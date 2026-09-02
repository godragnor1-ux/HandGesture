"use client";

import React, { useState } from "react";
import { Copy, Check, MessageSquareText, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function OutputDisplay({ text, isDetecting }) {
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

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="w-full max-w-lg mx-auto glass-card rounded-3xl p-5 border border-slate-700/60 shadow-2xl relative transition-all duration-300">
      <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <MessageSquareText className="w-4 h-4 text-sky-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Real-Time Translation
          </h2>
        </div>

        {text && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/70 shadow-sm transition-all"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </motion.button>
        )}
      </div>

      <div className="min-h-[100px] max-h-[180px] overflow-y-auto flex items-start px-1 py-1">
        {text ? (
          <p className="text-xl sm:text-2xl font-medium tracking-wide text-slate-100 break-words leading-relaxed font-sans">
            {text}
            {isDetecting && (
              <span className="inline-block w-2.5 h-5 ml-1.5 bg-sky-400 animate-pulse align-middle rounded-sm shadow-[0_0_8px_#38bdf8]" />
            )}
          </p>
        ) : (
          <div className="flex items-center gap-2 text-slate-500 text-base italic py-4">
            <Sparkles className="w-4 h-4 text-slate-600 animate-pulse" />
            <span>Start signing...</span>
            {isDetecting && (
              <span className="inline-block w-2 h-4 bg-slate-600 animate-pulse rounded-sm" />
            )}
          </div>
        )}
      </div>

      <div className="mt-3.5 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <span>
          {text ? `${text.length} chars • ${wordCount} ${wordCount === 1 ? "word" : "words"}` : "Waiting for gesture input"}
        </span>
        {isDetecting && (
          <span className="text-emerald-400/90 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            700ms stream
          </span>
        )}
      </div>
    </div>
  );
}
