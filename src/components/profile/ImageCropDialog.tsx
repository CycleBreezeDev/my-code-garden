import { useCallback, useEffect, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";

interface ImageCropDialogProps {
  open: boolean;
  imageSrc: string | null;
  /** Aspect ratio of the crop window: 1 for avatar (square), 3 for cover banner. */
  aspect: number;
  /** Output shape — `round` masks the preview to a circle (avatars). */
  cropShape?: "rect" | "round";
  /** Final pixel width of the cropped image. Height is derived from aspect. */
  outputWidth: number;
  title: string;
  description?: string;
  busy?: boolean;
  onCancel: () => void;
  /** Receives the cropped image as a Blob (image/jpeg, q=0.92). */
  onConfirm: (blob: Blob) => Promise<void> | void;
}

/**
 * Shared crop UI. Uses react-easy-crop for pan/zoom, then renders the
 * selected region into an offscreen canvas at `outputWidth` so we upload a
 * pre-sized JPEG (avoids shipping multi-MB originals to storage).
 */
export const ImageCropDialog = ({
  open,
  imageSrc,
  aspect,
  cropShape = "rect",
  outputWidth,
  title,
  description,
  busy = false,
  onCancel,
  onConfirm,
}: ImageCropDialogProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // Reset transform whenever a new image is opened so each upload starts fresh.
  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [open, imageSrc]);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    const blob = await renderCroppedBlob(imageSrc, croppedAreaPixels, outputWidth, aspect);
    if (!blob) return;
    await onConfirm(blob);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="relative h-72 w-full overflow-hidden rounded-lg bg-muted">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={cropShape}
              showGrid={cropShape === "rect"}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              objectFit="contain"
            />
          )}
        </div>
        <div className="flex items-center gap-3 px-1">
          <ZoomOut className="h-4 w-4 text-muted-foreground" />
          <Slider
            value={[zoom]}
            min={1}
            max={4}
            step={0.05}
            onValueChange={(v) => setZoom(v[0])}
            disabled={busy}
            className="flex-1"
            aria-label="Zoom"
          />
          <ZoomIn className="h-4 w-4 text-muted-foreground" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={busy || !croppedAreaPixels}>
            {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Decode the source image (object URL or remote) and render the user-selected
 * crop area into a canvas sized to `outputWidth × outputWidth/aspect`. We
 * always emit JPEG at q=0.92 — small enough for storage, no transparency loss
 * matters for avatars/covers.
 */
async function renderCroppedBlob(
  src: string,
  area: Area,
  outputWidth: number,
  aspect: number,
): Promise<Blob | null> {
  const image = await loadImage(src);
  const outputHeight = Math.round(outputWidth / aspect);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
