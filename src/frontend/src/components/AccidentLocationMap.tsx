import type { Location } from "@/backend";
import { Button } from "@/components/ui/button";
import { MapPin, X } from "lucide-react";
import { useEffect, useState } from "react";

interface AccidentLocationMapProps {
  onLocationSelect: (location: Location) => void;
  initialLocation?: Location;
  disabled?: boolean;
}

export default function AccidentLocationMap({
  onLocationSelect,
  initialLocation,
  disabled = false,
}: AccidentLocationMapProps) {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(
    initialLocation || null,
  );

  useEffect(() => {
    if (initialLocation) {
      setSelectedLocation(initialLocation);
    }
  }, [initialLocation]);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const latitude = 40.7128 + ((rect.height / 2 - y) / rect.height) * 0.1;
    const longitude = -74.006 + ((x - rect.width / 2) / rect.width) * 0.1;

    const location: Location = {
      latitude,
      longitude,
      accuracy: 10,
    };

    setSelectedLocation(location);
    onLocationSelect(location);
  };

  const handleClearPin = () => {
    setSelectedLocation(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Accident Location</span>
        {selectedLocation && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearPin}
            className="h-8 text-xs"
          >
            <X className="mr-1 h-3 w-3" />
            Clear Pin
          </Button>
        )}
      </div>

      <div
        onClick={handleMapClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ")
            handleMapClick(e as unknown as React.MouseEvent<HTMLDivElement>);
        }}
        tabIndex={disabled ? -1 : 0}
        aria-label="Click to mark accident location on map"
        className={`relative h-64 w-full overflow-hidden rounded-lg border-2 ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-crosshair"
        } ${
          selectedLocation
            ? "border-emergency bg-emergency/5"
            : "border-border bg-muted/30"
        }`}
        style={{
          backgroundImage: `
            linear-gradient(to right, oklch(var(--border) / 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, oklch(var(--border) / 0.1) 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          {!selectedLocation && !disabled && (
            <div className="text-center">
              <MapPin className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">Click to mark accident location</p>
            </div>
          )}
        </div>

        {selectedLocation && (
          <div
            className="absolute"
            style={{
              left: `${((selectedLocation.longitude + 74.006 - 0.05) / 0.1) * 100}%`,
              top: `${((40.7128 + 0.05 - selectedLocation.latitude) / 0.1) * 100}%`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <MapPin
              className="h-8 w-8 text-emergency drop-shadow-lg"
              fill="currentColor"
            />
          </div>
        )}
      </div>

      {selectedLocation && (
        <div className="rounded-lg bg-muted/50 p-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="font-medium">Latitude:</span>{" "}
              {selectedLocation.latitude.toFixed(6)}
            </div>
            <div>
              <span className="font-medium">Longitude:</span>{" "}
              {selectedLocation.longitude.toFixed(6)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
