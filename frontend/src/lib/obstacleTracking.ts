/**
 * Lightweight frame-to-frame obstacle tracking for motion classification
 */

export interface TrackedObstacle {
  id: string;
  position: { x: number; y: number };
  type: string;
  confidenceLevel: number;
  riskLevel: {
    level: 'High' | 'Moderate' | 'Low';
    description: string;
  };
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  motion: 'Static' | 'Moving';
}

export interface TrackingState {
  previousObstacles: Array<{
    id: string;
    centroid: { x: number; y: number };
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  frameCount: number;
}

/**
 * Initialize tracking state
 */
export function initializeTrackingState(): TrackingState {
  return {
    previousObstacles: [],
    frameCount: 0,
  };
}

/**
 * Track obstacles across frames and classify motion
 */
export function trackObstacles(
  currentObstacles: Array<{
    id: string;
    position: { x: number; y: number };
    type: string;
    confidenceLevel: number;
    riskLevel: {
      level: 'High' | 'Moderate' | 'Low';
      description: string;
    };
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>,
  previousState: TrackingState
): { trackedObstacles: TrackedObstacle[]; newState: TrackingState } {
  try {
    const trackedObstacles: TrackedObstacle[] = [];
    const currentObstacleData: TrackingState['previousObstacles'] = [];

    // If this is the first frame or no previous obstacles, mark all as Static
    if (previousState.frameCount === 0 || previousState.previousObstacles.length === 0) {
      for (const obstacle of currentObstacles) {
        trackedObstacles.push({
          ...obstacle,
          motion: 'Static',
        });

        // Store for next frame
        currentObstacleData.push({
          id: obstacle.id,
          centroid: calculateCentroid(obstacle.boundingBox),
          boundingBox: obstacle.boundingBox,
        });
      }

      return {
        trackedObstacles,
        newState: {
          previousObstacles: currentObstacleData,
          frameCount: previousState.frameCount + 1,
        },
      };
    }

    // Match current obstacles with previous frame
    for (const obstacle of currentObstacles) {
      const currentCentroid = calculateCentroid(obstacle.boundingBox);
      
      // Find best match from previous frame
      const match = findBestMatch(
        obstacle.boundingBox,
        currentCentroid,
        previousState.previousObstacles
      );

      let motion: 'Static' | 'Moving' = 'Static';

      if (match) {
        // Calculate displacement
        const displacement = calculateDistance(currentCentroid, match.centroid);
        const movementThreshold = 5; // pixels - adjust based on frame rate and resolution

        motion = displacement > movementThreshold ? 'Moving' : 'Static';
      }

      trackedObstacles.push({
        ...obstacle,
        motion,
      });

      // Store for next frame
      currentObstacleData.push({
        id: obstacle.id,
        centroid: currentCentroid,
        boundingBox: obstacle.boundingBox,
      });
    }

    return {
      trackedObstacles,
      newState: {
        previousObstacles: currentObstacleData,
        frameCount: previousState.frameCount + 1,
      },
    };
  } catch (error) {
    console.error('[ObstacleTracking] Tracking error:', error);
    
    // Fallback: return all obstacles as Static
    const fallbackObstacles = currentObstacles.map(obstacle => ({
      ...obstacle,
      motion: 'Static' as const,
    }));

    return {
      trackedObstacles: fallbackObstacles,
      newState: {
        previousObstacles: [],
        frameCount: previousState.frameCount + 1,
      },
    };
  }
}

/**
 * Calculate centroid of bounding box
 */
function calculateCentroid(boundingBox: {
  x: number;
  y: number;
  width: number;
  height: number;
}): { x: number; y: number } {
  return {
    x: boundingBox.x + boundingBox.width / 2,
    y: boundingBox.y + boundingBox.height / 2,
  };
}

/**
 * Calculate Euclidean distance between two points
 */
function calculateDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate Intersection over Union (IoU) for bounding boxes
 */
function calculateIoU(
  box1: { x: number; y: number; width: number; height: number },
  box2: { x: number; y: number; width: number; height: number }
): number {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

  const intersectionWidth = Math.max(0, x2 - x1);
  const intersectionHeight = Math.max(0, y2 - y1);
  const intersectionArea = intersectionWidth * intersectionHeight;

  const box1Area = box1.width * box1.height;
  const box2Area = box2.width * box2.height;
  const unionArea = box1Area + box2Area - intersectionArea;

  return unionArea > 0 ? intersectionArea / unionArea : 0;
}

/**
 * Find best matching obstacle from previous frame
 */
function findBestMatch(
  currentBox: { x: number; y: number; width: number; height: number },
  currentCentroid: { x: number; y: number },
  previousObstacles: TrackingState['previousObstacles']
): TrackingState['previousObstacles'][0] | null {
  if (previousObstacles.length === 0) return null;

  let bestMatch: TrackingState['previousObstacles'][0] | null = null;
  let bestScore = 0;

  for (const prevObstacle of previousObstacles) {
    // Calculate IoU
    const iou = calculateIoU(currentBox, prevObstacle.boundingBox);
    
    // Calculate centroid distance (normalized)
    const distance = calculateDistance(currentCentroid, prevObstacle.centroid);
    const maxDistance = 200; // Maximum expected movement between frames
    const normalizedDistance = 1 - Math.min(distance / maxDistance, 1);

    // Combined score (weighted: IoU 70%, distance 30%)
    const score = iou * 0.7 + normalizedDistance * 0.3;

    // Require minimum IoU or close centroid distance
    if ((iou > 0.3 || distance < 50) && score > bestScore) {
      bestScore = score;
      bestMatch = prevObstacle;
    }
  }

  return bestMatch;
}
