import { ExternalBlob } from "@/backend";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { useCallback, useState } from "react";

interface AccidentImageUploadProps {
  onImagesSelect: (images: File[]) => void;
  maxImages?: number;
  disabled?: boolean;
}

export default function AccidentImageUpload({
  onImagesSelect,
  maxImages = 5,
  disabled = false,
}: AccidentImageUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || disabled) return;

      const fileArray = Array.from(files).filter((file) =>
        file.type.startsWith("image/"),
      );

      const limitedFiles = fileArray.slice(0, maxImages - selectedFiles.length);

      if (limitedFiles.length > 0) {
        const newFiles = [...selectedFiles, ...limitedFiles];
        setSelectedFiles(newFiles);
        onImagesSelect(newFiles);

        for (const file of limitedFiles) {
          const reader = new FileReader();
          reader.onload = (e) => {
            setPreviews((prev) => [...prev, e.target?.result as string]);
          };
          reader.readAsDataURL(file);
        }
      }
    },
    [selectedFiles, maxImages, onImagesSelect, disabled],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
    },
    [handleFiles],
  );

  const removeImage = useCallback(
    (index: number) => {
      const newFiles = selectedFiles.filter((_, i) => i !== index);
      const newPreviews = previews.filter((_, i) => i !== index);
      setSelectedFiles(newFiles);
      setPreviews(newPreviews);
      onImagesSelect(newFiles);
    },
    [selectedFiles, previews, onImagesSelect],
  );

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? "border-emergency bg-emergency/10"
            : "border-border bg-muted/30"
        } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInput}
          disabled={disabled || selectedFiles.length >= maxImages}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <p className="mb-2 text-sm font-medium">
          {selectedFiles.length >= maxImages
            ? `Maximum ${maxImages} images reached`
            : "Drop accident scene images here or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground">
          {selectedFiles.length}/{maxImages} images selected
        </p>
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {previews.map((preview, index) => (
            <div
              key={preview}
              className="group relative aspect-video overflow-hidden rounded-lg"
            >
              <img
                src={preview}
                alt={`Preview ${index + 1}`}
                className="h-full w-full object-cover"
              />
              {!disabled && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={() => removeImage(index)}
                  className="absolute right-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                <p className="text-xs text-white">
                  <ImageIcon className="mr-1 inline h-3 w-3" />
                  {selectedFiles[index]?.name}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
