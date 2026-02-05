import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MetricsPanel from './MetricsPanel';
import DriverAlertPanel from './DriverAlertPanel';

interface DetectionResultsProps {
  result: {
    originalImageUrl: string;
    processedImageUrl: string;
    confidenceScore: number;
    processingTime: number;
    environmentalConditions: {
      lighting: string;
      weather: string;
    };
    roadType: string;
    metrics: {
      frameRate: number;
      detectionQuality: number;
      objectDetection: string;
    };
    obstacleDetection?: {
      obstacles: any[];
      emergencyConditions: any[];
      visualizationUrl: string;
    };
  };
}

export default function DetectionResults({ result }: DetectionResultsProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Detection Results</CardTitle>
          <CardDescription>
            Segmented road regions with obstacle detection and environmental analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="obstacles" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="original">Original</TabsTrigger>
              <TabsTrigger value="road">Road</TabsTrigger>
              <TabsTrigger value="obstacles">Obstacles</TabsTrigger>
            </TabsList>
            <TabsContent value="original" className="mt-4">
              <div className="overflow-hidden rounded-lg">
                <img
                  src={result.originalImageUrl}
                  alt="Original"
                  className="h-auto w-full object-contain"
                />
              </div>
            </TabsContent>
            <TabsContent value="road" className="mt-4">
              <div className="overflow-hidden rounded-lg">
                <img
                  src={result.processedImageUrl}
                  alt="Road Detection"
                  className="h-auto w-full object-contain"
                />
              </div>
            </TabsContent>
            <TabsContent value="obstacles" className="mt-4">
              <div className="overflow-hidden rounded-lg">
                <img
                  src={result.obstacleDetection?.visualizationUrl || result.processedImageUrl}
                  alt="Obstacle Detection"
                  className="h-auto w-full object-contain"
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {result.obstacleDetection && (
        <DriverAlertPanel
          obstacles={result.obstacleDetection.obstacles}
          emergencyConditions={result.obstacleDetection.emergencyConditions}
          soundEnabled={false}
          onToggleSound={() => {}}
        />
      )}

      <MetricsPanel
        metrics={{
          confidenceScore: result.confidenceScore,
          processingTime: result.processingTime,
          frameRate: result.metrics.frameRate,
          detectionQuality: result.metrics.detectionQuality,
          environmentalConditions: result.environmentalConditions,
          roadType: result.roadType,
          objectDetection: result.metrics.objectDetection,
        }}
      />
    </div>
  );
}
