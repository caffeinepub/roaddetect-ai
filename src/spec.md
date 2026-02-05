# Specification

## Summary
**Goal:** Improve the clarity and correctness of driver alerts and road metrics, and enhance road-region segmentation so curved roads are detected more reliably.

**Planned changes:**
- Update the Driver Alerts UI to use clear status color-coding: safe/normal states in green, and all warning/danger/critical states in red, applied consistently across DriverAlertPanel elements.
- Revise the Detection Metrics “Road Information” section to improve at-a-glance readability (clear label/value hierarchy) and explicitly display a “No objects detected” message when detections are empty/none.
- Improve the road region segmentation/mask generation to better follow curved road boundaries, reduce non-determinism between runs, and fix any post-processing/morphology logic that incorrectly assumes square images.

**User-visible outcome:** Driver alerts clearly indicate safe vs unsafe conditions using green/red styling, road information is easier to understand and explicitly states when no objects are detected, and road masks more consistently capture curved roads.
