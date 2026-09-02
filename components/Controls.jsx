"use client";

import React from "react";
import { Play, Square, Trash2, Volume2, Loader2, Space } from "lucide-react";
import { motion } from "framer-motion";

export default function Controls({
  isDetecting,
  onStart,
  onStop,
  onClear,
  onSpeak,
  onAddSpace,
  hasText,
  isSpeaking,
}) {
  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-2.5">
      {/* Primary Action Buttons Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* 1. Start Detection */}
        <motion.button
          type="button"
          onClick={onStart}
          disabled={isDetecting}
          whileHover={!isDetecting ? { scale: 1.02 } : {}}
          whileTap={!isDetecting ? { scale: 0.98 } : {}}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-medium text-sm transition-all duration-200 shadow-lg ${
            isDetecting
              ? "bg-slate-800/40 text-slate-500 border border-slate-700/30 cursor-not-allowed"
              : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-950/40 border border-emerald-400/40 active:shadow-none"
          }`}
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Start</span>
        </motion.button>

        {/* 2. Stop Detection */}
        <motion.button
          type="button"
          onClick={onStop}
          disabled={!isDetecting}
          whileHover={isDetecting ? { scale: 1.02 } : {}}
          whileTap={isDetecting ? { scale: 0.98 } : {}}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-medium text-sm transition-all duration-200 shadow-lg ${
            !isDetecting
              ? "bg-slate-800/40 text-slate-500 border border-slate-700/30 cursor-not-allowed"
              : "bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-rose-950/40 border border-rose-400/40 active:shadow-none"
          }`}
        >
          <Square className="w-4 h-4 fill-current" />
          <span>Stop</span>
        </motion.button>

        {/* 3. Speak Text (TTS) */}
        <motion.button
          type="button"
          onClick={onSpeak}
          disabled={!hasText || isSpeaking}
          whileHover={hasText && !isSpeaking ? { scale: 1.02 } : {}}
          whileTap={hasText && !isSpeaking ? { scale: 0.98 } : {}}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-medium text-sm transition-all duration-200 shadow-lg ${
            !hasText || isSpeaking
              ? "bg-slate-800/40 text-slate-500 border border-slate-700/30 cursor-not-allowed"
              : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-violet-950/40 border border-violet-400/40"
          }`}
        >
          {isSpeaking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Speaking</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4" />
              <span>Speak</span>
            </>
          )}
        </motion.button>

        {/* 4. Clear Text */}
        <motion.button
          type="button"
          onClick={onClear}
          disabled={!hasText}
          whileHover={hasText ? { scale: 1.02 } : {}}
          whileTap={hasText ? { scale: 0.98 } : {}}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-medium text-sm transition-all duration-200 shadow-lg ${
            !hasText
              ? "bg-slate-800/40 text-slate-500 border border-slate-700/30 cursor-not-allowed"
              : "bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600/50"
          }`}
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear</span>
        </motion.button>
      </div>

      {/* Quick Space helper */}
      {hasText && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onAddSpace}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          >
            <Space className="w-3.5 h-3.5" />
            <span>Add Space</span>
          </button>
        </div>
      )}
    </div>
  );
}
