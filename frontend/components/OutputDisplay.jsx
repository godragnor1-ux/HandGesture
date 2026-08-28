"use client";

import React, { useState } from "react";
import { Copy, Check, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function OutputDisplay({ text, isDetecting, lastPrediction }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto glass-panel rounded-2xl p-5 border border-slate-700/50 shadow-2xl relative">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-700/40">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-sky-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Translated Text
          </h2>
        </div>

        {text && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Main output text area */}
      <div className="min-h-[90px] max-h-[160px] overflow-y-auto flex items-start">
        {text ? (
          <p className="text-xl sm:text-2xl font-medium tracking-wide text-slate-100 break-words leading-relaxed">
            {text}
            {isDetecting && (
              <span className="inline-block w-2 h-5 ml-1.5 bg-sky-400 animate-pulse-slow align-middle rounded-sm" />
            )}
          </p>
        ) : (
          <div className="flex items-center gap-2 text-slate-500 text-base italic py-4">
            <span>Start signing...</span>
            {isDetecting && (
              <span className="inline-block w-2 h-4 bg-slate-600 animate-pulse rounded-sm" />
            )}
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="mt-3 pt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>{text ? `${text.length} characters` : "Waiting for gesture input"}</span>
        {isDetecting && (
          <span className="text-emerald-400/80 font-mono">Sampling every 700ms</span>
        )}
      </div>
    </div>
  );
}
