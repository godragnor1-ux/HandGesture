import base64
import logging
from typing import Optional, Union, BinaryIO
import cv2
import numpy as np

logger = logging.getLogger(__name__)

# Optimal internal resolution for MediaPipe HandLandmarker (MediaPipe models natively use 224x224 / 256x256)
TARGET_WIDTH = 256


def decode_base64_fast(raw_b64: Union[str, bytes]) -> Optional[np.ndarray]:
    """
    High-performance base64 image decoder that minimizes memory allocations and string copies.
    """
    try:
        if isinstance(raw_b64, str):
            # Fast header strip without copying entire string
            comma_idx = raw_b64.find(",")
            if comma_idx != -1:
                raw_b64 = raw_b64[comma_idx + 1:]
            raw_bytes = base64.b64decode(raw_b64)
        elif isinstance(raw_b64, (bytes, bytearray)):
            comma_idx = raw_b64.find(b",")
            if comma_idx != -1:
                raw_b64 = raw_b64[comma_idx + 1:]
            raw_bytes = base64.b64decode(raw_b64)
        else:
            return None

        # Convert buffer directly to uint8 array and decode
        np_arr = np.frombuffer(raw_bytes, dtype=np.uint8)
        return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    except Exception as e:
        logger.debug("Fast base64 decoding error: %s", str(e))
        return None


def decode_image(file_source: Union[bytes, BinaryIO, any]) -> Optional[np.ndarray]:
    """
    Safely decode image from multipart file storage, raw bytes, or base64.
    """
    if file_source is None:
        return None

    try:
        if hasattr(file_source, "read"):
            file_bytes = file_source.read()
            if not file_bytes:
                return None
            np_arr = np.frombuffer(file_bytes, dtype=np.uint8)
            return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        elif isinstance(file_source, (bytes, bytearray)):
            # Check if this might be a raw base64 byte sequence
            if file_source.startswith(b"data:image") or b";base64," in file_source:
                return decode_base64_fast(file_source)
            np_arr = np.frombuffer(file_source, dtype=np.uint8)
            return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        elif isinstance(file_source, str):
            return decode_base64_fast(file_source)

        elif isinstance(file_source, np.ndarray):
            return file_source

        return None

    except Exception as e:
        logger.exception("Error decoding image: %s", str(e))
        return None


def resize_image(image: np.ndarray, target_width: int = TARGET_WIDTH) -> np.ndarray:
    """
    Resize image to target width (default 256px) for optimal MediaPipe latency.
    Zero-copy / no-op if image is already at or below target width.
    """
    if image is None:
        return None

    h, w = image.shape[:2]
    if w <= target_width:
        return image

    scale = target_width / float(w)
    target_height = int(h * scale)

    return cv2.resize(image, (target_width, target_height), interpolation=cv2.INTER_AREA)
