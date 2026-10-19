"use client";

import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/wasm";

let landmarkerPromise = null;

// Singleton: GPU first, CPU fallback (some browsers / iGPUs reject the GPU delegate).
export function getHandLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      try {
        return await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });
      } catch (gpuErr) {
        console.warn("GPU delegate failed, falling back to CPU:", gpuErr);
        return await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });
      }
    })();
  }
  return landmarkerPromise;
}

// MediaPipe normalized landmarks -> 63-D wrist-translated, max-normalized
// feature vector. Matches backend preprocessing v1_translated_normalized_by_wrist_max:
// subtract wrist (landmark 0), divide by max absolute value. Returns null when
// the vector is degenerate.
export function landmarksToFeatures(landmarks) {
  const wrist = landmarks[0];
  const translated = [];
  for (const lm of landmarks) {
    translated.push(lm.x - wrist.x, lm.y - wrist.y, lm.z - wrist.z);
  }
  let maxAbs = 0;
  for (const v of translated) {
    const a = Math.abs(v);
    if (a > maxAbs) maxAbs = a;
  }
  if (maxAbs < 1e-6) return null;
  return translated.map((v) => v / maxAbs);
}

// Runs browser-side hand tracking on the live webcam frame and returns the
// 63-number feature vector for POST /api/predict, or null when no hand visible.
export async function getGestureFeatures(webcamRef) {
  if (!webcamRef || !webcamRef.current) return null;
  const video = webcamRef.current.video;
  if (!video || video.readyState < 2 || !video.videoWidth) return null;
  try {
    const landmarker = await getHandLandmarker();
    const result = landmarker.detectForVideo(video, performance.now());
    const landmarks = result && result.landmarks && result.landmarks[0];
    if (!landmarks || landmarks.length !== 21) return null;
    return landmarksToFeatures(landmarks);
  } catch (err) {
    console.error("Hand landmark detection error:", err);
    return null;
  }
}
