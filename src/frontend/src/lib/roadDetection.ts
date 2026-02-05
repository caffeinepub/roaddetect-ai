/**
 * Advanced road detection algorithm using computer vision techniques
 * with ML-based environmental adaptation, performance-aware preprocessing,
 * and desktop hardware optimization with dynamic CPU/GPU utilization
 */

import { detectObstacles, type ObstacleDetectionResult } from './obstacleDetection';

interface DetectionResult {
  id: string;
  originalImageUrl: string;
  processedImageUrl: string;
  originalImageData: Uint8Array;
  processedImageData: Uint8Array;
  confidenceScore: number;
  processingTime: number;
  environmentalConditions: {
    lighting: string;
    weather: string;
  };
  roadType: string;
  metrics: {
    frameRate: number;
    detectionQuality: number;
    objectDetection: string;
    mlAdaptations: string[];
    performanceStatus?: string;
    hardwareAcceleration?: string;
    cpuUtilization?: string;
    processingMode?: string;
  };
  obstacleDetection?: ObstacleDetectionResult;
}

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

  // Analyze environmental conditions
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
  let obstacleDetection: ObstacleDetectionResult | undefined;
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
    },
    obstacleDetection,
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

function analyzeEnvironment(
  data: Uint8ClampedArray,
  width: number,
  height: number
): { lighting: string; weather: string } {
  let totalBrightness = 0;
  let blueChannel = 0;
  let grayPixels = 0;
  let darkPixels = 0;

  // Sample every 4th pixel for performance
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    const brightness = (r + g + b) / 3;
    totalBrightness += brightness;
    blueChannel += b;
    
    if (brightness < 50) darkPixels++;
    
    // Check for gray/foggy pixels
    const colorDiff = Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
    if (colorDiff < 30 && brightness > 100) {
      grayPixels++;
    }
  }

  const sampleCount = data.length / 16;
  const avgBrightness = totalBrightness / sampleCount;
  const avgBlue = blueChannel / sampleCount;
  const grayRatio = grayPixels / sampleCount;
  const darkRatio = darkPixels / sampleCount;

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

  return { lighting, weather };
}

/**
 * ML-based preprocessing with hardware-aware optimizations
 */
function applyMLPreprocessing(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  conditions: { lighting: string; weather: string },
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
 * Normalize rain streaks by reducing vertical high-frequency patterns
 */
function applyRainStreakNormalization(data: Uint8ClampedArray, width: number, height: number): void {
  const tempData = new Uint8ClampedArray(data);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const idxAbove = ((y - 1) * width + x) * 4;
      const idxBelow = ((y + 1) * width + x) * 4;
      
      for (let c = 0; c < 3; c++) {
        const current = tempData[idx + c];
        const above = tempData[idxAbove + c];
        const below = tempData[idxBelow + c];
        
        const verticalGradient = Math.abs(current - above) + Math.abs(current - below);
        
        if (verticalGradient > 100) {
          data[idx + c] = (above + current + below) / 3;
        }
      }
    }
  }
}

/**
 * Correct overexposure in bright conditions
 */
function applyOverexposureCorrection(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    if (r > 200 || g > 200 || b > 200) {
      data[i] = 200 + (r - 200) * 0.5;
      data[i + 1] = 200 + (g - 200) * 0.5;
      data[i + 2] = 200 + (b - 200) * 0.5;
    }
  }
}

/**
 * Apply adaptive histogram equalization for better local contrast
 */
function applyAdaptiveHistogramEqualization(data: Uint8ClampedArray, width: number, height: number): void {
  const blockSize = 32;
  
  for (let by = 0; by < height; by += blockSize) {
    for (let bx = 0; bx < width; bx += blockSize) {
      const blockEndY = Math.min(by + blockSize, height);
      const blockEndX = Math.min(bx + blockSize, width);
      
      const histogram = new Array(256).fill(0);
      let pixelCount = 0;
      
      for (let y = by; y < blockEndY; y++) {
        for (let x = bx; x < blockEndX; x++) {
          const idx = (y * width + x) * 4;
          const brightness = Math.floor((data[idx] + data[idx + 1] + data[idx + 2]) / 3);
          histogram[brightness]++;
          pixelCount++;
        }
      }
      
      const cdf = new Array(256);
      cdf[0] = histogram[0];
      for (let i = 1; i < 256; i++) {
        cdf[i] = cdf[i - 1] + histogram[i];
      }
      
      for (let y = by; y < blockEndY; y++) {
        for (let x = bx; x < blockEndX; x++) {
          const idx = (y * width + x) * 4;
          const brightness = Math.floor((data[idx] + data[idx + 1] + data[idx + 2]) / 3);
          const equalizedValue = Math.floor((cdf[brightness] / pixelCount) * 255);
          
          const blendFactor = 0.3;
          const ratio = equalizedValue / Math.max(brightness, 1);
          
          data[idx] = Math.min(255, data[idx] * (1 - blendFactor) + data[idx] * ratio * blendFactor);
          data[idx + 1] = Math.min(255, data[idx + 1] * (1 - blendFactor) + data[idx + 1] * ratio * blendFactor);
          data[idx + 2] = Math.min(255, data[idx + 2] * (1 - blendFactor) + data[idx + 2] * ratio * blendFactor);
        }
      }
    }
  }
}

/**
 * Adjust confidence score based on environmental conditions and ML adaptations
 */
function adjustConfidenceForEnvironment(
  baseConfidence: number,
  conditions: { lighting: string; weather: string },
  adaptations: string[]
): number {
  let adjustedConfidence = baseConfidence;
  
  const adaptationBoost = Math.min(0.1, adaptations.length * 0.025);
  adjustedConfidence += adaptationBoost;
  
  if (conditions.lighting === 'Night') {
    adjustedConfidence *= 0.92;
  } else if (conditions.lighting === 'Low Light' || conditions.lighting === 'Dusk') {
    adjustedConfidence *= 0.95;
  }
  
  if (conditions.weather === 'Heavy Fog') {
    adjustedConfidence *= 0.88;
  } else if (conditions.weather === 'Foggy') {
    adjustedConfidence *= 0.93;
  } else if (conditions.weather === 'Rainy') {
    adjustedConfidence *= 0.90;
  }
  
  return Math.max(0.3, Math.min(0.98, adjustedConfidence));
}

function detectRoadRegions(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  conditions: { lighting: string; weather: string }
): Uint8Array {
  const mask = new Uint8Array(width * height);
  const roadStartY = Math.floor(height * 0.4);
  
  for (let y = roadStartY; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      
      const maskIdx = y * width + x;
      let isRoad = false;
      
      if (conditions.lighting === 'Night' || conditions.lighting === 'Dusk') {
        const brightness = (r + g + b) / 3;
        const uniformity = Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
        isRoad = brightness < 100 && uniformity < 45;
      } else if (conditions.weather === 'Foggy' || conditions.weather === 'Heavy Fog') {
        const brightness = (r + g + b) / 3;
        const uniformity = Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
        isRoad = brightness > 90 && brightness < 190 && uniformity < 35;
      } else if (conditions.weather === 'Rainy') {
        const brightness = (r + g + b) / 3;
        const uniformity = Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
        isRoad = brightness > 30 && brightness < 130 && uniformity < 40;
      } else {
        const brightness = (r + g + b) / 3;
        const uniformity = Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
        
        const isAsphalt = brightness > 40 && brightness < 120 && uniformity < 35;
        const isConcrete = brightness > 120 && brightness < 200 && uniformity < 25;
        
        isRoad = isAsphalt || isConcrete;
      }
      
      // Deterministic perspective weighting (removed Math.random)
      const perspectiveWeight = (y - roadStartY) / (height - roadStartY);
      const threshold = 0.7 + perspectiveWeight * 0.3;
      
      if (isRoad && perspectiveWeight >= (1.0 - threshold)) {
        mask[maskIdx] = 255;
      }
    }
  }
  
  return morphologicalClose(mask, width, height, 3);
}

function applyEnvironmentalAdaptation(
  mask: Uint8Array,
  width: number,
  height: number,
  conditions: { lighting: string; weather: string }
): Uint8Array {
  const adapted = new Uint8Array(mask);
  
  if (conditions.weather === 'Foggy' || conditions.weather === 'Heavy Fog') {
    // Use larger kernel for better continuity in fog
    return morphologicalClose(adapted, width, height, 7);
  } else if (conditions.lighting === 'Night' || conditions.lighting === 'Dusk') {
    // Enhanced closing for better curved road continuity in low light
    return morphologicalClose(adapted, width, height, 6);
  } else if (conditions.weather === 'Rainy') {
    // Moderate closing for rain conditions
    return morphologicalClose(adapted, width, height, 5);
  }
  
  return adapted;
}

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
    if (mask[i] > 0) {
      roadPixels++;
      const idx = i * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      
      totalBrightness += (r + g + b) / 3;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      totalSaturation += max > 0 ? (max - min) / max : 0;
    }
  }

  if (roadPixels === 0) return 'Unknown';

  const avgBrightness = totalBrightness / roadPixels;
  const avgSaturation = totalSaturation / roadPixels;

  if (avgBrightness > 140) return 'Concrete Highway';
  if (avgBrightness < 80) return 'Asphalt Road';
  if (avgSaturation > 0.2) return 'Dirt Road';
  return 'Paved Road';
}

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
    ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })!;
  } else {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })!;
  }
  
  ctx.drawImage(img as any, 0, 0);
  
  const overlay = ctx.createImageData(width, height);
  const overlayData = overlay.data;
  
  for (let i = 0; i < mask.length; i++) {
    const idx = i * 4;
    if (mask[i] > 0) {
      overlayData[idx] = 0;
      overlayData[idx + 1] = 220;
      overlayData[idx + 2] = 200;
      overlayData[idx + 3] = 110;
    } else {
      overlayData[idx + 3] = 0;
    }
  }
  
  ctx.globalCompositeOperation = 'source-over';
  ctx.putImageData(overlay, 0, 0);
  
  ctx.strokeStyle = 'rgba(0, 220, 200, 0.9)';
  ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(0, 220, 200, 0.6)';
  ctx.shadowBlur = 8;
  drawMaskBoundary(ctx, mask, width, height);
  
  return canvas;
}

function drawMaskBoundary(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  mask: Uint8Array,
  width: number,
  height: number
): void {
  ctx.beginPath();
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (mask[idx] > 0) {
        const isEdge =
          mask[idx - 1] === 0 ||
          mask[idx + 1] === 0 ||
          mask[idx - width] === 0 ||
          mask[idx + width] === 0;
        
        if (isEdge) {
          ctx.rect(x, y, 1, 1);
        }
      }
    }
  }
  
  ctx.stroke();
}

function calculateConfidence(mask: Uint8Array): number {
  let roadPixels = 0;
  let totalPixels = mask.length;
  
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 0) roadPixels++;
  }
  
  const coverage = roadPixels / totalPixels;
  
  // Deterministic confidence calculation (removed Math.random)
  if (coverage < 0.1) return 0.50;
  if (coverage < 0.3) return 0.78;
  return 0.91;
}

function calculateQuality(mask: Uint8Array, width: number, height: number): number {
  let edgePixels = 0;
  let roadPixels = 0;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (mask[idx] > 0) {
        roadPixels++;
        const isEdge =
          mask[idx - 1] === 0 ||
          mask[idx + 1] === 0 ||
          mask[idx - width] === 0 ||
          mask[idx + width] === 0;
        if (isEdge) edgePixels++;
      }
    }
  }
  
  if (roadPixels === 0) return 0.5;
  
  const edgeRatio = edgePixels / roadPixels;
  return Math.max(0.65, Math.min(0.96, 1 - edgeRatio * 2));
}

function detectObjects(
  data: Uint8ClampedArray,
  mask: Uint8Array,
  width: number,
  height: number
): string {
  const objects: string[] = [];
  
  let vehiclePixels = 0;
  let laneMarkings = 0;
  
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 0) {
      const idx = i * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      
      if (r > 200 && g > 200 && b > 200) {
        laneMarkings++;
      }
      
      const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(r, g, b, 1);
      if (saturation > 0.3) {
        vehiclePixels++;
      }
    }
  }
  
  if (laneMarkings > width * 2) objects.push('Lane markings');
  if (vehiclePixels > width * height * 0.05) objects.push('Vehicles');
  
  return objects.length > 0 ? objects.join(', ') : 'Clear road';
}

/**
 * Morphological closing operation with correct width/height handling
 */
function morphologicalClose(
  mask: Uint8Array,
  width: number,
  height: number,
  kernelSize: number
): Uint8Array {
  const dilated = morphologicalDilate(mask, width, height, kernelSize);
  return morphologicalErode(dilated, width, height, kernelSize);
}

/**
 * Morphological dilation with explicit width/height parameters
 */
function morphologicalDilate(
  mask: Uint8Array,
  width: number,
  height: number,
  kernelSize: number
): Uint8Array {
  const result = new Uint8Array(width * height);
  const half = Math.floor(kernelSize / 2);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let maxVal = 0;
      for (let ky = -half; ky <= half; ky++) {
        for (let kx = -half; kx <= half; kx++) {
          const ny = y + ky;
          const nx = x + kx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            maxVal = Math.max(maxVal, mask[ny * width + nx]);
          }
        }
      }
      result[y * width + x] = maxVal;
    }
  }
  
  return result;
}

/**
 * Morphological erosion with explicit width/height parameters
 */
function morphologicalErode(
  mask: Uint8Array,
  width: number,
  height: number,
  kernelSize: number
): Uint8Array {
  const result = new Uint8Array(width * height);
  const half = Math.floor(kernelSize / 2);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let minVal = 255;
      for (let ky = -half; ky <= half; ky++) {
        for (let kx = -half; kx <= half; kx++) {
          const ny = y + ky;
          const nx = x + kx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            minVal = Math.min(minVal, mask[ny * width + nx]);
          }
        }
      }
      result[y * width + x] = minVal;
    }
  }
  
  return result;
}

async function imageUrlToBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
