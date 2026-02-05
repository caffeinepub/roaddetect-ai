import { useState, useRef, useCallback } from 'react';
import { Upload, Video as VideoIcon, Loader2, Play, Pause, SkipForward, SkipBack } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { processRoadDetection } from '@/lib/roadDetection';
import { useStoreDetection, useStoreObstacleEvent, useStoreEmergencyEvent } from '@/hooks/useQueries';
import { ExternalBlob } from '@/backend';

interface VideoFrame {
  frameNumber: number;
  timestamp: number;
  imageUrl: string;
  detectionResult?: any;
}

export default function VideoUploadSection() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [videoFrames, setVideoFrames] = useState<VideoFrame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const storeDetection = useStoreDetection();
  const storeObstacleEvent = useStoreObstacleEvent();
  const storeEmergencyEvent = useStoreEmergencyEvent();

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('video/')) {
      toast.error('Please select a valid video file (MP4, AVI, MOV, WebM)');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setVideoFrames([]);
    setCurrentFrameIndex(0);
    setProcessingProgress(0);
    
    // Load video metadata
    const video = document.createElement('video');
    video.src = url;
    video.onloadedmetadata = () => {
      setVideoDuration(video.duration);
      const estimatedFrames = Math.floor(video.duration * 2); // Extract 2 frames per second
      setTotalFrames(estimatedFrames);
    };
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const extractFrameFromVideo = async (
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    time: number
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      video.currentTime = time;
      video.onseeked = () => {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(imageUrl);
      };
      video.onerror = reject;
    });
  };

  const deriveSurfaceType = (roadType: string): string => {
    if (roadType.includes('Asphalt')) return 'asphalt';
    if (roadType.includes('Concrete')) return 'concrete';
    if (roadType.includes('Dirt')) return 'dirt';
    if (roadType.includes('Paved')) return 'paved';
    return 'unknown';
  };

  const processVideo = async () => {
    if (!selectedFile || !previewUrl || !videoRef.current || !canvasRef.current) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    const frames: VideoFrame[] = [];

    try {
      toast.info('Starting video processing...', {
        description: 'Extracting frames and analyzing road conditions',
      });

      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Wait for video to load
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = reject;
        video.src = previewUrl;
      });

      const duration = video.duration;
      const frameInterval = 0.5; // Extract frame every 0.5 seconds
      const totalFramesToExtract = Math.floor(duration / frameInterval);

      for (let i = 0; i < totalFramesToExtract; i++) {
        const time = i * frameInterval;
        
        try {
          const imageUrl = await extractFrameFromVideo(video, canvas, time);
          
          // Process frame with road detection
          const result = await processRoadDetection(imageUrl, 'video', undefined, true);
          
          frames.push({
            frameNumber: i,
            timestamp: time,
            imageUrl,
            detectionResult: result,
          });

          // Store detection result in backend
          const originalBuffer = new ArrayBuffer(result.originalImageData.length);
          const originalView = new Uint8Array(originalBuffer);
          originalView.set(result.originalImageData);
          const originalBlob = ExternalBlob.fromBytes(originalView);

          const processedBuffer = new ArrayBuffer(result.processedImageData.length);
          const processedView = new Uint8Array(processedBuffer);
          processedView.set(result.processedImageData);
          const processedBlob = ExternalBlob.fromBytes(processedView);

          await storeDetection.mutateAsync({
            id: result.id,
            image: originalBlob,
            processedImage: processedBlob,
            confidenceScore: result.confidenceScore,
            processingTime: BigInt(result.processingTime),
            timestamp: BigInt(Date.now() * 1000000),
            lighting: result.environmentalConditions.lighting,
            weather: result.environmentalConditions.weather,
            roadType: result.roadType,
            surfaceType: deriveSurfaceType(result.roadType),
            frameRate: result.metrics.frameRate,
            detectionQuality: result.metrics.detectionQuality,
            objectDetection: result.metrics.objectDetection,
            hardwareType: result.metrics.hardwareAcceleration || 'standard',
            cpuUtilization: result.metrics.cpuUtilization ? parseFloat(result.metrics.cpuUtilization) : 0,
            gpuUtilization: 0,
            memoryUsage: 0,
          });

          // Store obstacle events
          if (result.obstacleDetection && result.obstacleDetection.obstacles.length > 0) {
            for (const obstacle of result.obstacleDetection.obstacles) {
              const obstacleBuffer = new ArrayBuffer(result.obstacleDetection.visualizationData.length);
              const obstacleView = new Uint8Array(obstacleBuffer);
              obstacleView.set(result.obstacleDetection.visualizationData);
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
            }

            for (const emergency of result.obstacleDetection.emergencyConditions) {
              await storeEmergencyEvent.mutateAsync({
                id: emergency.id,
                type: emergency.type,
                timestamp: BigInt(Date.now() * 1000000),
                associatedDetectionId: result.id,
                description: emergency.description,
                severity: emergency.severity,
              });
            }
          }

          const progress = ((i + 1) / totalFramesToExtract) * 100;
          setProcessingProgress(progress);
          
        } catch (error) {
          console.error(`Error processing frame ${i}:`, error);
        }
      }

      setVideoFrames(frames);
      setCurrentFrameIndex(0);
      
      toast.success('Video processing completed!', {
        description: `Analyzed ${frames.length} frames with road and obstacle detection`,
      });
      
    } catch (error) {
      console.error('Video processing error:', error);
      toast.error('Failed to process video', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      playbackIntervalRef.current = setInterval(() => {
        setCurrentFrameIndex((prev) => {
          if (prev >= videoFrames.length - 1) {
            if (playbackIntervalRef.current) {
              clearInterval(playbackIntervalRef.current);
              playbackIntervalRef.current = null;
            }
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 500);
    }
  };

  const handleNextFrame = () => {
    setCurrentFrameIndex((prev) => Math.min(prev + 1, videoFrames.length - 1));
  };

  const handlePrevFrame = () => {
    setCurrentFrameIndex((prev) => Math.max(prev - 1, 0));
  };

  const currentFrame = videoFrames[currentFrameIndex];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="card-enhanced animate-slide-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <VideoIcon className="h-5 w-5 text-primary" />
            Upload Video for Analysis
          </CardTitle>
          <CardDescription>
            Upload a video to analyze road conditions frame-by-frame with ML detection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative flex min-h-[320px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 ${
              isDragging
                ? 'border-primary bg-primary/10 shadow-glow'
                : 'border-border hover:border-primary/50 hover:bg-accent/30 hover:shadow-md'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/avi,video/mov,video/webm"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {previewUrl ? (
              <div className="relative h-full w-full">
                <video
                  ref={videoRef}
                  src={previewUrl}
                  className="h-full w-full rounded-2xl object-contain"
                  controls
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/90 opacity-0 backdrop-blur-sm transition-opacity duration-300 hover:opacity-100">
                  <div className="text-center">
                    <Upload className="mx-auto mb-2 h-8 w-8 text-primary" />
                    <p className="font-medium">Click to change video</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 p-5 shadow-lg">
                  <VideoIcon className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold">Drop your video here</p>
                  <p className="text-sm text-muted-foreground">or click to browse</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Supports: MP4, AVI, MOV, WebM
                </p>
              </div>
            )}
          </div>

          {isProcessing && (
            <div className="space-y-2 rounded-xl bg-primary/5 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Processing video...</span>
                <span className="text-muted-foreground">{Math.round(processingProgress)}%</span>
              </div>
              <Progress value={processingProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Extracting frames and analyzing road conditions
              </p>
            </div>
          )}

          <Button
            onClick={processVideo}
            disabled={!selectedFile || isProcessing}
            className="w-full rounded-xl shadow-lg transition-all duration-300 hover:shadow-glow"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing Video...
              </>
            ) : (
              <>
                <VideoIcon className="mr-2 h-5 w-5" />
                Analyze Video
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {videoFrames.length > 0 && currentFrame && (
        <Card className="card-enhanced animate-slide-in">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Detection Results
              </CardTitle>
              <Badge variant="outline" className="gap-1.5">
                Frame {currentFrameIndex + 1} / {videoFrames.length}
              </Badge>
            </div>
            <CardDescription>
              Frame-by-frame road and obstacle detection analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-muted">
              {currentFrame.detectionResult && (
                <img
                  src={currentFrame.detectionResult.processedImageUrl}
                  alt={`Frame ${currentFrameIndex + 1}`}
                  className="h-full w-full object-contain"
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handlePrevFrame}
                disabled={currentFrameIndex === 0}
                variant="outline"
                size="icon"
                className="rounded-xl"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                onClick={handlePlayPause}
                variant="outline"
                size="icon"
                className="rounded-xl"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button
                onClick={handleNextFrame}
                disabled={currentFrameIndex === videoFrames.length - 1}
                variant="outline"
                size="icon"
                className="rounded-xl"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <Progress 
                  value={(currentFrameIndex / (videoFrames.length - 1)) * 100} 
                  className="h-2"
                />
              </div>
            </div>

            {currentFrame.detectionResult && (
              <div className="space-y-3 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Confidence</p>
                    <p className="font-semibold">
                      {(currentFrame.detectionResult.confidenceScore * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Road Type</p>
                    <p className="font-semibold">{currentFrame.detectionResult.roadType}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Lighting</p>
                    <p className="font-semibold">
                      {currentFrame.detectionResult.environmentalConditions.lighting}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Weather</p>
                    <p className="font-semibold">
                      {currentFrame.detectionResult.environmentalConditions.weather}
                    </p>
                  </div>
                </div>

                {currentFrame.detectionResult.obstacleDetection && 
                 currentFrame.detectionResult.obstacleDetection.obstacles.length > 0 && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <p className="text-sm font-medium text-destructive">
                      {currentFrame.detectionResult.obstacleDetection.obstacles.length} Obstacle(s) Detected
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
