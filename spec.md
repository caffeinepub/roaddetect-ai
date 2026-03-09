# Road Detection System

## Current State
The app has a full road detection system with:
- Live camera and image upload detection tabs
- Obstacle detection with NMS (IoU 0.45, confidence ≥ 0.6)
- Bounding boxes drawn in `createObstacleVisualization()` in `obstacleDetection.ts`
- Basic colored boxes (red/yellow/green) with label + confidence
- No road zone overlay (green/yellow/red zones)
- No distance estimates shown on canvas
- No warning icons for close obstacles

## Requested Changes (Diff)

### Add
- Road zone color overlay on canvas: green (top 40% = far/safe), yellow (40-70% = caution), red (bottom 30% = danger)
- Distance estimate label above each bounding box: estimated in meters using vertical position heuristic
- Warning icons (triangle ⚠ + stop symbol 🛑) drawn on canvas above any obstacle whose bounding box bottom is in the bottom 30% of image OR estimated distance < 5m
- Blue bounding boxes for all obstacles (matching the reference image STONKAM style)

### Modify
- `createObstacleVisualization()` in `obstacleDetection.ts`: complete rewrite of rendering logic to include road zones, distance labels, blue boxes, and conditional warning icons
- Both live camera overlay and image upload use the same `createObstacleVisualization` function, so the change applies to both automatically

### Remove
- Red/yellow/green risk-level based box colors (replaced by unified blue boxes, with warning icons for danger zone)

## Implementation Plan
1. Rewrite `createObstacleVisualization()` in `obstacleDetection.ts`:
   - Draw road zone gradient overlay (green/yellow/red trapezoid shapes from top to bottom)
   - For each obstacle: compute estimated distance from vertical position
   - Draw blue bounding box with glow
   - Draw label: `Type Confidence%` above box
   - Draw distance below label: `~Xm`
   - If obstacle is in danger zone (box bottom > 70% height OR dist < 5m): draw warning triangle + stop icon above box
2. No changes needed in LiveCameraSection.tsx or ImageUploadSection.tsx — both already consume `visualizationUrl` from the result
