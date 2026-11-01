"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

export default function Html5QrcodePlugin({
  fps = 15,
  qrbox = 300,
  aspectRatio = 1.0,
  disableFlip = false,
  onSuccess,
  onError,
  onReady,
}) {
  const elementId = "html5-qr-reader";
  const scannerRef = useRef(null);
  const hasInitialized = useRef(false);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const onReadyRef = useRef(onReady);

  // Keep refs updated to avoid re-renders restarting the scanner
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
    onReadyRef.current = onReady;
  }, [onSuccess, onError, onReady]);

  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }

    let isMounted = true;

    // Define qrBoxFunction in outer scope so it is always available
    const qrBoxFunction = (viewfinderWidth, viewfinderHeight) => {
      const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
      const boxSize = Math.max(160, Math.min(minEdge * 0.75, qrbox || 260));
      return { width: Math.round(boxSize), height: Math.round(boxSize) };
    };

    const notifyCameraError = (error) => {
      const errMsg = error?.message || String(error || "");
      const errName = error?.name || "";

      let friendlyMessage = "Unable to start camera scanner. Please use manual entry.";

      if (
        errName === "NotAllowedError" ||
        errMsg.toLowerCase().includes("permission dismissed") ||
        errMsg.toLowerCase().includes("permission denied") ||
        errMsg.toLowerCase().includes("notallowederror")
      ) {
        friendlyMessage =
          "Camera permission was dismissed or denied. Please allow camera permissions in your browser or switch to Manual Entry.";
      } else if (
        errName === "NotFoundError" ||
        errMsg.toLowerCase().includes("no cameras") ||
        errMsg.toLowerCase().includes("devicesnotfounderror")
      ) {
        friendlyMessage =
          "No camera detected on this device. Please use manual ticket entry.";
      } else if (
        errName === "NotReadableError" ||
        errMsg.toLowerCase().includes("already in use")
      ) {
        friendlyMessage = "Camera is currently busy or in use by another application.";
      }

      // Display friendly toast to the user instead of raw console errors
      toast.error(friendlyMessage, { id: "qr-camera-status-toast" });

      if (onErrorRef.current) {
        onErrorRef.current(error, friendlyMessage);
      }
    };

    const initializeScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");

        if (!isMounted) return;

        const html5QrCode = new Html5Qrcode(elementId, /* verbose= */ false);
        scannerRef.current = html5QrCode;

        // Try to get cameras first
        let cameras = [];
        try {
          cameras = await Html5Qrcode.getCameras();
        } catch (camErr) {
          // Gracefully handle permission dismissed/denied without console.error
          console.warn("[QR] getCameras note:", camErr?.message || camErr);
          throw camErr;
        }

        if (!cameras || cameras.length === 0) {
          const noCamErr = new Error("No cameras found on this device");
          noCamErr.name = "NotFoundError";
          throw noCamErr;
        }

        // Prefer back camera
        let cameraId = cameras[0].id;
        const backCamera = cameras.find(
          (cam) =>
            cam.label?.toLowerCase().includes("back") ||
            cam.label?.toLowerCase().includes("rear") ||
            cam.label?.toLowerCase().includes("environment"),
        );
        if (backCamera) {
          cameraId = backCamera.id;
        }

        const config = {
          fps,
          qrbox: qrBoxFunction,
          aspectRatio,
          disableFlip,
        };

        await html5QrCode.start(
          cameraId,
          config,
          (decodedText) => {
            if (onSuccessRef.current) {
              onSuccessRef.current(decodedText);
            }
          },
          () => {
            // Suppress continuous "no QR found in frame" noise
          },
        );

        hasInitialized.current = true;
        toast.success("Camera scanner ready", { id: "qr-scanner-ready" });

        if (onReadyRef.current) {
          onReadyRef.current();
        }
      } catch (error) {
        console.warn("[QR] Primary initialization notice:", error?.message || error);

        const isPermissionDenied =
          error?.name === "NotAllowedError" ||
          String(error?.message || "").toLowerCase().includes("permission dismissed") ||
          String(error?.message || "").toLowerCase().includes("permission denied");

        // Only try facingMode fallback if it was not an explicit permission denial
        if (!isPermissionDenied) {
          try {
            const { Html5Qrcode } = await import("html5-qrcode");

            if (!isMounted) return;

            if (!scannerRef.current) {
              const html5QrCode = new Html5Qrcode(elementId, false);
              scannerRef.current = html5QrCode;
            }

            // Use facingMode constraint as fallback
            await scannerRef.current.start(
              { facingMode: "environment" },
              {
                fps,
                qrbox: qrBoxFunction,
                aspectRatio,
                disableFlip,
              },
              (decodedText) => {
                if (onSuccessRef.current) {
                  onSuccessRef.current(decodedText);
                }
              },
              () => {},
            );

            hasInitialized.current = true;
            toast.success("Camera scanner ready", { id: "qr-scanner-ready" });

            if (onReadyRef.current) {
              onReadyRef.current();
            }
            return;
          } catch (fallbackError) {
            console.warn(
              "[QR] Fallback scanner notice:",
              fallbackError?.message || fallbackError,
            );
            notifyCameraError(fallbackError);
            return;
          }
        }

        // If permission was dismissed/denied, inform the user via toast
        notifyCameraError(error);
      }
    };

    // Small delay to ensure DOM element exists
    const timeoutId = setTimeout(initializeScanner, 400);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);

      if (scannerRef.current && hasInitialized.current) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current?.clear();
          })
          .catch((err) => {
            console.warn("[QR] Cleanup notice (safe to ignore):", err?.message || err);
          });
      }
      hasInitialized.current = false;
    };
  }, [fps, qrbox, aspectRatio, disableFlip]);

  return (
    <div
      id={elementId}
      className="w-full h-full relative overflow-hidden"
    />
  );
}
