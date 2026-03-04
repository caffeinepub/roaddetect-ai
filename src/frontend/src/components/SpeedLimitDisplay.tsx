import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gauge, TrendingUp } from "lucide-react";

interface SpeedLimitDisplayProps {
  detectedSpeedLimit: number | null;
  speedLimitConfidence: number;
  currentSpeed: number;
  onSpeedChange: (speed: number) => void;
}

export default function SpeedLimitDisplay({
  detectedSpeedLimit,
  speedLimitConfidence,
  currentSpeed,
  onSpeedChange,
}: SpeedLimitDisplayProps) {
  const isOverSpeed =
    detectedSpeedLimit !== null && currentSpeed > detectedSpeedLimit;
  const isApproachingLimit =
    detectedSpeedLimit !== null &&
    currentSpeed > detectedSpeedLimit * 0.9 &&
    currentSpeed <= detectedSpeedLimit;

  const getSpeedColor = () => {
    if (isOverSpeed) return "text-destructive";
    if (isApproachingLimit) return "text-chart-3";
    return "text-chart-1";
  };

  const getSpeedBgColor = () => {
    if (isOverSpeed) return "bg-destructive/10 border-destructive/50";
    if (isApproachingLimit) return "bg-chart-3/10 border-chart-3/50";
    return "bg-chart-1/10 border-chart-1/50";
  };

  return (
    <Card className="card-enhanced">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <img
            src="/assets/generated/speed-limit-icon-transparent.dim_200x200.png"
            alt="Speed Limit"
            className="h-5 w-5"
          />
          Speed Limit Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Detected Speed Limit */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            Detected Speed Limit
          </Label>
          {detectedSpeedLimit !== null ? (
            <div className="rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 p-4 text-center shadow-inner">
              <div className="flex items-center justify-center gap-2">
                <span className="text-4xl font-bold text-primary">
                  {detectedSpeedLimit}
                </span>
                <span className="text-lg font-medium text-muted-foreground">
                  km/h
                </span>
              </div>
              <Badge
                variant="outline"
                className="mt-2 border-primary/50 text-primary"
              >
                {(speedLimitConfidence * 100).toFixed(0)}% confidence
              </Badge>
            </div>
          ) : (
            <div className="rounded-xl bg-muted/30 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                No speed limit detected
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Scanning for speed limit signs...
              </p>
            </div>
          )}
        </div>

        {/* Current Speed Input */}
        <div className="space-y-2">
          <Label
            htmlFor="current-speed"
            className="text-sm text-muted-foreground"
          >
            Current Vehicle Speed
          </Label>
          <div className="relative">
            <Input
              id="current-speed"
              type="number"
              min="0"
              max="200"
              value={currentSpeed}
              onChange={(e) =>
                onSpeedChange(Math.max(0, Number.parseInt(e.target.value) || 0))
              }
              className="pr-16 text-lg font-semibold"
              placeholder="0"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
              km/h
            </span>
          </div>
        </div>

        {/* Speed Status */}
        {detectedSpeedLimit !== null && currentSpeed > 0 && (
          <div className={`rounded-xl border-2 p-4 ${getSpeedBgColor()}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOverSpeed ? (
                  <img
                    src="/assets/generated/speed-enforcement-icon-transparent.dim_64x64.png"
                    alt="Speed Warning"
                    className="h-6 w-6"
                  />
                ) : (
                  <Gauge className={`h-6 w-6 ${getSpeedColor()}`} />
                )}
                <div>
                  <p className={`text-sm font-semibold ${getSpeedColor()}`}>
                    {isOverSpeed
                      ? "SPEED LIMIT EXCEEDED"
                      : isApproachingLimit
                        ? "Approaching Limit"
                        : "Within Speed Limit"}
                  </p>
                  {isOverSpeed && (
                    <p className="text-xs text-destructive">
                      {currentSpeed - detectedSpeedLimit} km/h over limit
                    </p>
                  )}
                </div>
              </div>
              {isOverSpeed && (
                <Badge variant="destructive" className="animate-pulse-glow">
                  WARNING
                </Badge>
              )}
              {isApproachingLimit && (
                <Badge
                  variant="outline"
                  className="border-chart-3 text-chart-3"
                >
                  CAUTION
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Speed Comparison */}
        {detectedSpeedLimit !== null && (
          <div className="rounded-lg bg-muted/30 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Speed Limit:</span>
              <span className="font-semibold">{detectedSpeedLimit} km/h</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your Speed:</span>
              <span className={`font-semibold ${getSpeedColor()}`}>
                {currentSpeed} km/h
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-all duration-300 ${
                  isOverSpeed
                    ? "bg-destructive"
                    : isApproachingLimit
                      ? "bg-chart-3"
                      : "bg-chart-1"
                }`}
                style={{
                  width: `${Math.min(100, (currentSpeed / (detectedSpeedLimit * 1.2)) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
