import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ImageUploadSection from '@/components/ImageUploadSection';
import VideoUploadSection from '@/components/VideoUploadSection';
import LiveCameraSection from '@/components/LiveCameraSection';
import HistorySection from '@/components/HistorySection';
import { Upload, Video, History, Camera } from 'lucide-react';

export default function RoadDetectionApp() {
  const [activeTab, setActiveTab] = useState('camera');

  // Auto-switch to camera tab on mount for live operational mode
  useEffect(() => {
    setActiveTab('camera');
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-primary/5">
      <Header />
      
      <main className="container mx-auto flex-1 px-4 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 animate-fade-in text-center">
            <h1 className="mb-4 bg-gradient-to-r from-primary via-chart-1 to-chart-2 bg-clip-text text-5xl font-bold tracking-tight text-transparent md:text-6xl">
              Road Detection System
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Live operational mode with continuous AI-powered road monitoring and instant driver alerts
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mx-auto grid h-12 w-full max-w-3xl grid-cols-4 rounded-2xl bg-card/50 p-1 shadow-lg backdrop-blur-sm">
              <TabsTrigger 
                value="camera"
                className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow-sm transition-all duration-300"
              >
                <Camera className="mr-2 h-4 w-4" />
                Live Camera
              </TabsTrigger>
              <TabsTrigger 
                value="upload" 
                className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow-sm transition-all duration-300"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Image
              </TabsTrigger>
              <TabsTrigger 
                value="video" 
                className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow-sm transition-all duration-300"
              >
                <Video className="mr-2 h-4 w-4" />
                Upload Video
              </TabsTrigger>
              <TabsTrigger 
                value="history"
                className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow-sm transition-all duration-300"
              >
                <History className="mr-2 h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="camera" className="mt-8 animate-slide-in">
              <LiveCameraSection isActive={activeTab === 'camera'} autoStart={true} />
            </TabsContent>

            <TabsContent value="upload" className="mt-8 animate-slide-in">
              <ImageUploadSection />
            </TabsContent>

            <TabsContent value="video" className="mt-8 animate-slide-in">
              <VideoUploadSection />
            </TabsContent>

            <TabsContent value="history" className="mt-8 animate-slide-in">
              <HistorySection />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
}
