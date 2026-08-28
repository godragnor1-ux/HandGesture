import os
import sys
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS

# Add backend root to Python path for seamless imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from routes.predict import predict_bp
from services.hand_detector import get_hand_detector
from services.sign_classifier import get_sign_classifier

# Configure Structured Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("SignLanguageBackend")


def create_app() -> Flask:
    """Application factory for the Flask Sign Language Translator."""
    app = Flask(__name__)

    # Enable CORS for all routes (allows real-time frontend streaming)
    CORS(app, resources={r"/*": {"origins": "*"}})

    # Register Blueprint (accessible directly at /predict and at /api/predict)
    app.register_blueprint(predict_bp)
    app.register_blueprint(predict_bp, name="predict_api", url_prefix="/api")

    # Request logger
    @app.before_request
    def log_incoming_request():
        logger.info("Incoming %s request to %s from %s", request.method, request.path, request.remote_addr)

    # Health Check Endpoint
    @app.route("/health", methods=["GET"])
    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "healthy",
            "service": "Sign Language Translator API",
            "version": "1.0.0"
        }), 200

    # Global Error Handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"success": False, "error": "Endpoint not found"}), 404

    @app.errorhandler(500)
    def internal_error(error):
        logger.exception("Internal server error: %s", str(error))
        return jsonify({"success": False, "error": "Internal server error"}), 500

    # Pre-warm singleton services on startup for zero first-request latency
    with app.app_context():
        logger.info("Pre-warming HandDetector and SignClassifier singletons...")
        get_hand_detector()
        get_sign_classifier()
        logger.info("Singletons initialized.")

    return app


# Create app instance
app = create_app()

if __name__ == "__main__":
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() in ("true", "1", "yes")

    print("\n=======================================================")
    print(f"🚀 Sign Language Translator Backend Server Running!")
    print(f"📡 Host: {host} | Port: {port}")
    print(f"🔗 Health: http://localhost:{port}/health")
    print(f"🎯 Predict: http://localhost:{port}/predict")
    print("=======================================================\n")

    app.run(host=host, port=port, debug=debug)
