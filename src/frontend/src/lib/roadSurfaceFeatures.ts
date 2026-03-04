/**
 * Road surface feature extraction for advanced road analysis
 * Computes: segmentation, drivable area, road edges, damage (potholes/cracks), wet/slippery detection
 * All features use in-browser CV with safe defaults on failure
 */

export interface RoadSurfaceFeatures {
  segmentation: {
    mask: Uint8Array;
    coverage: number;
    visualizationUrl: string | null;
  };
  drivableArea: {
    mask: Uint8Array;
    coverage: number;
    visualizationUrl: string | null;
  };
  roadEdges: {
    edgeMap: Uint8Array;
    edgeStrength: number;
    edgeCount: number;
    visualizationUrl: string | null;
  };
  damage: {
    potholeScore: number;
    crackScore: number;
    damageLocations: Array<{
      x: number;
      y: number;
      type: "pothole" | "crack";
      severity: number;
    }>;
    visualizationUrl: string | null;
  };
  wetSurface: {
    wetnessScore: number;
    slipperinessScore: number;
    visualizationUrl: string | null;
  };
}

/**
 * Extract all road surface features from image data
 */
export async function extractRoadSurfaceFeatures(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  roadMask: Uint8Array,
  conditions: { lighting: string; weather: string },
): Promise<RoadSurfaceFeatures> {
  const features: RoadSurfaceFeatures = {
    segmentation: {
      mask: new Uint8Array(0),
      coverage: 0,
      visualizationUrl: null,
    },
    drivableArea: {
      mask: new Uint8Array(0),
      coverage: 0,
      visualizationUrl: null,
    },
    roadEdges: {
      edgeMap: new Uint8Array(0),
      edgeStrength: 0,
      edgeCount: 0,
      visualizationUrl: null,
    },
    damage: {
      potholeScore: 0,
      crackScore: 0,
      damageLocations: [],
      visualizationUrl: null,
    },
    wetSurface: {
      wetnessScore: 0,
      slipperinessScore: 0,
      visualizationUrl: null,
    },
  };

  try {
    // 1. Road region segmentation
    features.segmentation = await computeSegmentation(roadMask, width, height);
  } catch (error) {
    console.error("[RoadSurface] Segmentation failed:", error);
  }

  try {
    // 2. Drivable area detection
    features.drivableArea = await computeDrivableArea(
      data,
      roadMask,
      width,
      height,
      conditions,
    );
  } catch (error) {
    console.error("[RoadSurface] Drivable area failed:", error);
  }

  try {
    // 3. Road edge detection
    features.roadEdges = await computeRoadEdges(roadMask, width, height);
  } catch (error) {
    console.error("[RoadSurface] Edge detection failed:", error);
  }

  try {
    // 4. Pothole and crack detection
    features.damage = await computeDamageDetection(
      data,
      roadMask,
      width,
      height,
      conditions,
    );
  } catch (error) {
    console.error("[RoadSurface] Damage detection failed:", error);
  }

  try {
    // 5. Wet/slippery surface detection
    features.wetSurface = await computeWetSurfaceDetection(
      data,
      roadMask,
      width,
      height,
      conditions,
    );
  } catch (error) {
    console.error("[RoadSurface] Wet surface detection failed:", error);
  }

  return features;
}

/**
 * Compute road region segmentation
 */
async function computeSegmentation(
  roadMask: Uint8Array,
  width: number,
  height: number,
): Promise<RoadSurfaceFeatures["segmentation"]> {
  const mask = new Uint8Array(roadMask);
  let roadPixels = 0;

  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 0) roadPixels++;
  }

  const coverage = roadPixels / mask.length;
  const visualizationUrl = await createSegmentationVisualization(
    mask,
    width,
    height,
  );

  return { mask, coverage, visualizationUrl };
}

/**
 * Compute drivable area (safe road regions without obstacles)
 */
async function computeDrivableArea(
  data: Uint8ClampedArray,
  roadMask: Uint8Array,
  width: number,
  height: number,
  _conditions: { lighting: string; weather: string },
): Promise<RoadSurfaceFeatures["drivableArea"]> {
  const mask = new Uint8Array(roadMask.length);
  let drivablePixels = 0;

  // Drivable area = road mask minus obstacles and hazards
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (roadMask[idx] === 0) continue;

      const pixelIdx = idx * 4;
      const r = data[pixelIdx];
      const g = data[pixelIdx + 1];
      const b = data[pixelIdx + 2];

      // Exclude bright spots (potential obstacles/vehicles)
      const brightness = (r + g + b) / 3;
      const saturation =
        (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(r, g, b, 1);

      const isObstacle = brightness > 180 || saturation > 0.4;

      if (!isObstacle) {
        mask[idx] = 255;
        drivablePixels++;
      }
    }
  }

  const coverage = drivablePixels / roadMask.length;
  const visualizationUrl = await createDrivableAreaVisualization(
    mask,
    width,
    height,
  );

  return { mask, coverage, visualizationUrl };
}

/**
 * Compute road edges using Sobel edge detection
 */
async function computeRoadEdges(
  roadMask: Uint8Array,
  width: number,
  height: number,
): Promise<RoadSurfaceFeatures["roadEdges"]> {
  const edgeMap = new Uint8Array(roadMask.length);
  let totalEdgeStrength = 0;
  let edgeCount = 0;

  // Sobel kernels
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (roadMask[idx] === 0) continue;

      let gx = 0;
      let gy = 0;

      // Apply Sobel operator
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const nIdx = (y + ky) * width + (x + kx);
          const kernelIdx = (ky + 1) * 3 + (kx + 1);
          const value = roadMask[nIdx];

          gx += value * sobelX[kernelIdx];
          gy += value * sobelY[kernelIdx];
        }
      }

      const magnitude = Math.sqrt(gx * gx + gy * gy);

      if (magnitude > 100) {
        edgeMap[idx] = Math.min(255, magnitude);
        totalEdgeStrength += magnitude;
        edgeCount++;
      }
    }
  }

  const edgeStrength = edgeCount > 0 ? totalEdgeStrength / edgeCount / 255 : 0;
  const visualizationUrl = await createEdgeVisualization(
    edgeMap,
    width,
    height,
  );

  return { edgeMap, edgeStrength, edgeCount, visualizationUrl };
}

/**
 * Detect potholes and cracks using texture analysis
 */
async function computeDamageDetection(
  data: Uint8ClampedArray,
  roadMask: Uint8Array,
  width: number,
  height: number,
  _conditions: { lighting: string; weather: string },
): Promise<RoadSurfaceFeatures["damage"]> {
  const damageLocations: Array<{
    x: number;
    y: number;
    type: "pothole" | "crack";
    severity: number;
  }> = [];
  let potholeScore = 0;
  let crackScore = 0;
  let potholeCount = 0;
  let crackCount = 0;

  const blockSize = 16;

  for (let by = 0; by < height - blockSize; by += blockSize) {
    for (let bx = 0; bx < width - blockSize; bx += blockSize) {
      let roadPixelsInBlock = 0;
      let avgBrightness = 0;
      let brightnessVariance = 0;
      let darkPixels = 0;

      // First pass: compute average brightness
      for (let y = by; y < by + blockSize && y < height; y++) {
        for (let x = bx; x < bx + blockSize && x < width; x++) {
          const idx = y * width + x;
          if (roadMask[idx] === 0) continue;

          roadPixelsInBlock++;
          const pixelIdx = idx * 4;
          const brightness =
            (data[pixelIdx] + data[pixelIdx + 1] + data[pixelIdx + 2]) / 3;
          avgBrightness += brightness;

          if (brightness < 60) darkPixels++;
        }
      }

      if (roadPixelsInBlock < blockSize * blockSize * 0.5) continue;

      avgBrightness /= roadPixelsInBlock;

      // Second pass: compute variance
      for (let y = by; y < by + blockSize && y < height; y++) {
        for (let x = bx; x < bx + blockSize && x < width; x++) {
          const idx = y * width + x;
          if (roadMask[idx] === 0) continue;

          const pixelIdx = idx * 4;
          const brightness =
            (data[pixelIdx] + data[pixelIdx + 1] + data[pixelIdx + 2]) / 3;
          brightnessVariance += (brightness - avgBrightness) ** 2;
        }
      }

      brightnessVariance /= roadPixelsInBlock;

      // Pothole detection: dark spots with low variance
      const darkRatio = darkPixels / roadPixelsInBlock;
      if (avgBrightness < 80 && brightnessVariance < 200 && darkRatio > 0.6) {
        const severity = Math.min(1, darkRatio * (1 - avgBrightness / 255));
        damageLocations.push({
          x: bx + blockSize / 2,
          y: by + blockSize / 2,
          type: "pothole",
          severity,
        });
        potholeScore += severity;
        potholeCount++;
      }

      // Crack detection: high variance with linear patterns
      if (
        brightnessVariance > 400 &&
        avgBrightness > 60 &&
        avgBrightness < 150
      ) {
        const severity = Math.min(1, brightnessVariance / 1000);
        damageLocations.push({
          x: bx + blockSize / 2,
          y: by + blockSize / 2,
          type: "crack",
          severity,
        });
        crackScore += severity;
        crackCount++;
      }
    }
  }

  potholeScore = potholeCount > 0 ? potholeScore / potholeCount : 0;
  crackScore = crackCount > 0 ? crackScore / crackCount : 0;

  const visualizationUrl = await createDamageVisualization(
    data,
    damageLocations,
    width,
    height,
  );

  return { potholeScore, crackScore, damageLocations, visualizationUrl };
}

/**
 * Detect wet or slippery surfaces using reflectance and color analysis
 */
async function computeWetSurfaceDetection(
  data: Uint8ClampedArray,
  roadMask: Uint8Array,
  width: number,
  height: number,
  conditions: { lighting: string; weather: string },
): Promise<RoadSurfaceFeatures["wetSurface"]> {
  let wetnessScore = 0;
  let slipperinessScore = 0;

  let roadPixels = 0;
  let highReflectancePixels = 0;
  let blueShiftPixels = 0;
  let darkWetPixels = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (roadMask[idx] === 0) continue;

      roadPixels++;
      const pixelIdx = idx * 4;
      const r = data[pixelIdx];
      const g = data[pixelIdx + 1];
      const b = data[pixelIdx + 2];

      const brightness = (r + g + b) / 3;

      // High reflectance (specular highlights from water)
      if (brightness > 200 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20) {
        highReflectancePixels++;
      }

      // Blue shift (water has higher blue component)
      if (b > r + 10 && b > g + 10) {
        blueShiftPixels++;
      }

      // Dark wet patches
      if (brightness < 70 && Math.abs(r - g) < 15 && Math.abs(g - b) < 15) {
        darkWetPixels++;
      }
    }
  }

  if (roadPixels > 0) {
    const reflectanceRatio = highReflectancePixels / roadPixels;
    const blueShiftRatio = blueShiftPixels / roadPixels;
    const darkWetRatio = darkWetPixels / roadPixels;

    // Wetness score based on reflectance and color
    wetnessScore = Math.min(
      1,
      (reflectanceRatio * 2 + blueShiftRatio + darkWetRatio) / 3,
    );

    // Slipperiness correlates with wetness and weather
    slipperinessScore = wetnessScore;
    if (conditions.weather.includes("Rain")) {
      slipperinessScore = Math.min(1, slipperinessScore * 1.3);
    }
    if (conditions.weather.includes("Fog")) {
      slipperinessScore = Math.min(1, slipperinessScore * 1.1);
    }
  }

  const visualizationUrl = await createWetSurfaceVisualization(
    data,
    roadMask,
    width,
    height,
    wetnessScore,
  );

  return { wetnessScore, slipperinessScore, visualizationUrl };
}

/**
 * Create segmentation visualization overlay
 */
async function createSegmentationVisualization(
  mask: Uint8Array,
  width: number,
  height: number,
): Promise<string | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let i = 0; i < mask.length; i++) {
      const idx = i * 4;
      if (mask[i] > 0) {
        data[idx] = 100;
        data[idx + 1] = 200;
        data[idx + 2] = 255;
        data[idx + 3] = 180;
      } else {
        data[idx + 3] = 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("[Visualization] Segmentation failed:", error);
    return null;
  }
}

/**
 * Create drivable area visualization overlay
 */
async function createDrivableAreaVisualization(
  mask: Uint8Array,
  width: number,
  height: number,
): Promise<string | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let i = 0; i < mask.length; i++) {
      const idx = i * 4;
      if (mask[i] > 0) {
        data[idx] = 50;
        data[idx + 1] = 255;
        data[idx + 2] = 100;
        data[idx + 3] = 160;
      } else {
        data[idx + 3] = 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("[Visualization] Drivable area failed:", error);
    return null;
  }
}

/**
 * Create edge detection visualization
 */
async function createEdgeVisualization(
  edgeMap: Uint8Array,
  width: number,
  height: number,
): Promise<string | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let i = 0; i < edgeMap.length; i++) {
      const idx = i * 4;
      const edgeValue = edgeMap[i];
      if (edgeValue > 0) {
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 0;
        data[idx + 3] = edgeValue;
      } else {
        data[idx + 3] = 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("[Visualization] Edge detection failed:", error);
    return null;
  }
}

/**
 * Create damage detection visualization
 */
async function createDamageVisualization(
  _data: Uint8ClampedArray,
  damageLocations: Array<{
    x: number;
    y: number;
    type: "pothole" | "crack";
    severity: number;
  }>,
  width: number,
  height: number,
): Promise<string | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Draw semi-transparent background
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(0, 0, width, height);

    // Draw damage markers
    for (const location of damageLocations) {
      const radius = 12 + location.severity * 8;
      ctx.beginPath();
      ctx.arc(location.x, location.y, radius, 0, Math.PI * 2);

      if (location.type === "pothole") {
        ctx.fillStyle = `rgba(255, 50, 50, ${0.5 + location.severity * 0.3})`;
        ctx.strokeStyle = `rgba(255, 100, 100, ${0.8 + location.severity * 0.2})`;
      } else {
        ctx.fillStyle = `rgba(255, 150, 0, ${0.4 + location.severity * 0.3})`;
        ctx.strokeStyle = `rgba(255, 200, 0, ${0.7 + location.severity * 0.3})`;
      }

      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle = "white";
      ctx.font = "10px sans-serif";
      ctx.fillText(
        location.type === "pothole" ? "P" : "C",
        location.x - 3,
        location.y + 4,
      );
    }

    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("[Visualization] Damage detection failed:", error);
    return null;
  }
}

/**
 * Create wet surface visualization
 */
async function createWetSurfaceVisualization(
  data: Uint8ClampedArray,
  roadMask: Uint8Array,
  width: number,
  height: number,
  wetnessScore: number,
): Promise<string | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const imageData = ctx.createImageData(width, height);
    const overlayData = imageData.data;

    for (let i = 0; i < roadMask.length; i++) {
      const idx = i * 4;
      if (roadMask[i] > 0) {
        const pixelIdx = i * 4;
        const r = data[pixelIdx];
        const g = data[pixelIdx + 1];
        const b = data[pixelIdx + 2];
        const brightness = (r + g + b) / 3;

        // Highlight wet areas with blue tint
        const isWet =
          brightness > 200 || (b > r + 10 && b > g + 10) || brightness < 70;

        if (isWet) {
          overlayData[idx] = 50;
          overlayData[idx + 1] = 150;
          overlayData[idx + 2] = 255;
          overlayData[idx + 3] = Math.floor(100 + wetnessScore * 80);
        } else {
          overlayData[idx + 3] = 0;
        }
      } else {
        overlayData[idx + 3] = 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("[Visualization] Wet surface failed:", error);
    return null;
  }
}
