/**
 * Obstacle detection algorithm for identifying objects on and beside the road
 */

export interface ObstacleInfo {
  id: string;
  position: { x: number; y: number };
  type: string;
  confidenceLevel: number;
  riskLevel: {
    level: 'High' | 'Moderate' | 'Low';
    description: string;
  };
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface EmergencyCondition {
  id: string;
  type: string;
  description: string;
  severity: {
    level: 'Critical' | 'Warning' | 'Info';
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
 * Detect obstacles in the image/video frame
 */
export async function detectObstacles(
  imageUrl: string,
  roadMask: Uint8Array,
  width: number,
  height: number
): Promise<ObstacleDetectionResult> {
  const img = await loadImage(imageUrl);
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, width, height);
  
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // Detect obstacles using color and position analysis
  const obstacles = detectObstaclesInFrame(data, roadMask, width, height);
  
  // Assess emergency conditions
  const emergencyConditions = assessEmergencyConditions(obstacles, width, height);
  
  // Create visualization with obstacle highlighting
  const visualizationCanvas = createObstacleVisualization(img, obstacles, width, height);
  const visualizationUrl = visualizationCanvas.toDataURL('image/jpeg', 0.9);
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
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Detect obstacles using color segmentation and position analysis
 */
function detectObstaclesInFrame(
  data: Uint8ClampedArray,
  roadMask: Uint8Array,
  width: number,
  height: number
): ObstacleInfo[] {
  const obstacles: ObstacleInfo[] = [];
  const visited = new Uint8Array(width * height);
  const minObstacleSize = 50; // Minimum pixels for an obstacle
  
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
          const obstacle = analyzeObstacleRegion(region, roadMask, width, height, obstacles.length);
          if (obstacle) {
            obstacles.push(obstacle);
          }
        }
      }
    }
  }
  
  return obstacles;
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
  seedB: number
): Region {
  const pixels: Array<{ x: number; y: number }> = [];
  const stack: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
  const colorThreshold = 40;
  
  let minX = startX, maxX = startX, minY = startY, maxY = startY;
  let sumR = 0, sumG = 0, sumB = 0;
  
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
    const colorDiff = Math.abs(r - seedR) + Math.abs(g - seedG) + Math.abs(b - seedB);
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
  index: number
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
  const obstacleType = classifyObstacle(avgR, avgG, avgB, maxY - minY, maxX - minX);
  
  // Determine risk level
  const riskLevel = determineRiskLevel(isOnRoad, centerY, height, maxY - minY);
  
  // Calculate confidence based on region properties
  const confidence = Math.min(0.95, 0.6 + (pixels.length / 1000) * 0.3);
  
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

function classifyObstacle(r: number, g: number, b: number, height: number, width: number): string {
  const brightness = (r + g + b) / 3;
  const aspectRatio = height / width;
  
  // Vehicle detection (typically wider than tall, various colors)
  if (aspectRatio < 1.2 && height > 30) {
    if (r > 150 && g < 100 && b < 100) return 'Red Vehicle';
    if (b > 150 && r < 100 && g < 100) return 'Blue Vehicle';
    if (brightness < 60) return 'Dark Vehicle';
    if (brightness > 180) return 'Light Vehicle';
    return 'Vehicle';
  }
  
  // Pedestrian detection (taller than wide)
  if (aspectRatio > 1.5 && aspectRatio < 3) {
    return 'Pedestrian';
  }
  
  // Traffic signs (bright, small, square-ish)
  if (brightness > 150 && height < 50 && Math.abs(aspectRatio - 1) < 0.3) {
    return 'Traffic Sign';
  }
  
  // Debris or unknown objects
  if (brightness < 80) return 'Dark Object';
  if (brightness > 180) return 'Bright Object';
  
  return 'Unknown Object';
}

function determineRiskLevel(
  isOnRoad: boolean,
  centerY: number,
  imageHeight: number,
  objectHeight: number
): { level: 'High' | 'Moderate' | 'Low'; description: string } {
  // Objects in lower part of image are closer
  const proximityRatio = centerY / imageHeight;
  const isClose = proximityRatio > 0.7;
  
  if (isOnRoad && isClose) {
    return {
      level: 'High',
      description: 'Obstacle directly in vehicle path - immediate attention required',
    };
  }
  
  if (isOnRoad && !isClose) {
    return {
      level: 'Moderate',
      description: 'Obstacle on road ahead - monitor closely',
    };
  }
  
  if (!isOnRoad && isClose) {
    return {
      level: 'Moderate',
      description: 'Object near roadside - maintain awareness',
    };
  }
  
  return {
    level: 'Low',
    description: 'Object detected at safe distance',
  };
}

function assessEmergencyConditions(
  obstacles: ObstacleInfo[],
  width: number,
  height: number
): EmergencyCondition[] {
  const emergencies: EmergencyCondition[] = [];
  
  // Check for high-risk obstacles
  const highRiskObstacles = obstacles.filter(o => o.riskLevel.level === 'High');
  
  if (highRiskObstacles.length > 0) {
    emergencies.push({
      id: `emergency_${Date.now()}_collision`,
      type: 'Collision Risk',
      description: `${highRiskObstacles.length} obstacle(s) detected in vehicle path`,
      severity: {
        level: 'Critical',
        urgency: 'Immediate action required',
      },
    });
  }
  
  // Check for multiple obstacles (potential blocked road)
  const moderateRiskObstacles = obstacles.filter(o => o.riskLevel.level === 'Moderate');
  if (moderateRiskObstacles.length >= 3) {
    emergencies.push({
      id: `emergency_${Date.now()}_blocked`,
      type: 'Road Obstruction',
      description: 'Multiple obstacles detected - road may be blocked',
      severity: {
        level: 'Warning',
        urgency: 'Reduce speed and proceed with caution',
      },
    });
  }
  
  // Check for pedestrians
  const pedestrians = obstacles.filter(o => o.type === 'Pedestrian' && o.riskLevel.level !== 'Low');
  if (pedestrians.length > 0) {
    emergencies.push({
      id: `emergency_${Date.now()}_pedestrian`,
      type: 'Pedestrian Alert',
      description: `${pedestrians.length} pedestrian(s) detected near road`,
      severity: {
        level: 'Warning',
        urgency: 'Exercise extreme caution',
      },
    });
  }
  
  return emergencies;
}

function createObstacleVisualization(
  img: HTMLImageElement,
  obstacles: ObstacleInfo[],
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true })!;
  
  // Draw original image
  ctx.drawImage(img, 0, 0);
  
  // Draw obstacle bounding boxes and labels
  obstacles.forEach(obstacle => {
    const { boundingBox, riskLevel, type, confidenceLevel } = obstacle;
    
    // Set color based on risk level
    let color: string;
    let shadowColor: string;
    if (riskLevel.level === 'High') {
      color = 'rgba(239, 68, 68, 0.8)'; // Red
      shadowColor = 'rgba(239, 68, 68, 0.6)';
    } else if (riskLevel.level === 'Moderate') {
      color = 'rgba(251, 191, 36, 0.8)'; // Yellow
      shadowColor = 'rgba(251, 191, 36, 0.6)';
    } else {
      color = 'rgba(34, 197, 94, 0.8)'; // Green
      shadowColor = 'rgba(34, 197, 94, 0.6)';
    }
    
    // Draw bounding box with glow
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 10;
    ctx.strokeRect(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height);
    
    // Draw label background
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    const labelText = `${type} (${(confidenceLevel * 100).toFixed(0)}%)`;
    const labelWidth = ctx.measureText(labelText).width + 16;
    const labelHeight = 24;
    const labelX = boundingBox.x;
    const labelY = Math.max(boundingBox.y - labelHeight - 4, 0);
    
    ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
    
    // Draw label text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillText(labelText, labelX + 8, labelY + 16);
  });
  
  return canvas;
}

async function imageUrlToBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
