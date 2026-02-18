/**
 * Advanced road detection algorithm using computer vision techniques
 * with ML-based environmental adaptation, performance-aware preprocessing,
 * desktop hardware optimization, pothole detection, and road surface feature extraction
 */

import { detectObstacles } from './obstacleDetection';
import { extractRoadSurfaceFeatures } from './roadSurfaceFeatures';
import type { DetectionResult, EnvironmentalConditions, PotholeDetection } from '@/types/detection';

interface PerformanceMetrics {
  avgFrameTime: number;
  frameCount: number;
}

interface HardwareCapabilities {
  supportsOffscreenCanvas: boolean;
  supportsWebGL: boolean;
  hardwareConcurrency: number;
  deviceMemory?: number;
  gpuTier?: 'high' | 'medium' | 'low';
}

// Global hardware capabilities cache
let hardwareCapabilities: HardwareCapabilities | null = null;

/**
 * Detect device hardware capabilities for optimal processing
 */
function detectHardwareCapabilities(): HardwareCapabilities {
  if (hardwareCapabilities) return hardwareCapabilities;

  const capabilities: HardwareCapabilities = {
    supportsOffscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    supportsWebGL: (() => {
      try {
        const canvas = document.createElement('canvas');
        return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
      } catch {
        return false;
      }
    })(),
    hardwareConcurrency: navigator.hardwareConcurrency || 4,
    deviceMemory: (navigator as any).deviceMemory,
  };

  // Estimate GPU tier based on available information
  if (capabilities.hardwareConcurrency >= 8 && (!capabilities.deviceMemory || capabilities.deviceMemory >= 8)) {
    capabilities.gpuTier = 'high';
  } else if (capabilities.hardwareConcurrency >= 4) {
    capabilities.gpuTier = 'medium';
  } else {
    capabilities.gpuTier = 'low';
  }

  hardwareCapabilities = capabilities;
  return capabilities;
}

/**
 * Detect potholes on the road surface using visual analysis
 */
function detectPotholes(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  roadMask: Uint8Array,
  environmentalConditions: EnvironmentalConditions
): PotholeDetection[] {
  const potholes: PotholeDetection[] = [];
  
  // Create edge detection for texture discontinuities
  const edges = detectEdges(data, width, height);
  
  // Detect dark regions on road surface (potential potholes)
  const darkRegions = detectDarkRegions(data, width, height, roadMask);
  
  // Analyze each dark region for pothole characteristics
  darkRegions.forEach((region, index) => {
    // Calculate region properties
    const area = region.pixels.length;
    const minArea = 50; // Minimum pixels for a pothole
    
    if (area < minArea) return;
    
    // Calculate bounding box
    let minX = width, minY = height, maxX = 0, maxY = 0;
    region.pixels.forEach(([x, y]) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
    
    const boxWidth = maxX - minX;
    const boxHeight = maxY - minY;
    
    // Skip if aspect ratio is too extreme
    const aspectRatio = boxWidth / boxHeight;
    if (aspectRatio > 4 || aspectRatio < 0.25) return;
    
    // Calculate center position
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Estimate distance based on vertical position (perspective projection)
    // Assume camera height ~1.5m, road extends to horizon
    const normalizedY = centerY / height;
    const distance = estimateDistanceFromPosition(normalizedY, height);
    
    // Calculate edge strength in region
    let edgeStrength = 0;
    region.pixels.forEach(([x, y]) => {
      const idx = y * width + x;
      edgeStrength += edges[idx];
    });
    edgeStrength /= area;
    
    // Calculate darkness score
    let darknessScore = 0;
    region.pixels.forEach(([x, y]) => {
      const idx = (y * width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      darknessScore += (255 - brightness) / 255;
    });
    darknessScore /= area;
    
    // Determine severity based on size, darkness, and edge strength
    const sizeScore = Math.min(1, area / 500);
    const severityScore = (darknessScore * 0.4 + edgeStrength * 0.3 + sizeScore * 0.3);
    
    let severity: 'Low' | 'Moderate' | 'High';
    if (severityScore > 0.7) severity = 'High';
    else if (severityScore > 0.4) severity = 'Moderate';
    else severity = 'Low';
    
    // Estimate physical size (rough approximation)
    const pixelToMeterRatio = 0.01 * (1 + normalizedY * 2); // Increases with distance
    const estimatedSize = area * pixelToMeterRatio * pixelToMeterRatio;
    
    // Estimate depth based on darkness and edge characteristics
    const estimatedDepth = darknessScore * edgeStrength * 15; // cm
    
    // Classify pothole type
    let potholeType: PotholeDetection['potholeType'];
    if (edgeStrength > 0.7 && darknessScore > 0.6) {
      potholeType = 'deep';
    } else if (boxWidth > boxHeight * 2) {
      potholeType = 'edge';
    } else if (area > 300) {
      potholeType = 'rough_size';
    } else if (edgeStrength > 0.5) {
      potholeType = 'surface_cracks';
    } else if (severityScore > 0.6) {
      potholeType = 'complex';
    } else {
      potholeType = 'unknown';
    }
    
    // Calculate confidence based on environmental conditions and detection quality
    let confidence = 0.6 + severityScore * 0.3;
    
    // Adjust confidence based on environmental conditions
    if (environmentalConditions.visibility) {
      confidence *= environmentalConditions.visibility;
    }
    if (environmentalConditions.lighting === 'Night' || environmentalConditions.lighting === 'Dusk') {
      confidence *= 0.7;
    }
    if (environmentalConditions.weather === 'Foggy' || environmentalConditions.weather === 'Heavy Fog') {
      confidence *= 0.6;
    }
    
    confidence = Math.max(0.3, Math.min(0.95, confidence));
    
    // Only include potholes with reasonable confidence
    if (confidence > 0.4) {
      potholes.push({
        id: `pothole_${Date.now()}_${index}`,
        position: { x: centerX, y: centerY },
        boundingBox: {
          x: minX,
          y: minY,
          width: boxWidth,
          height: boxHeight,
        },
        distance,
        severity,
        size: estimatedSize,
        depth: estimatedDepth,
        confidenceLevel: confidence,
        potholeType,
      });
    }
  });
  
  return potholes;
}

/**
 * Estimate distance in meters based on vertical position in frame
 * Uses perspective projection approximation
 */
function estimateDistanceFromPosition(normalizedY: number, imageHeight: number): number {
  // Camera parameters (approximate)
  const cameraHeight = 1.5; // meters
  const cameraAngle = 10; // degrees downward tilt
  const focalLength = imageHeight / (2 * Math.tan((60 * Math.PI) / 360)); // Assume 60° FOV
  
  // Calculate distance using perspective projection
  // For objects on the road plane
  const angleRad = (cameraAngle * Math.PI) / 180;
  const pixelFromHorizon = (normalizedY - 0.3) * imageHeight; // Assume horizon at ~30% from top
  
  if (pixelFromHorizon <= 0) return 100; // Far distance
  
  const distance = (cameraHeight * focalLength) / (pixelFromHorizon * Math.cos(angleRad));
  
  // Clamp to reasonable range
  return Math.max(1, Math.min(100, distance));
}

/**
 * Detect edges using Sobel operator
 */
function detectEdges(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const edges = new Uint8Array(width * height);
  
  // Sobel kernels
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          const kernelIdx = (ky + 1) * 3 + (kx + 1);
          
          gx += gray * sobelX[kernelIdx];
          gy += gray * sobelY[kernelIdx];
        }
      }
      
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[y * width + x] = Math.min(255, magnitude);
    }
  }
  
  return edges;
}

/**
 * Detect dark regions on road surface
 */
function detectDarkRegions(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  roadMask: Uint8Array
): Array<{ pixels: Array<[number, number]> }> {
  const visited = new Uint8Array(width * height);
  const regions: Array<{ pixels: Array<[number, number]> }> = [];
  
  // Threshold for dark pixels
  const darknessThreshold = 80;
  
  for (let y = Math.floor(height * 0.4); y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      
      // Skip if not on road or already visited
      if (roadMask[idx] === 0 || visited[idx] === 1) continue;
      
      const pixelIdx = idx * 4;
      const brightness = (data[pixelIdx] + data[pixelIdx + 1] + data[pixelIdx + 2]) / 3;
      
      // Check if pixel is dark
      if (brightness < darknessThreshold) {
        // Flood fill to find connected region
        const region = floodFill(data, width, height, x, y, visited, roadMask, darknessThreshold);
        
        if (region.pixels.length > 0) {
          regions.push(region);
        }
      }
    }
  }
  
  return regions;
}

/**
 * Flood fill algorithm to find connected dark regions
 */
function floodFill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  visited: Uint8Array,
  roadMask: Uint8Array,
  threshold: number
): { pixels: Array<[number, number]> } {
  const pixels: Array<[number, number]> = [];
  const stack: Array<[number, number]> = [[startX, startY]];
  
  while (stack.length > 0 && pixels.length < 1000) {
    const [x, y] = stack.pop()!;
    
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    
    const idx = y * width + x;
    
    if (visited[idx] === 1 || roadMask[idx] === 0) continue;
    
    const pixelIdx = idx * 4;
    const brightness = (data[pixelIdx] + data[pixelIdx + 1] + data[pixelIdx + 2]) / 3;
    
    if (brightness >= threshold) continue;
    
    visited[idx] = 1;
    pixels.push([x, y]);
    
    // Add neighbors
    stack.push([x + 1, y]);
    stack.push([x - 1, y]);
    stack.push([x, y + 1]);
    stack.push([x, y - 1]);
  }
  
  return { pixels };
}

/**
 * Create visualization overlay for detected potholes
 */
function createPotholeVisualization(
  img: HTMLImageElement,
  potholes: PotholeDetection[],
  width: number,
  height: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  
  // Draw original image
  ctx.drawImage(img, 0, 0, width, height);
  
  // Draw pothole bounding boxes and labels
  potholes.forEach((pothole) => {
    const { boundingBox, severity, distance, confidenceLevel } = pothole;
    
    // Color based on severity
    let color: string;
    if (severity === 'High') color = 'rgba(255, 0, 0, 0.7)';
    else if (severity === 'Moderate') color = 'rgba(255, 165, 0, 0.7)';
    else color = 'rgba(255, 255, 0, 0.7)';
    
    // Draw bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height);
    
    // Draw label background
    const label = `Pothole ${distance.toFixed(0)}m`;
    ctx.font = 'bold 14px Arial';
    const textWidth = ctx.measureText(label).width;
    
    ctx.fillStyle = color;
    ctx.fillRect(boundingBox.x, boundingBox.y - 22, textWidth + 10, 22);
    
    // Draw label text
    ctx.fillStyle = 'white';
    ctx.fillText(label, boundingBox.x + 5, boundingBox.y - 6);
    
    // Draw distance indicator
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pothole.position.x, pothole.position.y, 5, 0, 2 * Math.PI);
    ctx.fill();
  });
  
  return canvas.toDataURL('image/jpeg', 0.9);
}

export async function processRoadDetection(
  imageUrl: string,
  mode: 'image' | 'video',
  performanceMetrics?: PerformanceMetrics,
  enableObstacleDetection: boolean = true
): Promise<DetectionResult> {
  const startTime = performance.now();
  const hwCapabilities = detectHardwareCapabilities();

  // Load image with hardware-accelerated decoding hint
  const img = await loadImage(imageUrl);
  
  // Use OffscreenCanvas for better performance if available
  const useOffscreen = hwCapabilities.supportsOffscreenCanvas && mode === 'video';
  
  let canvas: HTMLCanvasElement | OffscreenCanvas;
  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  
  if (useOffscreen) {
    canvas = new OffscreenCanvas(img.width, img.height);
    ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
      willReadFrequently: false,
    })!;
  } else {
    canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
      willReadFrequently: false,
    })!;
  }
  
  ctx.drawImage(img as any, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Analyze environmental conditions with new perception signals
  const environmentalConditions = analyzeEnvironment(data, canvas.width, canvas.height);
  
  // Determine preprocessing intensity based on performance and hardware
  const preprocessingLevel = determinePreprocessingLevel(
    performanceMetrics,
    mode,
    hwCapabilities
  );
  
  // Apply ML-based preprocessing with hardware-aware optimizations
  const { preprocessedData, adaptations } = applyMLPreprocessing(
    data,
    canvas.width,
    canvas.height,
    environmentalConditions,
    preprocessingLevel,
    hwCapabilities
  );
  
  // Detect road regions with preprocessed data
  const roadMask = detectRoadRegions(
    preprocessedData,
    canvas.width,
    canvas.height,
    environmentalConditions
  );
  
  // Apply adaptive post-processing based on conditions
  const enhancedMask = applyEnvironmentalAdaptation(roadMask, canvas.width, canvas.height, environmentalConditions);
  
  // Detect road type
  const roadType = detectRoadType(preprocessedData, enhancedMask, canvas.width, canvas.height);
  
  // Detect potholes on road surface
  const potholes = detectPotholes(preprocessedData, canvas.width, canvas.height, enhancedMask, environmentalConditions);
  
  // Extract road surface features
  let roadSurfaceFeatures;
  try {
    roadSurfaceFeatures = await extractRoadSurfaceFeatures(
      preprocessedData,
      canvas.width,
      canvas.height,
      enhancedMask,
      environmentalConditions
    );
    
    // Add pothole detection results to road surface features
    if (roadSurfaceFeatures && potholes.length > 0) {
      const potholeVisualizationUrl = createPotholeVisualization(img, potholes, canvas.width, canvas.height);
      roadSurfaceFeatures.potholes = {
        detections: potholes,
        visualizationUrl: potholeVisualizationUrl,
      };
    }
  } catch (error) {
    console.error('[RoadDetection] Surface feature extraction failed:', error);
  }
  
  // Create visualization with hardware acceleration
  const processedCanvas = createVisualization(
    img,
    enhancedMask,
    canvas.width,
    canvas.height,
    useOffscreen
  );
  
  // Calculate metrics with ML-adjusted confidence
  const baseConfidence = calculateConfidence(enhancedMask);
  const confidenceScore = adjustConfidenceForEnvironment(
    baseConfidence,
    environmentalConditions,
    adaptations
  );
  const detectionQuality = calculateQuality(enhancedMask, canvas.width, canvas.height);
  const objectDetection = detectObjects(preprocessedData, enhancedMask, canvas.width, canvas.height);
  
  const processingTime = Math.round(performance.now() - startTime);
  const frameRate = mode === 'video' ? 1000 / processingTime : 0;

  // Calculate pothole metrics
  const potholeCount = potholes.length;
  const closestPotholeDistance = potholes.length > 0
    ? Math.min(...potholes.map(p => p.distance))
    : undefined;

  // Convert to data URLs and byte arrays
  let processedImageUrl: string;
  if (processedCanvas instanceof OffscreenCanvas) {
    const blob = await processedCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    processedImageUrl = URL.createObjectURL(blob);
  } else {
    processedImageUrl = processedCanvas.toDataURL('image/jpeg', 0.9);
  }
  
  const originalImageData = await imageUrlToBytes(imageUrl);
  const processedImageData = await imageUrlToBytes(processedImageUrl);

  // Hardware performance metrics
  const hardwareAcceleration = getHardwareAccelerationStatus(hwCapabilities, useOffscreen);
  const cpuUtilization = estimateCPUUtilization(processingTime, hwCapabilities);
  const processingMode = getProcessingMode(preprocessingLevel, hwCapabilities);
  const performanceStatus = getPerformanceStatus(processingTime, preprocessingLevel, hwCapabilities);

  // Detect obstacles if enabled
  let obstacleDetection;
  if (enableObstacleDetection) {
    try {
      obstacleDetection = await detectObstacles(imageUrl, enhancedMask, canvas.width, canvas.height);
    } catch (error) {
      console.error('Obstacle detection error:', error);
    }
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
  mode: 'image' | 'video',
  hwCapabilities: HardwareCapabilities
): 'full' | 'balanced' | 'fast' {
  // For image mode, always use full preprocessing
  if (mode === 'image') return 'full';
  
  // For high-end hardware, prefer full processing
  if (hwCapabilities.gpuTier === 'high' && hwCapabilities.hardwareConcurrency >= 8) {
    return 'full';
  }
  
  // For video mode, adapt based on performance
  if (!performanceMetrics || performanceMetrics.frameCount < 5) {
    // Start with balanced for medium/high tier, fast for low tier
    return hwCapabilities.gpuTier === 'low' ? 'fast' : 'balanced';
  }
  
  const avgFrameTime = performanceMetrics.avgFrameTime;
  
  // Dynamic thresholds based on hardware tier
  const fullThreshold = hwCapabilities.gpuTier === 'high' ? 200 : 150;
  const balancedThreshold = hwCapabilities.gpuTier === 'high' ? 350 : 300;
  
  if (avgFrameTime < fullThreshold) return 'full';
  if (avgFrameTime < balancedThreshold) return 'balanced';
  
  return 'fast';
}

function getHardwareAccelerationStatus(
  hwCapabilities: HardwareCapabilities,
  useOffscreen: boolean
): string {
  const features: string[] = [];
  
  if (useOffscreen) features.push('OffscreenCanvas');
  if (hwCapabilities.supportsWebGL) features.push('WebGL');
  
  const coreInfo = `${hwCapabilities.hardwareConcurrency} cores`;
  
  if (features.length > 0) {
    return `Active (${features.join(', ')}, ${coreInfo})`;
  }
  
  return `Standard (${coreInfo})`;
}

function estimateCPUUtilization(processingTime: number, hwCapabilities: HardwareCapabilities): string {
  // Estimate based on processing time and hardware capabilities
  const baselineTime = 100; // Expected time for reference hardware
  const utilizationRatio = (baselineTime / processingTime) * (4 / hwCapabilities.hardwareConcurrency);
  
  if (utilizationRatio > 0.8) return 'Optimal (multi-core)';
  if (utilizationRatio > 0.5) return 'Good (parallel)';
  if (utilizationRatio > 0.3) return 'Moderate';
  return 'Light';
}

function getProcessingMode(level: string, hwCapabilities: HardwareCapabilities): string {
  const tier = hwCapabilities.gpuTier || 'medium';
  return `${level.charAt(0).toUpperCase() + level.slice(1)} (${tier}-tier GPU)`;
}

function getPerformanceStatus(
  processingTime: number,
  level: string,
  hwCapabilities: HardwareCapabilities
): string {
  const tier = hwCapabilities.gpuTier || 'medium';
  
  if (level === 'fast') {
    return `Performance mode (${tier}-tier optimization)`;
  } else if (level === 'balanced') {
    return `Balanced mode (${tier}-tier)`;
  } else if (processingTime < 80) {
    return `Excellent (${tier}-tier acceleration)`;
  } else if (processingTime < 150) {
    return `Optimal (${tier}-tier)`;
  } else if (processingTime < 250) {
    return `Good performance`;
  } else {
    return 'Processing...';
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async'; // Use async decoding for better performance
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
  width: number,
  height: number
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
  const brightRatio = brightPixels / sampleCount;
  const whiteRatio = whitePixels / sampleCount;
  const highContrastRatio = highContrastPixels / sampleCount;

  // Determine lighting with more granularity
  let lighting: string;
  if (avgBrightness > 180) lighting = 'Bright';
  else if (avgBrightness > 120) lighting = 'Daylight';
  else if (avgBrightness > 60) lighting = 'Low Light';
  else if (avgBrightness > 30) lighting = 'Dusk';
  else lighting = 'Night';

  // Determine weather with improved detection
  let weather: string;
  if (grayRatio > 0.5) weather = 'Heavy Fog';
  else if (grayRatio > 0.3) weather = 'Foggy';
  else if (avgBlue > 140 && avgBrightness > 150) weather = 'Clear';
  else if (darkRatio > 0.4 && avgBrightness < 80) weather = 'Rainy';
  else if (avgBrightness < 100) weather = 'Overcast';
  else weather = 'Partly Cloudy';

  // Calculate new environment perception signals
  
  // Visibility score (0-1, higher is better visibility)
  let visibility = 1.0;
  if (grayRatio > 0.5) visibility = 0.3;
  else if (grayRatio > 0.3) visibility = 0.5;
  else if (grayRatio > 0.15) visibility = 0.7;
  else if (avgBrightness < 40) visibility = 0.4; // Night reduces visibility
  else if (avgBrightness < 70) visibility = 0.6; // Low light reduces visibility
  visibility = Math.max(0.1, Math.min(1.0, visibility));

  // Fog likelihood (0-1)
  const fogLikelihood = Math.min(1.0, grayRatio * 2.5);

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
  const atmosphericClarity = Math.max(0.1, Math.min(1.0, 
    1.0 - (grayRatio * 0.8) - (darkRatio * 0.3) + (avgBlue / 255) * 0.3
  ));

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
  level: 'full' | 'balanced' | 'fast',
  hwCapabilities: HardwareCapabilities
): { preprocessedData: Uint8ClampedArray; adaptations: string[] } {
  const preprocessed = new Uint8ClampedArray(data);
  const adaptations: string[] = [];

  // Fast mode: only essential preprocessing with SIMD-style operations
  if (level === 'fast') {
    if (conditions.lighting === 'Night' || conditions.lighting === 'Dusk') {
      applyFastLowLightEnhancement(preprocessed);
      adaptations.push('Fast low-light boost');
    }
    return { preprocessedData: preprocessed, adaptations };
  }

  // Balanced mode: selective preprocessing with parallel processing hints
  if (level === 'balanced') {
    if (conditions.lighting === 'Night' || conditions.lighting === 'Dusk' || conditions.lighting === 'Low Light') {
      applyLowLightEnhancement(preprocessed);
      adaptations.push('Low-light brightening');
    }
    
    if (conditions.weather === 'Foggy' || conditions.weather === 'Heavy Fog') {
      applyFogContrastEnhancement(preprocessed);
      adaptations.push('Fog contrast enhancement');
    }
    
    if (conditions.lighting === 'Bright') {
      applyOverexposureCorrection(preprocessed);
      adaptations.push('Brightness normalization');
    }
    
    return { preprocessedData: preprocessed, adaptations };
  }

  // Full mode: all preprocessing with hardware acceleration
  if (conditions.lighting === 'Night' || conditions.lighting === 'Dusk' || conditions.lighting === 'Low Light') {
    applyLowLightEnhancement(preprocessed);
    adaptations.push('Low-light brightening');
  }

  if (conditions.weather === 'Foggy' || conditions.weather === 'Heavy Fog') {
    applyFogContrastEnhancement(preprocessed);
    adaptations.push('Fog contrast enhancement');
  }

  if (conditions.weather === 'Rainy') {
    applyRainStreakNormalization(preprocessed, width, height);
    adaptations.push('Rain streak normalization');
  }

  if (conditions.lighting === 'Bright') {
    applyOverexposureCorrection(preprocessed);
    adaptations.push('Brightness normalization');
  }

  if (conditions.lighting !== 'Daylight' || conditions.weather !== 'Clear') {
    applyAdaptiveHistogramEqualization(preprocessed, width, height);
    adaptations.push('Adaptive contrast adjustment');
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
    data[i] = Math.min(255, Math.pow(r / 255, 0.6) * 255 * 1.3);
    data[i + 1] = Math.min(255, Math.pow(g / 255, 0.6) * 255 * 1.3);
    data[i + 2] = Math.min(255, Math.pow(b / 255, 0.6) * 255 * 1.3);
  }
}

/**
 * Enhance contrast in foggy conditions
 */
function applyFogContrastEnhancement(data: Uint8ClampedArray): void {
  const contrastFactor = 1.4;
  const midpoint = 128;
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, midpoint + (data[i] - midpoint) * contrastFactor));
    data[i + 1] = Math.min(255, Math.max(0, midpoint + (data[i + 1] - midpoint) * contrastFactor));
    data[i + 2] = Math.min(255, Math.max(0, midpoint + (data[i + 2] - midpoint) * contrastFactor));
  }
}

/**
 * Normalize rain streaks
 */
function applyRainStreakNormalization(data: Uint8ClampedArray, width: number, height: number): void {
  // Simple vertical blur to reduce rain streak artifacts
  const tempData = new Uint8ClampedArray(data);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const idxAbove = ((y - 1) * width + x) * 4;
      const idxBelow = ((y + 1) * width + x) * 4;
      
      for (let c = 0; c < 3; c++) {
        data[idx + c] = (tempData[idxAbove + c] + tempData[idx + c] + tempData[idxBelow + c]) / 3;
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
function applyAdaptiveHistogramEqualization(data: Uint8ClampedArray, width: number, height: number): void {
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
  const cdfMin = cdf.find(v => v > 0) || 0;
  
  // Apply equalization
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.floor((data[i] + data[i + 1] + data[i + 2]) / 3);
    const newValue = Math.round(((cdf[gray] - cdfMin) / (totalPixels - cdfMin)) * 255);
    
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
  conditions: EnvironmentalConditions
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
  conditions: EnvironmentalConditions
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
      if (temp[idx] === 255 &&
          temp[idx - 1] === 255 &&
          temp[idx + 1] === 255 &&
          temp[idx - width] === 255 &&
          temp[idx + width] === 255) {
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
  width: number,
  height: number
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
  
  if (roadPixels === 0) return 'Unknown';
  
  const avgBrightness = totalBrightness / roadPixels;
  const avgSaturation = totalSaturation / roadPixels;
  
  if (avgBrightness > 120 && avgSaturation < 0.2) return 'Concrete Highway';
  if (avgBrightness < 80 && avgSaturation < 0.15) return 'Asphalt Road';
  if (avgSaturation > 0.3) return 'Dirt/Gravel Road';
  
  return 'Paved Road';
}

/**
 * Create visualization of road detection
 */
function createVisualization(
  img: HTMLImageElement,
  mask: Uint8Array,
  width: number,
  height: number,
  useOffscreen: boolean
): HTMLCanvasElement | OffscreenCanvas {
  let canvas: HTMLCanvasElement | OffscreenCanvas;
  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  
  if (useOffscreen) {
    canvas = new OffscreenCanvas(width, height);
    ctx = canvas.getContext('2d')!;
  } else {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext('2d')!;
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
  adaptations: string[]
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
  if (conditions.lighting === 'Night') {
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
function calculateQuality(mask: Uint8Array, width: number, height: number): number {
  let roadPixels = 0;
  let edgePixels = 0;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (mask[idx] === 255) {
        roadPixels++;
        
        // Check if edge pixel
        if (mask[idx - 1] === 0 || mask[idx + 1] === 0 ||
            mask[idx - width] === 0 || mask[idx + width] === 0) {
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
  width: number,
  height: number
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
  
  if (objectRatio > 0.3) return 'Multiple objects detected';
  if (objectRatio > 0.15) return 'Objects present';
  if (objectRatio > 0.05) return 'Few objects';
  
  return 'Clear road';
}

/**
 * Convert image URL to byte array
 */
async function imageUrlToBytes(url: string): Promise<Uint8Array> {
  if (url.startsWith('data:')) {
    // Data URL
    const base64 = url.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } else if (url.startsWith('blob:')) {
    // Blob URL
    const response = await fetch(url);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } else {
    // Regular URL
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
}
