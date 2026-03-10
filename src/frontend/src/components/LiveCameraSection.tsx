import { ExternalBlob, MotionType, ObjectType, PotholeType } from "@/backend";
import { useCamera } from "@/camera/useCamera";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useStoreObstacleEvent,
  useStorePotholeEvent,
} from "@/hooks/useQueries";
import {
  type MotionDetection,
  detectMovingObjects,
  drawDetectionsOnCanvas,
} from "@/lib/motionVehicleDetection";
import {
  type TrackingState,
  initializeTrackingState,
  trackObstacles,
} from "@/lib/obstacleTracking";
import { processRoadDetection } from "@/lib/roadDetection";
import { detectSpeedLimit } from "@/lib/speedLimitDetection";
import type {
  EmergencyCondition,
  EnvironmentalConditions,
  ObstacleInfo,
  PotholeDetection,
  RoadSurfaceFeatures,
} from "@/types/detection";
import {
  Activity,
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  Eye,
  Loader2,
  Play,
  RefreshCw,
  Square,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import DriverAlertPanel from "./DriverAlertPanel";
import MetricsPanel from "./MetricsPanel";
import SpeedLimitDisplay from "./SpeedLimitDisplay";

interface LiveCameraSectionProps {
  isActive?: boolean;
  autoStart?: boolean;
}

type CameraStatus =
  | "idle"
  | "initializing"
  | "requesting-permission"
  | "active"
  | "error"
  | "denied";
type SystemStatus = "idle" | "initializing" | "ready" | "active" | "error";

interface LiveMetrics {
  confidenceScore: number;
  processingTime: number;
  frameRate: number;
  detectionQuality: number;
  environmentalConditions: EnvironmentalConditions;
  roadType: string;
  objectDetection: string;
  mlAdaptations?: string[];
  performanceStatus?: string;
  hardwareAcceleration?: string;
  cpuUtilization?: string;
  processingMode?: string;
  realTimeFPS: number;
  potholeCount?: number;
  closestPotholeDistance?: number;
}

export default function LiveCameraSection({
  isActive: isTabActive = false,
  autoStart = false,
}: LiveCameraSectionProps) {
  const {
    isActive,
    isSupported,
    error,
    isLoading,
    currentFacingMode: _currentFacingMode,
    startCamera,
    stopCamera,
    retry,
    videoRef,
    canvasRef,
  } = useCamera({ facingMode: "environment" });

  const [isDetecting, setIsDetecting] = useState(false);
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [roadSurfaceFeatures, setRoadSurfaceFeatures] = useState<
    RoadSurfaceFeatures | undefined
  >(undefined);
  const [obstacles, setObstacles] = useState<ObstacleInfo[]>([]);
  const [motionDetections, setMotionDetections] = useState<MotionDetection[]>(
    [],
  );
  const [potholes, setPotholes] = useState<PotholeDetection[]>([]);
  const [emergencyConditions, setEmergencyConditions] = useState<
    EmergencyCondition[]
  >([]);
  const [detectedSpeedLimit, setDetectedSpeedLimit] = useState<number | null>(
    null,
  );
  const [speedLimitConfidence, setSpeedLimitConfidence] = useState<number>(0);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [soundEnabled, _setSoundEnabled] = useState(true);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [systemStatus, setSystemStatus] = useState<SystemStatus>("idle");
  const [autoStartAttempted, setAutoStartAttempted] = useState(false);
  const [realTimeFPS, setRealTimeFPS] = useState<number>(0);
  const [detectionCount, setDetectionCount] = useState({
    obstacles: 0,
    speedLimits: 0,
    emergencies: 0,
    vehicles: 0,
    pedestrians: 0,
    debris: 0,
    potholes: 0,
    moving: 0,
    stationary: 0,
  });
  const [errorDetails, setErrorDetails] = useState<string>("");
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const frameCountRef = useRef<number>(0);
  const performanceMetricsRef = useRef({ avgFrameTime: 0, frameCount: 0 });
  const fpsCounterRef = useRef({ frames: 0, lastTime: performance.now() });
  const trackingStateRef = useRef<TrackingState>(initializeTrackingState());
  const previousFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const storeObstacleEvent = useStoreObstacleEvent();
  const storePotholeEvent = useStorePotholeEvent();
  const lastDetectionIdRef = useRef<string>("");
  const lastSpeedLimitDetectionRef = useRef<number>(0);
  const lastFullDetectionRef = useRef<number>(0);

  // Camera status effect
  useEffect(() => {
    if (isLoading) {
      setCameraStatus("requesting-permission");
    } else if (isActive) {
      setCameraStatus("active");
      setSystemStatus("ready");
      setErrorDetails("");
      if (autoStart) {
        toast.success("Camera Connected", {
          description: "Live monitoring system is ready",
        });
      }
    } else if (error) {
      setCameraStatus(error.type === "permission" ? "denied" : "error");
      setSystemStatus("error");
      const errorMsg = `Camera ${error.type} error: ${error.message}`;
      setErrorDetails(errorMsg);
      if (error.type === "permission") {
        toast.error("Camera Access Denied", {
          description: "Please allow camera access in your browser settings",
        });
      } else if (error.type === "not-found") {
        toast.error("Camera Not Found", {
          description: "No camera device detected on your system",
        });
      } else {
        toast.error("Camera Error", {
          description: error.message || "Failed to initialize camera",
        });
      }
    } else if (!isActive && !isLoading && !error) {
      setCameraStatus("idle");
      if (systemStatus !== "idle") setSystemStatus("idle");
    }
  }, [isActive, isLoading, error, systemStatus, autoStart]);

  // Auto-start camera
  useEffect(() => {
    if (
      autoStart &&
      isTabActive &&
      !isActive &&
      !autoStartAttempted &&
      !isLoading &&
      isSupported !== false &&
      cameraStatus === "idle"
    ) {
      setAutoStartAttempted(true);
      setSystemStatus("initializing");
      setCameraStatus("initializing");
      const initCamera = async () => {
        try {
          const timeoutPromise = new Promise<boolean>((_, reject) =>
            setTimeout(
              () => reject(new Error("Camera initialization timeout")),
              10000,
            ),
          );
          const success = await Promise.race([startCamera(), timeoutPromise]);
          if (success) {
            setCameraStatus("active");
            setSystemStatus("ready");
            setErrorDetails("");
          } else {
            setCameraStatus("error");
            setSystemStatus("error");
            setErrorDetails(
              "Failed to initialize camera. Please check permissions.",
            );
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          setCameraStatus("error");
          setSystemStatus("error");
          setErrorDetails(`Camera initialization failed: ${msg}`);
          toast.error("Camera System Error", { description: msg });
        }
      };
      const timer = setTimeout(initCamera, 100);
      return () => clearTimeout(timer);
    }
  }, [
    autoStart,
    isTabActive,
    isActive,
    autoStartAttempted,
    isLoading,
    isSupported,
    cameraStatus,
    startCamera,
  ]);

  // Auto-start detection
  useEffect(() => {
    if (autoStart && isActive && !isDetecting && systemStatus === "ready") {
      const timer = setTimeout(() => {
        setIsDetecting(true);
        setSystemStatus("active");
        frameCountRef.current = 0;
        performanceMetricsRef.current = { avgFrameTime: 0, frameCount: 0 };
        fpsCounterRef.current = { frames: 0, lastTime: performance.now() };
        trackingStateRef.current = initializeTrackingState();
        previousFrameDataRef.current = null;
        toast.info("Live Monitoring Active", {
          description: "Real-time road detection is now running",
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoStart, isActive, isDetecting, systemStatus]);

  // Reset auto-start flag
  useEffect(() => {
    if (!isTabActive) setAutoStartAttempted(false);
  }, [isTabActive]);

  // FPS counter
  useEffect(() => {
    if (!isDetecting) return;
    const update = () => {
      const now = performance.now();
      const elapsed = now - fpsCounterRef.current.lastTime;
      if (elapsed >= 1000) {
        setRealTimeFPS((fpsCounterRef.current.frames * 1000) / elapsed);
        fpsCounterRef.current.frames = 0;
        fpsCounterRef.current.lastTime = now;
      }
      if (isDetecting) requestAnimationFrame(update);
    };
    const id = requestAnimationFrame(update);
    return () => cancelAnimationFrame(id);
  }, [isDetecting]);

  const processFrame = useCallback(async () => {
    if (!videoRef.current || !overlayCanvasRef.current || !isDetecting) return;

    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
      willReadFrequently: true,
    }) as CanvasRenderingContext2D | null;

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Resize canvas to video dimensions
    if (
      canvas.width !== video.videoWidth ||
      canvas.height !== video.videoHeight
    ) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    const W = canvas.width;
    const H = canvas.height;

    // Draw current frame
    ctx.drawImage(video, 0, 0, W, H);
    const currentFrameData = ctx.getImageData(0, 0, W, H)
      .data as Uint8ClampedArray;

    fpsCounterRef.current.frames++;
    frameCountRef.current++;

    const currentTime = performance.now();

    // ── Motion detection every frame (~30 FPS) ──────────────────────────────
    if (
      previousFrameDataRef.current &&
      previousFrameDataRef.current.length === currentFrameData.length
    ) {
      const motionResult = detectMovingObjects(
        currentFrameData,
        previousFrameDataRef.current,
        W,
        H,
        22, // diff threshold
        250, // min blob size
      );

      if (motionResult.detections.length > 0) {
        // Redraw video frame cleanly, then draw overlays
        ctx.drawImage(video, 0, 0, W, H);
        drawDetectionsOnCanvas(ctx, motionResult.detections, W, H);
        setMotionDetections(motionResult.detections);

        // Update counts
        const moving = motionResult.detections.filter(
          (d) => d.motion === "Moving",
        ).length;
        const stationary = motionResult.detections.filter(
          (d) => d.motion === "Stationary",
        ).length;
        setDetectionCount((prev) => ({
          ...prev,
          obstacles: prev.obstacles + motionResult.detections.length,
          moving: prev.moving + moving,
          stationary: prev.stationary + stationary,
          vehicles:
            prev.vehicles +
            motionResult.detections.filter((d) => d.label.startsWith("Vehicle"))
              .length,
          pedestrians:
            prev.pedestrians +
            motionResult.detections.filter((d) =>
              d.label.startsWith("Pedestrian"),
            ).length,
        }));
      } else {
        setMotionDetections([]);
      }
    }

    // Store frame for next diff
    previousFrameDataRef.current = new Uint8ClampedArray(currentFrameData);

    // ── Full road detection (throttled to ~1 FPS) ───────────────────────────
    const timeSinceFullDetection = currentTime - lastFullDetectionRef.current;
    if (timeSinceFullDetection > 1000) {
      lastFullDetectionRef.current = currentTime;

      let dataUrl: string;
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = W;
      tempCanvas.height = H;
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.drawImage(video, 0, 0, W, H);
      dataUrl = tempCanvas.toDataURL("image/jpeg", 0.65);

      try {
        const processingStart = performance.now();
        const result = await processRoadDetection(
          dataUrl,
          "video",
          {
            avgFrameTime: performanceMetricsRef.current.avgFrameTime,
            frameCount: frameCountRef.current,
          },
          true,
        );
        const processingTime = performance.now() - processingStart;
        performanceMetricsRef.current.frameCount++;
        performanceMetricsRef.current.avgFrameTime =
          performanceMetricsRef.current.avgFrameTime * 0.9 +
          processingTime * 0.1;

        const detectedPotholes =
          result.roadSurfaceFeatures?.potholes?.detections || [];
        setPotholes(detectedPotholes);

        if (result.obstacleDetection) {
          const { trackedObstacles, newState } = trackObstacles(
            result.obstacleDetection.obstacles,
            trackingStateRef.current,
          );
          trackingStateRef.current = newState;
          setObstacles(trackedObstacles);
          setEmergencyConditions(result.obstacleDetection.emergencyConditions);

          if (
            trackedObstacles.length > 0 &&
            result.id !== lastDetectionIdRef.current
          ) {
            lastDetectionIdRef.current = result.id;
            let vehicleCount = 0;
            let pedestrianCount = 0;
            let debrisCount = 0;

            for (const obstacle of trackedObstacles) {
              const buf = new ArrayBuffer(
                result.obstacleDetection!.visualizationData.length,
              );
              const view = new Uint8Array(buf);
              view.set(result.obstacleDetection!.visualizationData);
              const blob = ExternalBlob.fromBytes(view);

              let objectType: ObjectType;
              if (obstacle.type === "Vehicle") {
                objectType = ObjectType.vehicle;
                vehicleCount++;
              } else if (obstacle.type === "Pedestrian") {
                objectType = ObjectType.pedestrian;
                pedestrianCount++;
              } else if (obstacle.type === "Debris/Obstacle") {
                objectType = ObjectType.debris;
                debrisCount++;
              } else objectType = ObjectType.unknown_;

              const motion =
                obstacle.motion === "Moving"
                  ? MotionType.moving
                  : MotionType.static_;

              try {
                await storeObstacleEvent.mutateAsync({
                  id: obstacle.id,
                  position: obstacle.position,
                  type: obstacle.type,
                  confidenceLevel: obstacle.confidenceLevel,
                  timestamp: BigInt(Date.now() * 1000000),
                  associatedDetectionId: result.id,
                  image: blob,
                  riskLevel: obstacle.riskLevel,
                  classification: { objectType, motion },
                });
              } catch (_) {
                /* non-critical */
              }
            }

            setDetectionCount((prev) => ({
              ...prev,
              vehicles: prev.vehicles + vehicleCount,
              pedestrians: prev.pedestrians + pedestrianCount,
              debris: prev.debris + debrisCount,
              emergencies:
                prev.emergencies +
                result.obstacleDetection!.emergencyConditions.length,
            }));
          }
        }

        // Store pothole events
        if (detectedPotholes.length > 0) {
          let potholeCount = 0;
          for (const pothole of detectedPotholes) {
            const buf = new ArrayBuffer(result.processedImageData.length);
            const view = new Uint8Array(buf);
            view.set(result.processedImageData);
            const blob = ExternalBlob.fromBytes(view);
            let bpt: PotholeType;
            switch (pothole.potholeType) {
              case "surface_cracks":
                bpt = PotholeType.surface_cracks;
                break;
              case "rough_size":
                bpt = PotholeType.rough_size;
                break;
              case "deep":
                bpt = PotholeType.deep;
                break;
              case "edge":
                bpt = PotholeType.edge;
                break;
              case "pavement":
                bpt = PotholeType.pavement;
                break;
              case "complex":
                bpt = PotholeType.complex;
                break;
              default:
                bpt = PotholeType.unknown_;
            }
            try {
              await storePotholeEvent.mutateAsync({
                id: pothole.id,
                position: pothole.position,
                confidenceLevel: pothole.confidenceLevel,
                timestamp: BigInt(Date.now() * 1000000),
                associatedDetectionId: result.id,
                image: blob,
                riskLevel: {
                  level: pothole.severity,
                  description: `Pothole detected at ${pothole.distance.toFixed(0)}m`,
                },
                potholeDetails: {
                  size: pothole.size,
                  depth: pothole.depth,
                  severity: pothole.severity,
                  potholeType: bpt,
                  location: {
                    coordinates: [pothole.position.x, pothole.position.y],
                    accuracy: pothole.confidenceLevel,
                  },
                  image_url: result.processedImageUrl,
                  distance_from_vehicle: pothole.distance,
                  createdAt: BigInt(Date.now() * 1000000),
                },
              });
              potholeCount++;
            } catch (_) {
              /* non-critical */
            }
          }
          setDetectionCount((prev) => ({
            ...prev,
            potholes: prev.potholes + potholeCount,
          }));
        }

        // Speed limit (every 3 s)
        if (currentTime - lastSpeedLimitDetectionRef.current > 3000) {
          lastSpeedLimitDetectionRef.current = currentTime;
          try {
            const slr = await detectSpeedLimit(dataUrl, W, H);
            if (slr.detectedSpeedLimit !== null && slr.confidenceLevel > 0.6) {
              setDetectedSpeedLimit(slr.detectedSpeedLimit);
              setSpeedLimitConfidence(slr.confidenceLevel);
              setDetectionCount((prev) => ({
                ...prev,
                speedLimits: prev.speedLimits + 1,
              }));
            }
          } catch (_) {
            /* non-critical */
          }
        }

        setMetrics({
          confidenceScore: result.confidenceScore,
          processingTime: result.processingTime,
          frameRate: result.metrics.frameRate,
          detectionQuality: result.metrics.detectionQuality,
          environmentalConditions: result.environmentalConditions,
          roadType: result.roadType,
          objectDetection: result.metrics.objectDetection,
          mlAdaptations: result.metrics.mlAdaptations,
          performanceStatus: result.metrics.performanceStatus,
          hardwareAcceleration: result.metrics.hardwareAcceleration,
          cpuUtilization: result.metrics.cpuUtilization,
          processingMode: result.metrics.processingMode,
          realTimeFPS,
          potholeCount: result.metrics.potholeCount,
          closestPotholeDistance: result.metrics.closestPotholeDistance,
        });
        setRoadSurfaceFeatures(result.roadSurfaceFeatures);
      } catch (err) {
        console.error("[Detection] Full detection error:", err);
      }
    }

    animationFrameRef.current = requestAnimationFrame(processFrame);
  }, [
    isDetecting,
    videoRef,
    storeObstacleEvent,
    storePotholeEvent,
    realTimeFPS,
  ]);

  const handleStartCamera = async () => {
    setCameraStatus("initializing");
    setSystemStatus("initializing");
    try {
      const success = await startCamera();
      if (success) {
        toast.success("Camera Started", {
          description: "Camera is now active",
        });
      } else {
        toast.error("Camera Start Failed", {
          description: "Could not start camera. Please check permissions.",
        });
      }
    } catch (err) {
      toast.error("Camera Error", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleStopCamera = async () => {
    if (isDetecting) {
      setIsDetecting(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
    }
    await stopCamera();
    setCameraStatus("idle");
    setSystemStatus("idle");
    previousFrameDataRef.current = null;
    toast.info("Camera Stopped", {
      description: "Camera has been deactivated",
    });
  };

  const handleStartDetection = () => {
    setIsDetecting(true);
    setSystemStatus("active");
    frameCountRef.current = 0;
    performanceMetricsRef.current = { avgFrameTime: 0, frameCount: 0 };
    fpsCounterRef.current = { frames: 0, lastTime: performance.now() };
    trackingStateRef.current = initializeTrackingState();
    previousFrameDataRef.current = null;
    setMotionDetections([]);
    toast.success("Detection Started", {
      description: "Real-time road detection is now active",
    });
  };

  const handleStopDetection = () => {
    setIsDetecting(false);
    setSystemStatus("ready");
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
    previousFrameDataRef.current = null;
    setMotionDetections([]);
    toast.info("Detection Stopped", {
      description: "Real-time detection has been paused",
    });
  };

  const handleRetry = async () => {
    setCameraStatus("initializing");
    setSystemStatus("initializing");
    setErrorDetails("");
    try {
      const success = await retry();
      if (success) {
        toast.success("Camera Reconnected", {
          description: "Camera is now active",
        });
      } else {
        toast.error("Retry Failed", {
          description: "Could not reconnect to camera",
        });
      }
    } catch (err) {
      toast.error("Retry Error", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  useEffect(() => {
    if (isDetecting) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isDetecting, processFrame]);

  const getStatusBadge = () => {
    switch (cameraStatus) {
      case "active":
        return (
          <Badge
            variant="default"
            className="bg-success text-success-foreground"
          >
            Active
          </Badge>
        );
      case "initializing":
      case "requesting-permission":
        return <Badge variant="secondary">Initializing...</Badge>;
      case "denied":
        return <Badge variant="destructive">Access Denied</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Idle</Badge>;
    }
  };

  const getSystemStatusBadge = () => {
    switch (systemStatus) {
      case "active":
        return (
          <Badge
            variant="default"
            className="bg-success text-success-foreground"
          >
            Detecting
          </Badge>
        );
      case "ready":
        return <Badge variant="secondary">Ready</Badge>;
      case "initializing":
        return <Badge variant="secondary">Initializing...</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Idle</Badge>;
    }
  };

  if (isSupported === false) {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <CameraOff className="h-5 w-5" />
            Camera Not Supported
          </CardTitle>
          <CardDescription>
            Your browser does not support camera access. Please use a modern
            browser.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const movingCount = motionDetections.filter(
    (d) => d.motion === "Moving",
  ).length;
  const stationaryCount = motionDetections.filter(
    (d) => d.motion === "Stationary",
  ).length;

  return (
    <div className="space-y-4">
      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Live Camera Monitoring
            </CardTitle>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              {getSystemStatusBadge()}
            </div>
          </div>
          <CardDescription>
            Real-time moving and stationary obstacle detection with bounding
            boxes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Camera Controls */}
          <div className="flex flex-wrap gap-2">
            {!isActive &&
              cameraStatus !== "error" &&
              cameraStatus !== "denied" && (
                <Button
                  onClick={handleStartCamera}
                  disabled={isLoading || cameraStatus === "initializing"}
                  className="gap-2 border border-primary/50"
                  data-ocid="camera.primary_button"
                >
                  {isLoading || cameraStatus === "initializing" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4" />
                      Start Camera
                    </>
                  )}
                </Button>
              )}
            {isActive && (
              <Button
                onClick={handleStopCamera}
                variant="destructive"
                className="gap-2 border border-destructive/60"
                data-ocid="camera.delete_button"
              >
                <CameraOff className="h-4 w-4" />
                Stop Camera
              </Button>
            )}
            {(cameraStatus === "error" || cameraStatus === "denied") && (
              <Button
                onClick={handleRetry}
                variant="outline"
                className="gap-2 border border-primary/50"
                data-ocid="camera.secondary_button"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            )}
            {isActive && !isDetecting && (
              <Button
                onClick={handleStartDetection}
                variant="default"
                className="gap-2 border border-primary/50"
                data-ocid="detection.primary_button"
              >
                <Play className="h-4 w-4" />
                Start Detection
              </Button>
            )}
            {isActive && isDetecting && (
              <Button
                onClick={handleStopDetection}
                variant="outline"
                className="gap-2 border border-primary/50"
                data-ocid="detection.secondary_button"
              >
                <Square className="h-4 w-4" />
                Stop Detection
              </Button>
            )}
          </div>

          {/* Error */}
          {errorDetails && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorDetails}</AlertDescription>
            </Alert>
          )}

          {/* Legend */}
          {isDetecting && (
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-orange-500" />
                Moving vehicle/obstacle
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm border-2 border-blue-500 border-dashed" />
                Stationary obstacle
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-red-500" />
                Danger zone (&lt;5m)
              </div>
            </div>
          )}

          {/* Camera Preview */}
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{ display: isActive ? "block" : "none" }}
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ display: isDetecting ? "block" : "none" }}
            />
            <canvas ref={canvasRef} className="hidden" />

            {!isActive && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Camera preview will appear here</p>
                </div>
              </div>
            )}

            {isActive && !isDetecting && (
              <div className="absolute top-4 left-4 right-4">
                <Alert className="bg-background/80 backdrop-blur">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Camera ready. Click "Start Detection" to begin analysis.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {isDetecting && (
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                <Badge variant="destructive" className="animate-pulse">
                  <Activity className="h-3 w-3 mr-1" />
                  LIVE
                </Badge>
                <div className="flex gap-2">
                  {movingCount > 0 && (
                    <Badge className="bg-orange-500 text-white text-xs">
                      {movingCount} Moving
                    </Badge>
                  )}
                  {stationaryCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {stationaryCount} Stationary
                    </Badge>
                  )}
                  <Badge variant="secondary">
                    {realTimeFPS.toFixed(1)} FPS
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {/* Detection Statistics */}
          {isDetecting && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-xs text-muted-foreground">
                  Total Obstacles
                </div>
                <div className="text-2xl font-bold">
                  {detectionCount.obstacles}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                <div className="text-xs text-orange-400">Moving</div>
                <div className="text-2xl font-bold text-orange-500">
                  {detectionCount.moving}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-xs text-muted-foreground">Stationary</div>
                <div className="text-2xl font-bold">
                  {detectionCount.stationary}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-xs text-muted-foreground">Potholes</div>
                <div className="text-2xl font-bold text-yellow-500">
                  {detectionCount.potholes}
                </div>
              </div>
            </div>
          )}

          {/* Live Detection Panel */}
          {isDetecting && (motionDetections.length > 0 || metrics) && (
            <div className="rounded-lg border border-primary/30 bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Eye className="h-4 w-4 text-primary" />
                Live Detection Data
                <Badge variant="secondary" className="ml-auto text-xs">
                  {realTimeFPS.toFixed(1)} FPS
                </Badge>
              </div>

              {/* Road info */}
              {metrics && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between rounded-md bg-background/60 px-3 py-2 border border-border">
                    <span className="text-muted-foreground">Road Type</span>
                    <span className="font-medium capitalize">
                      {metrics.roadType || "Analyzing..."}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-background/60 px-3 py-2 border border-border">
                    <span className="text-muted-foreground">Weather</span>
                    <span className="font-medium capitalize">
                      {metrics.environmentalConditions?.weather || "Clear"}
                    </span>
                  </div>
                </div>
              )}

              {/* Motion detections */}
              {motionDetections.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Detected Objects
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {motionDetections.map((det) => (
                      <Badge
                        key={det.id}
                        variant={
                          det.riskLevel === "High"
                            ? "destructive"
                            : det.motion === "Moving"
                              ? "default"
                              : "secondary"
                        }
                        className={`text-xs gap-1 ${
                          det.motion === "Moving"
                            ? "bg-orange-500 hover:bg-orange-600 text-white"
                            : ""
                        }`}
                      >
                        {det.label}
                        <span className="opacity-80">
                          {Math.round(det.confidence * 100)}%
                        </span>
                        <span className="opacity-60">
                          ~{det.estimatedDistance.toFixed(1)}m
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Potholes */}
              {potholes.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Potholes
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {potholes.map((p) => (
                      <Badge
                        key={p.id}
                        variant="outline"
                        className="text-xs border-yellow-500/60 text-yellow-500"
                      >
                        {p.severity} • {p.distance.toFixed(0)}m away
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Emergency */}
              {emergencyConditions.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-destructive uppercase tracking-wide">
                    Emergency Alerts
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {emergencyConditions.map((ec) => (
                      <Badge
                        key={ec.id}
                        variant="destructive"
                        className="text-xs"
                      >
                        {ec.type} — {ec.description}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {motionDetections.length === 0 &&
                potholes.length === 0 &&
                emergencyConditions.length === 0 && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    No obstacles detected — road clear
                  </div>
                )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metrics and Alerts */}
      {metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DriverAlertPanel
            obstacles={obstacles}
            emergencyConditions={emergencyConditions}
            potholes={potholes}
            detectedSpeedLimit={detectedSpeedLimit}
            currentSpeed={currentSpeed}
            soundEnabled={soundEnabled}
          />
          <MetricsPanel
            confidenceScore={metrics.confidenceScore}
            processingTime={metrics.processingTime}
            metrics={metrics}
            environmentalConditions={metrics.environmentalConditions}
            roadType={metrics.roadType}
            roadSurfaceFeatures={roadSurfaceFeatures}
          />
        </div>
      )}

      {detectedSpeedLimit !== null && (
        <SpeedLimitDisplay
          detectedSpeedLimit={detectedSpeedLimit}
          speedLimitConfidence={speedLimitConfidence}
          currentSpeed={currentSpeed}
          onSpeedChange={setCurrentSpeed}
        />
      )}
    </div>
  );
}
