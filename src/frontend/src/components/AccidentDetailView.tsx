import type { AccidentRecord } from "@/backend";
import { DetectionMethod } from "@/backend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AccidentAnalysisResult } from "@/lib/accidentAnalysis";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Image as ImageIcon,
  MapPin,
} from "lucide-react";
import AccidentLocationMap from "./AccidentLocationMap";

interface AccidentDetailViewProps {
  accident: AccidentRecord;
  onBack: () => void;
}

export default function AccidentDetailView({
  accident,
  onBack,
}: AccidentDetailViewProps) {
  const date = new Date(Number(accident.timestamp) / 1000000);
  const isAI = accident.detectionMethod === DetectionMethod.aiAnalyzed;

  let analysisData: AccidentAnalysisResult | null = null;
  if (accident.analysisResults) {
    try {
      analysisData = JSON.parse(
        accident.analysisResults,
      ) as AccidentAnalysisResult;
    } catch (e) {
      console.error("Failed to parse analysis results:", e);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={onBack} variant="outline" size="icon">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">Accident Report Details</h2>
          <p className="text-sm text-muted-foreground">
            Reported on {date.toLocaleDateString()} at{" "}
            {date.toLocaleTimeString()}
          </p>
        </div>
        <Badge variant={isAI ? "default" : "secondary"}>
          {isAI ? "AI Analyzed" : "Manual Report"}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <ImageIcon className="h-5 w-5" />
            Images ({accident.images.length})
          </h3>
          <div className="space-y-4">
            {accident.images.map((image, index) => (
              <div
                key={image.getDirectURL()}
                className="overflow-hidden rounded-lg border"
              >
                <img
                  src={image.getDirectURL()}
                  alt={`Accident scene ${index + 1}`}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <AlertTriangle className="h-5 w-5" />
              Description
            </h3>
            <p className="text-sm">
              {accident.description || "No description provided"}
            </p>
          </Card>

          {analysisData && (
            <Card className="p-6">
              <h3 className="mb-4 text-lg font-semibold">
                AI Analysis Results
              </h3>

              <div className="mb-4 rounded-lg bg-emergency/10 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Confidence Score</span>
                  <span className="text-2xl font-bold text-emergency">
                    {(analysisData.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-emergency"
                    style={{ width: `${analysisData.confidence * 100}%` }}
                  />
                </div>
              </div>

              {analysisData.indicators &&
                analysisData.indicators.length > 0 && (
                  <div className="mb-4">
                    <h4 className="mb-2 text-sm font-medium">
                      Detected Indicators
                    </h4>
                    <div className="space-y-2">
                      {analysisData.indicators.map((indicator) => (
                        <div
                          key={`${indicator.type}-${indicator.confidence}`}
                          className="rounded-lg bg-muted/50 p-3"
                        >
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {indicator.type}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {(indicator.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {indicator.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <div className="rounded-lg bg-muted/30 p-3">
                <p className="text-sm">{analysisData.summary}</p>
              </div>
            </Card>
          )}

          <Card className="p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <MapPin className="h-5 w-5" />
              Location
            </h3>
            <AccidentLocationMap
              onLocationSelect={() => {}}
              initialLocation={accident.location}
              disabled={true}
            />
          </Card>

          <Card className="p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Calendar className="h-5 w-5" />
              Metadata
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Report ID:</span>
                <span className="font-mono text-xs">{accident.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Detection Method:</span>
                <span>{isAI ? "AI Analysis" : "Manual Report"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Location Accuracy:
                </span>
                <span>{accident.location.accuracy}m</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
