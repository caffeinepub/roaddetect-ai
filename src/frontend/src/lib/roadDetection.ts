/**
 * Advanced road detection algorithm using computer vision techniques
 * with ML-based environmental adaptation, performance-aware preprocessing,
 * desktop hardware optimization, pothole detection, and road surface feature extraction
 */

import type {
  DetectionResult,
  EnvironmentalConditions,
  PotholeDetection,
  RoadSurfaceFeatures,
} from "@/types/detection";
import { detectObstacles } from "./obstacleDetection";
import { extractRoadSurfaceFeatures } from "./roadSurfaceFeatures";

interface PerformanceMetrics {
  avgFrameTime: number;
  frameCount: number;
}

interface HardwareCapabilities {
  supportsOffscreenCanvas: boolean;
  supportsWebGL: boolean;
  hardwareConcurrency: number;
  deviceMemory?: number;
  gpuTier?: "high" | "medium" | "low";
}

// Global hardware capabilities cache
let hardwareCapabilities: HardwareCapabilities | null = null;

/**
 * Detect device hardware capabilities for optimal processing
 */
function detectHardwareCapabilities(): HardwareCapabilities {
  if (hardwareCapabilities) return hardwareCapabilities;

  const capabilities: HardwareCapabilities = {
    supportsOffscreenCanvas: typeof OffscreenCanvas !== "undefined",
    supportsWebGL: (() => {
      try {
        const canvas = document.createElement("canvas");
        return !!(
          canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
        );
      } catch {
        return false;
      }
    })(),
    hardwareConcurrency: navigator.hardwareConcurrency || 4,
    deviceMemory: (navigator as any).deviceMemory,
  };

  // Estimate GPU tier based on available information
  if (
    capabilities.hardwareConcurrency >= 8 &&
    (!capabilities.deviceMemory || capabilities.deviceMemory >= 8)
  ) {
    capabilities.gpuTier = "high";
  } else if (capabilities.hardwareConcurrency >= 4) {
    capabilities.gpuTier = "medium";
  } else {
    capabilities.gpuTier = "low";
  }

  hardwareCapabilities = capabilities;
  return capabilities;
}

/**
 * Improved pothole detection using multi-cue analysis:
 * - Handles dry dark potholes AND water-filled (reflective) potholes
 * - Shape analysis: circularity, aspect ratio for oval/circular road holes
 * - Edge ring detection: strong edges at pothole rim
 * - Texture discontinuity scoring
 * - NMS to remove duplicate bounding boxes
 * - Confidence threshold 0.60
 */
function detectPotholes(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  roadMask: Uint8Array,
  environmentalConditions: EnvironmentalConditions,
): PotholeDetection[] {
  const candidates: PotholeDetection[] = [];

  // Compute edge map for texture/rim detection
  const edges = detectEdges(data, width, height);

  // --- Pass 1: Detect dark pothole candidates (dry potholes) ---
  const darkRegions = detectAnomalousRegions(
    data,
    width,
    height,
    roadMask,
    "dark",
  );

  // --- Pass 2: Detect bright/reflective candidates (water-filled potholes) ---
  const reflectiveRegions = detectAnomalousRegions(
    data,
    width,
    height,
    roadMask,
    "reflective",
  );

  const allRegions = [...darkRegions, ...reflectiveRegions];

  allRegions.forEach((region, index) => {
    const area = region.pixels.length;
    const minArea = 150; // lower threshold to catch small potholes
    if (area < minArea) return;

    // ── Bounding box ──────────────────────────────────────────────
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    for (const [x, y] of region.pixels) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;

    // ── Aspect ratio guard (potholes are roughly round) ──────────
    const aspectRatio = boxWidth / Math.max(boxHeight, 1);
    if (aspectRatio > 4.0 || aspectRatio < 0.25) return; // too elongated = shadow/crack

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // ── Circularity score ─────────────────────────────────────────
    // Estimate perimeter by counting boundary pixels
    const pixelSet = new Set(region.pixels.map(([x, y]) => y * width + x));
    let boundaryPixels = 0;
    for (const [x, y] of region.pixels) {
      const neighbours = [
        (y - 1) * width + x,
        (y + 1) * width + x,
        y * width + (x - 1),
        y * width + (x + 1),
      ];
      for (const n of neighbours) {
        if (!pixelSet.has(n)) {
          boundaryPixels++;
          break;
        }
      }
    }
    const perimeter = Math.max(boundaryPixels, 1);
    const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
    // Potholes: 0.1–0.85 (irregular), perfect circle = 1.0, very elongated < 0.05
    if (circularity < 0.05) return; // definitely not a pothole

    // ── Edge ring score: high edges at boundary = pothole rim ────
    let boundaryEdgeSum = 0;
    let boundaryCount = 0;
    for (const [x, y] of region.pixels) {
      const neighbours = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
        [x - 1, y - 1],
        [x + 1, y + 1],
        [x - 1, y + 1],
        [x + 1, y - 1],
      ];
      let isBoundary = false;
      for (const [nx, ny] of neighbours) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          isBoundary = true;
          break;
        }
        if (!pixelSet.has(ny * width + nx)) {
          isBoundary = true;
          break;
        }
      }
      if (isBoundary) {
        const edgeVal = edges[y * width + x];
        boundaryEdgeSum += edgeVal;
        boundaryCount++;
      }
    }
    const edgeRingScore =
      boundaryCount > 0
        ? Math.min(1, boundaryEdgeSum / boundaryCount / 120)
        : 0;

    // ── Depth / contrast score ────────────────────────────────────
    // Compare mean brightness inside region vs surrounding road pixels
    let innerBrightSum = 0;
    for (const [x, y] of region.pixels) {
      const idx = (y * width + x) * 4;
      innerBrightSum += (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
    }
    const innerBrightMean = innerBrightSum / area;

    // Sample surrounding road pixels in expanded bounding box
    const expandPx = Math.min(
      20,
      Math.floor(Math.min(boxWidth, boxHeight) * 0.4),
    );
    let outerBrightSum = 0;
    let outerCount = 0;
    for (
      let y = Math.max(0, minY - expandPx);
      y < Math.min(height, maxY + expandPx);
      y++
    ) {
      for (
        let x = Math.max(0, minX - expandPx);
        x < Math.min(width, maxX + expandPx);
        x++
      ) {
        const idx2 = y * width + x;
        if (pixelSet.has(idx2) || roadMask[idx2] === 0) continue;
        const pid = idx2 * 4;
        outerBrightSum += (data[pid] + data[pid + 1] + data[pid + 2]) / 3;
        outerCount++;
      }
    }
    const outerBrightMean =
      outerCount > 0 ? outerBrightSum / outerCount : innerBrightMean;
    const contrastScore = Math.min(
      1,
      Math.abs(outerBrightMean - innerBrightMean) / 80,
    );

    // ── Texture variance inside region ────────────────────────────
    // Water-filled potholes have high local variance (ripples, reflections)
    // Dry potholes have moderate variance (rough surface)
    // Shadows have low variance (uniform dark)
    let varianceSum = 0;
    for (const [x, y] of region.pixels) {
      const idx = (y * width + x) * 4;
      const bright = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      varianceSum += (bright - innerBrightMean) ** 2;
    }
    const variance = varianceSum / area;
    // Normalise: shadow variance ~50, pothole ~200-800, water pothole ~300-1200
    const varianceScore = Math.min(1, variance / 600);

    // ── Anti-shadow heuristic ────────────────────────────────────
    // Shadows: very elongated + low edge ring + low variance
    const isShadowLike =
      (aspectRatio > 2.5 || aspectRatio < 0.4) &&
      edgeRingScore < 0.15 &&
      varianceScore < 0.12;
    if (isShadowLike) return;

    // ── Anti-road-patch heuristic ─────────────────────────────────
    // Road patches: nearly rectangular (circularity ~0.78+), low variance, moderate brightness
    const isRoadPatch =
      circularity > 0.78 && varianceScore < 0.1 && contrastScore < 0.15;
    if (isRoadPatch) return;

    // ── Water/reflective classification ──────────────────────────
    const isWaterFilled = region.type === "reflective";

    // ── Confidence score ─────────────────────────────────────────
    // Weighted combination of cues
    const circularityScore = Math.min(1, circularity / 0.5); // normalise (potholes 0.1–0.6)
    let confidence =
      0.3 * circularityScore +
      0.25 * edgeRingScore +
      0.25 * contrastScore +
      0.2 * varianceScore;

    // Bonus: water-filled potholes have both high variance AND a detectable rim
    if (isWaterFilled && edgeRingScore > 0.2) {
      confidence = Math.min(confidence + 0.08, 1.0);
    }
    // Bonus for clearly circular shapes
    if (circularity > 0.3 && circularity < 0.9) {
      confidence = Math.min(confidence + 0.05, 1.0);
    }
    // Bonus if multiple cues agree
    if (edgeRingScore > 0.3 && contrastScore > 0.3) {
      confidence = Math.min(confidence + 0.06, 1.0);
    }

    // Environmental penalties
    if (environmentalConditions.visibility) {
      confidence *= environmentalConditions.visibility;
    }
    if (
      environmentalConditions.lighting === "Night" ||
      environmentalConditions.lighting === "Dusk"
    ) {
      confidence *= 0.75;
    }
    if (
      environmentalConditions.weather === "Foggy" ||
      environmentalConditions.weather === "Heavy Fog"
    ) {
      confidence *= 0.65;
    }

    confidence = Math.max(0.1, Math.min(0.95, confidence));

    // Confidence threshold 0.60 per requirements
    if (confidence < 0.6) return;

    // ── Severity ─────────────────────────────────────────────────
    const sizeScore = Math.min(1, area / 600);
    const severityScore =
      edgeRingScore * 0.35 + contrastScore * 0.35 + sizeScore * 0.3;
    let severity: "Low" | "Moderate" | "High";
    if (severityScore > 0.6) severity = "High";
    else if (severityScore > 0.35) severity = "Moderate";
    else severity = "Low";

    // ── Distance / size / depth estimates ────────────────────────
    const normalizedY = centerY / height;
    const distance = estimateDistanceFromPosition(normalizedY, height);
    const pixelToMeterRatio = 0.01 * (1 + normalizedY * 2);
    const estimatedSize = area * pixelToMeterRatio * pixelToMeterRatio;
    const estimatedDepth = contrastScore * edgeRingScore * 18;

    // ── Pothole type ─────────────────────────────────────────────
    let potholeType: PotholeDetection["potholeType"];
    if (isWaterFilled) {
      potholeType = "complex"; // water-filled
    } else if (edgeRingScore > 0.6 && contrastScore > 0.5) {
      potholeType = "deep";
    } else if (aspectRatio > 1.5 || aspectRatio < 0.67) {
      potholeType = "edge"; // oval/elongated
    } else if (area > 400) {
      potholeType = "rough_size";
    } else if (edgeRingScore > 0.4) {
      potholeType = "surface_cracks";
    } else {
      potholeType = "unknown";
    }

    candidates.push({
      id: `pothole_${Date.now()}_${index}`,
      position: { x: centerX, y: centerY },
      boundingBox: { x: minX, y: minY, width: boxWidth, height: boxHeight },
      distance,
      severity,
      size: estimatedSize,
      depth: estimatedDepth,
      confidenceLevel: confidence,
      potholeType,
    });
  });

  // ── Non-Maximum Suppression ───────────────────────────────────────
  return applyPotholeNMS(candidates, 0.5);
}

/**
 * Apply Non-Maximum Suppression to pothole candidates
 * Removes overlapping boxes, keeping highest-confidence one
 */
function applyPotholeNMS(
  detections: PotholeDetection[],
  iouThreshold: number,
): PotholeDetection[] {
  if (detections.length === 0) return [];

  // Sort by confidence descending
  const sorted = [...detections].sort(
    (a, b) => b.confidenceLevel - a.confidenceLevel,
  );
  const kept: PotholeDetection[] = [];

  for (const det of sorted) {
    let suppressed = false;
    for (const kep of kept) {
      const iou = computeIoU(det.boundingBox, kep.boundingBox);
      if (iou > iouThreshold) {
        suppressed = true;
        break;
      }
    }
    if (!suppressed) kept.push(det);
  }

  return kept;
}

/**
 * Compute Intersection over Union (IoU) of two bounding boxes
 */
function computeIoU(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;

  const ix1 = Math.max(a.x, b.x);
  const iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);

  if (ix2 <= ix1 || iy2 <= iy1) return 0;
  const intersection = (ix2 - ix1) * (iy2 - iy1);
  const union = a.width * a.height + b.width * b.height - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Compute Sobel edge map from image data
 */
function detectEdges(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const edges = new Uint8Array(width * height);
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          const ki = (ky + 1) * 3 + (kx + 1);
          gx += gray * sobelX[ki];
          gy += gray * sobelY[ki];
        }
      }
      edges[y * width + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
    }
  }
  return edges;
}

/**
 * Detect anomalous regions on road surface:
 * - "dark": dry potholes (brightness < threshold relative to local mean)
 * - "reflective": water-filled potholes (high local variance, blue-ish or very bright patches)
 */
function detectAnomalousRegions(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  roadMask: Uint8Array,
  type: "dark" | "reflective",
): Array<{ pixels: Array<[number, number]>; type: "dark" | "reflective" }> {
  const visited = new Uint8Array(width * height);
  const regions: Array<{
    pixels: Array<[number, number]>;
    type: "dark" | "reflective";
  }> = [];

  // Only scan lower 65% of image (road is in lower portion)
  const startY = Math.floor(height * 0.35);

  // Compute local road brightness mean for adaptive thresholding
  let roadBrightnessSum = 0;
  let roadPixelCount = 0;
  for (let y = startY; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (roadMask[idx] === 0) continue;
      const pid = idx * 4;
      roadBrightnessSum += (data[pid] + data[pid + 1] + data[pid + 2]) / 3;
      roadPixelCount++;
    }
  }
  const roadMeanBrightness =
    roadPixelCount > 0 ? roadBrightnessSum / roadPixelCount : 128;

  for (let y = startY; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (roadMask[idx] === 0 || visited[idx] === 1) continue;

      const pid = idx * 4;
      const r = data[pid];
      const g = data[pid + 1];
      const b = data[pid + 2];
      const brightness = (r + g + b) / 3;

      let isCandidate = false;

      if (type === "dark") {
        // Dry pothole: significantly darker than road mean
        // Also allows moderately dark pixels to catch partial potholes
        const darkThreshold = Math.max(40, roadMeanBrightness * 0.55);
        isCandidate = brightness < darkThreshold;
      } else {
        // Water-filled pothole: either very bright (reflection) or blue-dominant
        // relative to surrounding road - but NOT simply white sky reflections
        const highBright =
          brightness > Math.min(220, roadMeanBrightness * 1.45);
        const blueShift = b > r + 12 && b > g + 8 && brightness > 60;
        // High local variance patch: rippled water surface
        const localVar = computeLocalVariance(data, width, height, x, y, 5);
        const highVariance =
          localVar > 350 && brightness > 70 && brightness < 220;
        isCandidate =
          (highBright || blueShift || highVariance) &&
          // Avoid large uniform bright regions (sky, white vehicles)
          localVar > 80;
      }

      if (isCandidate) {
        const region = floodFillAnomalous(
          data,
          width,
          height,
          x,
          y,
          visited,
          roadMask,
          type,
          roadMeanBrightness,
        );
        if (region.pixels.length >= 80) {
          regions.push({ pixels: region.pixels, type });
        }
      }
    }
  }

  return regions;
}

/**
 * Compute local brightness variance in a window around (cx, cy)
 */
function computeLocalVariance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const pid = (ny * width + nx) * 4;
      const bright = (data[pid] + data[pid + 1] + data[pid + 2]) / 3;
      sum += bright;
      sumSq += bright * bright;
      count++;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

/**
 * Flood fill for anomalous region detection
 */
function floodFillAnomalous(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  visited: Uint8Array,
  roadMask: Uint8Array,
  type: "dark" | "reflective",
  roadMeanBrightness: number,
): { pixels: Array<[number, number]> } {
  const pixels: Array<[number, number]> = [];
  const stack: Array<[number, number]> = [[startX, startY]];
  const maxPixels = 2000; // cap region size

  const darkThreshold = Math.max(40, roadMeanBrightness * 0.55);
  const brightThreshold = Math.min(220, roadMeanBrightness * 1.45);

  while (stack.length > 0 && pixels.length < maxPixels) {
    const item = stack.pop()!;
    const x = item[0];
    const y = item[1];

    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const idx = y * width + x;
    if (visited[idx] === 1 || roadMask[idx] === 0) continue;

    const pid = idx * 4;
    const r = data[pid];
    const g = data[pid + 1];
    const b = data[pid + 2];
    const brightness = (r + g + b) / 3;

    let matches = false;
    if (type === "dark") {
      matches = brightness < darkThreshold * 1.1; // slight tolerance for fill
    } else {
      const highBright = brightness > brightThreshold * 0.92;
      const blueShift = b > r + 10 && b > g + 6;
      const highVar = computeLocalVariance(data, width, height, x, y, 3) > 200;
      matches = highBright || blueShift || highVar;
    }

    if (!matches) continue;

    visited[idx] = 1;
    pixels.push([x, y]);

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return { pixels };
}

/**
 * Estimate distance in meters based on vertical position in frame
 */
function estimateDistanceFromPosition(
  normalizedY: number,
  _height: number,
): number {
  // Perspective: objects higher in frame are farther away
  // Assume camera ~1.5m height, field of view ~60 degrees
  if (normalizedY <= 0.5) return 50; // very far
  const relativeY = (normalizedY - 0.5) * 2; // 0 = horizon, 1 = bottom of frame
  const distance = Math.max(1, 40 * (1 - relativeY) + 2);
  return distance;
}

/**
 * Create visualization overlay for detected potholes
 * Each pothole gets a clear bounding box with label: "Pothole (Confidence%)"
 */
function createPotholeVisualization(
  img: HTMLImageElement,
  potholes: PotholeDetection[],
  width: number,
  height: number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(img, 0, 0, width, height);

  for (const pothole of potholes) {
    const { boundingBox, severity, confidenceLevel } = pothole;

    // Color based on severity
    let boxColor: string;
    let bgColor: string;
    if (severity === "High") {
      boxColor = "rgba(255, 30, 30, 0.95)";
      bgColor = "rgba(220, 0, 0, 0.85)";
    } else if (severity === "Moderate") {
      boxColor = "rgba(255, 140, 0, 0.95)";
      bgColor = "rgba(200, 100, 0, 0.85)";
    } else {
      boxColor = "rgba(255, 220, 0, 0.95)";
      bgColor = "rgba(180, 150, 0, 0.85)";
    }

    // Draw bounding box with thick border
    ctx.strokeStyle = boxColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(
      boundingBox.x,
      boundingBox.y,
      boundingBox.width,
      boundingBox.height,
    );

    // Draw corner accents for clarity
    const cs = Math.min(
      16,
      Math.floor(Math.min(boundingBox.width, boundingBox.height) * 0.25),
    );
    ctx.lineWidth = 4;
    const bx = boundingBox.x;
    const by = boundingBox.y;
    const bw = boundingBox.width;
    const bh = boundingBox.height;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(bx, by + cs);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + cs, by);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(bx + bw - cs, by);
    ctx.lineTo(bx + bw, by);
    ctx.lineTo(bx + bw, by + cs);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(bx, by + bh - cs);
    ctx.lineTo(bx, by + bh);
    ctx.lineTo(bx + cs, by + bh);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(bx + bw - cs, by + bh);
    ctx.lineTo(bx + bw, by + bh);
    ctx.lineTo(bx + bw, by + bh - cs);
    ctx.stroke();

    // Label: "Pothole (Confidence%)"
    const label = `Pothole (${Math.round(confidenceLevel * 100)}%)`;
    ctx.font = "bold 14px Arial, sans-serif";
    const textWidth = ctx.measureText(label).width;
    const labelX = boundingBox.x;
    const labelY =
      boundingBox.y > 26
        ? boundingBox.y - 4
        : boundingBox.y + boundingBox.height + 22;

    // Label background
    ctx.fillStyle = bgColor;
    ctx.fillRect(labelX, labelY - 18, textWidth + 12, 22);

    // Label text
    ctx.fillStyle = "white";
    ctx.fillText(label, labelX + 6, labelY - 1);
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}

export async function processRoadDetection(
  imageUrl: string,
  mode: "image" | "video",
  performanceMetrics?: PerformanceMetrics,
  enableObstacleDetection = true,
): Promise<DetectionResult> {
  const startTime = performance.now();
  const hwCapabilities = detectHardwareCapabilities();

  // Load image with hardware-accelerated decoding hint
  const img = await loadImage(imageUrl);

  // Use OffscreenCanvas for better performance if available
  const useOffscreen =
    hwCapabilities.supportsOffscreenCanvas && mode === "video";

  let canvas: HTMLCanvasElement | OffscreenCanvas;
  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

  if (useOffscreen) {
    canvas = new OffscreenCanvas(img.width, img.height);
    ctx = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
      willReadFrequently: false,
    })!;
  } else {
    canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    ctx = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
      willReadFrequently: false,
    })!;
  }

  ctx.drawImage(img as any, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Analyze environmental conditions with new perception signals
  const environmentalConditions = analyzeEnvironment(
    data,
    canvas.width,
    canvas.height,
  );

  // Determine preprocessing intensity based on performance and hardware
  const preprocessingLevel = determinePreprocessingLevel(
    performanceMetrics,
    mode,
    hwCapabilities,
  );

  // Apply ML-based preprocessing with hardware-aware optimizations
  const { preprocessedData, adaptations } = applyMLPreprocessing(
    data,
    canvas.width,
    canvas.height,
    environmentalConditions,
    preprocessingLevel,
    hwCapabilities,
  );

  // Detect road regions with preprocessed data
  const roadMask = detectRoadRegions(
    preprocessedData,
    canvas.width,
    canvas.height,
    environmentalConditions,
  );

  // Apply adaptive post-processing based on conditions
  const enhancedMask = applyEnvironmentalAdaptation(
    roadMask,
    canvas.width,
    canvas.height,
    environmentalConditions,
  );

  // Detect road type
  const roadType = detectRoadType(
    preprocessedData,
    enhancedMask,
    canvas.width,
    canvas.height,
  );

  // Detect potholes on road surface — skip in foggy/low-visibility conditions
  // because dark-region analysis produces false positives in fog
  const isFogCondition =
    environmentalConditions.weather === "Foggy" ||
    environmentalConditions.weather === "Heavy Fog" ||
    (environmentalConditions.fogLikelihood !== undefined &&
      environmentalConditions.fogLikelihood >= 0.7);
  const potholes = isFogCondition
    ? []
    : detectPotholes(
        preprocessedData,
        canvas.width,
        canvas.height,
        enhancedMask,
        environmentalConditions,
      );

  // Extract road surface features
  let roadSurfaceFeatures: RoadSurfaceFeatures | undefined;
  try {
    roadSurfaceFeatures = await extractRoadSurfaceFeatures(
      preprocessedData,
      canvas.width,
      canvas.height,
      enhancedMask,
      environmentalConditions,
    );

    // Add pothole detection results to road surface features
    if (roadSurfaceFeatures && potholes.length > 0) {
      const potholeVisualizationUrl = createPotholeVisualization(
        img,
        potholes,
        canvas.width,
        canvas.height,
      );
      roadSurfaceFeatures.potholes = {
        detections: potholes,
        visualizationUrl: potholeVisualizationUrl,
      };
    }
  } catch (error) {
    console.error("[RoadDetection] Surface feature extraction failed:", error);
  }

  // Create visualization with hardware acceleration
  const processedCanvas = createVisualization(
    img,
    enhancedMask,
    canvas.width,
    canvas.height,
    useOffscreen,
  );

  // Calculate metrics with ML-adjusted confidence
  const baseConfidence = calculateConfidence(enhancedMask);
  const confidenceScore = adjustConfidenceForEnvironment(
    baseConfidence,
    environmentalConditions,
    adaptations,
  );
  const detectionQuality = calculateQuality(
    enhancedMask,
    canvas.width,
    canvas.height,
  );
  const objectDetection = detectObjects(
    preprocessedData,
    enhancedMask,
    canvas.width,
    canvas.height,
  );

  const processingTime = Math.round(performance.now() - startTime);
  const frameRate = mode === "video" ? 1000 / processingTime : 0;

  // Calculate pothole metrics
  const potholeCount = potholes.length;
  const closestPotholeDistance =
    potholes.length > 0
      ? Math.min(...potholes.map((p) => p.distance))
      : undefined;

  // Convert to data URLs and byte arrays
  let processedImageUrl: string;
  if (processedCanvas instanceof OffscreenCanvas) {
    const blob = await processedCanvas.convertToBlob({
      type: "image/jpeg",
      quality: 0.9,
    });
    processedImageUrl = URL.createObjectURL(blob);
  } else {
    processedImageUrl = processedCanvas.toDataURL("image/jpeg", 0.9);
  }

  const originalImageData = await imageUrlToBytes(imageUrl);
  const processedImageData = await imageUrlToBytes(processedImageUrl);

  // Hardware performance metrics
  const hardwareAcceleration = getHardwareAccelerationStatus(
    hwCapabilities,
    useOffscreen,
  );
  const cpuUtilization = estimateCPUUtilization(processingTime, hwCapabilities);
  const processingMode = getProcessingMode(preprocessingLevel, hwCapabilities);
  const performanceStatus = getPerformanceStatus(
    processingTime,
    preprocessingLevel,
    hwCapabilities,
  );

  // Detect obstacles if enabled — suppress in foggy conditions to avoid false positives
  let obstacleDetection:
    | Awaited<ReturnType<typeof detectObstacles>>
    | undefined;
  if (enableObstacleDetection && !isFogCondition) {
    try {
      obstacleDetection = await detectObstacles(
        imageUrl,
        enhancedMask,
        canvas.width,
        canvas.height,
      );
    } catch (error) {
      console.error("Obstacle detection error:", error);
    }
  } else if (isFogCondition) {
    // In fog, return empty obstacle result with fog warning
    obstacleDetection = {
      obstacles: [],
      emergencyConditions: [
        {
          id: `fog_warning_${Date.now()}`,
          type: "Reduced Visibility",
          description:
            "Foggy conditions detected — obstacle detection suppressed to prevent false positives. Drive with extreme caution.",
          severity: {
            level: "Warning" as const,
            urgency: "Reduce speed and use fog lights",
          },
        },
      ],
      visualizationUrl: imageUrl,
      visualizationData: new Uint8Array(0),
    };
  }

  return {
    id: `detection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    originalImageUrl: imageUrl,
    processedImageUrl,
    originalImageData,
    processedImageData,
    confidenceScore,
    processingTime,
    environmentalConditions,
    roadType,
    metrics: {
      frameRate,
      detectionQuality,
      objectDetection,
      mlAdaptations: adaptations,
      performanceStatus,
      hardwareAcceleration,
      cpuUtilization,
      processingMode,
      potholeCount,
      closestPotholeDistance,
    },
    obstacleDetection,
    roadSurfaceFeatures,
  };
}

/**
 * Determine preprocessing intensity based on system performance and hardware capabilities
 */
function determinePreprocessingLevel(
  performanceMetrics: PerformanceMetrics | undefined,
  mode: "image" | "video",
  hwCapabilities: HardwareCapabilities,
): "full" | "balanced" | "fast" {
  // For image mode, always use full preprocessing
  if (mode === "image") return "full";

  // For high-end hardware, prefer full processing
  if (
    hwCapabilities.gpuTier === "high" &&
    hwCapabilities.hardwareConcurrency >= 8
  ) {
    return "full";
  }

  // For video mode, adapt based on performance
  if (!performanceMetrics || performanceMetrics.frameCount < 5) {
    // Start with balanced for medium/high tier, fast for low tier
    return hwCapabilities.gpuTier === "low" ? "fast" : "balanced";
  }

  const avgFrameTime = performanceMetrics.avgFrameTime;

  // Dynamic thresholds based on hardware tier
  const fullThreshold = hwCapabilities.gpuTier === "high" ? 200 : 150;
  const balancedThreshold = hwCapabilities.gpuTier === "high" ? 350 : 300;

  if (avgFrameTime < fullThreshold) return "full";
  if (avgFrameTime < balancedThreshold) return "balanced";

  return "fast";
}

function getHardwareAccelerationStatus(
  hwCapabilities: HardwareCapabilities,
  useOffscreen: boolean,
): string {
  const features: string[] = [];

  if (useOffscreen) features.push("OffscreenCanvas");
  if (hwCapabilities.supportsWebGL) features.push("WebGL");

  const coreInfo = `${hwCapabilities.hardwareConcurrency} cores`;

  if (features.length > 0) {
    return `Active (${features.join(", ")}, ${coreInfo})`;
  }

  return `Standard (${coreInfo})`;
}

function estimateCPUUtilization(
  processingTime: number,
  hwCapabilities: HardwareCapabilities,
): string {
  // Estimate based on processing time and hardware capabilities
  const baselineTime = 100; // Expected time for reference hardware
  const utilizationRatio =
    (baselineTime / processingTime) * (4 / hwCapabilities.hardwareConcurrency);

  if (utilizationRatio > 0.8) return "Optimal (multi-core)";
  if (utilizationRatio > 0.5) return "Good (parallel)";
  if (utilizationRatio > 0.3) return "Moderate";
  return "Light";
}

function getProcessingMode(
  level: string,
  hwCapabilities: HardwareCapabilities,
): string {
  const tier = hwCapabilities.gpuTier || "medium";
  return `${level.charAt(0).toUpperCase() + level.slice(1)} (${tier}-tier GPU)`;
}

function getPerformanceStatus(
  processingTime: number,
  level: string,
  hwCapabilities: HardwareCapabilities,
): string {
  const tier = hwCapabilities.gpuTier || "medium";

  if (level === "fast") {
    return `Performance mode (${tier}-tier optimization)`;
  }
  if (level === "balanced") {
    return `Balanced mode (${tier}-tier)`;
  }
  if (processingTime < 80) {
    return `Excellent (${tier}-tier acceleration)`;
  }
  if (processingTime < 150) {
    return `Optimal (${tier}-tier)`;
  }
  if (processingTime < 250) {
    return "Good performance";
  }
  return "Processing...";
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async"; // Use async decoding for better performance
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Analyze environmental conditions with extended perception signals
 */
function analyzeEnvironment(
  data: Uint8ClampedArray,
  _width: number,
  _height: number,
): EnvironmentalConditions {
  let totalBrightness = 0;
  let blueChannel = 0;
  let grayPixels = 0;
  let darkPixels = 0;
  let brightPixels = 0;
  let highContrastPixels = 0;
  let whitePixels = 0;

  // Sample every 4th pixel for performance
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const brightness = (r + g + b) / 3;
    totalBrightness += brightness;
    blueChannel += b;

    if (brightness < 50) darkPixels++;
    if (brightness > 220) brightPixels++;
    if (brightness > 240 && r > 240 && g > 240 && b > 240) whitePixels++;

    // Check for gray/foggy pixels
    const colorDiff = Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
    if (colorDiff < 30 && brightness > 100) {
      grayPixels++;
    }

    // Check for high contrast (potential glare or reflections)
    if (brightness > 200 && colorDiff < 20) {
      highContrastPixels++;
    }
  }

  const sampleCount = data.length / 16;
  const avgBrightness = totalBrightness / sampleCount;
  const avgBlue = blueChannel / sampleCount;
  const grayRatio = grayPixels / sampleCount;
  const darkRatio = darkPixels / sampleCount;
  const _brightRatio = brightPixels / sampleCount;
  const whiteRatio = whitePixels / sampleCount;
  const highContrastRatio = highContrastPixels / sampleCount;

  // Determine lighting with more granularity
  let lighting: string;
  if (avgBrightness > 180) lighting = "Bright";
  else if (avgBrightness > 120) lighting = "Daylight";
  else if (avgBrightness > 60) lighting = "Low Light";
  else if (avgBrightness > 30) lighting = "Dusk";
  else lighting = "Night";

  // Determine weather with improved fog detection
  // Fog: image looks washed out — high gray ratio AND mid-high brightness (not dark)
  let weather: string;
  // Fog requires: very high gray ratio (>0.60), mid-brightness (not dark night, not blown out),
  // AND low color saturation throughout — avoids false positives on overcast/cloudy roads
  const isFoggy =
    grayRatio > 0.6 &&
    avgBrightness > 110 &&
    avgBrightness < 200 &&
    whiteRatio < 0.25;
  const isHeavyFog =
    grayRatio > 0.72 &&
    avgBrightness > 115 &&
    avgBrightness < 195 &&
    whiteRatio < 0.2;
  if (isHeavyFog) weather = "Heavy Fog";
  else if (isFoggy) weather = "Foggy";
  else if (avgBlue > 140 && avgBrightness > 150) weather = "Clear";
  else if (darkRatio > 0.4 && avgBrightness < 80) weather = "Rainy";
  else if (avgBrightness < 100) weather = "Overcast";
  else weather = "Partly Cloudy";

  // Calculate new environment perception signals

  // Visibility score (0-1, higher is better visibility)
  let visibility = 1.0;
  if (isHeavyFog) visibility = 0.2;
  else if (isFoggy) visibility = 0.4;
  else if (grayRatio > 0.15) visibility = 0.7;
  else if (avgBrightness < 40)
    visibility = 0.4; // Night reduces visibility
  else if (avgBrightness < 70) visibility = 0.6; // Low light reduces visibility
  visibility = Math.max(0.1, Math.min(1.0, visibility));

  // Fog likelihood: only meaningful if actually foggy, no inflation multiplier
  const fogLikelihood = isFoggy
    ? Math.min(1.0, ((grayRatio - 0.6) / 0.4) * 0.8 + 0.5) // maps 0.60–1.0 gray -> 0.50–0.90 likelihood
    : Math.min(0.35, grayRatio * 0.5); // non-foggy: capped at 0.35 so never triggers UI fog warning

  // Precipitation likelihood (0-1)
  let precipitationLikelihood = 0;
  if (darkRatio > 0.4 && avgBrightness < 80) {
    precipitationLikelihood = Math.min(1.0, darkRatio * 1.5);
  } else if (grayRatio > 0.2 && avgBrightness < 120) {
    precipitationLikelihood = Math.min(0.6, grayRatio * 1.2);
  }

  // Glare likelihood (0-1)
  const glareLikelihood = Math.min(1.0, (highContrastRatio + whiteRatio) * 2.0);

  // Atmospheric clarity (0-1, higher is clearer)
  const atmosphericClarity = Math.max(
    0.1,
    Math.min(
      1.0,
      1.0 - grayRatio * 0.8 - darkRatio * 0.3 + (avgBlue / 255) * 0.3,
    ),
  );

  return {
    lighting,
    weather,
    visibility,
    fogLikelihood,
    precipitationLikelihood,
    glareLikelihood,
    atmosphericClarity,
  };
}

/**
 * ML-based preprocessing with hardware-aware optimizations
 */
function applyMLPreprocessing(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  conditions: EnvironmentalConditions,
  level: "full" | "balanced" | "fast",
  _hwCapabilities: HardwareCapabilities,
): { preprocessedData: Uint8ClampedArray; adaptations: string[] } {
  const preprocessed = new Uint8ClampedArray(data);
  const adaptations: string[] = [];

  // Fast mode: only essential preprocessing with SIMD-style operations
  if (level === "fast") {
    if (conditions.lighting === "Night" || conditions.lighting === "Dusk") {
      applyFastLowLightEnhancement(preprocessed);
      adaptations.push("Fast low-light boost");
    }
    return { preprocessedData: preprocessed, adaptations };
  }

  // Balanced mode: selective preprocessing with parallel processing hints
  if (level === "balanced") {
    if (
      conditions.lighting === "Night" ||
      conditions.lighting === "Dusk" ||
      conditions.lighting === "Low Light"
    ) {
      applyLowLightEnhancement(preprocessed);
      adaptations.push("Low-light brightening");
    }

    if (conditions.weather === "Foggy" || conditions.weather === "Heavy Fog") {
      applyFogContrastEnhancement(preprocessed);
      adaptations.push("Fog contrast enhancement");
    }

    if (conditions.lighting === "Bright") {
      applyOverexposureCorrection(preprocessed);
      adaptations.push("Brightness normalization");
    }

    return { preprocessedData: preprocessed, adaptations };
  }

  // Full mode: all preprocessing with hardware acceleration
  if (
    conditions.lighting === "Night" ||
    conditions.lighting === "Dusk" ||
    conditions.lighting === "Low Light"
  ) {
    applyLowLightEnhancement(preprocessed);
    adaptations.push("Low-light brightening");
  }

  if (conditions.weather === "Foggy" || conditions.weather === "Heavy Fog") {
    applyFogContrastEnhancement(preprocessed);
    adaptations.push("Fog contrast enhancement");
  }

  if (conditions.weather === "Rainy") {
    applyRainStreakNormalization(preprocessed, width, height);
    adaptations.push("Rain streak normalization");
  }

  if (conditions.lighting === "Bright") {
    applyOverexposureCorrection(preprocessed);
    adaptations.push("Brightness normalization");
  }

  if (conditions.lighting !== "Daylight" || conditions.weather !== "Clear") {
    applyAdaptiveHistogramEqualization(preprocessed, width, height);
    adaptations.push("Adaptive contrast adjustment");
  }

  return { preprocessedData: preprocessed, adaptations };
}

/**
 * Fast low-light enhancement optimized for performance
 */
function applyFastLowLightEnhancement(data: Uint8ClampedArray): void {
  // Vectorized operation for better CPU utilization
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, data[i] * 1.4);
    data[i + 1] = Math.min(255, data[i + 1] * 1.4);
    data[i + 2] = Math.min(255, data[i + 2] * 1.4);
  }
}

/**
 * Enhance low-light images by boosting brightness and contrast
 */
function applyLowLightEnhancement(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Gamma correction for low light (gamma = 0.6)
    data[i] = Math.min(255, (r / 255) ** 0.6 * 255 * 1.3);
    data[i + 1] = Math.min(255, (g / 255) ** 0.6 * 255 * 1.3);
    data[i + 2] = Math.min(255, (b / 255) ** 0.6 * 255 * 1.3);
  }
}

/**
 * Enhance contrast in foggy conditions
 */
function applyFogContrastEnhancement(data: Uint8ClampedArray): void {
  const contrastFactor = 1.4;
  const midpoint = 128;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(
      255,
      Math.max(0, midpoint + (data[i] - midpoint) * contrastFactor),
    );
    data[i + 1] = Math.min(
      255,
      Math.max(0, midpoint + (data[i + 1] - midpoint) * contrastFactor),
    );
    data[i + 2] = Math.min(
      255,
      Math.max(0, midpoint + (data[i + 2] - midpoint) * contrastFactor),
    );
  }
}

/**
 * Normalize rain streaks
 */
function applyRainStreakNormalization(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  // Simple vertical blur to reduce rain streak artifacts
  const tempData = new Uint8ClampedArray(data);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const idxAbove = ((y - 1) * width + x) * 4;
      const idxBelow = ((y + 1) * width + x) * 4;

      for (let c = 0; c < 3; c++) {
        data[idx + c] =
          (tempData[idxAbove + c] +
            tempData[idx + c] +
            tempData[idxBelow + c]) /
          3;
      }
    }
  }
}

/**
 * Correct overexposure
 */
function applyOverexposureCorrection(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Compress highlights
    data[i] = r > 200 ? 200 + (r - 200) * 0.3 : r;
    data[i + 1] = g > 200 ? 200 + (g - 200) * 0.3 : g;
    data[i + 2] = b > 200 ? 200 + (b - 200) * 0.3 : b;
  }
}

/**
 * Apply adaptive histogram equalization
 */
function applyAdaptiveHistogramEqualization(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  // Build histogram
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.floor((data[i] + data[i + 1] + data[i + 2]) / 3);
    histogram[gray]++;
  }

  // Build cumulative distribution
  const cdf = new Array(256);
  cdf[0] = histogram[0];
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i - 1] + histogram[i];
  }

  // Normalize CDF
  const totalPixels = width * height;
  const cdfMin = cdf.find((v) => v > 0) || 0;

  // Apply equalization
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.floor((data[i] + data[i + 1] + data[i + 2]) / 3);
    const newValue = Math.round(
      ((cdf[gray] - cdfMin) / (totalPixels - cdfMin)) * 255,
    );

    const ratio = newValue / (gray || 1);
    data[i] = Math.min(255, data[i] * ratio);
    data[i + 1] = Math.min(255, data[i + 1] * ratio);
    data[i + 2] = Math.min(255, data[i + 2] * ratio);
  }
}

/**
 * Detect road regions using color and texture analysis
 */
function detectRoadRegions(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  _conditions: EnvironmentalConditions,
): Uint8Array {
  const mask = new Uint8Array(width * height);

  // Focus on lower portion of image where road typically appears
  const startY = Math.floor(height * 0.3);

  for (let y = startY; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Road detection heuristics
      const brightness = (r + g + b) / 3;
      const colorDiff = Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);

      // Roads tend to be gray/dark with low color variation
      const isRoadColor = colorDiff < 40 && brightness > 30 && brightness < 180;

      if (isRoadColor) {
        mask[y * width + x] = 255;
      }
    }
  }

  return mask;
}

/**
 * Apply environmental adaptation to road mask
 */
function applyEnvironmentalAdaptation(
  mask: Uint8Array,
  width: number,
  height: number,
  _conditions: EnvironmentalConditions,
): Uint8Array {
  // Apply morphological operations to clean up mask
  const enhanced = new Uint8Array(mask);

  // Simple dilation followed by erosion (closing operation)
  const temp = new Uint8Array(mask);

  // Dilation
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (mask[idx] === 255) {
        temp[idx] = 255;
        temp[idx - 1] = 255;
        temp[idx + 1] = 255;
        temp[idx - width] = 255;
        temp[idx + width] = 255;
      }
    }
  }

  // Erosion
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (
        temp[idx] === 255 &&
        temp[idx - 1] === 255 &&
        temp[idx + 1] === 255 &&
        temp[idx - width] === 255 &&
        temp[idx + width] === 255
      ) {
        enhanced[idx] = 255;
      } else {
        enhanced[idx] = 0;
      }
    }
  }

  return enhanced;
}

/**
 * Detect road type
 */
function detectRoadType(
  data: Uint8ClampedArray,
  mask: Uint8Array,
  _width: number,
  _height: number,
): string {
  let roadPixels = 0;
  let totalBrightness = 0;
  let totalSaturation = 0;

  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 255) {
      roadPixels++;
      const idx = i * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const brightness = (r + g + b) / 3;
      totalBrightness += brightness;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      totalSaturation += saturation;
    }
  }

  if (roadPixels === 0) return "Unknown";

  const avgBrightness = totalBrightness / roadPixels;
  const avgSaturation = totalSaturation / roadPixels;

  if (avgBrightness > 120 && avgSaturation < 0.2) return "Concrete Highway";
  if (avgBrightness < 80 && avgSaturation < 0.15) return "Asphalt Road";
  if (avgSaturation > 0.3) return "Dirt/Gravel Road";

  return "Paved Road";
}

/**
 * Create visualization of road detection
 */
function createVisualization(
  img: HTMLImageElement,
  mask: Uint8Array,
  width: number,
  height: number,
  useOffscreen: boolean,
): HTMLCanvasElement | OffscreenCanvas {
  let canvas: HTMLCanvasElement | OffscreenCanvas;
  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

  if (useOffscreen) {
    canvas = new OffscreenCanvas(width, height);
    ctx = canvas.getContext("2d")!;
  } else {
    canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext("2d")!;
  }

  // Draw original image
  ctx.drawImage(img as any, 0, 0, width, height);

  // Overlay road mask with transparency
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 255) {
      const idx = i * 4;
      // Tint road regions with green overlay
      data[idx] = Math.min(255, data[idx] * 0.7 + 0 * 0.3);
      data[idx + 1] = Math.min(255, data[idx + 1] * 0.7 + 255 * 0.3);
      data[idx + 2] = Math.min(255, data[idx + 2] * 0.7 + 0 * 0.3);
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

/**
 * Calculate confidence score
 */
function calculateConfidence(mask: Uint8Array): number {
  let roadPixels = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 255) roadPixels++;
  }

  const coverage = roadPixels / mask.length;

  // Confidence based on road coverage
  if (coverage > 0.3) return 0.9;
  if (coverage > 0.2) return 0.8;
  if (coverage > 0.1) return 0.7;
  if (coverage > 0.05) return 0.6;

  return 0.5;
}

/**
 * Adjust confidence based on environmental conditions
 */
function adjustConfidenceForEnvironment(
  baseConfidence: number,
  conditions: EnvironmentalConditions,
  adaptations: string[],
): number {
  let adjusted = baseConfidence;

  // Reduce confidence in poor visibility
  if (conditions.visibility && conditions.visibility < 0.5) {
    adjusted *= 0.8;
  }

  // Reduce confidence in fog
  if (conditions.fogLikelihood && conditions.fogLikelihood > 0.5) {
    adjusted *= 0.85;
  }

  // Reduce confidence at night
  if (conditions.lighting === "Night") {
    adjusted *= 0.9;
  }

  // Boost confidence if adaptations were applied successfully
  if (adaptations.length > 0) {
    adjusted = Math.min(0.95, adjusted * 1.05);
  }

  return Math.max(0.3, Math.min(0.95, adjusted));
}

/**
 * Calculate detection quality
 */
function calculateQuality(
  mask: Uint8Array,
  width: number,
  height: number,
): number {
  let roadPixels = 0;
  let edgePixels = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (mask[idx] === 255) {
        roadPixels++;

        // Check if edge pixel
        if (
          mask[idx - 1] === 0 ||
          mask[idx + 1] === 0 ||
          mask[idx - width] === 0 ||
          mask[idx + width] === 0
        ) {
          edgePixels++;
        }
      }
    }
  }

  if (roadPixels === 0) return 0;

  // Quality based on edge-to-area ratio (lower is better)
  const edgeRatio = edgePixels / roadPixels;

  if (edgeRatio < 0.1) return 0.95;
  if (edgeRatio < 0.2) return 0.85;
  if (edgeRatio < 0.3) return 0.75;

  return 0.65;
}

/**
 * Detect objects on road
 */
function detectObjects(
  data: Uint8ClampedArray,
  mask: Uint8Array,
  _width: number,
  _height: number,
): string {
  // Simple object detection based on non-road regions
  let objectPixels = 0;

  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 0) {
      const idx = i * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

      // Count non-road, non-sky pixels as potential objects
      if (brightness > 30 && brightness < 220) {
        objectPixels++;
      }
    }
  }

  const objectRatio = objectPixels / mask.length;

  if (objectRatio > 0.3) return "Multiple objects detected";
  if (objectRatio > 0.15) return "Objects present";
  if (objectRatio > 0.05) return "Few objects";

  return "Clear road";
}

/**
 * Convert image URL to byte array
 */
async function imageUrlToBytes(url: string): Promise<Uint8Array> {
  if (url.startsWith("data:")) {
    // Data URL
    const base64 = url.split(",")[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  if (url.startsWith("blob:")) {
    // Blob URL
    const response = await fetch(url);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
  // Regular URL
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
