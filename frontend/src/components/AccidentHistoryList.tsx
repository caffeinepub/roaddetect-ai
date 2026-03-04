import { useState } from 'react';
import { MapPin, Calendar, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useGetAllAccidentRecords } from '@/hooks/useAccidentQueries';
import { DetectionMethod } from '@/backend';
import type { AccidentRecord } from '@/backend';
import type { AccidentAnalysisResult } from '@/lib/accidentAnalysis';

interface AccidentHistoryListProps {
  onSelectAccident: (accident: AccidentRecord) => void;
}

export default function AccidentHistoryList({ onSelectAccident }: AccidentHistoryListProps) {
  const { data: accidents = [], isLoading, error } = useGetAllAccidentRecords();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse p-4">
            <div className="mb-3 h-32 rounded-lg bg-muted" />
            <div className="mb-2 h-4 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border-2 border-destructive bg-destructive/10 p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">Failed to load accident records</p>
      </div>
    );
  }

  if (accidents.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-12 text-center">
        <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-50" />
        <h3 className="mb-2 text-lg font-semibold">No Accident Reports</h3>
        <p className="text-sm text-muted-foreground">
          No accidents have been reported yet. Use the Report Accident button to create a new report.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {accidents.map((accident) => {
        const date = new Date(Number(accident.timestamp) / 1000000);
        const isAI = accident.detectionMethod === DetectionMethod.aiAnalyzed;
        
        let analysisData: AccidentAnalysisResult | null = null;
        if (accident.analysisResults) {
          try {
            analysisData = JSON.parse(accident.analysisResults) as AccidentAnalysisResult;
          } catch (e) {
            console.error('Failed to parse analysis results:', e);
          }
        }

        return (
          <Card
            key={accident.id}
            className="group cursor-pointer overflow-hidden transition-all hover:shadow-lg"
            onClick={() => onSelectAccident(accident)}
          >
            <div className="relative aspect-video overflow-hidden bg-muted">
              {accident.images.length > 0 ? (
                <img
                  src={accident.images[0].getDirectURL()}
                  alt="Accident scene"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground opacity-30" />
                </div>
              )}
              <div className="absolute right-2 top-2">
                <Badge variant={isAI ? 'default' : 'secondary'} className="text-xs">
                  {isAI ? 'AI Analyzed' : 'Manual'}
                </Badge>
              </div>
              {accident.images.length > 1 && (
                <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white">
                  +{accident.images.length - 1} more
                </div>
              )}
            </div>

            <div className="p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-sm">
                  {accident.description || 'No description provided'}
                </p>
              </div>

              {analysisData && (
                <div className="mb-3 rounded-lg bg-emergency/10 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Confidence</span>
                    <span className="text-xs font-bold text-emergency">
                      {(analysisData.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {date.toLocaleDateString()} {date.toLocaleTimeString()}
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {accident.location.latitude.toFixed(4)}, {accident.location.longitude.toFixed(4)}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
