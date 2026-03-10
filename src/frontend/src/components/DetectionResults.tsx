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
  CheckCircle2,
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

  // Require fogLikelihood >= 0.70 confidence threshold to show fog detection
  const FOG_THRESHOLD = 0.7;
  const isFoggy =
    (weather === "Foggy" || weather === "Heavy Fog") &&
    fogLikelihood >= FOG_THRESHOLD;
  const isHeavyFog = weather === "Heavy Fog" && fogLikelihood >= FOG_THRESHOLD;
  const fogConfidencePct = Math.round(fogLikelihood * 100);

  // Wet & Slip detection — confidence threshold 0.7
  const WET_THRESHOLD = 0.7;
  const wetnessScore =
    result.roadSurfaceFeatures?.wetSurface?.wetnessScore ?? 0;
  const slipScore =
    result.roadSurfaceFeatures?.wetSurface?.slipperinessScore ?? 0;
  const wetConfidence = Math.max(wetnessScore, slipScore);
  const isWet = wetConfidence >= WET_THRESHOLD;
  const isHighRisk = wetConfidence >= 0.82;
  const wetPct = Math.round(wetConfidence * 100);

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

        {/* Fog Detection Result */}
        <div
          data-ocid="fog.card"
          className={`mb-4 flex items-center gap-3 p-4 rounded-xl border ${
            isFoggy
              ? isHeavyFog
                ? "bg-red-500/10 border-red-500/40 text-red-400"
                : "bg-yellow-500/10 border-yellow-500/40 text-yellow-400"
              : "bg-green-500/10 border-green-500/30 text-green-400"
          }`}
        >
          <Cloud className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">
              {isFoggy
                ? `${isHeavyFog ? "Heavy " : ""}Fog Detected (${fogConfidencePct}%)`
                : "No Fog Detected"}
            </p>
            {isFoggy && (
              <p className="text-xs mt-0.5 opacity-80">
                {isHeavyFog
                  ? "Visibility severely reduced. Obstacle detection suppressed. Drive with extreme caution and use fog lights."
                  : "Reduced visibility detected. Some detections may be limited."}
              </p>
            )}
          </div>
        </div>

        {/* Pothole Detection Result */}
        <div
          data-ocid="pothole.card"
          className={`mb-4 flex items-center gap-3 p-4 rounded-xl border ${
            hasPotholes
              ? "bg-orange-500/10 border-orange-500/40 text-orange-400"
              : "bg-green-500/10 border-green-500/30 text-green-400"
          }`}
        >
          <Construction className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">
              {hasPotholes
                ? `Pothole Detected (${Math.round(
                    Math.max(
                      ...(
                        result.roadSurfaceFeatures?.potholes?.detections ?? []
                      ).map((p) => p.confidenceLevel),
                    ) * 100,
                  )}%)`
                : "No Potholes Detected"}
            </p>
            {hasPotholes && (
              <p className="text-xs mt-0.5 opacity-80">
                {potholeCount} pothole{potholeCount > 1 ? "s" : ""} found. See
                the Potholes tab for bounding boxes and details.
              </p>
            )}
          </div>
        </div>

        {/* Wet & Slip Detection Result */}
        <div
          data-ocid="wet.card"
          className={`mb-4 flex items-center gap-3 p-4 rounded-xl border ${
            isHighRisk
              ? "bg-red-500/10 border-red-500/40 text-red-400"
              : isWet
                ? "bg-yellow-500/10 border-yellow-500/40 text-yellow-400"
                : "bg-green-500/10 border-green-500/30 text-green-400"
          }`}
        >
          <Droplets className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">
              {isHighRisk
                ? `High Wet & Slip Risk (${wetPct}%)`
                : isWet
                  ? `Moderate Wet Surface (${wetPct}%)`
                  : "No Wet & Slip Risk Detected"}
            </p>
            {isWet && (
              <p className="text-xs mt-0.5 opacity-80">
                {isHighRisk
                  ? "Road surface is highly wet or slippery. Reduce speed and increase following distance."
                  : "Moderate wet surface detected. Drive carefully and watch for slippery areas."}
              </p>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex flex-wrap w-full h-auto gap-2 p-2 bg-muted/50">
            <TabsTrigger
              value="original"
              data-ocid="results.original.tab"
              className="text-xs flex items-center gap-1 px-3 py-2 border border-border rounded-md data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Image className="h-3 w-3" />
              Original
            </TabsTrigger>
            <TabsTrigger
              value="road"
              data-ocid="results.road.tab"
              className="text-xs flex items-center gap-1 px-3 py-2 border border-border rounded-md data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <MapPin className="h-3 w-3" />
              Road
            </TabsTrigger>
            <TabsTrigger
              value="segmentation"
              data-ocid="results.segmentation.tab"
              className="text-xs flex items-center gap-1 px-3 py-2 border border-border rounded-md data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Layers className="h-3 w-3" />
              Segment
            </TabsTrigger>
            <TabsTrigger
              value="drivable"
              data-ocid="results.drivable.tab"
              className="text-xs flex items-center gap-1 px-3 py-2 border border-border rounded-md data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Navigation className="h-3 w-3" />
              Drivable
            </TabsTrigger>
            <TabsTrigger
              value="edges"
              data-ocid="results.edges.tab"
              className="text-xs flex items-center gap-1 px-3 py-2 border border-border rounded-md data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Edges
            </TabsTrigger>
            <TabsTrigger
              value="damage"
              data-ocid="results.damage.tab"
              className="text-xs flex items-center gap-1 px-3 py-2 border border-border rounded-md data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Damage
            </TabsTrigger>
            <TabsTrigger
              value="wet"
              data-ocid="results.wet.tab"
              className="text-xs flex items-center gap-1 px-3 py-2 border border-border rounded-md data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Droplets className="h-3 w-3" />
              Wet/Slip
            </TabsTrigger>
            {hasPotholes && (
              <TabsTrigger
                value="potholes"
                data-ocid="results.potholes.tab"
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
            {isWet &&
            result.roadSurfaceFeatures?.wetSurface.visualizationUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img
                  src={result.roadSurfaceFeatures.wetSurface.visualizationUrl}
                  alt="Wet Surface Detection"
                  className="w-full h-auto"
                />
                <div className="absolute top-2 right-2 space-x-2">
                  <Badge
                    variant={isHighRisk ? "destructive" : "secondary"}
                    className="font-semibold"
                  >
                    {isHighRisk ? `High Risk ${wetPct}%` : `Wet ${wetPct}%`}
                  </Badge>
                </div>
              </div>
            ) : (
              <div
                data-ocid="wet.empty_state"
                className="flex flex-col items-center justify-center py-10 gap-3 text-green-400"
              >
                <CheckCircle2 className="h-10 w-10 opacity-80" />
                <p className="font-semibold text-sm">
                  No Wet &amp; Slip Risk Detected
                </p>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  The road surface appears dry. No rain, puddles, oil spills, or
                  wet reflections were detected.
                </p>
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
