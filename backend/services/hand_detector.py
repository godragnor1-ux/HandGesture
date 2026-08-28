import os
import ssl
import urllib.request
import logging
import threading
from typing import Optional, List, Dict, Any
import cv2
import numpy as np
import mediapipe as mp

logger = logging.getLogger(__name__)

MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
DEFAULT_MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")
DEFAULT_MODEL_PATH = os.path.join(DEFAULT_MODEL_DIR, "hand_landmarker.task")


def ensure_model_exists(model_path: str = DEFAULT_MODEL_PATH) -> str:
    """Download hand_landmarker.task if not present locally."""
    if os.path.exists(model_path) and os.path.getsize(model_path) > 1000:
        return model_path

    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    logger.info("Downloading MediaPipe HandLandmarker model to %s...", model_path)
    
    # Use unverified context to prevent macOS SSL certificate validation issues
    ssl_context = ssl._create_unverified_context()
    with urllib.request.urlopen(MODEL_URL, context=ssl_context) as response, open(model_path, "wb") as out_file:
        out_file.write(response.read())

    logger.info("Model downloaded successfully (%d bytes).", os.path.getsize(model_path))
    return model_path


class HandDetector:
    """
    Singleton service for MediaPipe Hand Detection.
    Supports both modern MediaPipe Tasks Vision API (with hardware acceleration)
    and legacy MediaPipe Solutions API with seamless fallback.
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(HandDetector, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self, model_path: Optional[str] = None):
        if self._initialized:
            return

        with self._lock:
            if self._initialized:
                return

            self._mode = None
            self._detector = None
            self._init_detector(model_path or DEFAULT_MODEL_PATH)
            self._initialized = True

    def _init_detector(self, model_path: str):
        # 1. Try Modern MediaPipe Tasks API
        try:
            from mediapipe.tasks import python
            from mediapipe.tasks.python import vision

            model_file = ensure_model_exists(model_path)

            # Try GPU delegate first (required for macOS Apple Silicon), fallback to CPU
            try:
                base_options = python.BaseOptions(
                    model_asset_path=model_file,
                    delegate=python.BaseOptions.Delegate.GPU
                )
                options = vision.HandLandmarkerOptions(
                    base_options=base_options,
                    running_mode=vision.RunningMode.IMAGE,
                    num_hands=1
                )
                self._detector = vision.HandLandmarker.create_from_options(options)
                self._mode = "tasks_gpu"
                logger.info("MediaPipe Tasks HandLandmarker initialized with GPU delegate.")
                return
            except Exception as gpu_err:
                logger.warning("GPU delegate initialization failed (%s), attempting CPU delegate...", str(gpu_err))

            base_options = python.BaseOptions(
                model_asset_path=model_file,
                delegate=python.BaseOptions.Delegate.CPU
            )
            options = vision.HandLandmarkerOptions(
                base_options=base_options,
                running_mode=vision.RunningMode.IMAGE,
                num_hands=1
            )
            self._detector = vision.HandLandmarker.create_from_options(options)
            self._mode = "tasks_cpu"
            logger.info("MediaPipe Tasks HandLandmarker initialized with CPU delegate.")
            return

        except Exception as tasks_err:
            logger.warning("MediaPipe Tasks API unavailable (%s), trying solutions API...", str(tasks_err))

        # 2. Try Legacy MediaPipe Solutions API (if mediapipe < 1.0)
        try:
            if hasattr(mp, "solutions") and hasattr(mp.solutions, "hands"):
                self._detector = mp.solutions.hands.Hands(
                    static_image_mode=False,
                    max_num_hands=1,
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5
                )
                self._mode = "solutions"
                logger.info("Legacy MediaPipe Solutions Hands initialized.")
                return
        except Exception as sol_err:
            logger.exception("Failed to initialize any MediaPipe detector: %s", str(sol_err))

        raise RuntimeError("Could not initialize MediaPipe Hand Detection engine.")

    def detect_landmarks(self, image_bgr: np.ndarray) -> Optional[Dict[str, Any]]:
        """
        Detects 21 3D hand landmarks from OpenCV BGR image.

        Args:
            image_bgr (np.ndarray): OpenCV image in BGR format.

        Returns:
            Optional[Dict[str, Any]]: Structured landmarks data or None.
        """
        if image_bgr is None or self._detector is None:
            return None

        try:
            if self._mode in ("tasks_gpu", "tasks_cpu"):
                # GPU delegate requires RGBA format; CPU accepts RGB/RGBA
                if self._mode == "tasks_gpu":
                    img_conv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGBA)
                    mp_img = mp.Image(image_format=mp.ImageFormat.SRGBA, data=img_conv)
                else:
                    img_conv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
                    mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_conv)

                result = self._detector.detect(mp_img)

                if not result or not result.hand_landmarks or len(result.hand_landmarks) == 0:
                    return None

                landmarks_raw = result.hand_landmarks[0]
                landmarks_list: List[Dict[str, float]] = []
                flat_coords: List[float] = []

                for lm in landmarks_raw:
                    landmarks_list.append({
                        "x": float(lm.x),
                        "y": float(lm.y),
                        "z": float(lm.z)
                    })
                    flat_coords.extend([float(lm.x), float(lm.y), float(lm.z)])

                handedness = "Unknown"
                if result.handedness and len(result.handedness) > 0:
                    handedness = result.handedness[0][0].category_name

                return {
                    "landmarks": landmarks_list,
                    "flat_coords": flat_coords,
                    "handedness": handedness
                }

            elif self._mode == "solutions":
                image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
                image_rgb.flags.writeable = False
                result = self._detector.process(image_rgb)

                if not result or not result.multi_hand_landmarks:
                    return None

                landmarks_raw = result.multi_hand_landmarks[0]
                landmarks_list: List[Dict[str, float]] = []
                flat_coords: List[float] = []

                for lm in landmarks_raw.landmark:
                    landmarks_list.append({
                        "x": float(lm.x),
                        "y": float(lm.y),
                        "z": float(lm.z)
                    })
                    flat_coords.extend([float(lm.x), float(lm.y), float(lm.z)])

                handedness = "Unknown"
                if result.multi_handedness and len(result.multi_handedness) > 0:
                    handedness = result.multi_handedness[0].classification[0].label

                return {
                    "landmarks": landmarks_list,
                    "flat_coords": flat_coords,
                    "handedness": handedness
                }

        except Exception as e:
            logger.exception("Exception during hand landmark detection: %s", str(e))
            return None

        return None


def get_hand_detector() -> HandDetector:
    return HandDetector()
