"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Hand, Sparkles, Activity } from "lucide-react";
import WebcamFeed from "@/components/WebcamFeed";
import { getGestureFeatures } from "@/components/handLandmarker";
import Controls from "@/components/Controls";
import OutputDisplay from "@/components/OutputDisplay";

// API base (override with NEXT_PUBLIC_API_URL on Vercel).
// Live backend is FastAPI: POST {features:[63 numbers]} to /api/predict
// -> {gesture, confidence, hand_detected}.
const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "https://handgesture-backend.onrender.com"
).replace(/\/$/, "");
const PREDICT_URL = API_BASE.endsWith("/predict")
  ? API_BASE.replace(/\/predict$/, "/api/predict")
  : `${API_BASE}/api/predict`;

const INFERENCE_INTERVAL_MS = 700;
// Generous timeout: Render free tier cold-starts can take 20s+ on first hit.
const REQUEST_TIMEOUT_MS = 30000;

export default function Home() {
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedText, setDetectedText] = useState("");
  const [lastPrediction, setLastPrediction] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [latencyMs, setLatencyMs] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Performance & Concurrency Refs
  const webcamRef = useRef(null);
  const requestLockRef = useRef(false);
  const loopTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const lastCharRef = useRef(null);
  const consecutiveCountRef = useRef(0);

  // High-performance single inference call
  const executeSingleInference = useCallback(async () => {
    // Drop cycle immediately if another request is currently in-flight
    if (requestLockRef.current) return;
    if (!webcamRef.current) return;

    // Browser-side MediaPipe: video frame -> 21 landmarks -> 63-D features.
    // Null = no hand in frame (skip the API call, clear prediction below).
    const features = await getGestureFeatures(webcamRef);

    // Acquire request lock
    requestLockRef.current = true;
    setIsProcessing(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

    try {
      if (!features) {
        lastCharRef.current = null;
        consecutiveCountRef.current = 0;
        setLastPrediction(null);
        setConfidence(null);
        return;
      }

      const fetchStartedAt = performance.now();
      const response = await fetch(PREDICT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features }),
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error("Predict endpoint returned status:", response.status);
        return;
      }

      const data = await response.json();

      if (!isMountedRef.current) return;

      // Client-measured round-trip keeps the latency badge live
      // (FastAPI backend does not return server-side latency).
      setLatencyMs(Math.round(performance.now() - fetchStartedAt));

      if (data.hand_detected && data.gesture) {
        const label = data.gesture;
        setLastPrediction(label);
        if (data.confidence !== undefined) setConfidence(data.confidence);

        // Word-level accumulation: append only on gesture change,
        // so holding a pose never spams duplicates.
        if (label !== lastCharRef.current) {
          lastCharRef.current = label;
          setDetectedText((prev) => (prev ? `${prev} ${label}` : label));
        }
        consecutiveCountRef.current = 0;
      } else {
        lastCharRef.current = null;
        consecutiveCountRef.current = 0;
        setLastPrediction(null);
        setConfidence(null);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Prediction request error:", err);
      }
    } finally {
      clearTimeout(timeoutId);
      abortControllerRef.current = null;
      requestLockRef.current = false;
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, []);

  // Self-scheduling loop ensuring exact 700ms cadence with ZERO overlapping calls
  useEffect(() => {
    isMountedRef.current = true;
    let isRunning = isDetecting;

    const scheduleNextTick = () => {
      if (!isRunning) return;
      loopTimeoutRef.current = setTimeout(async () => {
        if (!isRunning) return;
        await executeSingleInference();
        if (isRunning) {
          scheduleNextTick();
        }
      }, INFERENCE_INTERVAL_MS);
    };

    if (isDetecting) {
      executeSingleInference().then(() => {
        if (isRunning) scheduleNextTick();
      });
    } else {
      if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
        loopTimeoutRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      requestLockRef.current = false;
      setIsProcessing(false);
      setLastPrediction(null);
      setConfidence(null);
    }

    return () => {
      isRunning = false;
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [isDetecting, executeSingleInference]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Action Handlers
  const handleStart = () => setIsDetecting(true);
  const handleStop = () => setIsDetecting(false);
  
  const handleClear = () => {
    setDetectedText("");
    lastCharRef.current = null;
    consecutiveCountRef.current = 0;
  };

  const handleAddSpace = () => {
    setDetectedText((prev) => (prev.endsWith(" ") ? prev : prev + " "));
    lastCharRef.current = null;
    consecutiveCountRef.current = 0;
  };

  const handleSpeak = () => {
    if (!detectedText || !("speechSynthesis" in window)) {
      console.error("Speech Synthesis unavailable or text is empty");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(detectedText);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      console.error("SpeechSynthesis error:", e);
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative">
      {/* Background ambient radial lighting */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[450px] h-[450px] bg-violet-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-xl flex flex-col items-center space-y-4 sm:space-y-5">
        {/* Header Title Section */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-2"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/60 text-sky-400 text-xs font-semibold tracking-wider uppercase shadow-inner">
            <Hand className="w-3.5 h-3.5" />
            <span>AI Sign Recognition</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Sign Language Translator
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            Real-time hand gesture translation powered by MediaPipe AI & Neural Speech
          </p>
        </motion.header>

        {/* 1. Webcam Video Viewport */}
        <motion.section
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-full"
        >
          <WebcamFeed
            webcamRef={webcamRef}
            isDetecting={isDetecting}
            isProcessing={isProcessing}
            lastPrediction={lastPrediction}
            confidence={confidence}
            latencyMs={latencyMs}
          />
        </motion.section>

        {/* 2. Control Buttons */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="w-full"
        >
          <Controls
            isDetecting={isDetecting}
            onStart={handleStart}
            onStop={handleStop}
            onClear={handleClear}
            onSpeak={handleSpeak}
            onAddSpace={handleAddSpace}
            hasText={detectedText.length > 0}
            isSpeaking={isSpeaking}
          />
        </motion.section>

        {/* 3. Output Display Area */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="w-full"
        >
          <OutputDisplay
            text={detectedText}
            isDetecting={isDetecting}
          />
        </motion.section>
      </div>
    </main>
  );
}
