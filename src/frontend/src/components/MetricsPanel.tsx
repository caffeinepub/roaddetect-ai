import { Activity, Gauge, Clock, Eye, Cloud, Sun, Droplets, Wind, Zap, Cpu, Monitor } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MetricsPanelProps {
  metrics: {
    confidenceScore: number;
    processingTime: number;
    frameRate?: number;
    detectionQuality: number;
    environmentalConditions: {
      lighting: string;
      weather: string;
    };
    roadType: string;
    objectDetection: string;
    mlAdaptations?: string[];
    performanceStatus?: string;
    hardwareAcceleration?: string;
    cpuUtilization?: string;
    processingMode?: string;
    realTimeFPS?: number;
  };
  isLive?: boolean;
}

export default function MetricsPanel({ metrics, isLive = false }: MetricsPanelProps) {
  const getWeatherIcon = (weather: string) => {
    if (weather.includes('Fog')) return <Cloud className="h-4 w-4" />;
    if (weather.includes('Rain')) return <Droplets className="h-4 w-4" />;
    if (weather === 'Clear') return <Sun className="h-4 w-4" />;
    return <Wind className="h-4 w-4" />;
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.85) return 'text-chart-1';
    if (score >= 0.7) return 'text-chart-2';
    return 'text-chart-3';
  };

  const getQualityColor = (quality: number) => {
    if (quality >= 0.85) return 'text-chart-1';
    if (quality >= 0.7) return 'text-chart-2';
    return 'text-chart-3';
  };

  // Normalize object detection string to show explicit "No objects detected" message
  const normalizeObjectDetection = (detection: string): string => {
    const lowerDetection = detection.toLowerCase().trim();
    if (
      lowerDetection === '' ||
      lowerDetection === 'none' ||
      lowerDetection === 'clear' ||
      lowerDetection === 'clear road' ||
      lowerDetection === 'no objects'
    ) {
      return 'No objects detected';
    }
    return detection;
  };

  return (
    <Card className="card-enhanced">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-primary" />
          Detection Metrics
          {isLive && (
            <Badge variant="default" className="ml-auto animate-pulse-glow">
              Live
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hardware Performance Status */}
        {(metrics.hardwareAcceleration || metrics.cpuUtilization || metrics.processingMode) && (
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Monitor className="h-4 w-4" />
              Hardware Performance
            </h4>
            <div className="space-y-2">
              {metrics.hardwareAcceleration && (
                <div className="rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 p-3 shadow-inner">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Hardware Acceleration</p>
                      <p className="text-sm font-medium text-primary">{metrics.hardwareAcceleration}</p>
                    </div>
                  </div>
                </div>
              )}
              {metrics.cpuUtilization && (
                <div className="rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 p-3 shadow-inner">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">CPU Utilization</p>
                      <p className="text-sm font-medium text-primary">{metrics.cpuUtilization}</p>
                    </div>
                  </div>
                </div>
              )}
              {metrics.processingMode && (
                <div className="rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 p-3 shadow-inner">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Processing Mode</p>
                      <p className="text-sm font-medium text-primary">{metrics.processingMode}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Performance Status */}
        {metrics.performanceStatus && (
          <div className="rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 p-4 shadow-inner">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                {metrics.performanceStatus}
              </span>
            </div>
          </div>
        )}

        {/* Core Metrics */}
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-gradient-to-br from-background to-muted/30 p-3 shadow-sm transition-all duration-300 hover:shadow-md">
            <div className="flex items-center gap-2">
              <Gauge className={`h-4 w-4 ${getConfidenceColor(metrics.confidenceScore)}`} />
              <span className="text-sm font-medium">Confidence</span>
            </div>
            <span className={`text-lg font-bold ${getConfidenceColor(metrics.confidenceScore)}`}>
              {(metrics.confidenceScore * 100).toFixed(1)}%
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-gradient-to-br from-background to-muted/30 p-3 shadow-sm transition-all duration-300 hover:shadow-md">
            <div className="flex items-center gap-2">
              <Eye className={`h-4 w-4 ${getQualityColor(metrics.detectionQuality)}`} />
              <span className="text-sm font-medium">Quality</span>
            </div>
            <span className={`text-lg font-bold ${getQualityColor(metrics.detectionQuality)}`}>
              {(metrics.detectionQuality * 100).toFixed(1)}%
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-gradient-to-br from-background to-muted/30 p-3 shadow-sm transition-all duration-300 hover:shadow-md">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Processing Time</span>
            </div>
            <span className="text-lg font-bold">{metrics.processingTime}ms</span>
          </div>

          {isLive && metrics.realTimeFPS !== undefined && metrics.realTimeFPS > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-gradient-to-br from-background to-muted/30 p-3 shadow-sm transition-all duration-300 hover:shadow-md">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Real-time FPS</span>
              </div>
              <span className="text-lg font-bold text-primary">{metrics.realTimeFPS.toFixed(1)}</span>
            </div>
          )}

          {isLive && metrics.frameRate !== undefined && (
            <div className="flex items-center justify-between rounded-xl bg-gradient-to-br from-background to-muted/30 p-3 shadow-sm transition-all duration-300 hover:shadow-md">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Processing Rate</span>
              </div>
              <span className="text-lg font-bold">{metrics.frameRate.toFixed(1)} FPS</span>
            </div>
          )}
        </div>

        {/* Environmental Conditions */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground">Environmental Conditions</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-primary/5 to-accent/5 p-2.5 shadow-sm">
              <Sun className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Lighting</p>
                <p className="text-sm font-medium">{metrics.environmentalConditions.lighting}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-primary/5 to-accent/5 p-2.5 shadow-sm">
              {getWeatherIcon(metrics.environmentalConditions.weather)}
              <div>
                <p className="text-xs text-muted-foreground">Weather</p>
                <p className="text-sm font-medium">{metrics.environmentalConditions.weather}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Road Information - Enhanced with clearer hierarchy */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground">Road Information</h4>
          <div className="space-y-2">
            <div className="rounded-lg bg-gradient-to-br from-background to-muted/30 p-3 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground mb-1">Road Type</p>
              <p className="text-base font-semibold text-foreground">{metrics.roadType}</p>
            </div>
            <div className="rounded-lg bg-gradient-to-br from-background to-muted/30 p-3 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground mb-1">Objects Detected</p>
              <p className="text-base font-semibold text-foreground">{normalizeObjectDetection(metrics.objectDetection)}</p>
            </div>
          </div>
        </div>

        {/* ML Adaptations */}
        {metrics.mlAdaptations && metrics.mlAdaptations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">ML Adaptations Applied</h4>
            <div className="space-y-1.5">
              {metrics.mlAdaptations.map((adaptation, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 p-2 shadow-sm"
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="text-xs font-medium text-primary">{adaptation}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
