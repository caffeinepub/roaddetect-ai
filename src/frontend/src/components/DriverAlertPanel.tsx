import { useEffect, useRef } from 'react';
import { AlertTriangle, AlertCircle, Info, Volume2, VolumeX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ObstacleInfo, EmergencyCondition } from '@/lib/obstacleDetection';

interface DriverAlertPanelProps {
  obstacles: ObstacleInfo[];
  emergencyConditions: EmergencyCondition[];
  detectedSpeedLimit?: number | null;
  currentSpeed?: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export default function DriverAlertPanel({
  obstacles,
  emergencyConditions,
  detectedSpeedLimit,
  currentSpeed = 0,
  soundEnabled,
  onToggleSound,
}: DriverAlertPanelProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastAlertTimeRef = useRef<number>(0);
  const lastSpeedAlertTimeRef = useRef<number>(0);

  const isOverSpeed = detectedSpeedLimit != null && currentSpeed > detectedSpeedLimit;
  const speedExcess = isOverSpeed && detectedSpeedLimit != null ? currentSpeed - detectedSpeedLimit : 0;

  // Play alert sound when high-risk obstacles, critical emergencies, or speeding detected
  useEffect(() => {
    if (!soundEnabled) return;

    const now = Date.now();
    const timeSinceLastAlert = now - lastAlertTimeRef.current;

    // Throttle alerts to once per 2 seconds
    if (timeSinceLastAlert < 2000) return;

    const hasHighRisk = obstacles.some(o => o.riskLevel.level === 'High');
    const hasCritical = emergencyConditions.some(e => e.severity.level === 'Critical');

    if (hasHighRisk || hasCritical) {
      playAlertSound(800, 0.5);
      lastAlertTimeRef.current = now;
    }
  }, [obstacles, emergencyConditions, soundEnabled]);

  // Play speed alert sound
  useEffect(() => {
    if (!soundEnabled || !isOverSpeed) return;

    const now = Date.now();
    const timeSinceLastSpeedAlert = now - lastSpeedAlertTimeRef.current;

    // Alert frequency based on speed excess
    const alertInterval = speedExcess > 20 ? 3000 : 5000;

    if (timeSinceLastSpeedAlert > alertInterval) {
      playAlertSound(600, 0.4);
      lastSpeedAlertTimeRef.current = now;
    }
  }, [isOverSpeed, speedExcess, soundEnabled]);

  const playAlertSound = (frequency: number, duration: number) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  };

  const highRiskObstacles = obstacles.filter(o => o.riskLevel.level === 'High');
  const moderateRiskObstacles = obstacles.filter(o => o.riskLevel.level === 'Moderate');
  const criticalEmergencies = emergencyConditions.filter(e => e.severity.level === 'Critical');
  const warningEmergencies = emergencyConditions.filter(e => e.severity.level === 'Warning');

  const hasAlerts = obstacles.length > 0 || emergencyConditions.length > 0 || isOverSpeed;

  return (
    <Card className={`card-enhanced ${hasAlerts ? 'animate-pulse-glow' : ''}`}>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Driver Alerts</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSound}
            className="h-8 w-8 p-0"
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </Button>
        </div>

        {!hasAlerts && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 rounded-full bg-green-500/10 p-4">
              <Info className="h-8 w-8 text-green-600 dark:text-green-500" />
            </div>
            <p className="text-sm font-medium text-green-700 dark:text-green-500">
              No alerts
            </p>
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">
              All systems normal
            </p>
          </div>
        )}

        {/* Speed Limit Violation Alert */}
        {isOverSpeed && detectedSpeedLimit != null && (
          <div className="animate-pulse-glow rounded-xl border-2 border-red-600 bg-red-600/10 p-4">
            <div className="flex items-start gap-3">
              <img 
                src="/assets/generated/speed-enforcement-icon-transparent.dim_64x64.png" 
                alt="Speed Warning" 
                className="h-6 w-6 flex-shrink-0"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-red-700 dark:text-red-500">SPEED LIMIT EXCEEDED</p>
                  <Badge className="bg-red-600 text-white hover:bg-red-700 text-xs">
                    CRITICAL
                  </Badge>
                </div>
                <p className="text-sm text-red-700 dark:text-red-400">
                  Current speed: {currentSpeed} km/h | Limit: {detectedSpeedLimit} km/h
                </p>
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  Reduce speed by {speedExcess} km/h immediately
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Critical Emergencies */}
        {criticalEmergencies.length > 0 && (
          <div className="space-y-2">
            {criticalEmergencies.map(emergency => (
              <div
                key={emergency.id}
                className="animate-pulse-glow rounded-xl border-2 border-red-600 bg-red-600/10 p-4"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 flex-shrink-0 text-red-700 dark:text-red-500" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-red-700 dark:text-red-500">{emergency.type}</p>
                      <Badge className="bg-red-600 text-white hover:bg-red-700 text-xs">
                        CRITICAL
                      </Badge>
                    </div>
                    <p className="text-sm text-red-700 dark:text-red-400">{emergency.description}</p>
                    <p className="text-xs font-medium text-red-600 dark:text-red-400">
                      {emergency.severity.urgency}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* High Risk Obstacles */}
        {highRiskObstacles.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-red-700 dark:text-red-500">
              High Risk Obstacles ({highRiskObstacles.length})
            </h4>
            {highRiskObstacles.map(obstacle => (
              <div
                key={obstacle.id}
                className="rounded-lg border border-red-600/50 bg-red-600/5 p-3"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-red-700 dark:text-red-500">
                      {obstacle.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {obstacle.riskLevel.description}
                    </p>
                  </div>
                  <Badge className="bg-red-600 text-white hover:bg-red-700 text-xs">
                    {(obstacle.confidenceLevel * 100).toFixed(0)}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Warning Emergencies */}
        {warningEmergencies.length > 0 && (
          <div className="space-y-2">
            {warningEmergencies.map(emergency => (
              <div
                key={emergency.id}
                className="rounded-lg border border-red-500/50 bg-red-500/10 p-3"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-500" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-red-700 dark:text-red-500">
                        {emergency.type}
                      </p>
                      <Badge
                        variant="outline"
                        className="border-red-600 text-red-700 dark:text-red-500 text-xs"
                      >
                        WARNING
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {emergency.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Moderate Risk Obstacles */}
        {moderateRiskObstacles.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-red-600 dark:text-red-500">
              Moderate Risk ({moderateRiskObstacles.length})
            </h4>
            <div className="space-y-1.5">
              {moderateRiskObstacles.slice(0, 3).map(obstacle => (
                <div
                  key={obstacle.id}
                  className="flex items-center justify-between rounded-lg bg-red-500/5 border border-red-500/30 p-2"
                >
                  <p className="text-xs font-medium text-red-700 dark:text-red-500">{obstacle.type}</p>
                  <Badge variant="outline" className="border-red-500 text-red-600 dark:text-red-500 text-xs">
                    {(obstacle.confidenceLevel * 100).toFixed(0)}%
                  </Badge>
                </div>
              ))}
              {moderateRiskObstacles.length > 3 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{moderateRiskObstacles.length - 3} more
                </p>
              )}
            </div>
          </div>
        )}

        {/* Summary */}
        {hasAlerts && (
          <div className="rounded-lg bg-muted/30 p-3 text-center">
            <p className="text-xs text-muted-foreground">
              {isOverSpeed && <span className="font-semibold text-red-700 dark:text-red-500">Speed violation • </span>}
              {obstacles.length > 0 && <span>Obstacles: <span className="font-semibold">{obstacles.length}</span></span>}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
