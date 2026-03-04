export interface AccidentIndicator {
  type: string;
  confidence: number;
  description: string;
}

export interface AccidentAnalysisResult {
  confidence: number;
  indicators: AccidentIndicator[];
  summary: string;
  isAccident: boolean;
}

export async function analyzeAccidentScene(
  imageData: ImageData,
): Promise<AccidentAnalysisResult> {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  ctx.putImageData(imageData, 0, 0);

  const indicators: AccidentIndicator[] = [];
  let totalConfidence = 0;

  // Analyze for damaged vehicles (dark spots, irregular shapes)
  const vehicleDamage = detectVehicleDamage(imageData);
  if (vehicleDamage.detected) {
    indicators.push({
      type: "Damaged Vehicle",
      confidence: vehicleDamage.confidence,
      description: "Potential vehicle damage detected in the scene",
    });
    totalConfidence += vehicleDamage.confidence;
  }

  // Analyze for debris (scattered objects, irregular patterns)
  const debris = detectDebris(imageData);
  if (debris.detected) {
    indicators.push({
      type: "Debris",
      confidence: debris.confidence,
      description: "Scattered debris or objects detected on the road",
    });
    totalConfidence += debris.confidence;
  }

  // Analyze for emergency vehicles (bright colors, flashing patterns)
  const emergency = detectEmergencyVehicles(imageData);
  if (emergency.detected) {
    indicators.push({
      type: "Emergency Response",
      confidence: emergency.confidence,
      description: "Emergency vehicles or response activity detected",
    });
    totalConfidence += emergency.confidence;
  }

  // Analyze for broken glass (bright reflective spots)
  const glass = detectBrokenGlass(imageData);
  if (glass.detected) {
    indicators.push({
      type: "Broken Glass",
      confidence: glass.confidence,
      description: "Reflective fragments suggesting broken glass",
    });
    totalConfidence += glass.confidence;
  }

  // Analyze for skid marks (dark linear patterns)
  const skidMarks = detectSkidMarks(imageData);
  if (skidMarks.detected) {
    indicators.push({
      type: "Skid Marks",
      confidence: skidMarks.confidence,
      description: "Tire marks or skid patterns on road surface",
    });
    totalConfidence += skidMarks.confidence;
  }

  const averageConfidence =
    indicators.length > 0 ? totalConfidence / indicators.length : 0;
  const isAccident = averageConfidence > 0.4 && indicators.length >= 2;

  let summary = "";
  if (isAccident) {
    summary = `High probability accident scene detected with ${indicators.length} indicators. ${indicators.map((i) => i.type).join(", ")} identified.`;
  } else if (indicators.length > 0) {
    summary =
      "Possible accident indicators detected but confidence is low. Further verification recommended.";
  } else {
    summary = "No significant accident indicators detected in the image.";
  }

  return {
    confidence: averageConfidence,
    indicators,
    summary,
    isAccident,
  };
}

function detectVehicleDamage(imageData: ImageData): {
  detected: boolean;
  confidence: number;
} {
  const { data, width, height } = imageData;
  let darkSpots = 0;
  let irregularShapes = 0;
  const sampleSize = Math.floor(width * height * 0.1);

  for (let i = 0; i < sampleSize; i++) {
    const idx = Math.floor(Math.random() * (data.length / 4)) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    const brightness = (r + g + b) / 3;

    if (brightness < 80) {
      darkSpots++;
    }

    const variance = Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
    if (variance > 100) {
      irregularShapes++;
    }
  }

  const darkRatio = darkSpots / sampleSize;
  const irregularRatio = irregularShapes / sampleSize;
  const confidence = Math.min((darkRatio * 0.5 + irregularRatio * 0.5) * 2, 1);

  return {
    detected: confidence > 0.3,
    confidence,
  };
}

function detectDebris(imageData: ImageData): {
  detected: boolean;
  confidence: number;
} {
  const { data, width, height } = imageData;
  let scatteredObjects = 0;
  const sampleSize = Math.floor(width * height * 0.1);

  for (let i = 0; i < sampleSize; i++) {
    const idx = Math.floor(Math.random() * (data.length / 4)) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    const saturation = Math.max(r, g, b) - Math.min(r, g, b);

    if (saturation > 50 && saturation < 150) {
      scatteredObjects++;
    }
  }

  const confidence = Math.min((scatteredObjects / sampleSize) * 3, 1);

  return {
    detected: confidence > 0.25,
    confidence,
  };
}

function detectEmergencyVehicles(imageData: ImageData): {
  detected: boolean;
  confidence: number;
} {
  const { data } = imageData;
  let brightColors = 0;
  let redBluePatterns = 0;
  const sampleSize = Math.floor((data.length / 4) * 0.1);

  for (let i = 0; i < sampleSize; i++) {
    const idx = Math.floor(Math.random() * (data.length / 4)) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    if (r > 200 && g < 100 && b < 100) {
      redBluePatterns++;
    }

    if (r < 100 && g < 100 && b > 200) {
      redBluePatterns++;
    }

    const brightness = (r + g + b) / 3;
    if (brightness > 200) {
      brightColors++;
    }
  }

  const confidence = Math.min(
    (redBluePatterns / sampleSize) * 5 + (brightColors / sampleSize) * 2,
    1,
  );

  return {
    detected: confidence > 0.2,
    confidence,
  };
}

function detectBrokenGlass(imageData: ImageData): {
  detected: boolean;
  confidence: number;
} {
  const { data } = imageData;
  let reflectiveSpots = 0;
  const sampleSize = Math.floor((data.length / 4) * 0.1);

  for (let i = 0; i < sampleSize; i++) {
    const idx = Math.floor(Math.random() * (data.length / 4)) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    const brightness = (r + g + b) / 3;
    const uniformity = Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);

    if (brightness > 220 && uniformity < 30) {
      reflectiveSpots++;
    }
  }

  const confidence = Math.min((reflectiveSpots / sampleSize) * 4, 1);

  return {
    detected: confidence > 0.2,
    confidence,
  };
}

function detectSkidMarks(imageData: ImageData): {
  detected: boolean;
  confidence: number;
} {
  const { data, width } = imageData;
  let darkLinearPatterns = 0;
  const sampleSize = Math.floor((data.length / 4) * 0.05);

  for (let i = 0; i < sampleSize; i++) {
    const idx = Math.floor(Math.random() * (data.length / 4)) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    const brightness = (r + g + b) / 3;

    if (brightness < 60) {
      const nextIdx = idx + width * 4;
      if (nextIdx < data.length) {
        const nextBrightness =
          (data[nextIdx] + data[nextIdx + 1] + data[nextIdx + 2]) / 3;
        if (Math.abs(brightness - nextBrightness) < 20) {
          darkLinearPatterns++;
        }
      }
    }
  }

  const confidence = Math.min((darkLinearPatterns / sampleSize) * 3, 1);

  return {
    detected: confidence > 0.25,
    confidence,
  };
}
