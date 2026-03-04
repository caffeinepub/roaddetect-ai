import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EmergencyCondition, ObstacleInfo } from "@/types/detection";
import type { PotholeDetection } from "@/types/detection";
import {
  AlertCircle,
  AlertTriangle,
  Construction,
  ShieldAlert,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface DriverAlertPanelProps {
  obstacles: ObstacleInfo[];
  emergencyConditions: EmergencyCondition[];
  potholes?: PotholeDetection[];
  detectedSpeedLimit?: number | null;
  currentSpeed?: number;
  soundEnabled?: boolean;
}

export default function DriverAlertPanel({
  obstacles,
  emergencyConditions,
  potholes = [],
  detectedSpeedLimit,
  currentSpeed = 0,
  soundEnabled = true,
}: DriverAlertPanelProps) {
  const [activeAlerts, setActiveAlerts] = useState<string[]>([]);
  const lastAlertTimeRef = useRef<{ [key: string]: number }>({});
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize audio context
  useEffect(() => {
    if (soundEnabled && !audioContextRef.current) {
      audioContextRef.current = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
    }
  }, [soundEnabled]);

  // Play alert sound
  const playAlertSound = useCallback(
    (frequency: number, duration: number) => {
      if (!soundEnabled || !audioContextRef.current) return;

      try {
        const ctx = audioContextRef.current;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = "sine";

        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.01,
          ctx.currentTime + duration,
        );

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration);
      } catch (error) {
        console.error("Audio playback error:", error);
      }
    },
    [soundEnabled],
  );

  // Check for pothole alerts (within 50 meters)
  useEffect(() => {
    const now = Date.now();
    const alertThrottle = 3000; // 3 seconds between same type alerts

    const nearbyPotholes = potholes.filter((p) => p.distance <= 50);

    if (nearbyPotholes.length > 0) {
      const alertKey = "pothole";
      const lastAlertTime = lastAlertTimeRef.current[alertKey] || 0;

      if (now - lastAlertTime > alertThrottle) {
        const closestPothole = nearbyPotholes.reduce((closest, current) =>
          current.distance < closest.distance ? current : closest,
        );

        const alertMessage = `Potholes on road - ${closestPothole.distance.toFixed(0)}m ahead`;

        setActiveAlerts((prev) => {
          const filtered = prev.filter(
            (a) => !a.startsWith("Potholes on road"),
          );
          return [alertMessage, ...filtered].slice(0, 5);
        });

        // Play alert sound based on severity
        let frequency = 600;
        if (closestPothole.severity === "High") frequency = 800;
        else if (closestPothole.severity === "Moderate") frequency = 700;

        playAlertSound(frequency, 0.3);
        lastAlertTimeRef.current[alertKey] = now;
      }
    }
  }, [potholes, playAlertSound]);

  // Check for obstacle alerts
  useEffect(() => {
    const now = Date.now();
    const alertThrottle = 3000;

    for (const obstacle of obstacles) {
      if (obstacle.riskLevel.level === "High") {
        const alertKey = `obstacle_${obstacle.type}`;
        const lastAlertTime = lastAlertTimeRef.current[alertKey] || 0;

        if (now - lastAlertTime > alertThrottle) {
          const motionLabel = obstacle.motion ? ` • ${obstacle.motion}` : "";
          const alertMessage = `${obstacle.type}${motionLabel} detected - ${obstacle.riskLevel.description}`;

          setActiveAlerts((prev) => {
            const filtered = prev.filter((a) => !a.includes(obstacle.type));
            return [alertMessage, ...filtered].slice(0, 5);
          });

          playAlertSound(900, 0.2);
          lastAlertTimeRef.current[alertKey] = now;
        }
      }
    }
  }, [obstacles, playAlertSound]);

  // Check for emergency alerts
  useEffect(() => {
    const now = Date.now();
    const alertThrottle = 5000;

    for (const emergency of emergencyConditions) {
      if (emergency.severity.level === "Critical") {
        const alertKey = `emergency_${emergency.type}`;
        const lastAlertTime = lastAlertTimeRef.current[alertKey] || 0;

        if (now - lastAlertTime > alertThrottle) {
          const alertMessage = `EMERGENCY: ${emergency.description}`;

          setActiveAlerts((prev) => {
            const filtered = prev.filter((a) => !a.includes(emergency.type));
            return [alertMessage, ...filtered].slice(0, 5);
          });

          playAlertSound(1000, 0.5);
          lastAlertTimeRef.current[alertKey] = now;
        }
      }
    }
  }, [emergencyConditions, playAlertSound]);

  // Check for speed limit violations
  useEffect(() => {
    if (detectedSpeedLimit && currentSpeed > detectedSpeedLimit) {
      const now = Date.now();
      const alertKey = "speed_violation";
      const lastAlertTime = lastAlertTimeRef.current[alertKey] || 0;
      const alertThrottle = 5000;

      if (now - lastAlertTime > alertThrottle) {
        const overspeed = currentSpeed - detectedSpeedLimit;
        const alertMessage = `Speed limit exceeded by ${overspeed} km/h`;

        setActiveAlerts((prev) => {
          const filtered = prev.filter((a) => !a.includes("Speed limit"));
          return [alertMessage, ...filtered].slice(0, 5);
        });

        playAlertSound(750, 0.3);
        lastAlertTimeRef.current[alertKey] = now;
      }
    }
  }, [detectedSpeedLimit, currentSpeed, playAlertSound]);

  const highRiskObstacles = obstacles.filter(
    (o) => o.riskLevel.level === "High",
  );
  const criticalEmergencies = emergencyConditions.filter(
    (e) => e.severity.level === "Critical",
  );
  const nearbyPotholes = potholes.filter((p) => p.distance <= 50);
  const speedViolation =
    detectedSpeedLimit && currentSpeed > detectedSpeedLimit;

  const hasAlerts =
    highRiskObstacles.length > 0 ||
    criticalEmergencies.length > 0 ||
    nearbyPotholes.length > 0 ||
    speedViolation;

  return (
    <Card className="border-2 border-warning/30 bg-gradient-to-br from-background to-warning/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldAlert className="h-5 w-5 text-warning" />
          Driver Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasAlerts && activeAlerts.length === 0 && (
          <Alert className="border-success/30 bg-success/5">
            <AlertCircle className="h-4 w-4 text-success" />
            <AlertDescription className="text-success">
              All clear - No immediate hazards detected
            </AlertDescription>
          </Alert>
        )}

        {nearbyPotholes.length > 0 && (
          <Alert className="border-warning/50 bg-warning/10 animate-pulse">
            <Construction className="h-4 w-4 text-warning" />
            <AlertDescription className="font-semibold text-warning">
              Potholes on road
              <div className="mt-1 text-sm font-normal">
                {nearbyPotholes.length} pothole
                {nearbyPotholes.length > 1 ? "s" : ""} detected within 50m
                {nearbyPotholes.length > 0 && (
                  <span className="ml-2">
                    • Closest:{" "}
                    {Math.min(...nearbyPotholes.map((p) => p.distance)).toFixed(
                      0,
                    )}
                    m ahead
                  </span>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {highRiskObstacles.length > 0 && (
          <Alert className="border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="font-semibold text-destructive">
              High Risk Obstacles Detected
              <div className="mt-2 space-y-1">
                {highRiskObstacles.slice(0, 3).map((obstacle) => (
                  <div
                    key={obstacle.id}
                    className="flex items-center gap-2 text-sm font-normal"
                  >
                    <Badge variant="destructive" className="text-xs">
                      {obstacle.type}
                      {obstacle.motion && ` • ${obstacle.motion}`}
                    </Badge>
                    <span className="text-muted-foreground">
                      {obstacle.riskLevel.description}
                    </span>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {criticalEmergencies.length > 0 && (
          <Alert className="border-destructive bg-destructive/20 animate-pulse">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="font-bold text-destructive">
              EMERGENCY CONDITIONS
              <div className="mt-2 space-y-1">
                {criticalEmergencies.map((emergency) => (
                  <div key={emergency.id} className="text-sm font-normal">
                    {emergency.description}
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {speedViolation && (
          <Alert className="border-warning/50 bg-warning/10">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertDescription className="font-semibold text-warning">
              Speed Limit Violation
              <div className="mt-1 text-sm font-normal">
                Current: {currentSpeed} km/h • Limit: {detectedSpeedLimit} km/h
              </div>
            </AlertDescription>
          </Alert>
        )}

        {activeAlerts.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Recent Alerts
            </div>
            {activeAlerts.map((alert) => (
              <div
                key={alert}
                className="text-sm text-foreground/80 py-1 px-2 rounded bg-muted/30"
              >
                {alert}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
