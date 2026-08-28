import time
import logging
from flask import Blueprint, request, jsonify
from utils.image_utils import decode_image, decode_base64_fast, resize_image
from services.hand_detector import get_hand_detector
from services.sign_classifier import get_sign_classifier

logger = logging.getLogger(__name__)

predict_bp = Blueprint("predict", __name__)

# Pre-cache singleton references at module level for zero lookup overhead
_detector = None
_classifier = None


def _get_services():
    global _detector, _classifier
    if _detector is None:
        _detector = get_hand_detector()
    if _classifier is None:
        _classifier = get_sign_classifier()
    return _detector, _classifier


@predict_bp.route("/predict", methods=["POST"])
def predict():
    """
    POST /predict
    Accepts image file via multipart/form-data (key: 'image') or JSON base64 string.
    Processes hand detection via MediaPipe and returns prediction.

    Response format:
    {
      "success": true,
      "prediction": "A",
      "detected": true/false
    }
    """
    start_time = time.perf_counter()

    # 1. Fast image payload extraction (supports multipart/form-data, JSON base64, form-data)
    image_bgr = None

    if "image" in request.files:
        # Multipart form-data upload
        image_bgr = decode_image(request.files["image"])
    elif request.is_json and request.json and "image" in request.json:
        # Base64 string from JSON
        image_bgr = decode_base64_fast(request.json["image"])
    elif "image" in request.form:
        # Base64 string from form body
        image_bgr = decode_base64_fast(request.form["image"])

    # 2. Validation: Ensure valid image was provided and decoded
    if image_bgr is None:
        logger.warning("Prediction rejected: No image provided or decoding failed.")
        return jsonify({
            "success": False,
            "error": "No image",
            "detected": False
        }), 400

    # 3. Fast resize: Maintain aspect ratio at optimal 256px resolution for low latency
    image_resized = resize_image(image_bgr, target_width=256)

    # 4. MediaPipe Hand Landmark Detection (Singleton instance reused across all requests)
    detector, classifier = _get_services()
    detection_result = detector.detect_landmarks(image_resized)

    # 5. Prediction
    detected = detection_result is not None

    if detected:
        classification = classifier.predict(detection_result)
        prediction = classification.get("prediction", "A")
        confidence = classification.get("confidence", 1.0)
        landmarks = detection_result.get("landmarks", [])
        handedness = detection_result.get("handedness", "Unknown")
    else:
        prediction = None
        confidence = 0.0
        landmarks = []
        handedness = None

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

    logger.info(
        "Inference completed in %sms | detected: %s | prediction: %s",
        elapsed_ms, detected, prediction
    )

    # 6. Response payload
    return jsonify({
        "success": True,
        "prediction": prediction,
        "detected": detected,
        "landmarks_detected": detected,
        "confidence": confidence,
        "handedness": handedness,
        "landmarks": landmarks,
        "latency_ms": elapsed_ms
    }), 200
