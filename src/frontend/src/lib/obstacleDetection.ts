/**
 * Obstacle detection algorithm for identifying objects on and beside the road
 */

export interface ObstacleInfo {
  id: string;
  position: { x: number; y: number };
  type: string;
  confidenceLevel: number;
  riskLevel: {
    level: "High" | "Moderate" | "Low";
    description: string;
  };
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  estimatedDistance?: number; // meters
}

export interface EmergencyCondition {
  id: string;
  type: string;
  description: string;
  severity: {
    level: "Critical" | "Warning" | "Info";
    urgency: string;
  };
}

export interface ObstacleDetectionResult {
  obstacles: ObstacleInfo[];
  emergencyConditions: EmergencyCondition[];
  visualizationUrl: string;
  visualizationData: Uint8Array;
}

/**
 * Compute Intersection-over-Union (IoU) between two bounding boxes.
 */
function computeIoU(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;

  const interX1 = Math.max(a.x, b.x);
  const interY1 = Math.max(a.y, b.y);
  const interX2 = Math.min(ax2, bx2);
  const interY2 = Math.min(ay2, by2);

  const interW = Math.max(0, interX2 - interX1);
  const interH = Math.max(0, interY2 - interY1);
  const interArea = interW * interH;

  const aArea = a.width * a.height;
  const bArea = b.width * b.height;
  const unionArea = aArea + bArea - interArea;

  return unionArea > 0 ? interArea / unionArea : 0;
}

/**
 * Check if two boxes are "nearby" using a proximity threshold.
 */
function areNearby(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  proximityFraction = 0.5,
): boolean {
  if (computeIoU(a, b) > 0) return true;

  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;

  const gapX = Math.max(0, Math.max(a.x, b.x) - Math.min(ax2, bx2));
  const gapY = Math.max(0, Math.max(a.y, b.y) - Math.min(ay2, by2));

  const diagA = Math.sqrt(a.width * a.width + a.height * a.height);
  const diagB = Math.sqrt(b.width * b.width + b.height * b.height);
  const avgDiag = (diagA + diagB) / 2;

  const gap = Math.sqrt(gapX * gapX + gapY * gapY);
  return gap < avgDiag * proximityFraction;
}

/**
 * Merge two bounding boxes into the union bounding box.
 */
function mergeBoxes(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const x1 = Math.min(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.width, b.x + b.width);
  const y2 = Math.max(a.y + a.height, b.y + b.height);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

/**
 * Apply Non-Maximum Suppression to remove overlapping bounding boxes.
 */
function applyNMS(
  obstacles: ObstacleInfo[],
  iouThreshold = 0.45,
): ObstacleInfo[] {
  if (obstacles.length === 0) return [];

  const sorted = [...obstacles].sort(
    (a, b) => b.confidenceLevel - a.confidenceLevel,
  );

  const kept: ObstacleInfo[] = [];
  const suppressed = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue;
    kept.push(sorted[i]);
    for (let j = i + 1; j < sorted.length; j++) {
      if (suppressed.has(j)) continue;
      const iou = computeIoU(sorted[i].boundingBox, sorted[j].boundingBox);
      if (iou > iouThreshold) {
        suppressed.add(j);
      }
    }
  }

  return kept;
}

/**
 * Merge nearby boxes of the same type into a single box.
 */
function mergeNearbyBoxes(obstacles: ObstacleInfo[]): ObstacleInfo[] {
  if (obstacles.length <= 1) return obstacles;

  const n = obstacles.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(startIdx: number): number {
    let i = startIdx;
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }

  function union(i: number, j: number) {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[ri] = rj;
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (obstacles[i].type === obstacles[j].type) {
        if (areNearby(obstacles[i].boundingBox, obstacles[j].boundingBox)) {
          union(i, j);
        }
      }
    }
  }

  const clusters = new Map<number, ObstacleInfo[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(obstacles[i]);
  }

  const merged: ObstacleInfo[] = [];
  for (const group of clusters.values()) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }

    let box = group[0].boundingBox;
    for (let k = 1; k < group.length; k++) {
      box = mergeBoxes(box, group[k].boundingBox);
    }

    const best = group.reduce((a, b) =>
      a.confidenceLevel >= b.confidenceLevel ? a : b,
    );

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    merged.push({
      ...best,
      id: best.id,
      position: { x: centerX / box.width, y: centerY / box.height },
      boundingBox: box,
    });
  }

  return merged;
}

/**
 * Estimate distance in meters from vertical position in image.
 */
function estimateDistance(boxBottomY: number, imageHeight: number): number {
  const normalizedY = boxBottomY / imageHeight;

  if (normalizedY >= 0.85) return 2.0;
  if (normalizedY >= 0.75) return 4.0;
  if (normalizedY >= 0.7) return 5.5;
  if (normalizedY >= 0.6) return 9.0;
  if (normalizedY >= 0.5) return 14.0;
  if (normalizedY >= 0.4) return 22.0;
  if (normalizedY >= 0.3) return 35.0;
  return 60.0;
}

/**
 * Detect wet or oily road surface patches.
 *
 * Scans ALL pixels in the lower 70% of the image so oil-spill patches
 * (excluded from the road mask) are captured.
 *
 * Uses absolute pixel count as primary threshold — if ≥ 150 specifically
 * oily pixels are found, detection is reported. Focused oil criteria:
 *   isBrownish      : classic crude-oil colour
 *   isRainbowSheen  : iridescent oil on wet road
 *   isDarkOilPatch  : aged dark oil
 *
 * Returns a single ObstacleInfo bounding the detected region, labelled
 * "Floating Oil" when oil dominates, "Wet/Oily Surface" otherwise.
 */
function detectWetOilySurface(
  data: Uint8ClampedArray,
  roadMask: Uint8Array,
  width: number,
  height: number,
): ObstacleInfo | null {
  // Scan lower 70% of image
  const startY = Math.floor(height * 0.3);

  let wetPixelCount = 0;
  let oilyPixelCount = 0;
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;

  // Collect mean brightness of road-masked pixels for specular detection
  let roadBrightnessSum = 0;
  let roadPixelCount = 0;
  for (let y = startY; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (roadMask[idx] === 0) continue;
      const px = idx * 4;
      roadBrightnessSum += (data[px] + data[px + 1] + data[px + 2]) / 3;
      roadPixelCount++;
    }
  }
  const meanBrightness =
    roadPixelCount > 0 ? roadBrightnessSum / roadPixelCount : 100;

  // Scan ALL pixels in the lower 70%
  for (let y = startY; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const px = idx * 4;
      const r = data[px];
      const g = data[px + 1];
      const b = data[px + 2];
      const brightness = (r + g + b) / 3;
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const saturation = maxC > 0 ? (maxC - minC) / maxC : 0;

      // Wet surface: specular highlight on a road pixel
      const isSpecular =
        roadMask[idx] !== 0 &&
        brightness > meanBrightness + 40 &&
        brightness > 100;

      // Classic crude-oil: brownish/reddish dark patch
      const isBrownish =
        brightness < 130 && r > g + 15 && r > b + 15 && saturation > 0.12;

      // Iridescent oil sheen on wet road
      const isRainbowSheen =
        saturation > 0.2 && brightness > 15 && brightness < 120;

      // Aged/dark oil patch with colour variation
      const isDarkOilPatch = brightness < 80 && maxC - minC > 25;

      const isOily = isBrownish || isRainbowSheen || isDarkOilPatch;

      if (isSpecular || isOily) {
        if (isSpecular) wetPixelCount++;
        if (isOily) oilyPixelCount++;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const signalPixels = wetPixelCount + oilyPixelCount;

  // Use absolute pixel count as primary threshold — ratio was too restrictive
  if (signalPixels < 150) return null;
  if (maxX <= minX || maxY <= minY) return null;

  const boxW = maxX - minX;
  const boxH = maxY - minY;

  // Lower minimum bounding box area
  if (boxW * boxH < 500) return null;

  // "Floating Oil" when oil-type pixels dominate; otherwise "Wet/Oily Surface"
  const label =
    oilyPixelCount > wetPixelCount ? "Floating Oil" : "Wet/Oily Surface";

  // Confidence based on signal strength, capped at 0.92
  const totalScanPixels = (height - startY) * width;
  const signalRatio = signalPixels / Math.max(1, totalScanPixels);
  const confidence = Math.min(0.92, 0.65 + signalRatio * 4);

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const boxBottom = maxY;
  const dist = estimateDistance(boxBottom, height);
  const isClose = boxBottom > height * 0.7 || dist < 5;

  return {
    id: `wet_oily_${Date.now()}`,
    position: { x: centerX / width, y: centerY / height },
    type: label,
    confidenceLevel: confidence,
    riskLevel: isClose
      ? {
          level: "High",
          description:
            "Slippery road surface detected — reduce speed immediately",
        }
      : {
          level: "Moderate",
          description: "Wet or oily road surface ahead — proceed with caution",
        },
    boundingBox: { x: minX, y: minY, width: boxW, height: boxH },
    estimatedDistance: dist,
  };
}
/**
 * Detect obstacles in the image/video frame
 */
export async function detectObstacles(
  imageUrl: string,
  roadMask: Uint8Array,
  width: number,
  height: number,
): Promise<ObstacleDetectionResult> {
  const img = await loadImage(imageUrl);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const obstacles = detectObstaclesInFrame(data, roadMask, width, height);
  const emergencyConditions = assessEmergencyConditions(
    obstacles,
    width,
    height,
  );

  const visualizationCanvas = createObstacleVisualization(
    img,
    obstacles,
    width,
    height,
  );
  const visualizationUrl = visualizationCanvas.toDataURL("image/jpeg", 0.9);
  const visualizationData = await imageUrlToBytes(visualizationUrl);

  return {
    obstacles,
    emergencyConditions,
    visualizationUrl,
    visualizationData,
  };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Detect obstacles using color segmentation and position analysis.
 */
function detectObstaclesInFrame(
  data: Uint8ClampedArray,
  roadMask: Uint8Array,
  width: number,
  height: number,
): ObstacleInfo[] {
  const rawObstacles: ObstacleInfo[] = [];
  const visited = new Uint8Array(width * height);
  const minObstacleSize = 200;

  const roadStartY = Math.floor(height * 0.3);

  for (let y = roadStartY; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      if (visited[idx]) continue;

      const pixelIdx = idx * 4;
      const r = data[pixelIdx];
      const g = data[pixelIdx + 1];
      const b = data[pixelIdx + 2];

      const brightness = (r + g + b) / 3;
      const saturation = calculateSaturation(r, g, b);
      const isRoad = roadMask[idx] > 0;

      const isObstacle =
        (saturation > 0.25 && brightness > 40) ||
        (brightness > 180 && !isRoad) ||
        (brightness < 40 && !isRoad && y > height * 0.6);

      if (isObstacle) {
        const region = floodFill(data, visited, x, y, width, height, r, g, b);

        if (region.pixels.length >= minObstacleSize) {
          const obstacle = analyzeObstacleRegion(
            region,
            roadMask,
            width,
            height,
            rawObstacles.length,
          );
          if (obstacle && obstacle.confidenceLevel >= 0.6) {
            rawObstacles.push(obstacle);
          }
        }
      }
    }
  }

  // Step 1: NMS
  const afterNMS = applyNMS(rawObstacles);

  // Step 2: Merge nearby same-type boxes
  const merged = mergeNearbyBoxes(afterNMS).slice(0, 10);

  // Step 3: Detect wet/oily / floating oil surface
  const wetOily = detectWetOilySurface(data, roadMask, width, height);

  // Combine: surface detection appended as a separate labelled obstacle
  const allObstacles: ObstacleInfo[] = [
    ...merged,
    ...(wetOily ? [wetOily] : []),
  ];

  return allObstacles.map((obs) => ({
    ...obs,
    estimatedDistance:
      obs.estimatedDistance ??
      estimateDistance(obs.boundingBox.y + obs.boundingBox.height, height),
  }));
}

function calculateSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max > 0 ? (max - min) / max : 0;
}

interface Region {
  pixels: Array<{ x: number; y: number }>;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  avgR: number;
  avgG: number;
  avgB: number;
}

function floodFill(
  data: Uint8ClampedArray,
  visited: Uint8Array,
  startX: number,
  startY: number,
  width: number,
  height: number,
  seedR: number,
  seedG: number,
  seedB: number,
): Region {
  const pixels: Array<{ x: number; y: number }> = [];
  const stack: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
  const colorThreshold = 40;

  let minX = startX;
  let maxX = startX;
  let minY = startY;
  let maxY = startY;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  while (stack.length > 0 && pixels.length < 5000) {
    const { x, y } = stack.pop()!;

    if (x < 0 || x >= width || y < 0 || y >= height) continue;

    const idx = y * width + x;
    if (visited[idx]) continue;

    const pixelIdx = idx * 4;
    const r = data[pixelIdx];
    const g = data[pixelIdx + 1];
    const b = data[pixelIdx + 2];

    const colorDiff =
      Math.abs(r - seedR) + Math.abs(g - seedG) + Math.abs(b - seedB);
    if (colorDiff > colorThreshold) continue;

    visited[idx] = 1;
    pixels.push({ x, y });

    sumR += r;
    sumG += g;
    sumB += b;

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);

    stack.push({ x: x + 1, y });
    stack.push({ x: x - 1, y });
    stack.push({ x, y: y + 1 });
    stack.push({ x, y: y - 1 });
  }

  return {
    pixels,
    minX,
    maxX,
    minY,
    maxY,
    avgR: sumR / pixels.length,
    avgG: sumG / pixels.length,
    avgB: sumB / pixels.length,
  };
}

function analyzeObstacleRegion(
  region: Region,
  roadMask: Uint8Array,
  width: number,
  height: number,
  index: number,
): ObstacleInfo | null {
  const { pixels, minX, maxX, minY, maxY, avgR, avgG, avgB } = region;

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  let onRoadPixels = 0;
  for (const { x, y } of pixels) {
    const idx = y * width + x;
    if (roadMask[idx] > 0) {
      onRoadPixels++;
    }
  }

  const onRoadRatio = onRoadPixels / pixels.length;
  const isOnRoad = onRoadRatio > 0.3;

  const obstacleType = classifyObstacle(
    avgR,
    avgG,
    avgB,
    maxY - minY,
    maxX - minX,
  );

  const riskLevel = determineRiskLevel(isOnRoad, centerY, height, maxY - minY);
  const confidence = Math.min(0.95, 0.6 + (pixels.length / 1000) * 0.35);

  return {
    id: `obstacle_${Date.now()}_${index}`,
    position: { x: centerX / width, y: centerY / height },
    type: obstacleType,
    confidenceLevel: confidence,
    riskLevel,
    boundingBox: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    },
  };
}

function classifyObstacle(
  r: number,
  g: number,
  b: number,
  height: number,
  width: number,
): string {
  try {
    const brightness = (r + g + b) / 3;
    const aspectRatio = height / width;

    if (aspectRatio < 1.2 && height > 30) {
      return "Vehicle";
    }

    if (aspectRatio > 1.5 && aspectRatio < 3 && brightness > 60) {
      return "Pedestrian";
    }

    return "Debris/Obstacle";
  } catch (error) {
    console.error("[ObstacleDetection] Classification error:", error);
    return "Unknown";
  }
}

function determineRiskLevel(
  isOnRoad: boolean,
  centerY: number,
  imageHeight: number,
  _objectHeight: number,
): { level: "High" | "Moderate" | "Low"; description: string } {
  const proximityRatio = centerY / imageHeight;
  const isClose = proximityRatio > 0.7;

  if (isOnRoad && isClose) {
    return {
      level: "High",
      description:
        "Obstacle directly in vehicle path - immediate attention required",
    };
  }

  if (isOnRoad && !isClose) {
    return {
      level: "Moderate",
      description: "Obstacle on road ahead - monitor closely",
    };
  }

  if (!isOnRoad && isClose) {
    return {
      level: "Moderate",
      description: "Object near roadside - maintain awareness",
    };
  }

  return {
    level: "Low",
    description: "Object detected at safe distance",
  };
}

function assessEmergencyConditions(
  obstacles: ObstacleInfo[],
  _width: number,
  _height: number,
): EmergencyCondition[] {
  const emergencies: EmergencyCondition[] = [];

  const highRiskObstacles = obstacles.filter(
    (o) => o.riskLevel.level === "High",
  );

  if (highRiskObstacles.length > 0) {
    emergencies.push({
      id: `emergency_${Date.now()}_collision`,
      type: "Collision Risk",
      description: `${highRiskObstacles.length} obstacle(s) detected in vehicle path`,
      severity: {
        level: "Critical",
        urgency: "Immediate action required",
      },
    });
  }

  const moderateRiskObstacles = obstacles.filter(
    (o) => o.riskLevel.level === "Moderate",
  );
  if (moderateRiskObstacles.length >= 3) {
    emergencies.push({
      id: `emergency_${Date.now()}_blocked`,
      type: "Road Obstruction",
      description: "Multiple obstacles detected - road may be blocked",
      severity: {
        level: "Warning",
        urgency: "Reduce speed and proceed with caution",
      },
    });
  }

  const pedestrians = obstacles.filter(
    (o) => o.type === "Pedestrian" && o.riskLevel.level !== "Low",
  );
  if (pedestrians.length > 0) {
    emergencies.push({
      id: `emergency_${Date.now()}_pedestrian`,
      type: "Pedestrian Alert",
      description: `${pedestrians.length} pedestrian(s) detected near road`,
      severity: {
        level: "Warning",
        urgency: "Exercise extreme caution",
      },
    });
  }

  // Floating oil / wet surface alert
  const surfaceHazards = obstacles.filter(
    (o) =>
      o.type === "Wet/Oily Surface" ||
      o.type === "Oily Surface" ||
      o.type === "Floating Oil",
  );
  if (surfaceHazards.length > 0) {
    const isOil = surfaceHazards.some((o) => o.type === "Floating Oil");
    emergencies.push({
      id: `emergency_${Date.now()}_wet`,
      type: isOil ? "Floating Oil Hazard" : "Slippery Surface",
      description: isOil
        ? "Floating oil detected on road — severe skid risk"
        : "Wet or oily road surface detected — reduced traction",
      severity: {
        level: "Warning",
        urgency: "Reduce speed and avoid sudden braking",
      },
    });
  }

  return emergencies;
}

/**
 * Draw a warning triangle (⚠) icon at the given position.
 */
function drawWarningTriangle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  const half = size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - half);
  ctx.lineTo(cx + half, cy + half);
  ctx.lineTo(cx - half, cy + half);
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 200, 0, 0.95)";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#000";
  ctx.font = `bold ${Math.floor(size * 0.45)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("!", cx, cy + half * 0.2);
  ctx.restore();
}

/**
 * Draw a stop-sign style octagon icon at the given position.
 */
function drawStopIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  const r = size / 2;
  const sides = 8;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI / sides) * (2 * i + 1) - Math.PI / 2;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(220, 38, 38, 0.95)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${Math.floor(size * 0.28)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("STOP", cx, cy);
  ctx.restore();
}

/**
 * Draw road zone color overlay (green=safe, yellow=caution, red=danger)
 */
function drawRoadZones(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const greenEnd = height * 0.4;
  const yellowEnd = height * 0.7;

  const greenGrad = ctx.createLinearGradient(0, 0, 0, greenEnd);
  greenGrad.addColorStop(0, "rgba(34, 197, 94, 0.0)");
  greenGrad.addColorStop(1, "rgba(34, 197, 94, 0.18)");
  ctx.fillStyle = greenGrad;
  ctx.fillRect(0, 0, width, greenEnd);

  const yellowGrad = ctx.createLinearGradient(0, greenEnd, 0, yellowEnd);
  yellowGrad.addColorStop(0, "rgba(251, 191, 36, 0.18)");
  yellowGrad.addColorStop(1, "rgba(251, 191, 36, 0.28)");
  ctx.fillStyle = yellowGrad;
  ctx.fillRect(0, greenEnd, width, yellowEnd - greenEnd);

  const redGrad = ctx.createLinearGradient(0, yellowEnd, 0, height);
  redGrad.addColorStop(0, "rgba(239, 68, 68, 0.22)");
  redGrad.addColorStop(1, "rgba(239, 68, 68, 0.38)");
  ctx.fillStyle = redGrad;
  ctx.fillRect(0, yellowEnd, width, height - yellowEnd);

  const labelFont = `bold ${Math.max(10, Math.floor(width * 0.022))}px Inter, sans-serif`;
  ctx.font = labelFont;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  const labelPad = width * 0.015;

  ctx.fillStyle = "rgba(34, 197, 94, 0.9)";
  ctx.fillText("SAFE", width - labelPad, labelPad);

  ctx.fillStyle = "rgba(251, 191, 36, 0.9)";
  ctx.fillText("CAUTION", width - labelPad, greenEnd + labelPad);

  ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
  ctx.fillText("DANGER", width - labelPad, yellowEnd + labelPad);
}

/**
 * Create obstacle visualization:
 * - Road zone overlay
 * - Single bounding box per obstacle
 * - "Floating Oil" shown with orange dashed box + droplet icon
 * - "Wet/Oily Surface" shown with teal dashed box + droplet icon
 * - Warning icons for danger zone obstacles
 */
function createObstacleVisualization(
  img: HTMLImageElement,
  obstacles: ObstacleInfo[],
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: true })!;

  ctx.drawImage(img, 0, 0, width, height);
  drawRoadZones(ctx, width, height);

  const dangerThresholdY = height * 0.7;
  const dangerDistanceM = 5.0;

  const baseFontSize = Math.max(11, Math.floor(width * 0.028));
  const labelPadX = 8;
  const labelPadY = 5;
  const lineHeight = baseFontSize + 4;

  for (const obstacle of obstacles) {
    const { boundingBox, type, confidenceLevel } = obstacle;
    const boxBottom = boundingBox.y + boundingBox.height;
    const dist =
      obstacle.estimatedDistance ?? estimateDistance(boxBottom, height);

    const isDanger = boxBottom > dangerThresholdY || dist < dangerDistanceM;
    const isFloatingOil = type === "Floating Oil";
    const isWetOily =
      type === "Wet/Oily Surface" || type === "Oily Surface" || isFloatingOil;

    // ---- Bounding box ----
    let boxColor: string;
    let shadowColor: string;

    if (isFloatingOil) {
      // Orange dashed box — hazard on road surface
      boxColor = "#FF8C00";
      shadowColor = "rgba(255, 140, 0, 0.55)";
      ctx.setLineDash([8, 4]);
    } else if (isWetOily) {
      // Teal dashed box for generic wet/oily surface
      boxColor = "rgba(20, 184, 166, 0.95)";
      shadowColor = "rgba(20, 184, 166, 0.5)";
      ctx.setLineDash([8, 4]);
    } else if (isDanger) {
      boxColor = "rgba(239, 68, 68, 0.9)";
      shadowColor = "rgba(239, 68, 68, 0.5)";
      ctx.setLineDash([]);
    } else {
      boxColor = "rgba(59, 130, 246, 0.9)";
      shadowColor = "rgba(59, 130, 246, 0.5)";
      ctx.setLineDash([]);
    }

    ctx.strokeStyle = boxColor;
    ctx.lineWidth = Math.max(2, Math.floor(width * 0.004));
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 8;
    ctx.strokeRect(
      boundingBox.x,
      boundingBox.y,
      boundingBox.width,
      boundingBox.height,
    );
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);

    // ---- Labels ----
    // Prepend droplet emoji for oil/wet types
    const displayType = isWetOily ? `\u{1F4A7} ${type}` : type;
    const labelText = `${displayType} ${(confidenceLevel * 100).toFixed(0)}%`;
    const distText = isWetOily
      ? `Road Surface ~${dist.toFixed(1)}m`
      : `~${dist.toFixed(1)}m`;

    ctx.font = `bold ${baseFontSize}px Inter, sans-serif`;
    const labelW =
      Math.max(
        ctx.measureText(labelText).width,
        ctx.measureText(distText).width,
      ) +
      labelPadX * 2;
    const labelH = lineHeight * 2 + labelPadY * 2;

    const labelX = Math.min(boundingBox.x, width - labelW - 2);
    let labelY = boundingBox.y - labelH - 4;
    if (labelY < 0) labelY = boundingBox.y + boundingBox.height + 4;

    // Background pill colour
    let bgColor: string;
    if (isFloatingOil) {
      bgColor = "rgba(180, 83, 9, 0.88)"; // amber-800 — matches orange box
    } else if (isWetOily) {
      bgColor = "rgba(13, 148, 136, 0.88)"; // teal-600
    } else if (isDanger) {
      bgColor = "rgba(239, 68, 68, 0.85)";
    } else {
      bgColor = "rgba(30, 64, 175, 0.85)";
    }
    ctx.fillStyle = bgColor;
    roundRect(ctx, labelX, labelY, labelW, labelH, 4);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = `bold ${baseFontSize}px Inter, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(labelText, labelX + labelPadX, labelY + labelPadY);

    ctx.fillStyle = isFloatingOil
      ? "#fed7aa" // orange-200
      : isWetOily
        ? "#99f6e4" // teal-200
        : isDanger
          ? "#fde68a" // amber-200
          : "#93c5fd"; // blue-300
    ctx.font = `${baseFontSize - 1}px Inter, sans-serif`;
    ctx.fillText(distText, labelX + labelPadX, labelY + labelPadY + lineHeight);

    // ---- Wet/Oily / Floating Oil: draw droplet inside box ----
    if (isWetOily) {
      drawDropletIcon(
        ctx,
        boundingBox.x + boundingBox.width / 2,
        boundingBox.y + boundingBox.height / 2,
        Math.min(32, Math.floor(boundingBox.height * 0.25)),
        isFloatingOil,
      );
    }

    // ---- Warning icons for danger zone (non surface obstacles) ----
    if (isDanger && !isWetOily) {
      const iconSize = Math.max(18, Math.floor(width * 0.04));
      const iconY = labelY - iconSize - 6;
      const iconCenterY = Math.max(iconSize / 2 + 2, iconY + iconSize / 2);
      const boxCenterX = boundingBox.x + boundingBox.width / 2;

      drawWarningTriangle(
        ctx,
        boxCenterX - iconSize * 0.7,
        iconCenterY,
        iconSize,
      );
      drawStopIcon(ctx, boxCenterX + iconSize * 0.7, iconCenterY, iconSize);
    }
  }

  return canvas;
}

/**
 * Draw a water-droplet icon at the given centre position.
 * Orange fill for floating oil, teal for wet/oily.
 */
function drawDropletIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  isOil = false,
): void {
  if (size < 8) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.bezierCurveTo(
    cx + size * 0.6,
    cy - size * 0.3,
    cx + size * 0.8,
    cy + size * 0.3,
    cx,
    cy + size * 0.9,
  );
  ctx.bezierCurveTo(
    cx - size * 0.8,
    cy + size * 0.3,
    cx - size * 0.6,
    cy - size * 0.3,
    cx,
    cy - size,
  );
  ctx.closePath();
  ctx.fillStyle = isOil ? "rgba(255, 140, 0, 0.75)" : "rgba(20, 184, 166, 0.7)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/**
 * Helper: draw a rounded rectangle path.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function imageUrlToBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
