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
import MetricsPanel from './MetricsPanel';
import DriverAlertPanel from './DriverAlertPanel';
import SpeedLimitDisplay from './SpeedLimitDisplay';
import { useStoreObstacleEvent, useStoreEmergencyEvent, useStoreSpeedLimitDetection } from '@/hooks/useQueries';
import { ExternalBlob } from '@/backend';

interface LiveCameraSectionProps {
  isActive?: boolean;
  autoStart?: boolean;
}

type CameraStatus = 'idle' | 'initializing' | 'requesting-permission' | 'active' | 'error' | 'denied';
type SystemStatus = 'idle' | 'initializing' | 'ready' | 'active' | 'error';

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
  const [metrics, setMetrics] = useState<any>(null);
  const [obstacles, setObstacles] = useState<any[]>([]);
  const [emergencyConditions, setEmergencyConditions] = useState<any[]>([]);
  const [detectedSpeedLimit, setDetectedSpeedLimit] = useState<number | null>(null);
  const [speedLimitConfidence, setSpeedLimitConfidence] = useState<number>(0);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [systemStatus, setSystemStatus] = useState<SystemStatus>('idle');
  const [autoStartAttempted, setAutoStartAttempted] = useState(false);
  const [realTimeFPS, setRealTimeFPS] = useState<number>(0);
  const [detectionCount, setDetectionCount] = useState({ obstacles: 0, speedLimits: 0, emergencies: 0 });
  const [errorDetails, setErrorDetails] = useState<string>('');
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastProcessTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const performanceMetricsRef = useRef({ avgFrameTime: 0, frameCount: 0 });
  const fpsCounterRef = useRef({ frames: 0, lastTime: performance.now() });
  const storeObstacleEvent = useStoreObstacleEvent();
  const storeEmergencyEvent = useStoreEmergencyEvent();
  const storeSpeedLimitDetection = useStoreSpeedLimitDetection();
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
        
        if (result.obstacleDetection) {
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => {
            ctx.globalAlpha = 1.0;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          };
          img.src = result.obstacleDetection.visualizationUrl;

          setObstacles(result.obstacleDetection.obstacles);
          setEmergencyConditions(result.obstacleDetection.emergencyConditions);

          if (result.obstacleDetection.obstacles.length > 0 && result.id !== lastDetectionIdRef.current) {
            lastDetectionIdRef.current = result.id;
            
            let obstacleCount = 0;
            let emergencyCount = 0;

            result.obstacleDetection.obstacles.forEach(async (obstacle) => {
              const obstacleBuffer = new ArrayBuffer(result.obstacleDetection!.visualizationData.length);
              const obstacleView = new Uint8Array(obstacleBuffer);
              obstacleView.set(result.obstacleDetection!.visualizationData);
              const obstacleBlob = ExternalBlob.fromBytes(obstacleView);

              await storeObstacleEvent.mutateAsync({
                id: obstacle.id,
                position: obstacle.position,
                type: obstacle.type,
                confidenceLevel: obstacle.confidenceLevel,
                timestamp: BigInt(Date.now() * 1000000),
                associatedDetectionId: result.id,
                image: obstacleBlob,
                riskLevel: obstacle.riskLevel,
              });
              obstacleCount++;
            });

            result.obstacleDetection.emergencyConditions.forEach(async (emergency) => {
              await storeEmergencyEvent.mutateAsync({
                id: emergency.id,
                type: emergency.type,
                timestamp: BigInt(Date.now() * 1000000),
                associatedDetectionId: result.id,
                description: emergency.description,
                severity: emergency.severity,
              });
              emergencyCount++;
            });

            setDetectionCount(prev => ({
              obstacles: prev.obstacles + obstacleCount,
              speedLimits: prev.speedLimits,
              emergencies: prev.emergencies + emergencyCount,
            }));
          }
        }

        const timeSinceLastSpeedDetection = currentTime - lastSpeedLimitDetectionRef.current;
        if (timeSinceLastSpeedDetection > 3000) {
          lastSpeedLimitDetectionRef.current = currentTime;
          
          try {
            const speedLimitResult = await detectSpeedLimit(dataUrl, canvas.width, canvas.height);
            
            if (speedLimitResult.detectedSpeedLimit !== null && speedLimitResult.confidenceLevel > 0.6) {
              setDetectedSpeedLimit(speedLimitResult.detectedSpeedLimit);
              setSpeedLimitConfidence(speedLimitResult.confidenceLevel);
              
              const frameBuffer = new ArrayBuffer(speedLimitResult.visualizationData.length);
              const frameView = new Uint8Array(frameBuffer);
              frameView.set(speedLimitResult.visualizationData);
              const frameBlob = ExternalBlob.fromBytes(frameView);
              
              await storeSpeedLimitDetection.mutateAsync({
                id: `speed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                detectedSpeedLimit: BigInt(speedLimitResult.detectedSpeedLimit),
                confidenceLevel: speedLimitResult.confidenceLevel,
                timestamp: BigInt(Date.now() * 1000000),
                associatedDetectionId: result.id,
                frameData: frameBlob,
              });

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
        });
      } catch (error) {
        console.error('[Detection] Frame processing error:', error);
      }
    }

    animationFrameRef.current = requestAnimationFrame(processFrame);
  }, [isDetecting, videoRef, storeObstacleEvent, storeEmergencyEvent, storeSpeedLimitDetection, realTimeFPS]);

  const handleStartCamera = async () => {
    console.log('[Camera] Manual start camera requested');
    setSystemStatus('initializing');
    setCameraStatus('initializing');
    setErrorDetails('');
    
    try {
      console.log('[Camera] Calling startCamera()...');
      
      // Add timeout for camera initialization
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('Camera initialization timeout after 10 seconds')), 10000);
      });
      
      const startPromise = startCamera();
      const success = await Promise.race([startPromise, timeoutPromise]);
      
      if (success) {
        console.log('[Camera] Camera started successfully');
        setCameraStatus('active');
        setSystemStatus('ready');
        setErrorDetails('');
        toast.success('Camera Started', {
          description: 'Camera is now active and ready',
        });
      } else {
        console.error('[Camera] startCamera() returned false');
        setCameraStatus('error');
        setSystemStatus('error');
        const errorMsg = 'Failed to start camera. Please check permissions and try again.';
        setErrorDetails(errorMsg);
        toast.error('Camera Start Failed', {
          description: errorMsg,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('[Camera] Camera start exception:', err);
      setCameraStatus('error');
      setSystemStatus('error');
      setErrorDetails(`Camera error: ${errorMessage}`);
      toast.error('Camera Error', {
        description: errorMessage,
      });
    }
  };

  const handleRetryCamera = async () => {
    console.log('[Camera] Retry camera requested');
    setSystemStatus('initializing');
    setCameraStatus('initializing');
    setErrorDetails('');
    setAutoStartAttempted(false);
    
    try {
      console.log('[Camera] Calling retry()...');
      
      // Add timeout for retry
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('Camera retry timeout after 10 seconds')), 10000);
      });
      
      const retryPromise = retry();
      const success = await Promise.race([retryPromise, timeoutPromise]);
      
      if (success) {
        console.log('[Camera] Camera retry successful');
        setCameraStatus('active');
        setSystemStatus('ready');
        setErrorDetails('');
        toast.success('Camera Connected', {
          description: 'Camera retry successful',
        });
      } else {
        console.error('[Camera] retry() returned false');
        setCameraStatus('error');
        setSystemStatus('error');
        const errorMsg = 'Failed to retry camera. Please check permissions and try again.';
        setErrorDetails(errorMsg);
        toast.error('Camera Retry Failed', {
          description: errorMsg,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('[Camera] Camera retry exception:', err);
      setCameraStatus('error');
      setSystemStatus('error');
      setErrorDetails(`Camera retry error: ${errorMessage}`);
      toast.error('Camera Retry Error', {
        description: errorMessage,
      });
    }
  };

  const handleStartDetection = async () => {
    if (!isActive) {
      console.log('[Detection] Camera not active, starting camera first...');
      await handleStartCamera();
      // Wait for camera to fully initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      if (!isActive) {
        console.error('[Detection] Camera failed to start, cannot begin detection');
        return;
      }
    }
    console.log('[Detection] Starting live detection...');
    setIsDetecting(true);
    setSystemStatus('active');
    frameCountRef.current = 0;
    performanceMetricsRef.current = { avgFrameTime: 0, frameCount: 0 };
    fpsCounterRef.current = { frames: 0, lastTime: performance.now() };
  };

  const handleStopDetection = () => {
    console.log('[Detection] Stopping detection...');
    setIsDetecting(false);
    setSystemStatus('ready');
    if (animationFrameRef.current !== undefined) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setObstacles([]);
    setEmergencyConditions([]);
    setRealTimeFPS(0);
  };

  const handleStopCamera = async () => {
    console.log('[Camera] Stopping camera...');
    handleStopDetection();
    await stopCamera();
    setCameraStatus('idle');
    setSystemStatus('idle');
    setAutoStartAttempted(false);
  };

  useEffect(() => {
    if (isDetecting && isActive) {
      processFrame();
    }
    return () => {
      if (animationFrameRef.current !== undefined) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isDetecting, isActive, processFrame]);

  if (isSupported === false) {
    return (
      <Alert variant="destructive" className="animate-slide-in">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-medium">Camera Not Supported</p>
            <p>Your browser does not support camera access. Please use a modern browser with camera support:</p>
            <ul className="ml-4 list-disc space-y-1 text-sm">
              <li>Google Chrome (recommended)</li>
              <li>Mozilla Firefox</li>
              <li>Safari (macOS/iOS)</li>
              <li>Microsoft Edge</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  const getSystemStatusBadge = () => {
    switch (systemStatus) {
      case 'initializing':
        return (
          <Badge variant="outline" className="gap-1.5 border-primary/50 bg-primary/10">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            Initializing System
          </Badge>
        );
      case 'ready':
        return (
          <Badge variant="outline" className="gap-1.5 border-chart-2/50 bg-chart-2/10">
            <CheckCircle2 className="h-3 w-3 text-chart-2" />
            System Ready
          </Badge>
        );
      case 'active':
        return (
          <Badge variant="default" className="gap-1.5 animate-pulse-glow">
            <Activity className="h-3 w-3" />
            Live Monitoring Active
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1.5">
            <AlertCircle className="h-3 w-3" />
            System Error
          </Badge>
        );
      default:
        return null;
    }
  };

  const getCameraStatusBadge = () => {
    switch (cameraStatus) {
      case 'initializing':
      case 'requesting-permission':
        return (
          <Badge variant="outline" className="gap-1.5 border-primary/50 bg-primary/10">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            {cameraStatus === 'requesting-permission' ? 'Requesting Access' : 'Initializing'}
          </Badge>
        );
      case 'active':
        return (
          <Badge variant="outline" className="gap-1.5 border-chart-1/50 bg-chart-1/10">
            <ShieldCheck className="h-3 w-3 text-chart-1" />
            Camera Active
          </Badge>
        );
      case 'denied':
        return (
          <Badge variant="destructive" className="gap-1.5">
            <ShieldAlert className="h-3 w-3" />
            Access Denied
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1.5">
            <AlertCircle className="h-3 w-3" />
            Camera Error
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="card-enhanced animate-slide-in lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" />
                Live Operational Mode
              </CardTitle>
              <CardDescription>
                Continuous real-time monitoring with instant alerts
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {getSystemStatusBadge()}
              {getCameraStatusBadge()}
              {isActive && isDetecting && realTimeFPS > 0 && (
                <Badge variant="outline" className="gap-1.5 border-primary/50 bg-primary/10">
                  <Cpu className="h-3 w-3 text-primary" />
                  {realTimeFPS.toFixed(1)} FPS
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Live Detection Statistics */}
          {isDetecting && (
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 p-4 shadow-inner">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{detectionCount.obstacles}</p>
                <p className="text-xs text-muted-foreground">Obstacles Detected</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-chart-1">{detectionCount.speedLimits}</p>
                <p className="text-xs text-muted-foreground">Speed Limits Found</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-destructive">{detectionCount.emergencies}</p>
                <p className="text-xs text-muted-foreground">Emergency Events</p>
              </div>
            </div>
          )}

          <div className="relative aspect-video overflow-hidden rounded-2xl bg-muted shadow-lg">
            {cameraStatus === 'active' && isActive ? (
              <>
                {/* Video element - always visible, positioned behind canvas when detecting */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ 
                    zIndex: isDetecting ? 0 : 10,
                  }}
                />
                {/* Overlay canvas for detection visualization */}
                <canvas
                  ref={overlayCanvasRef}
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ 
                    zIndex: isDetecting ? 10 : 0,
                    pointerEvents: 'none',
                  }}
                />
                {/* Hidden canvas for photo capture */}
                <canvas ref={canvasRef} className="hidden" />
                
                {/* Live Status Overlay */}
                {isDetecting && (
                  <div className="absolute top-4 left-4 z-20 flex items-center gap-2 rounded-lg bg-black/70 px-3 py-2 backdrop-blur-sm">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-semibold text-white">LIVE</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center p-8">
                <div className="max-w-md text-center">
                  <div className="mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 p-6 shadow-lg">
                    {cameraStatus === 'initializing' || cameraStatus === 'requesting-permission' ? (
                      <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                    ) : cameraStatus === 'denied' ? (
                      <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
                    ) : cameraStatus === 'error' ? (
                      <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
                    ) : systemStatus === 'initializing' ? (
                      <Zap className="mx-auto h-12 w-12 text-primary animate-pulse" />
                    ) : (
                      <Camera className="mx-auto h-12 w-12 text-primary" />
                    )}
                  </div>
                  <p className="text-lg font-medium text-foreground">
                    {cameraStatus === 'requesting-permission' 
                      ? 'Requesting Camera Access' 
                      : cameraStatus === 'initializing'
                        ? 'Initializing Camera'
                        : cameraStatus === 'denied'
                          ? 'Camera Access Denied'
                          : cameraStatus === 'error'
                            ? 'Camera Error'
                            : systemStatus === 'initializing'
                              ? 'Initializing Live System'
                              : 'Camera Ready to Start'}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {cameraStatus === 'requesting-permission' 
                      ? 'Please allow camera access when prompted'
                      : cameraStatus === 'initializing'
                        ? 'Setting up camera connection...'
                        : cameraStatus === 'denied' 
                          ? 'Camera permissions are required for live monitoring'
                          : cameraStatus === 'error'
                            ? errorDetails || 'An error occurred while accessing the camera'
                            : systemStatus === 'initializing'
                              ? 'Setting up continuous monitoring system...'
                              : 'Click "Start Camera" to begin live monitoring'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Permission prompt alert */}
          {cameraStatus === 'idle' && !error && !isLoading && (
            <Alert className="animate-slide-in border-primary/50 bg-primary/5">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <AlertDescription>
                <p className="font-medium text-primary">Live Operational Mode - Camera Access Required</p>
                <p className="mt-1 text-sm">
                  This system requires continuous camera access for real-time road monitoring and instant driver alerts. 
                  All processing happens locally in your browser with hardware acceleration.
                </p>
                <p className="mt-2 text-sm font-medium">
                  Click "Start Camera" below and allow access when prompted.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Camera active and ready alert */}
          {cameraStatus === 'active' && isActive && !isDetecting && (
            <Alert className="animate-slide-in border-chart-2/50 bg-chart-2/5">
              <CheckCircle2 className="h-4 w-4 text-chart-2" />
              <AlertDescription>
                <p className="font-medium text-chart-2">Camera Connected Successfully</p>
                <p className="mt-1 text-sm">
                  Your camera is now active and ready for live monitoring. Click "Start Live Monitoring" to begin real-time detection.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Permission denied alert */}
          {cameraStatus === 'denied' && (
            <Alert variant="destructive" className="animate-slide-in">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Camera Access Denied - Live Mode Unavailable</p>
                  <p className="text-sm">
                    Live operational mode requires camera permissions. To enable:
                  </p>
                  <ol className="ml-4 list-decimal space-y-1 text-sm">
                    <li>Click the camera icon (🎥) or lock icon (🔒) in your browser's address bar</li>
                    <li>Change "Camera" permission to "Allow"</li>
                    <li>Click the "Retry Camera" button below</li>
                  </ol>
                  {errorDetails && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Error details: {errorDetails}
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Camera error alert - only show for non-denied errors */}
          {cameraStatus === 'error' && (
            <Alert variant="destructive" className="animate-slide-in">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Camera Error</p>
                  <p className="text-sm">
                    {errorDetails || (error ? error.message : 'An error occurred while accessing the camera')}
                  </p>
                  {error?.type === 'not-found' && (
                    <div className="mt-2 text-sm">
                      <p className="font-medium">Troubleshooting:</p>
                      <ul className="ml-4 list-disc space-y-1">
                        <li>Ensure your device has a camera connected</li>
                        <li>Check that no other application is using the camera</li>
                        <li>Try reconnecting your camera (if external)</li>
                        <li>Restart your browser</li>
                      </ul>
                    </div>
                  )}
                  {error?.type === 'not-supported' && (
                    <p className="mt-2 text-sm">
                      Your browser or device does not support camera access. Please try a different browser or device.
                    </p>
                  )}
                  {error?.type === 'unknown' && (
                    <p className="mt-2 text-sm">
                      An unexpected error occurred. Please try again or use a different browser.
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            {cameraStatus !== 'active' ? (
              <>
                <Button
                  onClick={handleStartCamera}
                  disabled={cameraStatus === 'initializing' || cameraStatus === 'requesting-permission'}
                  className="flex-1 rounded-xl shadow-lg transition-all duration-300 hover:shadow-glow"
                  size="lg"
                >
                  {cameraStatus === 'initializing' || cameraStatus === 'requesting-permission' ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {cameraStatus === 'requesting-permission' ? 'Requesting Access...' : 'Initializing...'}
                    </>
                  ) : (
                    <>
                      <Camera className="mr-2 h-5 w-5" />
                      Start Camera
                    </>
                  )}
                </Button>
                {(cameraStatus === 'error' || cameraStatus === 'denied') && (
                  <Button
                    onClick={handleRetryCamera}
                    variant="outline"
                    className="rounded-xl transition-all duration-300"
                    size="lg"
                  >
                    <RefreshCw className="mr-2 h-5 w-5" />
                    Retry
                  </Button>
                )}
              </>
            ) : (
              <>
                {!isDetecting ? (
                  <Button
                    onClick={handleStartDetection}
                    className="flex-1 rounded-xl shadow-lg transition-all duration-300 hover:shadow-glow"
                    size="lg"
                  >
                    <Play className="mr-2 h-5 w-5" />
                    Start Live Monitoring
                  </Button>
                ) : (
                  <Button
                    onClick={handleStopDetection}
                    variant="secondary"
                    className="flex-1 rounded-xl shadow-lg transition-all duration-300"
                    size="lg"
                  >
                    <Square className="mr-2 h-5 w-5" />
                    Pause Monitoring
                  </Button>
                )}
                <Button
                  onClick={handleStopCamera}
                  variant="outline"
                  className="rounded-xl transition-all duration-300 hover:border-destructive hover:text-destructive"
                  size="lg"
                >
                  <CameraOff className="mr-2 h-5 w-5" />
                  Stop Camera
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {isDetecting && (
          <>
            <div className="animate-slide-in">
              <SpeedLimitDisplay
                detectedSpeedLimit={detectedSpeedLimit}
                speedLimitConfidence={speedLimitConfidence}
                currentSpeed={currentSpeed}
                onSpeedChange={setCurrentSpeed}
              />
            </div>
            
            <div className="animate-slide-in">
              <DriverAlertPanel
                obstacles={obstacles}
                emergencyConditions={emergencyConditions}
                detectedSpeedLimit={detectedSpeedLimit}
                currentSpeed={currentSpeed}
                soundEnabled={soundEnabled}
                onToggleSound={() => setSoundEnabled(!soundEnabled)}
              />
            </div>
          </>
        )}
        
        {metrics && isDetecting && (
          <div className="animate-slide-in">
            <MetricsPanel metrics={metrics} isLive />
          </div>
        )}
      </div>
    </div>
  );
}
