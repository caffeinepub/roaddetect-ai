import { useState } from 'react';
import { AlertTriangle, Camera as CameraIcon, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useCamera } from '@/camera/useCamera';
import AccidentLocationMap from './AccidentLocationMap';
import AccidentImageUpload from './AccidentImageUpload';
import AccidentAnalysisResults from './AccidentAnalysisResults';
import { analyzeAccidentScene } from '@/lib/accidentAnalysis';
import { useAddAccidentRecord } from '@/hooks/useAccidentMutations';
import { ExternalBlob, DetectionMethod, Location } from '@/backend';
import type { AccidentAnalysisResult } from '@/lib/accidentAnalysis';
import { toast } from 'sonner';

export default function AccidentReportDialog() {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<Location | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [capturedPhoto, setCapturedPhoto] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AccidentAnalysisResult | null>(null);
  const [analyzedImageUrl, setAnalyzedImageUrl] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'camera'>('upload');

  const addAccidentMutation = useAddAccidentRecord();

  const {
    isActive,
    isSupported,
    error: cameraError,
    isLoading: cameraLoading,
    startCamera,
    stopCamera,
    capturePhoto,
    videoRef,
    canvasRef,
  } = useCamera({
    facingMode: 'environment',
    quality: 0.9,
  });

  const handleCameraCapture = async () => {
    const photo = await capturePhoto();
    if (photo) {
      setCapturedPhoto(photo);
      setSelectedFiles([photo]);
      await stopCamera();
      toast.success('Photo captured successfully');
    }
  };

  const handleAnalyze = async () => {
    const filesToAnalyze = capturedPhoto ? [capturedPhoto] : selectedFiles;
    
    if (filesToAnalyze.length === 0) {
      toast.error('Please select or capture at least one image');
      return;
    }

    setIsAnalyzing(true);

    try {
      const file = filesToAnalyze[0];
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          toast.error('Failed to process image');
          setIsAnalyzing(false);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        const result = await analyzeAccidentScene(imageData);
        setAnalysisResult(result);
        setAnalyzedImageUrl(url);
        setIsAnalyzing(false);
      };

      img.src = url;
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze image');
      setIsAnalyzing(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!location) {
      toast.error('Please mark the accident location on the map');
      return;
    }

    if (!description.trim()) {
      toast.error('Please provide a description');
      return;
    }

    try {
      const images: ExternalBlob[] = [];
      
      for (const file of selectedFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const blob = ExternalBlob.fromBytes(uint8Array);
        images.push(blob);
      }

      await addAccidentMutation.mutateAsync({
        id: `accident-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        method: DetectionMethod.manual,
        location,
        timestamp: BigInt(Date.now() * 1000000),
        images,
        description,
        analysisResults: null,
      });

      handleClose();
    } catch (error) {
      console.error('Submit error:', error);
    }
  };

  const handleAISubmit = async () => {
    if (!location) {
      toast.error('Please mark the accident location on the map');
      return;
    }

    if (!analysisResult) {
      toast.error('Please analyze the image first');
      return;
    }

    try {
      const images: ExternalBlob[] = [];
      const filesToUpload = capturedPhoto ? [capturedPhoto] : selectedFiles;
      
      for (const file of filesToUpload) {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const blob = ExternalBlob.fromBytes(uint8Array);
        images.push(blob);
      }

      await addAccidentMutation.mutateAsync({
        id: `accident-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        method: DetectionMethod.aiAnalyzed,
        location,
        timestamp: BigInt(Date.now() * 1000000),
        images,
        description: description || analysisResult.summary,
        analysisResults: JSON.stringify(analysisResult),
      });

      handleClose();
    } catch (error) {
      console.error('Submit error:', error);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setDescription('');
    setLocation(null);
    setSelectedFiles([]);
    setCapturedPhoto(null);
    setAnalysisResult(null);
    setAnalyzedImageUrl('');
    setActiveTab('upload');
    if (isActive) {
      stopCamera();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) {
        handleClose();
      } else {
        setOpen(true);
      }
    }}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="btn-icon-align h-10 w-10 rounded-xl transition-colors duration-200 hover:bg-emergency/10 motion-safe:hover:shadow-glow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Report Accident"
        >
          <AlertTriangle className="h-5 w-5 text-emergency" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-emergency" />
            Report Accident
          </DialogTitle>
          <DialogDescription>
            Report an accident with location, images, and AI analysis
          </DialogDescription>
        </DialogHeader>

        {analysisResult ? (
          <AccidentAnalysisResults
            result={analysisResult}
            imageUrl={analyzedImageUrl}
            onConfirm={handleAISubmit}
            onCancel={() => {
              setAnalysisResult(null);
              setAnalyzedImageUrl('');
            }}
            isSubmitting={addAccidentMutation.isPending}
          />
        ) : (
          <div className="space-y-6 py-4">
            <AccidentLocationMap
              onLocationSelect={setLocation}
              disabled={addAccidentMutation.isPending}
            />

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe what you witnessed..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={addAccidentMutation.isPending}
                rows={3}
              />
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'camera')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Images
                </TabsTrigger>
                <TabsTrigger value="camera">
                  <CameraIcon className="mr-2 h-4 w-4" />
                  Camera
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="mt-4">
                <AccidentImageUpload
                  onImagesSelect={setSelectedFiles}
                  disabled={addAccidentMutation.isPending}
                />
              </TabsContent>

              <TabsContent value="camera" className="mt-4 space-y-4">
                {isSupported === false ? (
                  <div className="rounded-lg border-2 border-destructive bg-destructive/10 p-4 text-center">
                    <p className="text-sm text-destructive">
                      Camera is not supported in your browser
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="h-full w-full object-cover"
                      />
                      <canvas ref={canvasRef} className="hidden" />
                    </div>

                    {cameraError && (
                      <div className="rounded-lg border border-destructive bg-destructive/10 p-3">
                        <p className="text-sm text-destructive">{cameraError.message}</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {!isActive ? (
                        <Button
                          onClick={startCamera}
                          disabled={cameraLoading}
                          className="flex-1"
                        >
                          {cameraLoading ? 'Starting...' : 'Start Camera'}
                        </Button>
                      ) : (
                        <>
                          <Button
                            onClick={handleCameraCapture}
                            disabled={!isActive}
                            className="flex-1"
                          >
                            <CameraIcon className="mr-2 h-4 w-4" />
                            Capture Photo
                          </Button>
                          <Button
                            onClick={stopCamera}
                            variant="outline"
                            disabled={cameraLoading}
                          >
                            Stop
                          </Button>
                        </>
                      )}
                    </div>

                    {capturedPhoto && (
                      <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                        Photo captured: {capturedPhoto.name}
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex gap-3">
              <Button
                onClick={handleManualSubmit}
                variant="outline"
                className="flex-1"
                disabled={!location || addAccidentMutation.isPending}
              >
                Submit Manual Report
              </Button>
              <Button
                onClick={handleAnalyze}
                className="flex-1 bg-emergency hover:bg-emergency/90"
                disabled={
                  (selectedFiles.length === 0 && !capturedPhoto) ||
                  !location ||
                  isAnalyzing ||
                  addAccidentMutation.isPending
                }
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze with AI'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
