import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetAllObstacleEvents } from "@/hooks/useQueries";
import { isMotionType, isObjectType } from "@/utils/candidEnum";
import { Activity, AlertCircle, AlertTriangle, TrendingUp } from "lucide-react";

export default function SystemOverviewPanel() {
  const { data: obstacleEvents, isLoading } = useGetAllObstacleEvents();

  if (isLoading) {
    return (
      <Card className="mb-6 border-primary/20 bg-gradient-to-br from-card to-card/50">
        <CardHeader className="pb-2 px-5 pt-5">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Activity className="h-5 w-5 text-primary" />
            System Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid gap-4 mb-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border/50 bg-background/50 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-primary/10 p-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Loading...
                  </p>
                  <p className="text-xl font-bold">--</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalObstacles = obstacleEvents?.length || 0;
  const vehicleCount =
    obstacleEvents?.filter((e) =>
      isObjectType(e.classification.objectType, "vehicle"),
    ).length || 0;
  const pedestrianCount =
    obstacleEvents?.filter((e) =>
      isObjectType(e.classification.objectType, "pedestrian"),
    ).length || 0;
  const debrisCount =
    obstacleEvents?.filter((e) =>
      isObjectType(e.classification.objectType, "debris"),
    ).length || 0;
  const movingCount =
    obstacleEvents?.filter((e) =>
      isMotionType(e.classification.motion, "moving"),
    ).length || 0;

  return (
    <Card className="mb-6 border-primary/20 bg-gradient-to-br from-card to-card/50 shadow-lg">
      <CardHeader className="pb-2 px-5 pt-5">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Activity className="h-5 w-5 text-primary" />
          System Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="grid gap-4 mb-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border/50 bg-background/50 p-4 backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-md">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-primary/10 p-2">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Total Obstacles
                </p>
                <p className="text-xl font-bold">{totalObstacles}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/50 bg-background/50 p-4 backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-md">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-chart-1/10 p-2">
                <AlertTriangle className="h-4 w-4 text-chart-1" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Vehicles
                </p>
                <p className="text-xl font-bold">{vehicleCount}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/50 bg-background/50 p-4 backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-md">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-accent/10 p-2">
                <AlertCircle className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Pedestrians
                </p>
                <p className="text-xl font-bold">{pedestrianCount}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/50 bg-background/50 p-4 backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-md">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-destructive/10 p-2">
                <Activity className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Moving Objects
                </p>
                <p className="text-xl font-bold">{movingCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border/50 bg-background/50 p-3 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-chart-2" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">
                  Debris/Obstacles
                </p>
                <p className="text-sm font-semibold">{debrisCount}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/50 bg-background/50 p-3 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Classification</p>
                <Badge variant="secondary" className="text-xs">
                  Active
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
