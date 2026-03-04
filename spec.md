# Specification

## Summary
**Goal:** Build an accident detection system that combines manual reporting with AI-powered image analysis, allowing users to report accidents they witness and upload photos for automated accident detection.

**Planned changes:**
- Create manual accident reporting interface with description and timestamp capture
- Add image upload functionality with drag-and-drop support for accident scene photos
- Implement AI-powered accident scene analysis using multimodal vision to detect vehicles, damage, and debris with confidence scoring
- Build interactive map component with pin-dropping to mark accident locations
- Extend Motoko backend to store accident records including detection method, location, timestamp, images, description, and analysis results
- Create accident history view displaying all reported accidents with thumbnails, locations, and detection methods
- Design emergency-focused visual theme with red/amber/white color palette and high-visibility typography

**User-visible outcome:** Users can manually report accidents with location pins on an interactive map, upload accident scene photos for AI analysis that detects and confirms accidents with confidence scores, and view a complete history of all reported accidents with their images and detection details.
