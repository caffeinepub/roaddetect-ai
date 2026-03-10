/**
 * Real-time motion-based vehicle detection using frame differencing.
 * Detects both MOVING and STATIONARY obstacles on live camera.
 */

export interface MotionDetection {
  id: string;
  label: string;
  confidence: number;
  motion: "Moving" | "Stationary";
  boundingBox: { x: number; y: number; width: number; height: number };
  estimatedDistance: number;
  riskLevel: "High" | "Moderate" | "Low";
}

export interface MotionDetectionResult {
  detections: MotionDetection[];
  motionPixelCount: number;
}

// ─── NMS ─────────────────────────────────────────────────────────────────────

function iou(
  a: MotionDetection["boundingBox"],
  b: MotionDetection["boundingBox"],
): number {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;
  const ix1 = Math.max(a.x, b.x);
  const iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

function applyNMS(
  dets: MotionDetection[],
  threshold = 0.45,
): MotionDetection[] {
  const sorted = [...dets].sort((a, b) => b.confidence - a.confidence);
  const kept: MotionDetection[] = [];
  const suppressed = new Set<number>();
  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue;
    kept.push(sorted[i]);
    for (let j = i + 1; j < sorted.length; j++) {
      if (suppressed.has(j)) continue;
      if (iou(sorted[i].boundingBox, sorted[j].boundingBox) > threshold) {
        suppressed.add(j);
      }
    }
  }
  return kept;
}

// ─── Proximity merge ─────────────────────────────────────────────────────────

function boxGap(
  a: MotionDetection["boundingBox"],
  b: MotionDetection["boundingBox"],
): number {
  const gx = Math.max(
    0,
    Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width),
  );
  const gy = Math.max(
    0,
    Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height),
  );
  return Math.sqrt(gx * gx + gy * gy);
}

function mergeGroup(group: MotionDetection[]): MotionDetection {
  let x1 = Number.POSITIVE_INFINITY;
  let y1 = Number.POSITIVE_INFINITY;
  let x2 = Number.NEGATIVE_INFINITY;
  let y2 = Number.NEGATIVE_INFINITY;
  let bestConf = 0;
  let bestDet = group[0];
  for (const d of group) {
    x1 = Math.min(x1, d.boundingBox.x);
    y1 = Math.min(y1, d.boundingBox.y);
    x2 = Math.max(x2, d.boundingBox.x + d.boundingBox.width);
    y2 = Math.max(y2, d.boundingBox.y + d.boundingBox.height);
    if (d.confidence > bestConf) {
      bestConf = d.confidence;
      bestDet = d;
    }
  }
  const box = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  return {
    ...bestDet,
    boundingBox: box,
    estimatedDistance: 15,
    riskLevel: "Moderate" as const,
  };
}

function mergeByProximity(
  dets: MotionDetection[],
  gap = 80,
): MotionDetection[] {
  const n = dets.length;
  if (n === 0) return [];
  const parent = Array.from({ length: n }, (_, idx) => idx);

  function find(startIdx: number): number {
    let current = startIdx;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  }

  function unite(i: number, j: number) {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[ri] = rj;
  }

  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      if (boxGap(dets[i].boundingBox, dets[j].boundingBox) < gap) unite(i, j);

  const clusters = new Map<number, MotionDetection[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!clusters.has(r)) clusters.set(r, []);
    clusters.get(r)!.push(dets[i]);
  }
  return [...clusters.values()].map((g) =>
    g.length === 1 ? g[0] : mergeGroup(g),
  );
}

// ─── Distance estimate ────────────────────────────────────────────────────────

function estimateDistance(boxBottomY: number, imageHeight: number): number {
  const n = boxBottomY / imageHeight;
  if (n >= 0.9) return 1.5;
  if (n >= 0.8) return 3.0;
  if (n >= 0.7) return 5.5;
  if (n >= 0.6) return 9.0;
  if (n >= 0.5) return 14.0;
  if (n >= 0.4) return 22.0;
  return 40.0;
}

// ─── Flood fill region ────────────────────────────────────────────────────────

function floodFillMask(
  mask: Uint8Array,
  visited: Uint8Array,
  startX: number,
  startY: number,
  width: number,
  height: number,
): { minX: number; minY: number; maxX: number; maxY: number; size: number } {
  let minX = startX;
  let minY = startY;
  let maxX = startX;
  let maxY = startY;
  let size = 0;
  const stack: number[] = [startY * width + startX];
  while (stack.length > 0 && size < 8000) {
    const idx = stack.pop()!;
    if (visited[idx]) continue;
    const x = idx % width;
    const y = (idx - x) / width;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (!mask[idx]) continue;
    visited[idx] = 1;
    size++;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    if (x + 1 < width) stack.push(idx + 1);
    if (x - 1 >= 0) stack.push(idx - 1);
    if (y + 1 < height) stack.push(idx + width);
    if (y - 1 >= 0) stack.push(idx - width);
  }
  return { minX, minY, maxX, maxY, size };
}

// ─── Classify object type ─────────────────────────────────────────────────────

function classifyType(
  boxW: number,
  boxH: number,
  avgR: number,
  avgG: number,
  avgB: number,
): string {
  const aspect = boxH > 0 ? boxW / boxH : 1;
  const brightness = (avgR + avgG + avgB) / 3;
  if (aspect < 0.7 && boxH > 40 && brightness > 50) return "Pedestrian";
  if (aspect > 0.8 && (boxW > 60 || boxH > 40)) return "Vehicle";
  return "Obstacle";
}

// ─── Core detection ───────────────────────────────────────────────────────────

export function detectMovingObjects(
  currentData: Uint8ClampedArray,
  previousData: Uint8ClampedArray,
  width: number,
  height: number,
  diffThreshold = 25,
  minBlobSize = 300,
): MotionDetectionResult {
  const total = width * height;
  const motionMask = new Uint8Array(total);
  let motionPixelCount = 0;
  const startY = Math.floor(height * 0.15);

  for (let y = startY; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dr = Math.abs(currentData[idx] - previousData[idx]);
      const dg = Math.abs(currentData[idx + 1] - previousData[idx + 1]);
      const db = Math.abs(currentData[idx + 2] - previousData[idx + 2]);
      if (dr + dg + db > diffThreshold * 3) {
        motionMask[y * width + x] = 1;
        motionPixelCount++;
      }
    }
  }

  // Dilate motion mask
  const dilated = new Uint8Array(motionMask);
  const dilateR = 6;
  for (let y = startY + dilateR; y < height - dilateR; y++) {
    for (let x = dilateR; x < width - dilateR; x++) {
      if (motionMask[y * width + x]) {
        for (let dy = -dilateR; dy <= dilateR; dy++) {
          for (let dx = -dilateR; dx <= dilateR; dx++) {
            dilated[(y + dy) * width + (x + dx)] = 1;
          }
        }
      }
    }
  }

  // Find moving blobs
  const visitedMotion = new Uint8Array(total);
  const rawMoving: MotionDetection[] = [];

  for (let y = startY; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!dilated[idx] || visitedMotion[idx]) continue;
      const region = floodFillMask(dilated, visitedMotion, x, y, width, height);
      if (region.size < minBlobSize) continue;
      const boxW = region.maxX - region.minX;
      const boxH = region.maxY - region.minY;
      if (boxW < 20 || boxH < 20) continue;

      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sampleCount = 0;
      for (let sy = region.minY; sy <= region.maxY; sy += 4) {
        for (let sx = region.minX; sx <= region.maxX; sx += 4) {
          const pi = (sy * width + sx) * 4;
          sumR += currentData[pi];
          sumG += currentData[pi + 1];
          sumB += currentData[pi + 2];
          sampleCount++;
        }
      }
      const avgR = sampleCount > 0 ? sumR / sampleCount : 128;
      const avgG = sampleCount > 0 ? sumG / sampleCount : 128;
      const avgB = sampleCount > 0 ? sumB / sampleCount : 128;

      const baseType = classifyType(boxW, boxH, avgR, avgG, avgB);
      const dist = estimateDistance(region.maxY, height);
      const isClose = region.maxY > height * 0.7 || dist < 5;
      const conf = Math.min(0.95, 0.65 + (region.size / 5000) * 0.25);

      rawMoving.push({
        id: `moving_${Date.now()}_${x}_${y}`,
        label: `${baseType} (Moving)`,
        confidence: conf,
        motion: "Moving",
        boundingBox: {
          x: region.minX,
          y: region.minY,
          width: boxW,
          height: boxH,
        },
        estimatedDistance: dist,
        riskLevel: isClose ? "High" : "Moderate",
      });
    }
  }

  // Stationary detection (color segmentation, only when scene is mostly static)
  const motionRatio = motionPixelCount / ((height - startY) * width);
  const rawStationary: MotionDetection[] = [];

  if (motionRatio < 0.4) {
    const visitedStat = new Uint8Array(total);
    for (let i = 0; i < total; i++) if (dilated[i]) visitedStat[i] = 1;

    for (let y = Math.floor(height * 0.3); y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (visitedStat[idx]) continue;
        const pi = idx * 4;
        const r = currentData[pi];
        const g = currentData[pi + 1];
        const b = currentData[pi + 2];
        const brightness = (r + g + b) / 3;
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const sat = maxC > 0 ? (maxC - minC) / maxC : 0;
        const isCandidate =
          (sat > 0.28 && brightness > 45) ||
          (brightness > 190 && y > height * 0.4);
        if (!isCandidate) continue;

        // Build local color mask
        const localMask = new Uint8Array(total);
        for (
          let fy = Math.max(0, y - 60);
          fy < Math.min(height, y + 60);
          fy++
        ) {
          for (
            let fx = Math.max(0, x - 60);
            fx < Math.min(width, x + 60);
            fx++
          ) {
            const fi = fy * width + fx;
            if (visitedStat[fi]) continue;
            const fp = fi * 4;
            const fr = currentData[fp];
            const fg = currentData[fp + 1];
            const fb = currentData[fp + 2];
            const diff = Math.abs(fr - r) + Math.abs(fg - g) + Math.abs(fb - b);
            if (diff < 60) localMask[fi] = 1;
          }
        }

        const region = floodFillMask(
          localMask,
          visitedStat,
          x,
          y,
          width,
          height,
        );
        if (region.size < minBlobSize * 0.8) continue;
        const boxW = region.maxX - region.minX;
        const boxH = region.maxY - region.minY;
        if (boxW < 25 || boxH < 25) continue;
        const dist = estimateDistance(region.maxY, height);
        const isClose = region.maxY > height * 0.72 || dist < 5;
        const baseType = classifyType(boxW, boxH, r, g, b);
        const conf = Math.min(0.9, 0.6 + (region.size / 4000) * 0.22);
        rawStationary.push({
          id: `stationary_${Date.now()}_${x}_${y}`,
          label: `${baseType} (Stationary)`,
          confidence: conf,
          motion: "Stationary",
          boundingBox: {
            x: region.minX,
            y: region.minY,
            width: boxW,
            height: boxH,
          },
          estimatedDistance: dist,
          riskLevel: isClose ? "High" : "Low",
        });
      }
    }
  }

  const movingMerged = mergeByProximity(applyNMS(rawMoving)).slice(0, 6);
  const stationaryMerged = mergeByProximity(applyNMS(rawStationary)).slice(
    0,
    5,
  );

  const fix = (d: MotionDetection): MotionDetection => {
    const dist = estimateDistance(
      d.boundingBox.y + d.boundingBox.height,
      height,
    );
    const isClose =
      dist < 5 || d.boundingBox.y + d.boundingBox.height > height * 0.7;
    return {
      ...d,
      estimatedDistance: dist,
      riskLevel: isClose ? "High" : d.motion === "Moving" ? "Moderate" : "Low",
    };
  };

  return {
    detections: [...movingMerged.map(fix), ...stationaryMerged.map(fix)],
    motionPixelCount,
  };
}

// ─── Canvas overlay renderer ──────────────────────────────────────────────────

export function drawDetectionsOnCanvas(
  ctx: CanvasRenderingContext2D,
  detections: MotionDetection[],
  width: number,
  height: number,
): void {
  if (detections.length === 0) return;

  const dangerY = height * 0.7;
  const baseFontSize = Math.max(13, Math.floor(width * 0.028));

  for (const det of detections) {
    const { x, y, width: bw, height: bh } = det.boundingBox;
    const boxBottom = y + bh;
    const isClose = boxBottom > dangerY || det.estimatedDistance < 5;

    let strokeColor: string;
    let labelBg: string;
    let distColor: string;

    if (det.motion === "Moving" && isClose) {
      strokeColor = "rgba(239, 68, 68, 0.95)";
      labelBg = "rgba(185, 28, 28, 0.92)";
      distColor = "#fde68a";
    } else if (det.motion === "Moving") {
      strokeColor = "rgba(249, 115, 22, 0.9)";
      labelBg = "rgba(194, 65, 12, 0.90)";
      distColor = "#fed7aa";
    } else if (isClose) {
      strokeColor = "rgba(234, 179, 8, 0.90)";
      labelBg = "rgba(161, 98, 7, 0.90)";
      distColor = "#fef9c3";
    } else {
      strokeColor = "rgba(59, 130, 246, 0.85)";
      labelBg = "rgba(30, 64, 175, 0.88)";
      distColor = "#93c5fd";
    }

    // Draw box
    const lineW = Math.max(2, Math.floor(width * 0.005));
    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineW;
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur = 10;
    if (det.motion === "Stationary") ctx.setLineDash([8, 4]);
    ctx.strokeRect(x, y, bw, bh);
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
    ctx.fillStyle = strokeColor.replace(/[^,]+(?=\))/, "0.07");
    ctx.fillRect(x, y, bw, bh);
    ctx.restore();

    // Draw label
    const confPct = Math.round(det.confidence * 100);
    const labelText = `${det.label} ${confPct}%`;
    const distText = `~${det.estimatedDistance.toFixed(1)}m`;

    ctx.save();
    ctx.font = `bold ${baseFontSize}px Inter, sans-serif`;
    const labelW2 = ctx.measureText(labelText).width;
    ctx.font = `${baseFontSize - 2}px Inter, sans-serif`;
    const distW = ctx.measureText(distText).width;
    const labelBoxW = Math.max(labelW2, distW) + 14;
    const labelBoxH = baseFontSize * 2 + 12;

    const lx = Math.min(x, width - labelBoxW - 2);
    let ly = y - labelBoxH - 4;
    if (ly < 0) ly = y + bh + 4;

    ctx.fillStyle = labelBg;
    ctx.beginPath();
    ctx.roundRect(lx, ly, labelBoxW, labelBoxH, 4);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = `bold ${baseFontSize}px Inter, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(labelText, lx + 7, ly + 4);

    ctx.fillStyle = distColor;
    ctx.font = `${baseFontSize - 2}px Inter, sans-serif`;
    ctx.fillText(distText, lx + 7, ly + baseFontSize + 6);
    ctx.restore();

    // Warning icons for close moving objects
    if (isClose && det.motion === "Moving") {
      const iconSize = Math.max(18, Math.floor(width * 0.04));
      const iconCenterX = x + bw / 2;
      const iconCenterY = Math.max(iconSize / 2 + 2, ly - iconSize / 2 - 4);
      drawWarningTriangle(
        ctx,
        iconCenterX - iconSize * 0.8,
        iconCenterY,
        iconSize,
      );
      drawStopOctagon(ctx, iconCenterX + iconSize * 0.8, iconCenterY, iconSize);
    }
  }
}

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

function drawStopOctagon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  const r = size / 2;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 8) * (2 * i + 1) - Math.PI / 2;
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
