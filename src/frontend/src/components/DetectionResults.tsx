import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DetectionResult } from "@/types/detection";
import {
  AlertTriangle,
  Cloud,
  Construction,
  Droplets,
  Eye,
  Image,
  Layers,
  MapPin,
  Navigation,
  Sun,
} from "lucide-react";
import { useState } from "react";

interface DetectionResultsProps {
  result: DetectionResult;
}

export default function DetectionResults({ result }: DetectionResultsProps) {
  const [activeTab, setActiveTab] = useState("original");

  const hasPotholes =
    result.roadSurfaceFeatures?.potholes &&
    result.roadSurfaceFeatures.potholes.detections.length > 0;
  const potholeCount =
    result.roadSurfaceFeatures?.potholes?.detections.length || 0;

  const weather = result.environmentalConditions.weather;
  const lighting = result.environmentalConditions.lighting;
  const fogLikelihood = result.environmentalConditions.fogLikelihood ?? 0;
  const visibility = result.environmentalConditions.visibility ?? 1;

  const isFoggy =
    weather === "Foggy" || weather === "Heavy Fog" || fogLikelihood > 0.4;
  const isHeavyFog = weather === "Heavy Fog" || fogLikelihood > 0.65;

  function getWeatherIcon() {
    if (isFoggy) return <Cloud className="h-4 w-4" />;
    if (weather === "Rainy") return <Droplets className="h-4 w-4" />;
    return <Sun className="h-4 w-4" />;
  }

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          Detection Results
        </CardTitle>
        <CardDescription>
          Processed in {result.processingTime}ms • Confidence:{" "}
          {(result.confidenceScore * 100).toFixed(0)}%
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Environmental conditions summary */}
        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-muted border border-border">
            {getWeatherIcon()}
            <span>{weather}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-muted border border-border">
            <Sun className="h-4 w-4" />
            <span>{lighting}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-muted border border-border">
            <Eye className="h-4 w-4" />
            <span>Visibility: {(visibility * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* Fog warning banner */}
        {isFoggy && (
          <div
            className={`mb-4 flex items-start gap-3 p-4 rounded-xl border ${
              isHeavyFog
                ? "bg-red-500/10 border-red-500/40 text-red-400"
                : "bg-yellow-500/10 border-yellow-500/40 text-yellow-400"
            }`}
          >
            <Cloud className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">
                {isHeavyFog
                  ? "Heavy Fog Detected"
                  : "Foggy Conditions Detected"}
              </p>
              <p className="text-xs mt-0.5 opacity-80">
                {isHeavyFog
                  ? "Visibility is severely reduced. Pothole and obstacle detection are suppressed to prevent false positives. Drive with extreme caution and use fog lights."
                  : "Reduced visibility detected. Some detections may be limited. Pothole analysis is suppressed to avoid false positives in foggy conditions."}
              </p>
              <p className="text-xs mt-1 opacity-70">
                Fog likelihood: {(fogLikelihood * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex flex-wrap w-full h-auto gap-2 p-2 bg-muted/50">
            <TabsTrigger
              value="original"
              className="text-xs flex items-center gap-1 px-3 py-2 border border-border rounded-md data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Image className="h-3 w-3" />
              Original
            </TabsTrigger>
            <TabsTrigger
              value="road"
              className="text-xs flex items-center gap-1 px-3 py-2 border border-border rounded-md data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <MapPin className="h-3 w-3" />
              Road
            </TabsTrigger>
            <TabsTrigger
              value="obstacles"
              className="text-xs flex items-center gap-1 px-3 py-2 border border-border rounded-md data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <AlertTriangle className="h-3 w-3" />
              Obstacles
            </TabsTrigger>
            <TabsTrigger
              value="segmentation"
              className="text-xs flex items-center gap-1 px-3 py-2 border border-border rounded-md data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Layers className="h-3 w-3" />
              Segment
            </TabsTrigger>
            <TabsTrigger
              value="drivable"
              className="text-xs flex items-center gap-1 px-3 py-2 border border-border rounded-md data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Navigation className="h-3 w-3" />
              Drivable
            </TabsTrigger>
            <TabsTrigger
              value="edges"
              className="text-xs flex items-center gap-1 px-3 py-2 border border-border rounded-md data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Edges
            </TabsTrigger>
            <TabsTrigger
              value="damage"
              className="text-xs flex items-center gap-1 px-3 py-2 border border-border rounded-md data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Damage
            </TabsTrigger>
            <TabsTrigger
              value="wet"
              className="text-xs flex items-center gap-1 px-3 py-2 border border-border rounded-md data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Droplets className="h-3 w-3" />
              Wet/Slip
            </TabsTrigger>
            {hasPotholes && (
              <TabsTrigger
                value="potholes"
                className="text-xs flex items-center gap-1 px-3 py-2 border border-border rounded-md data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Construction className="h-3 w-3" />
                Potholes
                <Badge variant="destructive" className="ml-1 text-xs">
                  {potholeCount}
                </Badge>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="original" className="mt-4">
            <div className="relative rounded-lg overflow-hidden border border-border">
              <img
                src={result.originalImageUrl}
                alt="Original"
                className="w-full h-auto"
              />
              <div className="absolute top-2 right-2">
                <Badge variant="secondary">Original Image</Badge>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="road" className="mt-4">
            <div className="relative rounded-lg overflow-hidden border border-border">
              <img
                src={result.processedImageUrl}
                alt="Road Detection"
                className="w-full h-auto"
              />
              <div className="absolute top-2 right-2">
                <Badge variant="secondary">Road: {result.roadType}</Badge>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="obstacles" className="mt-4">
            {result.obstacleDetection ? (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img
                    src={result.obstacleDetection.visualizationUrl}
                    alt="Obstacle Detection"
                    className="w-full h-auto"
                  />
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary">
                      {result.obstacleDetection.obstacles.length} Obstacle(s)
                    </Badge>
                  </div>
                </div>
                {result.obstacleDetection.obstacles.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {result.obstacleDetection.obstacles.map((obstacle) => (
                      <div
                        key={obstacle.id}
                        className="p-3 rounded-lg border border-border bg-card"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge
                            variant={
                              obstacle.riskLevel.level === "High"
                                ? "destructive"
                                : obstacle.riskLevel.level === "Moderate"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {obstacle.type}
                            {obstacle.motion && ` • ${obstacle.motion}`}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {(obstacle.confidenceLevel * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {obstacle.riskLevel.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No obstacle detection data available
              </div>
            )}
          </TabsContent>

          <TabsContent value="segmentation" className="mt-4">
            {result.roadSurfaceFeatures?.segmentation.visualizationUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img
                  src={result.roadSurfaceFeatures.segmentation.visualizationUrl}
                  alt="Road Segmentation"
                  className="w-full h-auto"
                />
                <div className="absolute top-2 right-2">
                  <Badge variant="secondary">
                    Coverage:{" "}
                    {(
                      result.roadSurfaceFeatures.segmentation.coverage * 100
                    ).toFixed(0)}
                    %
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Segmentation data not available
              </div>
            )}
          </TabsContent>

          <TabsContent value="drivable" className="mt-4">
            {result.roadSurfaceFeatures?.drivableArea.visualizationUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img
                  src={result.roadSurfaceFeatures.drivableArea.visualizationUrl}
                  alt="Drivable Area"
                  className="w-full h-auto"
                />
                <div className="absolute top-2 right-2">
                  <Badge variant="secondary">
                    Drivable:{" "}
                    {(
                      result.roadSurfaceFeatures.drivableArea.coverage * 100
                    ).toFixed(0)}
                    %
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Drivable area data not available
              </div>
            )}
          </TabsContent>

          <TabsContent value="edges" className="mt-4">
            {result.roadSurfaceFeatures?.roadEdges.visualizationUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img
                  src={result.roadSurfaceFeatures.roadEdges.visualizationUrl}
                  alt="Road Edges"
                  className="w-full h-auto"
                />
                <div className="absolute top-2 right-2 space-x-2">
                  <Badge variant="secondary">
                    Strength:{" "}
                    {result.roadSurfaceFeatures.roadEdges.edgeStrength.toFixed(
                      2,
                    )}
                  </Badge>
                  <Badge variant="secondary">
                    Edges: {result.roadSurfaceFeatures.roadEdges.edgeCount}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Edge detection data not available
              </div>
            )}
          </TabsContent>

          <TabsContent value="damage" className="mt-4">
            {result.roadSurfaceFeatures?.damage.visualizationUrl ? (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img
                    src={result.roadSurfaceFeatures.damage.visualizationUrl}
                    alt="Road Damage"
                    className="w-full h-auto"
                  />
                  <div className="absolute top-2 right-2 space-x-2">
                    <Badge variant="secondary">
                      Potholes:{" "}
                      {(
                        result.roadSurfaceFeatures.damage.potholeScore * 100
                      ).toFixed(0)}
                      %
                    </Badge>
                    <Badge variant="secondary">
                      Cracks:{" "}
                      {(
                        result.roadSurfaceFeatures.damage.crackScore * 100
                      ).toFixed(0)}
                      %
                    </Badge>
                  </div>
                </div>
                {result.roadSurfaceFeatures.damage.damageLocations.length >
                  0 && (
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <div className="text-sm font-medium mb-2">
                      Damage Locations (
                      {result.roadSurfaceFeatures.damage.damageLocations.length}
                      )
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                      {result.roadSurfaceFeatures.damage.damageLocations
                        .slice(0, 6)
                        .map((loc) => (
                          <div
                            key={`${loc.type}-${loc.severity}`}
                            className="flex items-center gap-1"
                          >
                            <Badge variant="outline" className="text-xs">
                              {loc.type}
                            </Badge>
                            <span className="text-muted-foreground">
                              {(loc.severity * 100).toFixed(0)}%
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Damage detection data not available
              </div>
            )}
          </TabsContent>

          <TabsContent value="wet" className="mt-4">
            {result.roadSurfaceFeatures?.wetSurface.visualizationUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img
                  src={result.roadSurfaceFeatures.wetSurface.visualizationUrl}
                  alt="Wet Surface Detection"
                  className="w-full h-auto"
                />
                <div className="absolute top-2 right-2 space-x-2">
                  <Badge variant="secondary">
                    Wetness:{" "}
                    {(
                      result.roadSurfaceFeatures.wetSurface.wetnessScore * 100
                    ).toFixed(0)}
                    %
                  </Badge>
                  <Badge variant="secondary">
                    Slip Risk:{" "}
                    {(
                      result.roadSurfaceFeatures.wetSurface.slipperinessScore *
                      100
                    ).toFixed(0)}
                    %
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Wet surface data not available
              </div>
            )}
          </TabsContent>

          {hasPotholes && (
            <TabsContent value="potholes" className="mt-4">
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img
                    src={
                      result.roadSurfaceFeatures!.potholes!.visualizationUrl!
                    }
                    alt="Pothole Detection"
                    className="w-full h-auto"
                  />
                  <div className="absolute top-2 right-2">
                    <Badge variant="destructive">
                      {potholeCount} Pothole{potholeCount > 1 ? "s" : ""}{" "}
                      Detected
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {result.roadSurfaceFeatures!.potholes!.detections.map(
                    (pothole) => (
                      <div
                        key={pothole.id}
                        className="p-3 rounded-lg border border-warning/30 bg-warning/5"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge
                            variant={
                              pothole.severity === "High"
                                ? "destructive"
                                : pothole.severity === "Moderate"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {pothole.severity} Severity
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {(pothole.confidenceLevel * 100).toFixed(0)}%
                            confidence
                          </span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Distance:
                            </span>
                            <span className="font-medium">
                              {pothole.distance.toFixed(0)}m
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Size:</span>
                            <span className="font-medium">
                              {pothole.size.toFixed(2)}m²
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Depth:
                            </span>
                            <span className="font-medium">
                              {pothole.depth.toFixed(1)}cm
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Type:</span>
                            <span className="font-medium capitalize">
                              {pothole.potholeType.replace(/_/g, " ")}
                            </span>
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
