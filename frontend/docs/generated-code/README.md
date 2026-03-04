# Generated Code Documentation

This directory contains the complete source code for the Road Detection System application, organized as individual Markdown documents for easy reading and reference.

## Overview

The Road Detection System is a real-time AI-powered road monitoring application built with:
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Motoko (Internet Computer)
- **Features**: Live camera monitoring, obstacle detection, road surface analysis, motion tracking

## Documentation Structure

Each source file is documented in its own Markdown file, preserving the original file path in the document title. The structure mirrors the application's file organization:

### Backend
- [backend/main.mo.md](./backend/main.mo.md) - Main backend canister with data storage and access control

### Frontend Core
- [frontend/src/App.tsx.md](./frontend/src/App.tsx.md) - Root application component
- [frontend/src/main.tsx.md](./frontend/src/main.tsx.md) - Application entry point
- [frontend/src/backend.d.ts.md](./frontend/src/backend.d.ts.md) - TypeScript interface for backend

### Pages
- [frontend/src/pages/RoadDetectionApp.tsx.md](./frontend/src/pages/RoadDetectionApp.tsx.md) - Main application page with tabs

### Components
- [frontend/src/components/Header.tsx.md](./frontend/src/components/Header.tsx.md) - Application header
- [frontend/src/components/Footer.tsx.md](./frontend/src/components/Footer.tsx.md) - Application footer
- [frontend/src/components/LiveCameraSection.tsx.md](./frontend/src/components/LiveCameraSection.tsx.md) - Live camera monitoring
- [frontend/src/components/ImageUploadSection.tsx.md](./frontend/src/components/ImageUploadSection.tsx.md) - Image upload interface
- [frontend/src/components/HistorySection.tsx.md](./frontend/src/components/HistorySection.tsx.md) - Detection history viewer
- [frontend/src/components/ReportDialog.tsx.md](./frontend/src/components/ReportDialog.tsx.md) - PDF report dialog

### Hooks
- [frontend/src/hooks/useActor.ts.md](./frontend/src/hooks/useActor.ts.md) - Backend actor initialization
- [frontend/src/hooks/useInternetIdentity.ts.md](./frontend/src/hooks/useInternetIdentity.ts.md) - Internet Identity authentication
- [frontend/src/hooks/useQueries.ts.md](./frontend/src/hooks/useQueries.ts.md) - React Query hooks for backend

### Libraries
- [frontend/src/lib/roadDetection.ts.md](./frontend/src/lib/roadDetection.ts.md) - Road detection algorithm
- [frontend/src/lib/obstacleDetection.ts.md](./frontend/src/lib/obstacleDetection.ts.md) - Obstacle detection
- [frontend/src/lib/obstacleTracking.ts.md](./frontend/src/lib/obstacleTracking.ts.md) - Frame-to-frame obstacle tracking

## How to Use This Documentation

1. **Browse by feature**: Start with the main page component to understand the application flow
2. **Understand the architecture**: Review the backend interface and hooks to see how frontend communicates with backend
3. **Study algorithms**: Check the lib/ files for computer vision and detection logic
4. **Component reference**: Look at individual components to understand UI implementation

## Key Technologies

- **React 19** with TypeScript for type-safe UI development
- **Tailwind CSS** with OKLCH color system for modern styling
- **React Query** for server state management
- **Internet Computer** for decentralized backend
- **Canvas API** for real-time image processing
- **Computer Vision** algorithms for road and obstacle detection

## Notes

- All code is generated and maintained by the Caffeine.ai platform
- Files under `frontend/src/components/ui/` are shadcn/ui components (not included in this documentation)
- The backend runs on the Internet Computer blockchain
- Frontend uses modern React patterns with hooks and functional components
