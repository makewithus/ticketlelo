"use client";

import { useState, useRef, useEffect } from "react";
import {
  X,
  Upload,
  Crop,
  Image as ImageIcon,
  Check,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { updateEvent } from "@/lib/firestore";

export function SquarePhotoUploadModal({
  isOpen,
  onClose,
  event,
  onPhotoUpdated,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewSquareUrl, setPreviewSquareUrl] = useState(null);

  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setImageSrc(null);
      setZoom(1);
      setRotation(0);
      setPreviewSquareUrl(null);
    }
  }, [isOpen]);

  if (!isOpen || !event) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file (JPG, PNG, WebP)");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image file size should be less than 8MB");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageSrc(event.target.result);
      processSquareCrop(event.target.result, 1, 0);
    };
    reader.readAsDataURL(file);
  };

  // Enforces a strict 1:1 square canvas crop
  const processSquareCrop = (sourceUrl, currentZoom, currentRotation) => {
    if (!sourceUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const TARGET_SIZE = 800; // Perfect 800x800 square output
      canvas.width = TARGET_SIZE;
      canvas.height = TARGET_SIZE;
      const ctx = canvas.getContext("2d");

      // Fill background
      ctx.fillStyle = "#131517";
      ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);

      ctx.save();
      ctx.translate(TARGET_SIZE / 2, TARGET_SIZE / 2);
      ctx.rotate((currentRotation * Math.PI) / 180);
      ctx.scale(currentZoom, currentZoom);

      // Center crop square math
      const srcAspect = img.width / img.height;
      let drawW, drawH;

      if (srcAspect > 1) {
        // Landscape: scale height to fit square
        drawH = TARGET_SIZE;
        drawW = TARGET_SIZE * srcAspect;
      } else {
        // Portrait: scale width to fit square
        drawW = TARGET_SIZE;
        drawH = TARGET_SIZE / srcAspect;
      }

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      const squareDataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setPreviewSquareUrl(squareDataUrl);
    };
    img.src = sourceUrl;
  };

  const handleZoomChange = (newZoom) => {
    const clamped = Math.max(0.8, Math.min(2.5, newZoom));
    setZoom(clamped);
    if (imageSrc) processSquareCrop(imageSrc, clamped, rotation);
  };

  const handleRotate = () => {
    const newRot = (rotation + 90) % 360;
    setRotation(newRot);
    if (imageSrc) processSquareCrop(imageSrc, zoom, newRot);
  };

  const handleSavePhoto = async () => {
    if (!previewSquareUrl) {
      toast.error("Please select an image first");
      return;
    }

    setIsProcessing(true);
    try {
      await updateEvent(event.id, {
        coverImage: previewSquareUrl,
        bannerUrl: previewSquareUrl,
        aspectRatio: "1:1",
      });

      if (typeof onPhotoUpdated === "function") {
        onPhotoUpdated(previewSquareUrl);
      }

      toast.success("Event square photo updated successfully!");
      onClose();
    } catch (err) {
      console.error("Failed to update event photo:", err);
      toast.error("Failed to save event photo");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl bg-[#1A1C1F] border border-[#2A2D31] p-6 shadow-2xl relative space-y-5 animate-in zoom-in-95 duration-200 text-white">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-[#9B9EA4] hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#212327] border border-[#2A2D31] flex items-center justify-center text-[#FE760B]">
            <Crop size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Change Event Photo</h3>
            <p className="text-xs text-[#9B9EA4]">Enforces 1:1 square ratio to preserve card layouts</p>
          </div>
        </div>

        {/* Square Ratio Preview Box */}
        <div className="flex flex-col items-center">
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`w-56 h-56 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center relative overflow-hidden transition-all cursor-pointer group ${
              previewSquareUrl
                ? "border-[#FE760B] bg-[#131517]"
                : "border-[#2A2D31] hover:border-[#FE760B]/50 bg-[#131517]"
            }`}
          >
            {previewSquareUrl ? (
              <div className="w-full h-full relative">
                <img
                  src={previewSquareUrl}
                  alt="Square event preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-semibold gap-1">
                  <Upload size={18} />
                  <span>Replace Photo</span>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#212327] border border-[#2A2D31] flex items-center justify-center text-[#FE760B] mx-auto group-hover:scale-110 transition-transform">
                  <ImageIcon size={22} />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Click to Upload Photo</p>
                  <p className="text-[10px] text-[#9B9EA4] mt-0.5">JPG, PNG, WebP up to 8MB</p>
                </div>
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#212327] border border-[#2A2D31] text-[10px] font-mono text-[#FE760B]">
                  1:1 Square Lock
                </span>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Square Crop Fine-Tuning Controls */}
        {previewSquareUrl && (
          <div className="bg-[#131517] border border-[#2A2D31] rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between text-xs text-[#9B9EA4]">
              <span className="font-semibold text-white">Adjust Square Fit</span>
              <button
                type="button"
                onClick={handleRotate}
                className="inline-flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
              >
                <RotateCw size={12} />
                <span>Rotate 90°</span>
              </button>
            </div>

            {/* Zoom Slider */}
            <div className="flex items-center gap-3">
              <ZoomOut size={14} className="text-[#9B9EA4]" />
              <input
                type="range"
                min="0.8"
                max="2.2"
                step="0.05"
                value={zoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="flex-1 accent-[#FE760B] cursor-pointer"
              />
              <ZoomIn size={14} className="text-[#9B9EA4]" />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-xs font-semibold text-[#9B9EA4] hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSavePhoto}
            disabled={isProcessing || !previewSquareUrl}
            className="px-5 py-2 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#131517]" />
            ) : (
              <Check className="w-4 h-4 text-[#131517]" />
            )}
            <span>{isProcessing ? "Saving..." : "Save Square Photo"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
