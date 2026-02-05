import { useState, useRef, useCallback } from 'react';
import { Upload, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { processRoadDetection } from '@/lib/roadDetection';
import DetectionResults from './DetectionResults';
import { useStoreDetection, useStoreObstacleEvent, useStoreEmergencyEvent } from '@/hooks/useQueries';
import { ExternalBlob } from '@/backend';

export default function ImageUploadSection() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionResult, setDetectionResult] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const storeDetection = useStoreDetection();
  const storeObstacleEvent = useStoreObstacleEvent();
  const storeEmergencyEvent = useStoreEmergencyEvent();

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setDetectionResult(null);
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

  // Derive surface type from road type
  const deriveSurfaceType = (roadType: string): string => {
    if (roadType.includes('Asphalt')) return 'asphalt';
    if (roadType.includes('Concrete')) return 'concrete';
    if (roadType.includes('Dirt')) return 'dirt';
    if (roadType.includes('Paved')) return 'paved';
    return 'unknown';
  };

  const processImage = async () => {
    if (!selectedFile || !previewUrl) return;

    setIsProcessing(true);
    try {
      const result = await processRoadDetection(previewUrl, 'image', undefined, true);
      setDetectionResult(result);

      // Store in backend - create proper Uint8Array<ArrayBuffer>
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

      // Store obstacle detection results
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

        // Store emergency events
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

      toast.success('Road and obstacle detection completed successfully!');
    } catch (error) {
      console.error('Detection error:', error);
      toast.error('Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="card-enhanced animate-slide-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Upload Road Image
          </CardTitle>
          <CardDescription>
            Upload an image to detect road regions and obstacles with ML-powered analysis
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
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {previewUrl ? (
              <div className="relative h-full w-full">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="h-full w-full rounded-2xl object-contain"
                />
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/90 opacity-0 backdrop-blur-sm transition-opacity duration-300 hover:opacity-100">
                  <div className="text-center">
                    <Upload className="mx-auto mb-2 h-8 w-8 text-primary" />
                    <p className="font-medium">Click to change image</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 p-5 shadow-lg">
                  <Upload className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold">Drop your image here</p>
                  <p className="text-sm text-muted-foreground">or click to browse</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Supports: JPG, PNG, WebP
                </p>
              </div>
            )}
          </div>

          <Button
            onClick={processImage}
            disabled={!selectedFile || isProcessing}
            className="w-full rounded-xl shadow-lg transition-all duration-300 hover:shadow-glow"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing with ML...
              </>
            ) : (
              <>
                <ImageIcon className="mr-2 h-5 w-5" />
                Detect Road & Obstacles
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {detectionResult && (
        <div className="animate-slide-in">
          <DetectionResults result={detectionResult} />
        </div>
      )}
    </div>
  );
}
