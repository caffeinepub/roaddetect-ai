import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, CameraOff, Loader2, Play, Square, AlertCircle, CheckCircle2, Cpu, ShieldCheck, ShieldAlert, Activity, Zap, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useCamera } from '@/camera/useCamera';
import { processRoadDetection } from '@/lib/roadDetection';
import { detectSpeedLimit } from '@/lib/speedLimitDetection';
import { trackObstacles, initializeTrackingState, type TrackingState } from '@/lib/obstacleTracking';
import MetricsPanel from './MetricsPanel';
import DriverAlertPanel from './DriverAlertPanel';
import SpeedLimitDisplay from './SpeedLimitDisplay';
import { useStoreObstacleEvent, useStorePotholeEvent } from '@/hooks/useQueries';
import { ExternalBlob, MotionType, ObjectType, PotholeType } from '@/backend';
import type { DetectionMetrics, EnvironmentalConditions, RoadSurfaceFeatures, ObstacleInfo, EmergencyCondition, PotholeDetection } from '@/types/detection';

interface LiveCameraSectionProps {
  isActive?: boolean;
  autoStart?: boolean;
}

type CameraStatus = 'idle' | 'initializing' | 'requesting-permission' | 'active' | 'error' | 'denied';
type SystemStatus = 'idle' | 'initializing' | 'ready' | 'active' | 'error';

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

export default function LiveCameraSection({ isActive: isTabActive = false, autoStart = false }: LiveCameraSectionProps) {
  const {
    isActive,
    isSupported,
    error,
    isLoading,
    currentFacingMode,
    startCamera,
    stopCamera,
    retry,
    videoRef,
    canvasRef,
  } = useCamera({ facingMode: 'environment' });

  const [isDetecting, setIsDetecting] = useState(false);
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [roadSurfaceFeatures, setRoadSurfaceFeatures] = useState<RoadSurfaceFeatures | undefined>(undefined);
  const [obstacles, setObstacles] = useState<ObstacleInfo[]>([]);
  const [potholes, setPotholes] = useState<PotholeDetection[]>([]);
  const [emergencyConditions, setEmergencyConditions] = useState<EmergencyCondition[]>([]);
  const [detectedSpeedLimit, setDetectedSpeedLimit] = useState<number | null>(null);
  const [speedLimitConfidence, setSpeedLimitConfidence] = useState<number>(0);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [systemStatus, setSystemStatus] = useState<SystemStatus>('idle');
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
  });
  const [errorDetails, setErrorDetails] = useState<string>('');
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastProcessTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const performanceMetricsRef = useRef({ avgFrameTime: 0, frameCount: 0 });
  const fpsCounterRef = useRef({ frames: 0, lastTime: performance.now() });
  const trackingStateRef = useRef<TrackingState>(initializeTrackingState());
  const storeObstacleEvent = useStoreObstacleEvent();
  const storePotholeEvent = useStorePotholeEvent();
  const lastDetectionIdRef = useRef<string>('');
  const lastSpeedLimitDetectionRef = useRef<number>(0);

  // Update camera status based on hook state
  useEffect(() => {
    if (isLoading) {
      setCameraStatus('requesting-permission');
      console.log('[Camera] Requesting permission...');
    } else if (isActive) {
      setCameraStatus('active');
      setSystemStatus('ready');
      setErrorDetails('');
      console.log('[Camera] Camera active and ready');
      
      // Show success toast when camera becomes active
      if (autoStart) {
        toast.success('Camera Connected', {
          description: 'Live monitoring system is ready',
        });
      }
    } else if (error) {
      setCameraStatus(error.type === 'permission' ? 'denied' : 'error');
      setSystemStatus('error');
      const errorMsg = `Camera ${error.type} error: ${error.message}`;
      setErrorDetails(errorMsg);
      console.error('[Camera]', errorMsg, error);
      
      // Show error toast with appropriate message
      if (error.type === 'permission') {
        toast.error('Camera Access Denied', {
          description: 'Please allow camera access in your browser settings',
        });
      } else if (error.type === 'not-found') {
        toast.error('Camera Not Found', {
          description: 'No camera device detected on your system',
        });
      } else if (error.type === 'not-supported') {
        toast.error('Camera Not Supported', {
          description: 'Your browser does not support camera access',
        });
      } else {
        toast.error('Camera Error', {
          description: error.message || 'Failed to initialize camera',
        });
      }
    } else if (!isActive && !isLoading && !error) {
      setCameraStatus('idle');
      if (systemStatus !== 'idle') {
        setSystemStatus('idle');
      }
    }
  }, [isActive, isLoading, error, systemStatus, autoStart]);

  // Auto-start camera in live operational mode with comprehensive error handling
  useEffect(() => {
    if (
      autoStart &&
      isTabActive && 
      !isActive && 
      !autoStartAttempted && 
      !isLoading && 
      isSupported !== false &&
      cameraStatus === 'idle'
    ) {
      console.log('[Camera] Auto-starting camera for live operational mode...');
      setAutoStartAttempted(true);
      setSystemStatus('initializing');
      setCameraStatus('initializing');
      
      const initCamera = async () => {
        try {
          console.log('[Camera] Calling startCamera()...');
          
          // Add timeout for camera initialization
          const timeoutPromise = new Promise<boolean>((_, reject) => {
            setTimeout(() => reject(new Error('Camera initialization timeout')), 10000);
          });
          
          const startPromise = startCamera();
          const success = await Promise.race([startPromise, timeoutPromise]);
          
          if (success) {
            console.log('[Camera] Camera started successfully');
            setCameraStatus('active');
            setSystemStatus('ready');
            setErrorDetails('');
          } else {
            console.error('[Camera] startCamera() returned false');
            setCameraStatus('error');
            setSystemStatus('error');
            const errorMsg = 'Failed to initialize camera. Please check permissions and try again.';
            setErrorDetails(errorMsg);
            toast.error('Camera Initialization Failed', {
              description: errorMsg,
            });
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          console.error('[Camera] Camera initialization exception:', err);
          setCameraStatus('error');
          setSystemStatus('error');
          setErrorDetails(`Camera initialization failed: ${errorMessage}`);
          
          toast.error('Camera System Error', {
            description: errorMessage,
          });
        }
      };
      
      // Add a small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        initCamera();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [autoStart, isTabActive, isActive, autoStartAttempted, isLoading, isSupported, cameraStatus, startCamera]);

  // Auto-start detection once camera is active in live operational mode
  useEffect(() => {
    if (autoStart && isActive && !isDetecting && systemStatus === 'ready') {
      console.log('[Camera] Auto-starting detection...');
      const timer = setTimeout(() => {
        setIsDetecting(true);
        setSystemStatus('active');
        frameCountRef.current = 0;
        performanceMetricsRef.current = { avgFrameTime: 0, frameCount: 0 };
        fpsCounterRef.current = { frames: 0, lastTime: performance.now() };
        trackingStateRef.current = initializeTrackingState();
        
        toast.info('Live Monitoring Active', {
          description: 'Real-time road detection is now running',
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoStart, isActive, isDetecting, systemStatus]);

  // Reset auto-start flag when tab becomes inactive
  useEffect(() => {
    if (!isTabActive) {
      setAutoStartAttempted(false);
      console.log('[Camera] Tab inactive, reset auto-start flag');
    }
  }, [isTabActive]);

  // Real-time FPS counter using native performance API
  useEffect(() => {
    if (!isDetecting) return;

    const updateFPS = () => {
      const now = performance.now();
      const elapsed = now - fpsCounterRef.current.lastTime;
      
      if (elapsed >= 1000) {
        const fps = (fpsCounterRef.current.frames * 1000) / elapsed;
        setRealTimeFPS(fps);
        fpsCounterRef.current.frames = 0;
        fpsCounterRef.current.lastTime = now;
      }
      
      if (isDetecting) {
        requestAnimationFrame(updateFPS);
      }
    };

    const rafId = requestAnimationFrame(updateFPS);
    return () => cancelAnimationFrame(rafId);
  }, [isDetecting]);

  const processFrame = useCallback(async () => {
    if (!videoRef.current || !overlayCanvasRef.current || !isDetecting) return;

    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    
    const ctx = canvas.getContext('2d', { 
      alpha: false,
      desynchronized: true,
      willReadFrequently: false,
    }) as CanvasRenderingContext2D | null;

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const currentTime = performance.now();
    const timeSinceLastProcess = currentTime - lastProcessTimeRef.current;

    const targetFrameTime = performanceMetricsRef.current.avgFrameTime > 200 ? 500 : 200;
    
    if (timeSinceLastProcess < targetFrameTime) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    lastProcessTimeRef.current = currentTime;
    frameCountRef.current++;
    fpsCounterRef.current.frames++;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    let tempCanvas: HTMLCanvasElement | OffscreenCanvas;
    let tempCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    
    if (typeof OffscreenCanvas !== 'undefined') {
      tempCanvas = new OffscreenCanvas(canvas.width, canvas.height);
      tempCtx = tempCanvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
      })!;
    } else {
      tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      tempCtx = tempCanvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
      })!;
    }
    
    if (tempCtx) {
      tempCtx.putImageData(imageData, 0, 0);
      
      let dataUrl: string;
      if (tempCanvas instanceof OffscreenCanvas) {
        const blob = await tempCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
        dataUrl = URL.createObjectURL(blob);
      } else {
        dataUrl = tempCanvas.toDataURL('image/jpeg', 0.7);
      }

      try {
        const processingStart = performance.now();
        
        const result = await processRoadDetection(dataUrl, 'video', {
          avgFrameTime: performanceMetricsRef.current.avgFrameTime,
          frameCount: frameCountRef.current
        }, true);
        
        const processingTime = performance.now() - processingStart;
        
        performanceMetricsRef.current.frameCount++;
        performanceMetricsRef.current.avgFrameTime = 
          performanceMetricsRef.current.avgFrameTime * 0.9 + processingTime * 0.1;
        
        // Extract potholes from road surface features
        const detectedPotholes = result.roadSurfaceFeatures?.potholes?.detections || [];
        setPotholes(detectedPotholes);

        if (result.obstacleDetection) {
          // Track obstacles across frames for motion classification
          const { trackedObstacles, newState } = trackObstacles(
            result.obstacleDetection.obstacles,
            trackingStateRef.current
          );
          trackingStateRef.current = newState;

          const img = new Image();
          img.decoding = 'async';
          img.onload = () => {
            ctx.globalAlpha = 1.0;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          };
          img.src = result.obstacleDetection.visualizationUrl;

          setObstacles(trackedObstacles);
          setEmergencyConditions(result.obstacleDetection.emergencyConditions);

          if (trackedObstacles.length > 0 && result.id !== lastDetectionIdRef.current) {
            lastDetectionIdRef.current = result.id;
            
            let obstacleCount = 0;
            let emergencyCount = result.obstacleDetection.emergencyConditions.length;
            let vehicleCount = 0;
            let pedestrianCount = 0;
            let debrisCount = 0;

            trackedObstacles.forEach(async (obstacle) => {
              const obstacleBuffer = new ArrayBuffer(result.obstacleDetection!.visualizationData.length);
              const obstacleView = new Uint8Array(obstacleBuffer);
              obstacleView.set(result.obstacleDetection!.visualizationData);
              const obstacleBlob = ExternalBlob.fromBytes(obstacleView);

              // Map obstacle type to backend enum
              let objectType: ObjectType;
              if (obstacle.type === 'Vehicle') {
                objectType = ObjectType.vehicle;
                vehicleCount++;
              } else if (obstacle.type === 'Pedestrian') {
                objectType = ObjectType.pedestrian;
                pedestrianCount++;
              } else if (obstacle.type === 'Debris/Obstacle') {
                objectType = ObjectType.debris;
                debrisCount++;
              } else {
                objectType = ObjectType.unknown_;
              }

              // Map motion to backend enum
              const motion = obstacle.motion === 'Moving' ? MotionType.moving : MotionType.static_;

              await storeObstacleEvent.mutateAsync({
                id: obstacle.id,
                position: obstacle.position,
                type: obstacle.type,
                confidenceLevel: obstacle.confidenceLevel,
                timestamp: BigInt(Date.now() * 1000000),
                associatedDetectionId: result.id,
                image: obstacleBlob,
                riskLevel: obstacle.riskLevel,
                classification: {
                  objectType,
                  motion,
                },
              });
              obstacleCount++;
            });

            setDetectionCount(prev => ({
              obstacles: prev.obstacles + obstacleCount,
              speedLimits: prev.speedLimits,
              emergencies: prev.emergencies + emergencyCount,
              vehicles: prev.vehicles + vehicleCount,
              pedestrians: prev.pedestrians + pedestrianCount,
              debris: prev.debris + debrisCount,
              potholes: prev.potholes,
            }));
          }
        }

        // Store pothole events
        if (detectedPotholes.length > 0 && result.id !== lastDetectionIdRef.current) {
          let potholeCount = 0;

          detectedPotholes.forEach(async (pothole) => {
            const potholeBuffer = new ArrayBuffer(result.processedImageData.length);
            const potholeView = new Uint8Array(potholeBuffer);
            potholeView.set(result.processedImageData);
            const potholeBlob = ExternalBlob.fromBytes(potholeView);

            // Map pothole type to backend enum
            let backendPotholeType: PotholeType;
            switch (pothole.potholeType) {
              case 'surface_cracks':
                backendPotholeType = PotholeType.surface_cracks;
                break;
              case 'rough_size':
                backendPotholeType = PotholeType.rough_size;
                break;
              case 'deep':
                backendPotholeType = PotholeType.deep;
                break;
              case 'edge':
                backendPotholeType = PotholeType.edge;
                break;
              case 'pavement':
                backendPotholeType = PotholeType.pavement;
                break;
              case 'complex':
                backendPotholeType = PotholeType.complex;
                break;
              default:
                backendPotholeType = PotholeType.unknown_;
            }

            await storePotholeEvent.mutateAsync({
              id: pothole.id,
              position: pothole.position,
              confidenceLevel: pothole.confidenceLevel,
              timestamp: BigInt(Date.now() * 1000000),
              associatedDetectionId: result.id,
              image: potholeBlob,
              riskLevel: {
                level: pothole.severity,
                description: `Pothole detected at ${pothole.distance.toFixed(0)}m`,
              },
              potholeDetails: {
                size: pothole.size,
                depth: pothole.depth,
                severity: pothole.severity,
                potholeType: backendPotholeType,
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
          });

          setDetectionCount(prev => ({
            ...prev,
            potholes: prev.potholes + potholeCount,
          }));
        }

        const timeSinceLastSpeedDetection = currentTime - lastSpeedLimitDetectionRef.current;
        if (timeSinceLastSpeedDetection > 3000) {
          lastSpeedLimitDetectionRef.current = currentTime;
          
          try {
            const speedLimitResult = await detectSpeedLimit(dataUrl, canvas.width, canvas.height);
            
            if (speedLimitResult.detectedSpeedLimit !== null && speedLimitResult.confidenceLevel > 0.6) {
              setDetectedSpeedLimit(speedLimitResult.detectedSpeedLimit);
              setSpeedLimitConfidence(speedLimitResult.confidenceLevel);
              
              setDetectionCount(prev => ({
                ...prev,
                speedLimits: prev.speedLimits + 1,
              }));
            }
          } catch (error) {
            console.error('[Detection] Speed limit detection error:', error);
          }
        }

        if (dataUrl.startsWith('blob:')) {
          URL.revokeObjectURL(dataUrl);
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
          realTimeFPS: realTimeFPS,
          potholeCount: result.metrics.potholeCount,
          closestPotholeDistance: result.metrics.closestPotholeDistance,
        });

        setRoadSurfaceFeatures(result.roadSurfaceFeatures);
      } catch (error) {
        console.error('[Detection] Frame processing error:', error);
      }
    }

    animationFrameRef.current = requestAnimationFrame(processFrame);
  }, [isDetecting, videoRef, storeObstacleEvent, storePotholeEvent, realTimeFPS]);

  const handleStartCamera = async () => {
    console.log('[Camera] Manual start camera button clicked');
    setCameraStatus('initializing');
    setSystemStatus('initializing');
    
    try {
      const success = await startCamera();
      if (success) {
        console.log('[Camera] Camera started successfully');
        toast.success('Camera Started', {
          description: 'Camera is now active',
        });
      } else {
        console.error('[Camera] Failed to start camera');
        toast.error('Camera Start Failed', {
          description: 'Could not start camera. Please check permissions.',
        });
      }
    } catch (err) {
      console.error('[Camera] Error starting camera:', err);
      toast.error('Camera Error', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const handleStopCamera = async () => {
    console.log('[Camera] Stop camera button clicked');
    
    if (isDetecting) {
      setIsDetecting(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
    }
    
    await stopCamera();
    setCameraStatus('idle');
    setSystemStatus('idle');
    
    toast.info('Camera Stopped', {
      description: 'Camera has been deactivated',
    });
  };

  const handleStartDetection = () => {
    console.log('[Camera] Start detection button clicked');
    setIsDetecting(true);
    setSystemStatus('active');
    frameCountRef.current = 0;
    performanceMetricsRef.current = { avgFrameTime: 0, frameCount: 0 };
    fpsCounterRef.current = { frames: 0, lastTime: performance.now() };
    trackingStateRef.current = initializeTrackingState();
    
    toast.success('Detection Started', {
      description: 'Real-time road detection is now active',
    });
  };

  const handleStopDetection = () => {
    console.log('[Camera] Stop detection button clicked');
    setIsDetecting(false);
    setSystemStatus('ready');
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
    
    toast.info('Detection Stopped', {
      description: 'Real-time detection has been paused',
    });
  };

  const handleRetry = async () => {
    console.log('[Camera] Retry button clicked');
    setCameraStatus('initializing');
    setSystemStatus('initializing');
    setErrorDetails('');
    
    try {
      const success = await retry();
      if (success) {
        console.log('[Camera] Retry successful');
        toast.success('Camera Reconnected', {
          description: 'Camera is now active',
        });
      } else {
        console.error('[Camera] Retry failed');
        toast.error('Retry Failed', {
          description: 'Could not reconnect to camera',
        });
      }
    } catch (err) {
      console.error('[Camera] Retry error:', err);
      toast.error('Retry Error', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  useEffect(() => {
    if (isDetecting) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isDetecting, processFrame]);

  const getStatusBadge = () => {
    switch (cameraStatus) {
      case 'active':
        return <Badge variant="default" className="bg-success text-success-foreground">Active</Badge>;
      case 'initializing':
      case 'requesting-permission':
        return <Badge variant="secondary">Initializing...</Badge>;
      case 'denied':
        return <Badge variant="destructive">Access Denied</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Idle</Badge>;
    }
  };

  const getSystemStatusBadge = () => {
    switch (systemStatus) {
      case 'active':
        return <Badge variant="default" className="bg-success text-success-foreground">Detecting</Badge>;
      case 'ready':
        return <Badge variant="secondary">Ready</Badge>;
      case 'initializing':
        return <Badge variant="secondary">Initializing...</Badge>;
      case 'error':
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
            Your browser does not support camera access. Please use a modern browser.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

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
            Real-time road detection with obstacle tracking and environmental analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Camera Controls */}
          <div className="flex flex-wrap gap-2">
            {!isActive && cameraStatus !== 'error' && cameraStatus !== 'denied' && (
              <Button
                onClick={handleStartCamera}
                disabled={isLoading || cameraStatus === 'initializing'}
                className="gap-2"
              >
                {isLoading || cameraStatus === 'initializing' ? (
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
                className="gap-2"
              >
                <CameraOff className="h-4 w-4" />
                Stop Camera
              </Button>
            )}

            {(cameraStatus === 'error' || cameraStatus === 'denied') && (
              <Button
                onClick={handleRetry}
                variant="outline"
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            )}

            {isActive && !isDetecting && (
              <Button
                onClick={handleStartDetection}
                variant="default"
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                Start Detection
              </Button>
            )}

            {isActive && isDetecting && (
              <Button
                onClick={handleStopDetection}
                variant="outline"
                className="gap-2"
              >
                <Square className="h-4 w-4" />
                Stop Detection
              </Button>
            )}
          </div>

          {/* Error Display */}
          {errorDetails && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorDetails}</AlertDescription>
            </Alert>
          )}

          {/* Camera Preview */}
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{ display: isActive ? 'block' : 'none' }}
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ display: isDetecting ? 'block' : 'none' }}
            />
            <canvas
              ref={canvasRef}
              className="hidden"
            />
            
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
                <Badge variant="secondary">
                  {realTimeFPS.toFixed(1)} FPS
                </Badge>
              </div>
            )}
          </div>

          {/* Detection Statistics */}
          {isDetecting && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-xs text-muted-foreground">Obstacles</div>
                <div className="text-2xl font-bold">{detectionCount.obstacles}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-xs text-muted-foreground">Potholes</div>
                <div className="text-2xl font-bold text-warning">{detectionCount.potholes}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-xs text-muted-foreground">Speed Limits</div>
                <div className="text-2xl font-bold">{detectionCount.speedLimits}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-xs text-muted-foreground">Emergencies</div>
                <div className="text-2xl font-bold text-destructive">{detectionCount.emergencies}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metrics and Alerts Grid */}
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

      {/* Speed Limit Display */}
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
