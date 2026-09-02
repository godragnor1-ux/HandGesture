"use client";

import React, { memo } from "react";
import Webcam from "react-webcam";
import { Eye, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const videoConstraints = {
  width: 640,
  height: 480,
  facingMode: "user",
};

let _offscreenCanvas = null;

/**
 * High-performance frame extractor.
 * Scales the video frame to a lightweight 256px JPEG (~5KB) directly on an offscreen canvas.
 * This avoids sending heavy 640x480 images over HTTP and keeps latency under 20ms.
 */
export function getOptimizedFrame(webcamRef) {
  if (!webcamRef || !webcamRef.current) return null;
  const video = webcamRef.current.video;
  if (!video || video.readyState < 2 || !video.videoWidth) {
    // Fallback to getScreenshot if video element not directly ready
    return webcamRef.current.getScreenshot ? webcamRef.current.getScreenshot() : null;
  }

  const targetWidth = 256;
  const targetHeight = Math.round(video.videoHeight * (targetWidth / video.videoWidth)) || 192;

  if (typeof document !== "undefined") {
    if (!_offscreenCanvas) {
      _offscreenCanvas = document.createElement("canvas");
    }
    _offscreenCanvas.width = targetWidth;
    _offscreenCanvas.height = targetHeight;
    const ctx = _offscreenCanvas.getContext("2d", { alpha: false, willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
      return _offscreenCanvas.toDataURL("image/jpeg", 0.55);
    }
  }

  return webcamRef.current.getScreenshot();
}

const WebcamFeed = memo(function WebcamFeed({
  webcamRef,
  isDetecting,
  lastPrediction,
  latencyMs,
}) {
  return (
    <div className="relative w-full max-w-lg mx-auto rounded-2xl overflow-hidden glass-panel border border-slate-700/60 shadow-2xl group">
      {/* Top Status Bar overlay */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/70 backdrop-blur-md border border-white/10 text-xs font-medium">
          <span
            className={`w-2 h-2 rounded-full ${
              isDetecting ? "bg-emerald-400 animate-ping" : "bg-amber-400"
            }`}
          />
          <span className={isDetecting ? "text-emerald-300" : "text-amber-300"}>
            {isDetecting ? "LIVE RECOGNITION" : "STANDBY"}
          </span>
        </div>

        {isDetecting && latencyMs !== null && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-950/70 backdrop-blur-md border border-white/10 text-[11px] text-slate-300 font-mono">
            <Zap className="w-3 h-3 text-sky-400" />
            <span>{latencyMs}ms</span>
          </div>
        )}
      </div>

      {/* Camera Viewport */}
      <div className="relative aspect-[4/3] w-full bg-slate-950 flex items-center justify-center overflow-hidden">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          screenshotQuality={0.55}
          videoConstraints={videoConstraints}
          mirrored={true}
          className="w-full h-full object-cover"
        />

        {/* Scan line overlay when detecting */}
        {isDetecting && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="w-full h-24 bg-gradient-to-b from-transparent via-sky-500/15 to-transparent animate-scan-line" />
            <div className="absolute inset-0 border border-sky-500/20 rounded-2xl pointer-events-none" />
          </div>
        )}

        {/* Live Detected Character floating pill */}
        <AnimatePresence>
          {isDetecting && lastPrediction && (
            <motion.div
              initial={{ scale: 0.7, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.7, opacity: 0 }}
              className="absolute bottom-4 right-4 z-20 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-950/80 backdrop-blur-md border border-sky-400/30 text-sky-200 shadow-lg font-mono text-sm"
            >
              <Eye className="w-4 h-4 text-sky-400" />
              <span>
                Detected: <strong className="text-white text-base">{lastPrediction}</strong>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

export default WebcamFeed;
