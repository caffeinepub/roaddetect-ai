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
 * Detect wet or slippery surfaces using multi-cue analysis.
 * Confidence threshold: 0.7 — only reports wet if score >= 0.7.
 * Detects: rain streaks, water puddles, oil spills, wet road reflections.
 * Prevents false positives from dry asphalt, shadows, and normal road texture.
 */
async function computeWetSurfaceDetection(
  data: Uint8ClampedArray,
  roadMask: Uint8Array,
  width: number,
  height: number,
  conditions: { lighting: string; weather: string },
): Promise<RoadSurfaceFeatures["wetSurface"]> {
  const WET_THRESHOLD = 0.7;

  // --- Scan road pixels in lower 60% for wetness cues ---
  const scanStartY = Math.floor(height * 0.4);

  let roadPixels = 0;
  let puddlePixels = 0; // medium brightness + blue dominant
  let oilPixels = 0; // rainbow sheen: high saturation, no single extreme channel
  let reflectionPixels = 0; // bright spot surrounded by dark road
  let dryGrayPixels = 0; // all channels close + mid brightness + low saturation

  // Collect brightness values for surrounding context (specular highlight check)
  // We'll use a sampling approach: for each bright pixel, check its neighborhood
  const neighborRadius = 12;

  for (let y = scanStartY; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (roadMask[idx] === 0) continue;

      roadPixels++;
      const pixelIdx = idx * 4;
      const r = data[pixelIdx];
      const g = data[pixelIdx + 1];
      const b = data[pixelIdx + 2];
      const brightness = (r + g + b) / 3;
      const maxCh = Math.max(r, g, b);
      const minCh = Math.min(r, g, b);
      const saturation = maxCh > 0 ? (maxCh - minCh) / maxCh : 0;

      // --- Dry road check ---
      // Mid-gray, all channels close, low saturation
      const channelSpread = Math.max(
        Math.abs(r - g),
        Math.abs(g - b),
        Math.abs(r - b),
      );
      if (
        brightness >= 80 &&
        brightness <= 160 &&
        channelSpread <= 15 &&
        saturation < 0.12
      ) {
        dryGrayPixels++;
      }

      // --- Water puddle ---
      // Medium brightness (120-190), blue channel dominant over red by 15+, over green by 5+
      if (brightness >= 120 && brightness <= 190 && b > r + 15 && b > g + 5) {
        puddlePixels++;
      }

      // --- Oil spill (rainbow sheen) ---
      // High saturation (>0.35), no single channel at extreme values (not pure red/green/blue),
      // hue variance between channels indicates sheen
      if (saturation > 0.35) {
        // Exclude pixels that are mostly one pure channel (traffic signs, markings)
        const dominated = maxCh > 200 && minCh < 40;
        if (!dominated) {
          // Check that we have variance between channels (rainbow sheen)
          const variance =
            ((r - brightness) ** 2 +
              (g - brightness) ** 2 +
              (b - brightness) ** 2) /
            3;
          if (variance > 300) {
            oilPixels++;
          }
        }
      }

      // --- Wet road reflections (specular highlights on dark road) ---
      // Bright pixel (>200) surrounded by dark road (avg neighborhood < 90)
      if (brightness > 200) {
        let neighborSum = 0;
        let neighborCount = 0;
        const ny1 = Math.max(0, y - neighborRadius);
        const ny2 = Math.min(height - 1, y + neighborRadius);
        const nx1 = Math.max(0, x - neighborRadius);
        const nx2 = Math.min(width - 1, x + neighborRadius);

        // Sample every 3rd pixel for performance
        for (let ny = ny1; ny <= ny2; ny += 3) {
          for (let nx = nx1; nx <= nx2; nx += 3) {
            if (ny === y && nx === x) continue;
            const nIdx = ny * width + nx;
            if (roadMask[nIdx] === 0) continue;
            const nPix = nIdx * 4;
            const nb = (data[nPix] + data[nPix + 1] + data[nPix + 2]) / 3;
            neighborSum += nb;
            neighborCount++;
          }
        }

        if (neighborCount > 0) {
          const avgNeighborBrightness = neighborSum / neighborCount;
          // Specular highlight surrounded by dark road = wet reflection
          if (avgNeighborBrightness < 90) {
            reflectionPixels++;
          }
        }
      }
    }
  }

  // --- Rain streak detection ---
  // Scan vertical strips for alternating bright/dark patterns (vertical lines)
  let rainScore = 0;
  const stripWidth = 4;
  const minStreakLength = Math.floor(height * 0.15);
  let streakStrips = 0;
  let totalStrips = 0;

  for (let x = stripWidth; x < width - stripWidth; x += stripWidth * 2) {
    totalStrips++;
    let transitions = 0;
    let prevBright = -1;

    for (let y = 0; y < height; y++) {
      const idx = y * width + x;
      const pixelIdx = idx * 4;
      const brightness =
        (data[pixelIdx] + data[pixelIdx + 1] + data[pixelIdx + 2]) / 3;
      const isBright = brightness > 140 ? 1 : 0;

      if (prevBright !== -1 && isBright !== prevBright) {
        transitions++;
      }
      prevBright = isBright;
    }

    // Many transitions in a narrow vertical strip suggests rain streaks
    const transitionDensity = transitions / height;
    if (transitions >= minStreakLength / 2 && transitionDensity > 0.3) {
      streakStrips++;
    }
  }

  if (totalStrips > 0) {
    rainScore = Math.min(1, (streakStrips / totalStrips) * 2.5);
    // Only count rain streaks if a meaningful portion of strips are streaky
    if (streakStrips / totalStrips < 0.35) rainScore = 0;
  }

  // --- Dry road confidence ---
  const dryRoadConfidence =
    roadPixels > 0 ? Math.min(1, (dryGrayPixels / roadPixels) * 2) : 0;

  // --- Score calculation ---
  let puddleScore = 0;
  let oilScore = 0;
  let reflectionScore = 0;

  if (roadPixels > 0) {
    puddleScore = Math.min(1, (puddlePixels / roadPixels) * 8);
    oilScore = Math.min(1, (oilPixels / roadPixels) * 12);
    reflectionScore = Math.min(1, (reflectionPixels / roadPixels) * 20);
  }

  // Minimum pixel count guards — avoid noise on tiny images
  if (puddlePixels < 50) puddleScore = 0;
  if (oilPixels < 30) oilScore = 0;
  if (reflectionPixels < 10) reflectionScore = 0;

  let wetnessScore =
    rainScore * 0.35 +
    puddleScore * 0.35 +
    oilScore * 0.2 +
    reflectionScore * 0.1;

  // Apply dry road penalty
  if (dryRoadConfidence > 0.7) {
    wetnessScore *= 0.2;
  }

  // Weather boost only if strong enough signal already present
  if (wetnessScore > 0.4 && conditions.weather.includes("Rain")) {
    wetnessScore = Math.min(1, wetnessScore * 1.2);
  }

  // Enforce threshold — below 0.7 means not wet
  if (wetnessScore < WET_THRESHOLD) {
    wetnessScore = 0;
  }

  const slipperinessScore = wetnessScore;

  // Find bounding box of wet area pixels for visualization
  let wetMinX = width;
  let wetMinY = height;
  let wetMaxX = 0;
  let wetMaxY = 0;
  let wetAreaPixelCount = 0;

  if (wetnessScore >= WET_THRESHOLD) {
    for (let y = scanStartY; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (roadMask[idx] === 0) continue;
        const pixelIdx = idx * 4;
        const r = data[pixelIdx];
        const g = data[pixelIdx + 1];
        const b = data[pixelIdx + 2];
        const brightness = (r + g + b) / 3;
        // Mark pixels contributing to wetness signal
        const isWetPixel =
          (brightness >= 120 && brightness <= 190 && b > r + 15 && b > g + 5) || // puddle
          brightness > 200; // specular
        if (isWetPixel) {
          wetMinX = Math.min(wetMinX, x);
          wetMinY = Math.min(wetMinY, y);
          wetMaxX = Math.max(wetMaxX, x);
          wetMaxY = Math.max(wetMaxY, y);
          wetAreaPixelCount++;
        }
      }
    }
  }

  const visualizationUrl = await createWetSurfaceVisualization(
    data,
    roadMask,
    width,
    height,
    wetnessScore,
    wetAreaPixelCount > 20
      ? { minX: wetMinX, minY: wetMinY, maxX: wetMaxX, maxY: wetMaxY }
      : null,
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
 * Create wet surface visualization.
 * Returns null if no wet area detected (score = 0).
 * When wet area IS detected, draws a blue dashed bounding box around the wet region.
 */
async function createWetSurfaceVisualization(
  data: Uint8ClampedArray,
  roadMask: Uint8Array,
  width: number,
  height: number,
  wetnessScore: number,
  wetBbox: { minX: number; minY: number; maxX: number; maxY: number } | null,
): Promise<string | null> {
  // If no wetness detected, return null — no visualization needed
  if (wetnessScore === 0 || wetBbox === null) return null;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Draw the original pixel data as base
    const imageData = ctx.createImageData(width, height);
    for (let i = 0; i < roadMask.length; i++) {
      const idx = i * 4;
      imageData.data[idx] = data[idx];
      imageData.data[idx + 1] = data[idx + 1];
      imageData.data[idx + 2] = data[idx + 2];
      imageData.data[idx + 3] = roadMask[i] > 0 ? 200 : 0;
    }
    ctx.putImageData(imageData, 0, 0);

    // Draw blue tint overlay on road area
    for (let i = 0; i < roadMask.length; i++) {
      const idx = i * 4;
      if (roadMask[i] > 0) {
        imageData.data[idx] = Math.min(255, data[idx] * 0.5 + 25);
        imageData.data[idx + 1] = Math.min(255, data[idx + 1] * 0.5 + 75);
        imageData.data[idx + 2] = Math.min(255, data[idx + 2] * 0.5 + 128);
        imageData.data[idx + 3] = 180;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Draw bounding box around detected wet area
    const pad = 8;
    const bx = Math.max(0, wetBbox.minX - pad);
    const by = Math.max(0, wetBbox.minY - pad);
    const bw = Math.min(width, wetBbox.maxX + pad) - bx;
    const bh = Math.min(height, wetBbox.maxY + pad) - by;

    // Dashed blue bounding box
    ctx.strokeStyle = "rgba(50, 150, 255, 0.9)";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(bx, by, bw, bh);
    ctx.setLineDash([]);

    // Label above the bounding box
    const labelText = "Wet Area";
    ctx.font = "bold 14px sans-serif";
    const textWidth = ctx.measureText(labelText).width;
    const labelX = bx;
    const labelY = Math.max(20, by - 6);

    // Label background
    ctx.fillStyle = "rgba(50, 150, 255, 0.85)";
    ctx.fillRect(labelX - 2, labelY - 16, textWidth + 10, 20);

    // Label text
    ctx.fillStyle = "white";
    ctx.fillText(labelText, labelX + 3, labelY - 1);

    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("[Visualization] Wet surface failed:", error);
    return null;
  }
}
