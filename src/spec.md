# Specification

## Summary
**Goal:** Add pothole detection capability with 50-meter advance warning alerts to the Road Safety Alert system.

**Planned changes:**
- Extend road detection algorithm to identify potholes using visual analysis of road texture and surface irregularities
- Calculate estimated distance to detected potholes based on camera perspective and pixel position
- Trigger audio and visual alerts displaying "Potholes on road" when potholes are detected within 50 meters
- Store pothole detection events in backend with type, location, and distance information
- Display pothole count and closest distance in MetricsPanel during live detection

**User-visible outcome:** Users will receive advance warnings when potholes are detected on the road ahead (up to 50 meters), see pothole detections highlighted in the video overlay, and view pothole statistics in the metrics panel.
