import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type {
  DetectionMetrics,
  EnvironmentalConditions,
  RoadSurfaceFeatures,
} from "@/types/detection";
import {
  Activity,
  Cloud,
  Construction,
  Droplets,
  Eye,
  Gauge,
  Moon,
  Sun,
  Wind,
  Zap,
} from "lucide-react";

interface MetricsPanelProps {
  confidenceScore: number;
  processingTime: number;
  metrics: DetectionMetrics;
  environmentalConditions: EnvironmentalConditions;
  roadType: string;
  roadSurfaceFeatures?: RoadSurfaceFeatures;
}

export default function MetricsPanel({
  confidenceScore,
  processingTime,
  metrics,
  environmentalConditions,
  roadType,
  roadSurfaceFeatures,
}: MetricsPanelProps) {
  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return "text-success";
    if (score >= 0.6) return "text-warning";
    return "text-destructive";
  };

  const getPerformanceColor = (time: number) => {
    if (time < 100) return "text-success";
    if (time < 200) return "text-warning";
    return "text-destructive";
  };

  const getLightingIcon = (lighting: string) => {
    if (lighting === "Night" || lighting === "Dusk")
      return <Moon className="h-4 w-4" />;
    if (lighting === "Bright") return <Sun className="h-4 w-4" />;
    return <Sun className="h-4 w-4" />;
  };

  const getWeatherIcon = (weather: string) => {
    if (weather.includes("Fog")) return <Cloud className="h-4 w-4" />;
    if (weather.includes("Rain")) return <Droplets className="h-4 w-4" />;
    if (weather === "Clear") return <Sun className="h-4 w-4" />;
    return <Wind className="h-4 w-4" />;
  };

  const potholeCount = metrics.potholeCount || 0;
  const closestPotholeDistance = metrics.closestPotholeDistance;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-primary" />
          Detection Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Core Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Confidence</div>
            <div
              className={`text-2xl font-bold ${getConfidenceColor(confidenceScore)}`}
            >
              {(confidenceScore * 100).toFixed(0)}%
            </div>
            <Progress value={confidenceScore * 100} className="h-1.5" />
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Processing</div>
            <div
              className={`text-2xl font-bold ${getPerformanceColor(processingTime)}`}
            >
              {processingTime}ms
            </div>
            <div className="text-xs text-muted-foreground">
              {metrics.realTimeFPS
                ? `${metrics.realTimeFPS.toFixed(1)} FPS`
                : `${metrics.frameRate.toFixed(1)} FPS`}
            </div>
          </div>
        </div>

        {/* Pothole Detection Metrics */}
        {potholeCount > 0 && (
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
            <div className="flex items-center gap-2 mb-2">
              <Construction className="h-4 w-4 text-warning" />
              <span className="text-sm font-semibold text-warning">
                Pothole Detection
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Count</div>
                <div className="font-bold text-warning">{potholeCount}</div>
              </div>
              {closestPotholeDistance !== undefined &&
                closestPotholeDistance <= 50 && (
                  <div>
                    <div className="text-xs text-muted-foreground">Closest</div>
                    <div className="font-bold text-warning">
                      {closestPotholeDistance.toFixed(0)}m
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Hardware Performance */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Hardware Performance</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant="outline" className="text-xs">
                {metrics.performanceStatus || "Processing"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Acceleration:</span>
              <span className="font-medium">
                {metrics.hardwareAcceleration || "Standard"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CPU:</span>
              <span className="font-medium">
                {metrics.cpuUtilization || "Moderate"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mode:</span>
              <span className="font-medium">
                {metrics.processingMode || "Balanced"}
              </span>
            </div>
          </div>
        </div>

        {/* Environmental Conditions */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Environment</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 text-xs">
              {getLightingIcon(environmentalConditions.lighting)}
              <div>
                <div className="text-muted-foreground">Lighting</div>
                <div className="font-medium">
                  {environmentalConditions.lighting}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {getWeatherIcon(environmentalConditions.weather)}
              <div>
                <div className="text-muted-foreground">Weather</div>
                <div className="font-medium">
                  {environmentalConditions.weather}
                </div>
              </div>
            </div>
          </div>

          {environmentalConditions.visibility !== undefined && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  Visibility
                </span>
                <span className="font-medium">
                  {(environmentalConditions.visibility * 100).toFixed(0)}%
                </span>
              </div>
              <Progress
                value={environmentalConditions.visibility * 100}
                className="h-1"
              />
            </div>
          )}
        </div>

        {/* Road Surface Analysis */}
        {roadSurfaceFeatures && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="text-sm font-medium">Road Surface Analysis</div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Coverage:</span>
                <span className="font-medium">
                  {(roadSurfaceFeatures.segmentation.coverage * 100).toFixed(0)}
                  %
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Drivable Area:</span>
                <span className="font-medium">
                  {(roadSurfaceFeatures.drivableArea.coverage * 100).toFixed(0)}
                  %
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Edge Strength:</span>
                <span className="font-medium">
                  {roadSurfaceFeatures.roadEdges.edgeStrength.toFixed(2)}
                </span>
              </div>
              {roadSurfaceFeatures.damage.potholeScore > 0.3 && (
                <div className="flex justify-between text-warning">
                  <span>Damage Detected:</span>
                  <span className="font-medium">
                    {(roadSurfaceFeatures.damage.potholeScore * 100).toFixed(0)}
                    %
                  </span>
                </div>
              )}
              {roadSurfaceFeatures.wetSurface.wetnessScore > 0.4 && (
                <div className="flex justify-between text-info">
                  <span>Wet Surface:</span>
                  <span className="font-medium">
                    {(
                      roadSurfaceFeatures.wetSurface.wetnessScore * 100
                    ).toFixed(0)}
                    %
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Detection Quality */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          <div className="text-sm font-medium">Detection Quality</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quality Score:</span>
              <span className="font-medium">
                {(metrics.detectionQuality * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Road Type:</span>
              <Badge variant="secondary" className="text-xs">
                {roadType}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Objects:</span>
              <span className="font-medium">{metrics.objectDetection}</span>
            </div>
          </div>
        </div>

        {/* ML Adaptations */}
        {metrics.mlAdaptations && metrics.mlAdaptations.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="text-sm font-medium">Active Adaptations</div>
            <div className="flex flex-wrap gap-1">
              {metrics.mlAdaptations.map((adaptation) => (
                <Badge key={adaptation} variant="outline" className="text-xs">
                  {adaptation}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
