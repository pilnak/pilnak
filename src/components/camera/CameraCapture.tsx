import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Camera, X, RotateCw, Check } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
  title?: string;
  facingMode?: "user" | "environment";
}

export function CameraCapture({
  onCapture,
  onCancel,
  title = "Take Photo",
  facingMode = "environment",
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentFacingMode, setCurrentFacingMode] = useState<"user" | "environment">(facingMode);

  /* --- lock body scroll while camera is open --- */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /* --- stop camera --- */
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  /* --- start camera --- */
  const startCamera = useCallback(
    async (mode: "user" | "environment") => {
      setIsLoading(true);
      setError(null);
      stopCamera();

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera not supported on this device or connection.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });

        streamRef.current = stream;
        setCurrentFacingMode(mode);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(console.error);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unable to access camera.");
        setIsLoading(false);
      }
    },
    [stopCamera],
  );

  /* --- init --- */
  useEffect(() => {
    startCamera(facingMode);
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVideoReady = () => setIsLoading(false);

  /* --- capture --- */
  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const image = canvas.toDataURL("image/jpeg", 0.92);
    if (!image || image === "data:,") {
      setError("Failed to capture. Please try again.");
      return;
    }

    setCapturedImage(image);
    stopCamera();
  }, [stopCamera]);

  /* --- retake --- */
  const handleRetake = () => {
    setCapturedImage(null);
    startCamera(currentFacingMode);
  };

  /* --- switch camera --- */
  const handleSwitchCamera = () => {
    startCamera(currentFacingMode === "user" ? "environment" : "user");
  };

  /* --- close --- */
  const handleClose = () => {
    stopCamera();
    onCancel();
  };

  /* ------------------------------------------------------------------ */
  /* UI                                                                   */
  /* ------------------------------------------------------------------ */

  const ui = (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 99999 }}
      className="bg-black"
    >
      {/* ── CAMERA / PREVIEW FILL ──────────────────────────────────── */}
      {capturedImage ? (
        <img
          src={capturedImage}
          alt="Preview"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onCanPlay={handleVideoReady}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
          {isLoading && !error && (
            <div
              style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              className="text-white text-sm tracking-wide"
            >
              Opening camera…
            </div>
          )}
        </>
      )}

      {/* error state */}
      {error && (
        <div
          style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}
          className="text-white text-center"
        >
          <Camera style={{ width: 56, height: 56, opacity: 0.5, marginBottom: 16 }} />
          <p style={{ marginBottom: 24, fontSize: 14, opacity: 0.8 }}>{error}</p>
          <button
            onClick={() => startCamera(currentFacingMode)}
            style={{
              background: "white",
              color: "black",
              fontWeight: 600,
              fontSize: 14,
              padding: "10px 24px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {/* ── TOP GRADIENT + CONTROLS ───────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 120,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "calc(env(safe-area-inset-top, 0px) + 16px) 16px 0",
          pointerEvents: "none",
        }}
      >
        {/* Close */}
        <button
          onClick={handleClose}
          style={{
            pointerEvents: "auto",
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.35)",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            backdropFilter: "blur(4px)",
          }}
        >
          <X style={{ width: 20, height: 20, color: "white" }} />
        </button>

        {/* Title */}
        <span
          style={{
            color: "white",
            fontWeight: 600,
            fontSize: 15,
            letterSpacing: "0.01em",
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
            alignSelf: "center",
          }}
        >
          {title}
        </span>

        {/* Switch camera (hidden when reviewing capture) */}
        {!capturedImage ? (
          <button
            onClick={handleSwitchCamera}
            style={{
              pointerEvents: "auto",
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.35)",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              backdropFilter: "blur(4px)",
            }}
          >
            <RotateCw style={{ width: 20, height: 20, color: "white" }} />
          </button>
        ) : (
          <div style={{ width: 40 }} />
        )}
      </div>

      {/* ── BOTTOM GRADIENT + CONTROLS ────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 200,
          background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 40px)",
          pointerEvents: "none",
        }}
      >
        {capturedImage ? (
          /* ── Review controls: Retake (left) | Use Photo (right) ── */
          <div
            style={{
              pointerEvents: "auto",
              display: "flex",
              width: "100%",
              justifyContent: "space-between",
              alignItems: "center",
              paddingInline: 40,
            }}
          >
            <button
              onClick={handleRetake}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.18)",
                  border: "2px solid rgba(255,255,255,0.55)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backdropFilter: "blur(4px)",
                }}
              >
                <RotateCw style={{ width: 20, height: 20, color: "white" }} />
              </div>
              <span style={{ color: "white", fontSize: 12, fontWeight: 500 }}>Retake</span>
            </button>

            <button
              onClick={() => onCapture(capturedImage)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "#009C41",
                  border: "3px solid rgba(255,255,255,0.8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 20px rgba(0,156,65,0.5)",
                }}
              >
                <Check style={{ width: 26, height: 26, color: "white" }} />
              </div>
              <span style={{ color: "white", fontSize: 12, fontWeight: 600 }}>Use Photo</span>
            </button>
          </div>
        ) : !isLoading && !error ? (
          /* ── Shutter button ── */
          <button
            onClick={handleCapture}
            style={{
              pointerEvents: "auto",
              width: 76,
              height: 76,
              borderRadius: "50%",
              background: "white",
              border: "4px solid rgba(255,255,255,0.45)",
              outline: "none",
              cursor: "pointer",
              boxShadow: "0 0 0 2px rgba(255,255,255,0.25), 0 8px 24px rgba(0,0,0,0.4)",
              transition: "transform 0.1s",
              flexShrink: 0,
            }}
            onMouseDown={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.93)")}
            onMouseUp={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
            onTouchStart={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.93)")}
            onTouchEnd={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
          />
        ) : null}
      </div>
    </div>
  );

  return createPortal(ui, document.body);
}
