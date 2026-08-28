import io
import os
import sys
import unittest
import numpy as np
import cv2

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from utils.image_utils import decode_image, resize_image


class TestSignLanguageAPI(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.client = self.app.test_client()
        self.app.testing = True

    def test_health_check(self):
        """Test /health endpoint returns 200 and healthy status."""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data.get("status"), "healthy")

    def test_predict_no_image(self):
        """Test /predict returns 400 when no image is supplied."""
        response = self.client.post("/predict")
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertFalse(data.get("success"))
        self.assertIn("error", data)

    def test_predict_with_synthetic_image(self):
        """Test /predict returns 200 with synthetic image upload."""
        # Create a synthetic 640x480 RGB image
        img = np.zeros((480, 640, 3), dtype=np.uint8)
        # Draw a synthetic circle / shape
        cv2.circle(img, (320, 240), 100, (255, 255, 255), -1)
        
        # Encode as JPEG
        _, img_encoded = cv2.imencode(".jpg", img)
        img_bytes = io.BytesIO(img_encoded.tobytes())

        data = {
            "image": (img_bytes, "test_hand.jpg")
        }

        response = self.client.post(
            "/predict",
            data=data,
            content_type="multipart/form-data"
        )
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertTrue(json_data.get("success"))
        self.assertIn("landmarks_detected", json_data)
        self.assertIn("latency_ms", json_data)

    def test_image_utils_resize(self):
        """Test image resizing utility."""
        img = np.zeros((720, 1280, 3), dtype=np.uint8)
        resized = resize_image(img, target_width=320)
        self.assertEqual(resized.shape[1], 320)
        self.assertEqual(resized.shape[0], int(720 * (320 / 1280)))


if __name__ == "__main__":
    unittest.main()
