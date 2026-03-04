import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ImageUploadSection from '@/components/ImageUploadSection';
import LiveCameraSection from '@/components/LiveCameraSection';
import AccidentHistoryPage from '@/pages/AccidentHistoryPage';
import SystemOverviewPanel from '@/components/SystemOverviewPanel';
import { Upload, AlertTriangle, Camera } from 'lucide-react';

export default function RoadDetectionApp() {
  const [activeTab, setActiveTab] = useState('camera');

  useEffect(() => {
    setActiveTab('camera');
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-primary/5">
      <Header />
      
      <main className="container mx-auto flex-1 px-4 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 motion-safe:animate-fade-in text-center">
            <h1 className="mb-4 bg-gradient-to-r from-primary via-chart-1 to-chart-2 bg-clip-text text-page-title text-transparent">
              Road Safety Alert System
            </h1>
            <p className="mx-auto max-w-2xl text-description">
              AI-powered accident detection with live monitoring and instant reporting
            </p>
          </div>

          <SystemOverviewPanel />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mx-auto grid h-12 w-full max-w-3xl grid-cols-3 rounded-2xl surface-primary p-1 shadow-lg">
              <TabsTrigger 
                value="camera"
                className="rounded-xl transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground motion-safe:data-[state=active]:shadow-glow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Camera className="mr-2 h-4 w-4" />
                Live Camera
              </TabsTrigger>
              <TabsTrigger 
                value="upload" 
                className="rounded-xl transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground motion-safe:data-[state=active]:shadow-glow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Image
              </TabsTrigger>
              <TabsTrigger 
                value="accidents"
                className="rounded-xl transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground motion-safe:data-[state=active]:shadow-glow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Accident Reports
              </TabsTrigger>
            </TabsList>

            <TabsContent value="camera" className="mt-8 motion-safe:animate-slide-in">
              <LiveCameraSection isActive={activeTab === 'camera'} autoStart={true} />
            </TabsContent>

            <TabsContent value="upload" className="mt-8 motion-safe:animate-slide-in">
              <ImageUploadSection />
            </TabsContent>

            <TabsContent value="accidents" className="mt-8 motion-safe:animate-slide-in">
              <AccidentHistoryPage />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
}
