/**
 * Live hazard detection from raw camera pixel data.
 * Detects fog, wet/slippery road surfaces, and potholes using pixel analysis.
 */

export interface HazardBox {
  type: "pothole" | "fog" | "wet";
  label: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  estimatedDistance: number;
}

export interface LiveHazardResult {
  hazards: HazardBox[];
  fogDetected: boolean;
  fogConfidence: number;
  wetDetected: boolean;
  wetConfidence: number;
  potholeDetected: boolean;
  potholeCount: number;
}

// ─── Fog detection ────────────────────────────────────────────────────────────

function detectFog(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { detected: boolean; confidence: number } {
  // Sample upper 60% of image
  const endY = Math.floor(height * 0.6);
  const step = 4; // sample every 4th pixel for performance

  let totalPixels = 0;
  let brightGrayCount = 0;
  let sumBrightness = 0;
  let sumSatVariance = 0;
  const satSamples: number[] = [];

  for (let y = 0; y < endY; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const brightness = (r + g + b) / 3;
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC > 0 ? (maxC - minC) / maxC : 0;

      sumBrightness += brightness;
      satSamples.push(sat);
      totalPixels++;

      // Fog pixel: high brightness, low saturation (washed-out / gray-white)
      if (brightness > 170 && sat < 0.18) {
        brightGrayCount++;
      }
    }
  }

  if (totalPixels === 0) return { detected: false, confidence: 0 };

  const avgBrightness = sumBrightness / totalPixels;
  const avgSat = satSamples.reduce((a, b) => a + b, 0) / satSamples.length;
  const satVariance =
    satSamples.reduce((a, v) => a + (v - avgSat) ** 2, 0) / satSamples.length;

  sumSatVariance = satVariance;

  const grayRatio = brightGrayCount / totalPixels;

  // Fog signature: high proportion of bright-gray pixels + very low saturation variance
  let confidence = 0;
  if (avgBrightness > 150 && sumSatVariance < 0.015 && grayRatio > 0.45) {
    confidence = Math.min(
      0.95,
      grayRatio * 1.4 + (0.015 - sumSatVariance) * 10,
    );
  } else if (grayRatio > 0.6 && avgBrightness > 170) {
    confidence = Math.min(0.9, grayRatio * 0.95);
  }

  const detected = confidence >= 0.65;
  return { detected, confidence };
}

// ─── Wet surface detection ────────────────────────────────────────────────────

function detectWetSurface(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { detected: boolean; confidence: number } {
  // Sample lower 50% of image (road area)
  const startY = Math.floor(height * 0.5);
  const step = 3;

  let totalPixels = 0;
  let specularCount = 0; // bright pixels surrounded by darker ones
  let blueShiftCount = 0; // b > r + 15
  let reflectiveCount = 0; // low color variance but high brightness

  for (let y = startY; y < height; y += step) {
    for (let x = step; x < width - step; x += step) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const brightness = (r + g + b) / 3;

      totalPixels++;

      // Blue-shifted pixels (water reflection)
      if (b > r + 15 && brightness > 60) {
        blueShiftCount++;
      }

      // Specular reflection: very bright pixel
      if (brightness > 200) {
        // Check neighbours are darker
        const nIdx = ((y - step) * width + x) * 4;
        const sIdx = ((y + step) * width + x) * 4;
        const nBright =
          sIdx < data.length
            ? (data[sIdx] + data[sIdx + 1] + data[sIdx + 2]) / 3
            : brightness;
        const sBright =
          nIdx >= 0
            ? (data[nIdx] + data[nIdx + 1] + data[nIdx + 2]) / 3
            : brightness;
        if (brightness - nBright > 25 || brightness - sBright > 25) {
          specularCount++;
        }
      }

      // Reflective asphalt: low color variance but moderately bright (wet sheen)
      const variance =
        ((r - brightness) ** 2 +
          (g - brightness) ** 2 +
          (b - brightness) ** 2) /
        3;
      if (variance < 80 && brightness > 90 && brightness < 200) {
        reflectiveCount++;
      }
    }
  }

  if (totalPixels === 0) return { detected: false, confidence: 0 };

  const specularRatio = specularCount / totalPixels;
  const blueRatio = blueShiftCount / totalPixels;
  const reflectRatio = reflectiveCount / totalPixels;

  // Combine cues
  let score = specularRatio * 3.5 + blueRatio * 4.0 + reflectRatio * 1.2;

  // Dry road penalty: if scene is mostly uniform mid-gray with very low variance, it's dry asphalt
  let totalVariance = 0;
  let sampleCount = 0;
  for (let y = startY; y < height; y += step * 2) {
    for (let x = 0; x < width; x += step * 2) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b2 = data[idx + 2];
      const br = (r + g + b2) / 3;
      totalVariance += ((r - br) ** 2 + (g - br) ** 2 + (b2 - br) ** 2) / 3;
      sampleCount++;
    }
  }
  const avgVariance = sampleCount > 0 ? totalVariance / sampleCount : 0;
  if (avgVariance < 100 && reflectRatio > 0.4 && specularRatio < 0.01) {
    score *= 0.2; // heavily penalize — likely dry uniform asphalt
  }

  const confidence = Math.min(0.95, score);
  const detected = confidence >= 0.65;
  return { detected, confidence };
}

// ─── Pothole detection ────────────────────────────────────────────────────────

interface PotholeCandidate {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  size: number;
}

function iouPothole(a: PotholeCandidate, b: PotholeCandidate): number {
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

function nmsPotholes(
  candidates: PotholeCandidate[],
  threshold = 0.4,
): PotholeCandidate[] {
  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
  const kept: PotholeCandidate[] = [];
  const suppressed = new Set<number>();
  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue;
    kept.push(sorted[i]);
    for (let j = i + 1; j < sorted.length; j++) {
      if (!suppressed.has(j) && iouPothole(sorted[i], sorted[j]) > threshold) {
        suppressed.add(j);
      }
    }
  }
  return kept;
}

function detectPotholes(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): PotholeCandidate[] {
  // Only look in lower 40% (road area)
  const startY = Math.floor(height * 0.6);
  const gridStep = 8;

  const darkMask = new Uint8Array(width * height);

  // Build dark pixel mask
  for (let y = startY; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const brightness = (r + g + b) / 3;
      // Dark region below road-surface brightness
      if (brightness < 60) {
        darkMask[y * width + x] = 1;
      }
    }
  }

  const visited = new Uint8Array(width * height);
  const candidates: PotholeCandidate[] = [];

  // Scan on a grid and flood-fill dark clusters
  for (let y = startY; y < height; y += gridStep) {
    for (let x = 0; x < width; x += gridStep) {
      const idx = y * width + x;
      if (!darkMask[idx] || visited[idx]) continue;

      // BFS flood fill
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let size = 0;
      const queue: number[] = [idx];

      while (queue.length > 0 && size < 12000) {
        const cur = queue.pop()!;
        if (visited[cur]) continue;
        visited[cur] = 1;
        size++;

        const cx = cur % width;
        const cy = (cur - cx) / width;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        const neighbors = [cur + 1, cur - 1, cur + width, cur - width];
        for (const n of neighbors) {
          if (n >= 0 && n < width * height && !visited[n] && darkMask[n]) {
            queue.push(n);
          }
        }
      }

      if (size < 300) continue;

      const bw = maxX - minX;
      const bh = maxY - minY;
      if (bw < 10 || bh < 10) continue;

      // Check that surrounding pixels are brighter (road surface)
      const padX = Math.floor(bw * 0.3);
      const padY = Math.floor(bh * 0.3);
      const surroundStartX = Math.max(0, minX - padX);
      const surroundStartY = Math.max(startY, minY - padY);
      const surroundEndX = Math.min(width - 1, maxX + padX);
      const surroundEndY = Math.min(height - 1, maxY + padY);

      let surroundSum = 0;
      let surroundCount = 0;
      let innerSum = 0;
      let innerCount = 0;

      for (let sy = surroundStartY; sy <= surroundEndY; sy += 4) {
        for (let sx = surroundStartX; sx <= surroundEndX; sx += 4) {
          const pi = (sy * width + sx) * 4;
          const br = (data[pi] + data[pi + 1] + data[pi + 2]) / 3;
          const insideBox =
            sx >= minX && sx <= maxX && sy >= minY && sy <= maxY;
          if (insideBox) {
            innerSum += br;
            innerCount++;
          } else {
            surroundSum += br;
            surroundCount++;
          }
        }
      }

      const avgInner = innerCount > 0 ? innerSum / innerCount : 60;
      const avgSurround = surroundCount > 0 ? surroundSum / surroundCount : 90;

      // Pothole is darker than surrounding road
      if (avgSurround < 80) continue; // road itself is too dark — likely night/tunnel
      if (avgInner >= avgSurround - 20) continue; // not dark enough contrast

      const contrast = (avgSurround - avgInner) / avgSurround;
      const sizeScore = Math.min(1, size / 3000);
      const confidence = Math.min(
        0.95,
        0.55 + contrast * 0.3 + sizeScore * 0.15,
      );

      if (confidence < 0.65) continue;

      candidates.push({
        x: minX,
        y: minY,
        width: bw,
        height: bh,
        confidence,
        size,
      });
    }
  }

  return nmsPotholes(candidates).slice(0, 2);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function detectLiveHazards(
  imageData: ImageData,
  width: number,
  height: number,
): LiveHazardResult {
  const data = imageData.data as Uint8ClampedArray;

  const fog = detectFog(data, width, height);
  const wet = detectWetSurface(data, width, height);
  const potholes = detectPotholes(data, width, height);

  const hazards: HazardBox[] = [];

  // Add pothole hazard boxes
  for (const p of potholes) {
    const distRatio = (p.y + p.height) / height;
    let dist = 40;
    if (distRatio >= 0.95) dist = 1.5;
    else if (distRatio >= 0.9) dist = 3;
    else if (distRatio >= 0.8) dist = 6;
    else if (distRatio >= 0.7) dist = 12;
    else dist = 20;

    hazards.push({
      type: "pothole",
      label: `Pothole Detected (${Math.round(p.confidence * 100)}%)`,
      confidence: p.confidence,
      boundingBox: { x: p.x, y: p.y, width: p.width, height: p.height },
      estimatedDistance: dist,
    });
  }

  // Fog hazard (whole-frame overlay — no box needed)
  if (fog.detected) {
    hazards.push({
      type: "fog",
      label: `Fog Detected (${Math.round(fog.confidence * 100)}%)`,
      confidence: fog.confidence,
      boundingBox: { x: 0, y: 0, width, height: Math.floor(height * 0.5) },
      estimatedDistance: 999,
    });
  }

  // Wet road hazard (overlay — no standalone box)
  if (wet.detected) {
    hazards.push({
      type: "wet",
      label: `Wet & Slippery Road (${Math.round(wet.confidence * 100)}%)`,
      confidence: wet.confidence,
      boundingBox: {
        x: 0,
        y: Math.floor(height * 0.6),
        width,
        height: Math.floor(height * 0.4),
      },
      estimatedDistance: 999,
    });
  }

  return {
    hazards,
    fogDetected: fog.detected,
    fogConfidence: fog.confidence,
    wetDetected: wet.detected,
    wetConfidence: wet.confidence,
    potholeDetected: potholes.length > 0,
    potholeCount: potholes.length,
  };
}
