import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGetDetectionHistory } from '@/hooks/useQueries';
import { Clock, Image as ImageIcon, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import type { DetectionResult } from '@/backend';

export default function HistorySection() {
  const { data: history, isLoading } = useGetDetectionHistory();
  const [selectedResult, setSelectedResult] = useState<DetectionResult | null>(null);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="aspect-video w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardContent className="flex min-h-[400px] flex-col items-center justify-center py-12">
          <ImageIcon className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No detection history</h3>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Upload an image or use live camera to start detecting roads
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <ScrollArea className="h-[700px] pr-4">
          <div className="grid gap-4 md:grid-cols-2">
            {history.map((result) => (
              <Card
                key={result.id}
                className="cursor-pointer transition-all hover:shadow-lg"
                onClick={() => setSelectedResult(result)}
              >
                <CardHeader>
                  <CardTitle className="text-base">{result.id}</CardTitle>
                  <CardDescription className="flex items-center gap-1 text-xs">
                    <Clock className="h-3 w-3" />
                    {new Date(Number(result.timestamp) / 1000000).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="aspect-video overflow-hidden rounded-lg">
                    <img
                      src={result.processedImage.getDirectURL()}
                      alt="Detection result"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {(result.confidenceScore * 100).toFixed(0)}%
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {Number(result.processingTime)}ms
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {selectedResult && (
        <Card>
          <CardHeader>
            <CardTitle>Detection Details</CardTitle>
            <CardDescription>{selectedResult.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Original Image</h4>
              <div className="overflow-hidden rounded-lg">
                <img
                  src={selectedResult.image.getDirectURL()}
                  alt="Original"
                  className="h-auto w-full object-contain"
                />
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Detected Road</h4>
              <div className="overflow-hidden rounded-lg">
                <img
                  src={selectedResult.processedImage.getDirectURL()}
                  alt="Processed"
                  className="h-auto w-full object-contain"
                />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Confidence</span>
                <span className="font-medium">
                  {(selectedResult.confidenceScore * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Quality</span>
                <span className="font-medium">
                  {(selectedResult.metrics.detectionQuality * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Road Type</span>
                <Badge variant="secondary">{selectedResult.environmentalConditions.roadType}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Surface Type</span>
                <Badge variant="secondary">{selectedResult.environmentalConditions.surfaceType}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Lighting</span>
                <Badge variant="secondary">
                  {selectedResult.environmentalConditions.lighting}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Weather</span>
                <Badge variant="secondary">
                  {selectedResult.environmentalConditions.weather}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
