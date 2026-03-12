import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type TrackedVehicle,
  applyNMS,
  getObjectCategory,
  updateVehicleTracker,
} from "@/lib/vehicleSpeedTracker";
import { Activity, MonitorCheck, Square, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface RoadMonitorSectionProps {
  isActive?: boolean;
}

const CONFIDENCE_THRESHOLD = 0.75;

interface LastDetection {
  name: string;
  confidence: number;
  timestamp: string;
  speed?: number;
}

export default function RoadMonitorSection({
  isActive = false,
}: RoadMonitorSectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const lastDetectRef = useRef<number>(0);
  const trackerRef = useRef<Map<string, TrackedVehicle>>(new Map());
  const totalVehiclesRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);

  const [isRunning, setIsRunning] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [fps, setFps] = useState(0);
  const [vehicleCount, setVehicleCount] = useState(0);
  const [totalVehicles, setTotalVehicles] = useState(0);
  const [lastDetection, setLastDetection] = useState<LastDetection | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // Load COCO-SSD via CDN
  const loadModel = useCallback(async () => {
    if (modelRef.current || modelLoading) return;
    setModelLoading(true);
    setError(null);
    try {
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
    } catch (_e) {
      setError("Failed to load AI model. Please check your connection.");
    } finally {
      setModelLoading(false);
    }
  }, [modelLoading]);

  useEffect(() => {
    if (isActive) loadModel();
  }, [isActive, loadModel]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsRunning(false);
    setVehicleCount(0);
    setFps(0);
  }, []);

  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Sync canvas size to video
    if (
      canvas.width !== video.videoWidth ||
      canvas.height !== video.videoHeight
    ) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const now = performance.now();
    frameCountRef.current++;
    const elapsed = now - lastFpsTimeRef.current;
    if (elapsed > 1000) {
      const currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
      setFps(currentFps);
      frameCountRef.current = 0;
      lastFpsTimeRef.current = now;
    }

    // Run inference every ~100ms
    if (modelRef.current && now - lastDetectRef.current > 100) {
      lastDetectRef.current = now;
      modelRef.current
        .detect(video)
        .then((preds: any[]) => {
          const filtered = applyNMS(
            preds.filter((p) => p.score >= CONFIDENCE_THRESHOLD),
          );
          const tracker = updateVehicleTracker(
            filtered,
            trackerRef.current,
            now,
            canvas.width,
            canvas.height,
          );
          trackerRef.current = tracker;

          // Count vehicles
          let vCount = 0;
          for (const [, track] of tracker) {
            const cat = getObjectCategory(track.label);
            if (cat === "vehicle") vCount++;
          }
          setVehicleCount(vCount);

          // Alerts and last detection update
          for (const [, track] of tracker) {
            const cat = getObjectCategory(track.label);
            if (cat === "vehicle") {
              if (track.isNew && !track.alertedApproach) {
                track.alertedApproach = true;
                totalVehiclesRef.current++;
                setTotalVehicles(totalVehiclesRef.current);
                toast.warning("Vehicle Approaching", {
                  description: "Vehicle detected in camera view",
                  duration: 3000,
                });
                toast.success("Normal Vehicle Speed", {
                  description: `~${Math.round(track.speedKmh)} km/h`,
                  duration: 2000,
                });
              } else if (
                !track.isNew &&
                track.speedKmh > 40 &&
                now - track.alertedSpeedAt > 5000
              ) {
                track.alertedSpeedAt = now;
                toast.error("High Speed Vehicle Alert", {
                  description: `Vehicle estimated at ~${Math.round(track.speedKmh)} km/h`,
                  duration: 4000,
                });
              }
            }
          }

          // Last detection card
          if (filtered.length > 0) {
            const top = filtered[0];
            const tracked = [...tracker.values()].find(
              (t) => t.label === top.class,
            );
            setLastDetection({
              name: top.class
                .split(" ")
                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" "),
              confidence: Math.round(top.score * 100),
              timestamp: new Date().toLocaleTimeString(),
              speed: tracked?.speedKmh,
            });
          }

          // Draw bounding boxes
          const canvasCtx = canvas.getContext("2d");
          if (!canvasCtx) return;
          canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

          for (const pred of filtered) {
            const [bx, by, bw, bh] = pred.bbox;
            const cat = getObjectCategory(pred.class);
            const inDanger = by + bh > canvas.height * 0.7;
            const tracked = [...tracker.values()].find(
              (t) => t.label === pred.class,
            );

            let boxColor: string;
            if (inDanger) {
              boxColor = "#ef4444";
            } else if (cat === "vehicle") {
              boxColor = "#f97316";
            } else if (cat === "person") {
              boxColor = "#3b82f6";
            } else {
              boxColor = "#9ca3af";
            }

            canvasCtx.strokeStyle = boxColor;
            canvasCtx.lineWidth = 2.5;
            canvasCtx.shadowColor = boxColor;
            canvasCtx.shadowBlur = 6;
            canvasCtx.strokeRect(bx, by, bw, bh);
            canvasCtx.shadowBlur = 0;

            // Label
            let labelText: string;
            if (cat === "vehicle") {
              labelText = `Vehicle Detected (${Math.round(pred.score * 100)}%)`;
            } else if (cat === "background") {
              labelText = "Background Object";
            } else {
              const name = pred.class
                .split(" ")
                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ");
              labelText = `${name} (${Math.round(pred.score * 100)}%)`;
            }

            canvasCtx.font = "bold 13px monospace";
            const textW = canvasCtx.measureText(labelText).width;

            // Speed line above label for vehicles
            let speedY = by - 4;
            if (cat === "vehicle" && tracked && tracked.speedKmh > 0) {
              const speedText = `~${Math.round(tracked.speedKmh)} km/h`;
              const speedColor = tracked.speedKmh > 40 ? "#ef4444" : "#22c55e";
              canvasCtx.fillStyle = speedColor;
              canvasCtx.font = "bold 12px monospace";
              const speedW = canvasCtx.measureText(speedText).width;
              canvasCtx.fillText(
                speedText,
                bx + bw / 2 - speedW / 2,
                speedY - 15,
              );
              canvasCtx.font = "bold 13px monospace";
            }

            // Label background
            canvasCtx.fillStyle = "rgba(0,0,0,0.65)";
            canvasCtx.fillRect(bx, speedY - 18, textW + 8, 18);
            canvasCtx.fillStyle = boxColor;
            canvasCtx.fillText(labelText, bx + 4, speedY - 4);
          }
        })
        .catch(() => {});
    }

    rafRef.current = requestAnimationFrame(drawFrame);
  }, []);

  const startCamera = useCallback(async () => {
    if (!modelLoaded) {
      await loadModel();
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", frameRate: { ideal: 30 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      trackerRef.current = new Map();
      totalVehiclesRef.current = 0;
      setTotalVehicles(0);
      lastFpsTimeRef.current = performance.now();
      frameCountRef.current = 0;
      setIsRunning(true);
      rafRef.current = requestAnimationFrame(drawFrame);
    } catch (_e) {
      setError(
        "Camera access denied. Please allow camera permissions and try again.",
      );
    }
  }, [modelLoaded, loadModel, drawFrame]);

  // Stop when tab becomes inactive
  useEffect(() => {
    if (!isActive) stopCamera();
  }, [isActive, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="space-y-6">
      <Card className="border-primary/30 bg-card/80 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <MonitorCheck className="h-5 w-5 text-primary" />
            Road Monitor
            {modelLoading && (
              <Badge variant="outline" className="ml-2 text-xs animate-pulse">
                Loading AI Model...
              </Badge>
            )}
            {modelLoaded && !modelLoading && (
              <Badge className="ml-2 bg-primary/20 text-primary border-primary/30 text-xs">
                AI Ready
              </Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Camera Feed */}
          <div className="relative w-full overflow-hidden rounded-xl bg-black aspect-video border border-border/50">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              muted
              playsInline
            />
            <canvas
              ref={canvasRef}
              data-ocid="monitor.canvas_target"
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Status bar overlay */}
            {isRunning && (
              <div className="absolute top-3 left-3 right-3 flex items-center gap-2 flex-wrap">
                <Badge className="bg-red-600/90 text-white border-0 gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse inline-block" />
                  LIVE
                </Badge>
                <Badge className="bg-primary/90 text-primary-foreground border-0 text-xs">
                  {vehicleCount} Vehicle{vehicleCount !== 1 ? "s" : ""}
                </Badge>
                <Badge className="bg-black/70 text-muted-foreground border border-border/50 text-xs">
                  {fps} FPS
                </Badge>
              </div>
            )}

            {/* Placeholder when not running */}
            {!isRunning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <MonitorCheck className="h-12 w-12 opacity-30" />
                <p className="text-sm opacity-60">
                  {modelLoading
                    ? "Loading AI model..."
                    : "Click Start to begin monitoring"}
                </p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Control button */}
          <Button
            data-ocid="monitor.primary_button"
            onClick={isRunning ? stopCamera : startCamera}
            disabled={modelLoading}
            className="w-full"
            variant={isRunning ? "outline" : "default"}
          >
            {isRunning ? (
              <>
                <Square className="mr-2 h-4 w-4" />
                Stop Monitoring
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                {modelLoading ? "Loading Model..." : "Start Monitoring"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Detection Result Card */}
      <Card className="border-primary/20 bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <Activity className="h-4 w-4 text-primary" />
            Detection Result
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lastDetection ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Object</p>
                  <p className="font-semibold text-foreground text-sm">
                    {lastDetection.name}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    Confidence
                  </p>
                  <p className="font-semibold text-primary text-sm">
                    {lastDetection.confidence}%
                  </p>
                </div>
                {lastDetection.speed !== undefined &&
                  lastDetection.speed > 0 && (
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground mb-1">
                        Speed
                      </p>
                      <p
                        className={`font-semibold text-sm ${
                          lastDetection.speed > 40
                            ? "text-destructive"
                            : "text-green-500"
                        }`}
                      >
                        ~{Math.round(lastDetection.speed)} km/h
                      </p>
                    </div>
                  )}
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Source</p>
                  <p className="font-semibold text-foreground text-sm">
                    Live Camera
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Last detected: {lastDetection.timestamp}</span>
                <span>
                  Total vehicles this session:{" "}
                  <span className="text-primary font-medium">
                    {totalVehicles}
                  </span>
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm">
                No detections yet — start monitoring to see results
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
