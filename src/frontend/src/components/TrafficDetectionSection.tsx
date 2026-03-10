import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, Pause, Play, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface Detection {
  class: string;
  score: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
  isMoving: boolean;
}

interface VehicleCount {
  [key: string]: number;
}

const VEHICLE_CLASSES = new Set([
  "car",
  "truck",
  "bus",
  "motorcycle",
  "bicycle",
]);
const CONFIDENCE_THRESHOLD = 0.6;
const IOU_THRESHOLD = 0.5;
const MOTION_THRESHOLD = 15;
const DETECTION_INTERVAL_MS = 100;
const MOTION_CANVAS_WIDTH = 160;
const MOTION_CANVAS_HEIGHT = 120;

function iou(a: number[], b: number[]): number {
  const x1 = Math.max(a[0], b[0]);
  const y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[0] + a[2], b[0] + b[2]);
  const y2 = Math.min(a[1] + a[3], b[1] + b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = a[2] * a[3];
  const areaB = b[2] * b[3];
  return inter / (areaA + areaB - inter);
}

function applyNMS(detections: Detection[]): Detection[] {
  if (detections.length === 0) return [];
  const sorted = [...detections].sort((a, b) => b.score - a.score);
  const kept: Detection[] = [];
  const suppressed = new Set<number>();
  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue;
    kept.push(sorted[i]);
    for (let j = i + 1; j < sorted.length; j++) {
      if (suppressed.has(j)) continue;
      if (iou(sorted[i].bbox, sorted[j].bbox) > IOU_THRESHOLD) {
        suppressed.add(j);
      }
    }
  }
  return kept;
}

function getVehicleColor(cls: string): string {
  const colors: Record<string, string> = {
    car: "#f97316",
    truck: "#fb923c",
    bus: "#fdba74",
    motorcycle: "#ff6b35",
    bicycle: "#ffd166",
  };
  return colors[cls] ?? "#f97316";
}

interface Props {
  isActive: boolean;
}

export default function TrafficDetectionSection({ isActive }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevMotionDataRef = useRef<Uint8ClampedArray | null>(null);
  const modelRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const rafRef = useRef<number | null>(null);
  const detectionsRef = useRef<Detection[]>([]);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef(0);
  const fpsRef = useRef(0);

  const [isRunning, setIsRunning] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [fps, setFps] = useState(0);
  const [movingCount, setMovingCount] = useState(0);
  const [stationaryCount, setStationaryCount] = useState(0);
  const [vehicleCounts, setVehicleCounts] = useState<VehicleCount>({});
  const [error, setError] = useState<string | null>(null);

  // Load TF.js and COCO-SSD via CDN
  const loadModel = useCallback(async () => {
    if (modelRef.current || modelLoading) return;
    setModelLoading(true);
    setError(null);
    try {
      // Load scripts dynamically
      await new Promise<void>((resolve, reject) => {
        if ((window as any).tf) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.src =
          "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js";
        script.onload = () => resolve();
        script.onerror = () =>
          reject(new Error("Failed to load TensorFlow.js"));
        document.head.appendChild(script);
      });
      await new Promise<void>((resolve, reject) => {
        if ((window as any).cocoSsd) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.src =
          "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load COCO-SSD"));
        document.head.appendChild(script);
      });
      const model = await (window as any).cocoSsd.load();
      modelRef.current = model;
      setModelLoaded(true);
    } catch (_) {
      setError("Failed to load AI model. Please check your connection.");
    } finally {
      setModelLoading(false);
    }
  }, [modelLoading]);

  useEffect(() => {
    if (isActive) loadModel();
  }, [isActive, loadModel]);

  // Initialize motion canvas
  useEffect(() => {
    motionCanvasRef.current = document.createElement("canvas");
    motionCanvasRef.current.width = MOTION_CANVAS_WIDTH;
    motionCanvasRef.current.height = MOTION_CANVAS_HEIGHT;
  }, []);

  const computeMotionScore = useCallback(
    (
      videoEl: HTMLVideoElement,
      bbox: [number, number, number, number],
    ): number => {
      const mc = motionCanvasRef.current;
      if (!mc) return 0;
      const ctx = mc.getContext("2d");
      if (!ctx) return 0;

      ctx.drawImage(videoEl, 0, 0, MOTION_CANVAS_WIDTH, MOTION_CANVAS_HEIGHT);
      const curr = ctx.getImageData(
        0,
        0,
        MOTION_CANVAS_WIDTH,
        MOTION_CANVAS_HEIGHT,
      ).data;
      const prev = prevMotionDataRef.current;

      if (!prev) {
        prevMotionDataRef.current = new Uint8ClampedArray(curr);
        return 0;
      }

      // Scale bbox to motion canvas size
      const vw = videoEl.videoWidth || 640;
      const vh = videoEl.videoHeight || 480;
      const scaleX = MOTION_CANVAS_WIDTH / vw;
      const scaleY = MOTION_CANVAS_HEIGHT / vh;
      const rx = Math.max(0, Math.floor(bbox[0] * scaleX));
      const ry = Math.max(0, Math.floor(bbox[1] * scaleY));
      const rw = Math.min(
        MOTION_CANVAS_WIDTH - rx,
        Math.ceil(bbox[2] * scaleX),
      );
      const rh = Math.min(
        MOTION_CANVAS_HEIGHT - ry,
        Math.ceil(bbox[3] * scaleY),
      );

      let diff = 0;
      let count = 0;
      for (let y = ry; y < ry + rh; y++) {
        for (let x = rx; x < rx + rw; x++) {
          const idx = (y * MOTION_CANVAS_WIDTH + x) * 4;
          diff += Math.abs(curr[idx] - prev[idx]);
          diff += Math.abs(curr[idx + 1] - prev[idx + 1]);
          diff += Math.abs(curr[idx + 2] - prev[idx + 2]);
          count += 3;
        }
      }

      prevMotionDataRef.current = new Uint8ClampedArray(curr);
      return count > 0 ? diff / count : 0;
    },
    [],
  );

  const runDetection = useCallback(async () => {
    const video = videoRef.current;
    const model = modelRef.current;
    if (!video || !model || video.readyState < 2) return;

    try {
      const predictions = await model.detect(video);

      // Filter to vehicle classes with confidence threshold
      let vehicleDetections: Detection[] = predictions
        .filter(
          (p: any) =>
            VEHICLE_CLASSES.has(p.class) && p.score >= CONFIDENCE_THRESHOLD,
        )
        .map((p: any) => ({
          class: p.class,
          score: p.score,
          bbox: p.bbox as [number, number, number, number],
          isMoving: false,
        }));

      // Apply NMS
      vehicleDetections = applyNMS(vehicleDetections);

      // Apply motion detection
      vehicleDetections = vehicleDetections.map((d) => ({
        ...d,
        isMoving: computeMotionScore(video, d.bbox) > MOTION_THRESHOLD,
      }));

      detectionsRef.current = vehicleDetections;

      // Update state counts
      const moving = vehicleDetections.filter((d) => d.isMoving).length;
      const stationary = vehicleDetections.filter((d) => !d.isMoving).length;
      setMovingCount(moving);
      setStationaryCount(stationary);

      const counts: VehicleCount = {};
      for (const d of vehicleDetections) {
        counts[d.class] = (counts[d.class] ?? 0) + 1;
      }
      setVehicleCounts(counts);

      // FPS tracking
      frameCountRef.current++;
      const now = performance.now();
      const elapsed = now - lastFrameTimeRef.current;
      if (elapsed >= 1000) {
        const currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
        fpsRef.current = currentFps;
        setFps(currentFps);
        frameCountRef.current = 0;
        lastFrameTimeRef.current = now;
      }
    } catch (_) {
      // Ignore detection errors
    }
  }, [computeMotionScore]);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Sync canvas size to video
    if (video.videoWidth > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const detections = detectionsRef.current;
    for (const det of detections) {
      if (!det.isMoving) continue;

      const [bx, by, bw, bh] = det.bbox;
      const size = Math.max(bw, bh);
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      const sx = cx - size / 2;
      const sy = cy - size / 2;

      const color = getVehicleColor(det.class);

      // Draw glow effect
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(sx, sy, size, size);
      ctx.shadowBlur = 0;

      // Corner accents
      const cornerLen = Math.min(size * 0.15, 20);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      // TL
      ctx.beginPath();
      ctx.moveTo(sx, sy + cornerLen);
      ctx.lineTo(sx, sy);
      ctx.lineTo(sx + cornerLen, sy);
      ctx.stroke();
      // TR
      ctx.beginPath();
      ctx.moveTo(sx + size - cornerLen, sy);
      ctx.lineTo(sx + size, sy);
      ctx.lineTo(sx + size, sy + cornerLen);
      ctx.stroke();
      // BL
      ctx.beginPath();
      ctx.moveTo(sx, sy + size - cornerLen);
      ctx.lineTo(sx, sy + size);
      ctx.lineTo(sx + cornerLen, sy + size);
      ctx.stroke();
      // BR
      ctx.beginPath();
      ctx.moveTo(sx + size - cornerLen, sy + size);
      ctx.lineTo(sx + size, sy + size);
      ctx.lineTo(sx + size, sy + size - cornerLen);
      ctx.stroke();

      // Label
      const label = `${det.class.charAt(0).toUpperCase() + det.class.slice(1)} (${Math.round(det.score * 100)}%)`;
      ctx.font = "bold 13px monospace";
      const textW = ctx.measureText(label).width;
      const labelX = sx;
      const labelY = sy - 8;

      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(labelX - 2, labelY - 15, textW + 8, 20);
      ctx.fillStyle = color;
      ctx.fillText(label, labelX + 2, labelY);
    }

    if (isRunning) {
      rafRef.current = requestAnimationFrame(drawFrame);
    }
  }, [isRunning]);

  useEffect(() => {
    if (isRunning) {
      rafRef.current = requestAnimationFrame(drawFrame);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isRunning, drawFrame]);

  const startCamera = useCallback(async () => {
    setError(null);
    if (!modelRef.current) {
      await loadModel();
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, min: 20 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      prevMotionDataRef.current = null;
      frameCountRef.current = 0;
      lastFrameTimeRef.current = performance.now();
      setIsRunning(true);
      detectionIntervalRef.current = setInterval(
        runDetection,
        DETECTION_INTERVAL_MS,
      );
    } catch (_) {
      setError("Camera access denied or unavailable.");
    }
  }, [loadModel, runDetection]);

  const stopCamera = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    detectionsRef.current = [];
    setIsRunning(false);
    setMovingCount(0);
    setStationaryCount(0);
    setFps(0);
    setVehicleCounts({});
    prevMotionDataRef.current = null;
  }, []);

  // Cleanup on unmount or tab switch
  useEffect(() => {
    if (!isActive && isRunning) stopCamera();
  }, [isActive, isRunning, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const vehicleClassLabels: Record<string, string> = {
    car: "Cars",
    truck: "Trucks",
    bus: "Buses",
    motorcycle: "Motorcycles",
    bicycle: "Bicycles",
  };

  return (
    <div data-ocid="traffic.panel" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 border border-primary/30">
            <Car className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-section-title">Traffic Detection</h2>
            <p className="text-helper">
              Real-time moving vehicle detection via COCO-SSD
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {modelLoaded && (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
              <Zap className="h-3 w-3" />
              AI Model Ready
            </Badge>
          )}
          {modelLoading && (
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
              Loading Model…
            </Badge>
          )}
        </div>
      </div>

      {/* Video + Canvas container */}
      <div className="card-enhanced overflow-hidden rounded-2xl">
        <div
          className="relative w-full"
          style={{ minHeight: "360px", background: "#0a0a0a" }}
        >
          {/* Video */}
          <video
            ref={videoRef}
            muted
            autoPlay
            playsInline
            className="w-full rounded-2xl"
            style={{
              display: isRunning ? "block" : "none",
              maxHeight: "520px",
              objectFit: "cover",
            }}
          />
          {/* Canvas overlay */}
          <canvas
            ref={canvasRef}
            data-ocid="traffic.canvas_target"
            className="absolute inset-0 w-full h-full rounded-2xl pointer-events-none"
            style={{ display: isRunning ? "block" : "none" }}
          />

          {/* Placeholder when not running */}
          {!isRunning && (
            <div className="flex flex-col items-center justify-center gap-4 py-24 px-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border-2 border-primary/20">
                <Car className="h-10 w-10 text-primary/50" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground/70">
                  Camera Inactive
                </p>
                <p className="text-helper mt-1">
                  {modelLoading
                    ? "Loading AI model, please wait…"
                    : "Click Start Camera to begin live detection"}
                </p>
              </div>
            </div>
          )}

          {/* Status overlay bar */}
          {isRunning && (
            <div
              className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2 rounded-t-2xl"
              style={{
                background: "rgba(0,0,0,0.65)",
                backdropFilter: "blur(4px)",
              }}
            >
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                </span>
                <span className="text-xs font-bold tracking-widest text-red-400 uppercase">
                  Live
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-orange-400">
                  Moving: <strong className="text-white">{movingCount}</strong>
                </span>
                <span className="text-gray-400">
                  Stationary:{" "}
                  <strong className="text-white">{stationaryCount}</strong>
                </span>
                <span className="text-green-400">
                  FPS: <strong className="text-white">{fps}</strong>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between gap-4 border-t border-border/50 p-4">
          <Button
            data-ocid="traffic.start_button"
            onClick={isRunning ? stopCamera : startCamera}
            disabled={modelLoading}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/60 font-semibold px-6 shadow-md transition-all"
          >
            {isRunning ? (
              <>
                <Pause className="h-4 w-4" /> Stop Camera
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Start Camera
              </>
            )}
          </Button>

          {error && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <span className="font-mono">⚠</span> {error}
            </p>
          )}

          {isRunning && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
              Detecting every 100ms
            </div>
          )}
        </div>
      </div>

      {/* Detection Summary Panel */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Object.entries(vehicleClassLabels).map(([cls, label]) => {
          const count = vehicleCounts[cls] ?? 0;
          const color = getVehicleColor(cls);
          return (
            <div
              key={cls}
              className="card-enhanced flex flex-col items-center gap-2 p-4 text-center"
              style={{ borderColor: count > 0 ? `${color}40` : undefined }}
            >
              <span
                className="text-2xl font-bold"
                style={{ color: count > 0 ? color : undefined }}
              >
                {count}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="card-enhanced p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Detection Legend
        </p>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-6 rounded-sm border-2"
              style={{ borderColor: "#f97316" }}
            />
            <span>Moving Vehicle — square bounding box + label</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-6 rounded-sm border-2 border-dashed border-gray-500" />
            <span>Stationary Vehicle — counted only, no box drawn</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-mono text-green-400">
              FPS
            </span>
            <span>Detection frames per second</span>
          </div>
        </div>
      </div>
    </div>
  );
}
