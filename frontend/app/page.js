"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Hand } from "lucide-react";
import WebcamFeed, { getOptimizedFrame } from "@/components/WebcamFeed";
import Controls from "@/components/Controls";
import OutputDisplay from "@/components/OutputDisplay";

// API endpoints with automatic fallback
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/predict";
const API_FALLBACK_URL = "http://localhost:5050/predict";

// Precise interval between inference requests
const INFERENCE_INTERVAL_MS = 700;
// Request timeout guard (aborts in-flight request if backend exceeds 1200ms)
const REQUEST_TIMEOUT_MS = 1200;

export default function Home() {
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedText, setDetectedText] = useState("");
  const [lastPrediction, setLastPrediction] = useState(null);
  const [latencyMs, setLatencyMs] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Performance & Concurrency Refs
  const webcamRef = useRef(null);
  const requestLockRef = useRef(false); // Strict request lock ensuring ONE request at a time
  const loopTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const lastCharRef = useRef(null);
  const consecutiveCountRef = useRef(0);

  // Send a single frame with strict locking and timeout guard
  const executeSingleInference = useCallback(async () => {
    // 1. Request Lock Guard: Drop cycle immediately if another request is in flight
    if (requestLockRef.current) return;
    if (!webcamRef.current) return;

    // 2. Extract downscaled & compressed frame (~4-6KB)
    const imageSrc = getOptimizedFrame(webcamRef);
    if (!imageSrc) return;

    // 3. Acquire Lock
    requestLockRef.current = true;
    setIsProcessing(true);

    // Create abort controller for network timeout
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

    try {
      let response;
      const requestPayload = JSON.stringify({ image: imageSrc });

      try {
        response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestPayload,
          signal: abortController.signal,
        });
      } catch (primaryErr) {
        if (abortController.signal.aborted) throw primaryErr;
        // Fallback to secondary port if port 5000 was busy
        response = await fetch(API_FALLBACK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestPayload,
          signal: abortController.signal,
        });
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error("Predict endpoint returned status:", response.status);
        return;
      }

      const data = await response.json();

      if (!isMountedRef.current) return;

      if (data.success && data.landmarks_detected && data.prediction) {
        const char = data.prediction;
        setLastPrediction(char);
        if (data.latency_ms !== undefined) setLatencyMs(data.latency_ms);

        // Smart text accumulation: 3 consecutive detections (~2.1s hold) appends repeat char
        if (char === lastCharRef.current) {
          consecutiveCountRef.current += 1;
          if (consecutiveCountRef.current === 3) {
            setDetectedText((prev) => prev + char);
            consecutiveCountRef.current = 0;
          }
        } else {
          lastCharRef.current = char;
          consecutiveCountRef.current = 1;
          setDetectedText((prev) => prev + char);
        }
      } else if (!data.landmarks_detected) {
        lastCharRef.current = null;
        consecutiveCountRef.current = 0;
        setLastPrediction(null);
        if (data.latency_ms !== undefined) setLatencyMs(data.latency_ms);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Prediction request error:", err);
      }
    } finally {
      clearTimeout(timeoutId);
      abortControllerRef.current = null;
      // 4. Release Lock
      requestLockRef.current = false;
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, []);

  // Self-scheduling loop: guarantees exactly 700ms gap and ZERO overlapping requests
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
      // Immediate first frame capture, then schedule chained ticks
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

  // Handlers
  const handleStart = () => setIsDetecting(true);
  const handleStop = () => setIsDetecting(false);
  const handleClear = () => {
    setDetectedText("");
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
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-xl flex flex-col items-center space-y-5">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-1.5"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-sky-400 text-xs font-semibold tracking-wider uppercase shadow-inner">
            <Hand className="w-3.5 h-3.5" />
            <span>AI Sign Recognition</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Sign Language Translator
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
            Real-time hand gesture detection with low-latency MediaPipe vision
          </p>
        </motion.header>

        {/* 1. Webcam Viewport */}
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
            latencyMs={latencyMs}
          />
        </motion.section>

        {/* 2. Controls */}
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
            hasText={detectedText.length > 0}
            isSpeaking={isSpeaking}
          />
        </motion.section>

        {/* 3. Output Display */}
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
