export interface TrackedVehicle {
  id: string;
  label: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
  centroid: { x: number; y: number };
  speedKmh: number;
  lastSeen: number;
  frameHistory: { x: number; y: number; time: number }[];
  isNew: boolean;
  alertedApproach: boolean;
  alertedSpeed: boolean;
  alertedSpeedAt: number;
}

const VEHICLE_CLASSES = new Set([
  "car",
  "truck",
  "bus",
  "motorcycle",
  "bicycle",
]);

const BACKGROUND_CLASSES = new Set([
  "potted plant",
  "bench",
  "traffic light",
  "stop sign",
  "parking meter",
  "fire hydrant",
]);

export function getObjectCategory(
  cls: string,
): "vehicle" | "person" | "background" | "other" {
  if (VEHICLE_CLASSES.has(cls)) return "vehicle";
  if (cls === "person") return "person";
  if (BACKGROUND_CLASSES.has(cls)) return "background";
  return "other";
}

function iou(a: number[], b: number[]): number {
  const x1 = Math.max(a[0], b[0]);
  const y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[0] + a[2], b[0] + b[2]);
  const y2 = Math.min(a[1] + a[3], b[1] + b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (inter === 0) return 0;
  const areaA = a[2] * a[3];
  const areaB = b[2] * b[3];
  return inter / (areaA + areaB - inter);
}

export function applyNMS(predictions: any[], iouThreshold = 0.5): any[] {
  if (predictions.length === 0) return [];
  const sorted = [...predictions].sort((a, b) => b.score - a.score);
  const kept: any[] = [];
  const suppressed = new Set<number>();
  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue;
    kept.push(sorted[i]);
    for (let j = i + 1; j < sorted.length; j++) {
      if (suppressed.has(j)) continue;
      if (
        sorted[i].class === sorted[j].class &&
        iou(sorted[i].bbox, sorted[j].bbox) > iouThreshold
      ) {
        suppressed.add(j);
      }
    }
  }
  return kept;
}

function centroid(bbox: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

let nextId = 1;

export function updateVehicleTracker(
  predictions: any[],
  trackerMap: Map<string, TrackedVehicle>,
  frameTime: number,
  _canvasWidth: number,
  _canvasHeight: number,
): Map<string, TrackedVehicle> {
  const now = frameTime;
  const STALE_MS = 2000;
  const MATCH_DISTANCE = 80;
  const SPEED_SCALE = 0.15; // pixel/ms -> relative km/h scale
  const EMA_ALPHA = 0.3;
  const MAX_HISTORY = 8;

  // Remove stale tracks
  for (const [id, track] of trackerMap) {
    if (now - track.lastSeen > STALE_MS) trackerMap.delete(id);
  }

  const matched = new Set<string>();

  for (const pred of predictions) {
    const bbox = {
      x: pred.bbox[0],
      y: pred.bbox[1],
      width: pred.bbox[2],
      height: pred.bbox[3],
    };
    const c = centroid(bbox);

    // Find closest existing track
    let bestId: string | null = null;
    let bestDist = MATCH_DISTANCE;
    for (const [id, track] of trackerMap) {
      if (matched.has(id)) continue;
      if (track.label !== pred.class) continue;
      const d = dist(track.centroid, c);
      if (d < bestDist) {
        bestDist = d;
        bestId = id;
      }
    }

    if (bestId) {
      const track = trackerMap.get(bestId)!;
      const history = [
        ...track.frameHistory,
        { x: c.x, y: c.y, time: now },
      ].slice(-MAX_HISTORY);

      let rawSpeed = 0;
      if (history.length >= 2) {
        const oldest = history[0];
        const newest = history[history.length - 1];
        const dt = newest.time - oldest.time;
        if (dt > 0) {
          const dp = dist(oldest, newest);
          rawSpeed = (dp / dt) * 1000 * SPEED_SCALE;
        }
      }

      const smoothedSpeed =
        EMA_ALPHA * rawSpeed + (1 - EMA_ALPHA) * track.speedKmh;

      trackerMap.set(bestId, {
        ...track,
        bbox,
        centroid: c,
        confidence: pred.score,
        speedKmh: smoothedSpeed,
        lastSeen: now,
        frameHistory: history,
        isNew: false,
      });
      matched.add(bestId);
    } else {
      // New track
      const id = `v${nextId++}`;
      trackerMap.set(id, {
        id,
        label: pred.class,
        confidence: pred.score,
        bbox,
        centroid: c,
        speedKmh: 0,
        lastSeen: now,
        frameHistory: [{ x: c.x, y: c.y, time: now }],
        isNew: true,
        alertedApproach: false,
        alertedSpeed: false,
        alertedSpeedAt: 0,
      });
    }
  }

  return trackerMap;
}
