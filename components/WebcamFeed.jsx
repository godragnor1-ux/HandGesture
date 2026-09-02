"use client";

import React, { memo } from "react";
import Webcam from "react-webcam";
import { Zap, Camera, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const videoConstraints = {
  width: 640,
  height: 480,
  facingMode: "user",
};

let _offscreenCanvas = null;

/**
 * Extracts a lightweight, downsampled 256px JPEG (~4KB) from the active webcam stream.
 * Executes on an offscreen canvas to avoid blocking the main rendering thread.
 */
export function getOptimizedFrame(webcamRef) {
  if (!webcamRef || !webcamRef.current) return null;
  const video = webcamRef.current.video;
  if (!video || video.readyState < 2 || !video.videoWidth) {
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
  confidence,
}) {
  return (
    <div className="relative w-full max-w-lg mx-auto rounded-3xl overflow-hidden glass-card border border-slate-700/60 shadow-2xl group transition-all duration-300">
      {/* Top Status HUD Header */}
      <div className="absolute top-3.5 left-3.5 right-3.5 z-20 flex items-center justify-between pointer-events-none">
        {/* Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/10 text-xs font-medium tracking-wide">
          <span
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              isDetecting ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" : "bg-amber-400"
            }`}
          />
          <span className={isDetecting ? "text-emerald-300" : "text-amber-300"}>
            {isDetecting ? "LIVE RECOGNITION" : "STANDBY"}
          </span>
        </div>

        {/* Real-time Latency Badge */}
        {isDetecting && latencyMs !== null && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/10 text-[11px] text-slate-300 font-mono">
            <Zap className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
            <span>{latencyMs}ms</span>
          </div>
        )}
      </div>

      {/* Video Viewport Container */}
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

        {/* HUD Targeting Corner Brackets */}
        <div className="absolute inset-4 pointer-events-none border border-white/5 rounded-2xl">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-sky-400/60 rounded-tl-lg" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-sky-400/60 rounded-tr-lg" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-sky-400/60 rounded-bl-lg" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-sky-400/60 rounded-br-lg" />
        </div>

        {/* Active Laser Scan Line */}
        {isDetecting && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="w-full h-20 bg-gradient-to-b from-transparent via-sky-400/20 to-transparent animate-scan" />
          </div>
        )}

        {/* Live Detected Character floating pill */}
        <AnimatePresence>
          {isDetecting && lastPrediction && (
            <motion.div
              initial={{ scale: 0.6, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.6, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="absolute bottom-4 right-4 z-20 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-sky-400/40 text-sky-100 shadow-[0_10px_30px_rgba(0,0,0,0.8)] font-mono text-sm"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>
                Sign: <strong className="text-white text-lg font-bold ml-1">{lastPrediction}</strong>
              </span>
              {confidence && (
                <span className="text-xs text-sky-300/70 border-l border-white/10 pl-2">
                  {Math.round(confidence * 100)}%
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

export default WebcamFeed;
