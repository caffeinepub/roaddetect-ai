# Road Detection System

## Current State
LiveCameraSection.tsx uses frame differencing (motionVehicleDetection.ts) to detect moving/stationary obstacles. It draws bounding boxes for all detected objects with orange (moving) and blue-dashed (stationary) styles. There is no cap on bounding box count. Pothole, fog, and wet-surface detection only work on uploaded images. Speed tracking and popup alerts exist for vehicle approach and high speed. The UI shows detection stats, live data panel, and a detection result card.

## Requested Changes (Diff)

### Add
- In-camera hazard detection running every 1s on live frames:
  - Fog detection via pixel brightness/contrast analysis (confidence ≥ 0.65)
  - Wet/slippery road detection via reflection pattern analysis (confidence ≥ 0.65)
  - Pothole detection via dark region/texture analysis in lower image area (confidence ≥ 0.65)
- Hazard bounding box overlays on live canvas (pothole box labeled "Pothole Detected", fog warning banner)
- Popup toast for "Wet & Slippery Road" when wet conditions detected (rate-limited to once per 8s)
- Priority ranking system: hazards (pothole > fog > wet) get boxes first, then closest vehicle fills remaining slots
- Max 2-3 visible bounding boxes at any time
- Vehicle label simplified to "Vehicle Detected" with speed above box

### Modify
- drawDetectionsOnCanvas in motionVehicleDetection.ts: accept max-box count and priority list, filter out non-hazard background objects (trees, buildings, sky, road markings), label vehicles as "Vehicle Detected" instead of "Vehicle (Moving)"
- LiveCameraSection.tsx: integrate in-camera hazard detection, apply box limit, pass hazard data to canvas renderer, show fog overlay banner on canvas, trigger wet road popup alert
- Detection result card: show "Pothole Detected" or "Fog Detected" when relevant hazards are found

### Remove
- Stationary object boxes from default view (still detected internally, but no box drawn — keeps UI minimal for driver)
- Old unlimited box rendering in favour of capped priority-based rendering

## Implementation Plan
1. Create `src/lib/liveHazardDetection.ts` — pixel analysis functions for fog, wet surface, and pothole detection on raw ImageData from live camera
2. Update `motionVehicleDetection.ts` — add renderPrioritized() export that accepts vehicle detections + hazard detections, applies max=3 cap, hazard-first priority, labels vehicles as "Vehicle Detected", and skips stationary non-hazard objects
3. Update `LiveCameraSection.tsx` — run hazard detection every 1s on offscreen canvas, trigger wet road toast (rate-limited), show fog banner overlay, pass all detections to renderPrioritized(), show hazard data in detection panel
