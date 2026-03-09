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
 * Apply Non-Maximum Suppression to remove overlapping bounding boxes.
 * Keeps the highest-confidence box and suppresses any box whose IoU
 * with a kept box exceeds iouThreshold.
 */
function applyNMS(
  obstacles: ObstacleInfo[],
  iouThreshold = 0.45,
): ObstacleInfo[] {
  if (obstacles.length === 0) return [];

  // Sort by confidence descending
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
 * Estimate distance in meters from vertical position in image.
 * Objects lower in the image are closer to the camera.
 * Using a perspective heuristic: bottom 30% ~ 0-8m, middle ~ 8-25m, top ~ 25-80m.
 */
function estimateDistance(boxBottomY: number, imageHeight: number): number {
  const normalizedY = boxBottomY / imageHeight; // 0 = top, 1 = bottom

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

  // Detect obstacles using color and position analysis
  const obstacles = detectObstaclesInFrame(data, roadMask, width, height);

  // Assess emergency conditions
  const emergencyConditions = assessEmergencyConditions(
    obstacles,
    width,
    height,
  );

  // Create visualization with obstacle highlighting
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
 * Applies NMS to ensure only one bounding box per detected object.
 */
function detectObstaclesInFrame(
  data: Uint8ClampedArray,
  roadMask: Uint8Array,
  width: number,
  height: number,
): ObstacleInfo[] {
  const obstacles: ObstacleInfo[] = [];
  const visited = new Uint8Array(width * height);
  const minObstacleSize = 200; // Raised from 50 — filters tiny false-positive fragments

  // Focus on road area and immediate surroundings
  const roadStartY = Math.floor(height * 0.3);

  for (let y = roadStartY; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      if (visited[idx]) continue;

      const pixelIdx = idx * 4;
      const r = data[pixelIdx];
      const g = data[pixelIdx + 1];
      const b = data[pixelIdx + 2];

      // Detect potential obstacles (objects with distinct colors or high contrast)
      const brightness = (r + g + b) / 3;
      const saturation = calculateSaturation(r, g, b);
      const isRoad = roadMask[idx] > 0;

      // Look for objects that stand out from the road
      const isObstacle =
        (saturation > 0.25 && brightness > 40) || // Colorful objects (vehicles, signs)
        (brightness > 180 && !isRoad) || // Bright objects (pedestrians in light clothing)
        (brightness < 40 && !isRoad && y > height * 0.6); // Dark objects on road

      if (isObstacle) {
        // Flood fill to find connected region
        const region = floodFill(data, visited, x, y, width, height, r, g, b);

        if (region.pixels.length >= minObstacleSize) {
          const obstacle = analyzeObstacleRegion(
            region,
            roadMask,
            width,
            height,
            obstacles.length,
          );
          // Only keep obstacles above the raised confidence threshold
          if (obstacle && obstacle.confidenceLevel >= 0.6) {
            obstacles.push(obstacle);
          }
        }
      }
    }
  }

  // Apply NMS to eliminate overlapping duplicate boxes, then cap at 10 results
  const nmsObstacles = applyNMS(obstacles).slice(0, 10);

  // Attach estimated distance to each obstacle
  return nmsObstacles.map((obs) => ({
    ...obs,
    estimatedDistance: estimateDistance(
      obs.boundingBox.y + obs.boundingBox.height,
      height,
    ),
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

    // Check if color is similar
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

    // Add neighbors
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

  // Calculate center position
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Determine if obstacle is on road or beside it
  let onRoadPixels = 0;
  for (const { x, y } of pixels) {
    const idx = y * width + x;
    if (roadMask[idx] > 0) {
      onRoadPixels++;
    }
  }

  const onRoadRatio = onRoadPixels / pixels.length;
  const isOnRoad = onRoadRatio > 0.3;

  // Classify obstacle type based on color and position
  const obstacleType = classifyObstacle(
    avgR,
    avgG,
    avgB,
    maxY - minY,
    maxX - minX,
  );

  // Determine risk level
  const riskLevel = determineRiskLevel(isOnRoad, centerY, height, maxY - minY);

  // Raised confidence floor: 0.60 base, scaling up with region size
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

    // Vehicle detection (typically wider than tall, various colors)
    if (aspectRatio < 1.2 && height > 30) {
      return "Vehicle";
    }

    // Pedestrian detection (taller than wide, usually brighter than road)
    if (aspectRatio > 1.5 && aspectRatio < 3 && brightness > 60) {
      return "Pedestrian";
    }

    // Debris or unknown objects
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
  // Objects in lower part of image are closer
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

  // Check for high-risk obstacles
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

  // Check for multiple obstacles (potential blocked road)
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

  // Check for pedestrians
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
  ctx.moveTo(cx, cy - half); // top
  ctx.lineTo(cx + half, cy + half); // bottom right
  ctx.lineTo(cx - half, cy + half); // bottom left
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 200, 0, 0.95)";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Exclamation
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
  // STOP text
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${Math.floor(size * 0.28)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("STOP", cx, cy);
  ctx.restore();
}

/**
 * Draw road zone color overlay (green=safe, yellow=caution, red=danger)
 * as semi-transparent trapezoid bands over the canvas.
 */
function drawRoadZones(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const greenEnd = height * 0.4;
  const yellowEnd = height * 0.7;

  // Green zone (top 40% — far/safe)
  const greenGrad = ctx.createLinearGradient(0, 0, 0, greenEnd);
  greenGrad.addColorStop(0, "rgba(34, 197, 94, 0.0)");
  greenGrad.addColorStop(1, "rgba(34, 197, 94, 0.18)");
  ctx.fillStyle = greenGrad;
  ctx.fillRect(0, 0, width, greenEnd);

  // Yellow zone (40-70% — caution)
  const yellowGrad = ctx.createLinearGradient(0, greenEnd, 0, yellowEnd);
  yellowGrad.addColorStop(0, "rgba(251, 191, 36, 0.18)");
  yellowGrad.addColorStop(1, "rgba(251, 191, 36, 0.28)");
  ctx.fillStyle = yellowGrad;
  ctx.fillRect(0, greenEnd, width, yellowEnd - greenEnd);

  // Red zone (bottom 30% — danger)
  const redGrad = ctx.createLinearGradient(0, yellowEnd, 0, height);
  redGrad.addColorStop(0, "rgba(239, 68, 68, 0.22)");
  redGrad.addColorStop(1, "rgba(239, 68, 68, 0.38)");
  ctx.fillStyle = redGrad;
  ctx.fillRect(0, yellowEnd, width, height - yellowEnd);

  // Zone labels (small, top-right corner of each zone)
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
 * Create obstacle visualization matching STONKAM-style:
 * - Road zone color overlay (green/yellow/red)
 * - Blue bounding box per obstacle (single, NMS-enforced)
 * - Label: Type + Confidence above box
 * - Distance estimate below label
 * - Warning triangle + stop icon for danger zone obstacles
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

  // Draw original image
  ctx.drawImage(img, 0, 0, width, height);

  // Draw road zone overlay
  drawRoadZones(ctx, width, height);

  const dangerThresholdY = height * 0.7; // bottom 30% = danger
  const dangerDistanceM = 5.0; // under 5m = danger

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

    // ---- Bounding box ----
    // Blue box (STONKAM style), red tint for danger zone
    const boxColor = isDanger
      ? "rgba(239, 68, 68, 0.9)"
      : "rgba(59, 130, 246, 0.9)"; // blue
    const shadowColor = isDanger
      ? "rgba(239, 68, 68, 0.5)"
      : "rgba(59, 130, 246, 0.5)";

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

    // ---- Labels ----
    const labelText = `${type} ${(confidenceLevel * 100).toFixed(0)}%`;
    const distText = `~${dist.toFixed(1)}m`;

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

    // Background pill
    const bgColor = isDanger
      ? "rgba(239, 68, 68, 0.85)"
      : "rgba(30, 64, 175, 0.85)"; // blue-800
    ctx.fillStyle = bgColor;
    roundRect(ctx, labelX, labelY, labelW, labelH, 4);
    ctx.fill();

    // Label text
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${baseFontSize}px Inter, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(labelText, labelX + labelPadX, labelY + labelPadY);

    // Distance text (slightly smaller, cyan)
    ctx.fillStyle = isDanger ? "#fde68a" : "#93c5fd";
    ctx.font = `${baseFontSize - 1}px Inter, sans-serif`;
    ctx.fillText(distText, labelX + labelPadX, labelY + labelPadY + lineHeight);

    // ---- Warning icons for danger zone ----
    if (isDanger) {
      const iconSize = Math.max(18, Math.floor(width * 0.04));
      const iconY = labelY - iconSize - 6;
      const iconCenterY = Math.max(iconSize / 2 + 2, iconY + iconSize / 2);
      const boxCenterX = boundingBox.x + boundingBox.width / 2;

      // Draw triangle (⚠) to the left of center
      drawWarningTriangle(
        ctx,
        boxCenterX - iconSize * 0.7,
        iconCenterY,
        iconSize,
      );
      // Draw stop icon to the right of center
      drawStopIcon(ctx, boxCenterX + iconSize * 0.7, iconCenterY, iconSize);
    }
  }

  return canvas;
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
