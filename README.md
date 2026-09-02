# 🤟 Real-Time AI Sign Language Translator

A production-grade, low-latency full-stack AI web application for real-time American Sign Language (ASL) recognition and speech synthesis.

[![Frontend](https://img.shields.io/badge/Frontend-Vercel-black?style=flat-square&logo=vercel)](https://handgesture-frontend.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-Render-46E3B7?style=flat-square&logo=render)](https://handgesture-backend.onrender.com)
[![Next.js](https://img.shields.io/badge/Next.js-14_App_Router-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Flask](https://img.shields.io/badge/Flask-3.x-white?style=flat-square&logo=flask)](https://flask.palletsprojects.com/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Vision_AI-blue?style=flat-square&logo=google)](https://mediapipe.dev/)

---

## 🔗 Live Deployed Links

| Component | Service | Live URL |
| :--- | :--- | :--- |
| **Frontend Web App** | Vercel | [https://handgesture-frontend.vercel.app](https://handgesture-frontend.vercel.app) |
| **Backend API** | Render | [https://handgesture-backend.onrender.com](https://handgesture-backend.onrender.com) |
| **Health Check** | Render | [https://handgesture-backend.onrender.com/health](https://handgesture-backend.onrender.com/health) |

---

## ✨ Features

- **⚡ Low-Latency Vision Pipeline (<20ms response time)**:
  - Real-time 21 3D hand landmark detection via MediaPipe Tasks Vision API with GPU hardware acceleration.
  - Native 256px resolution matching internal neural network dimensions.
- **🔒 Zero-Lag Frontend Architecture**:
  - Request lock mutex preventing concurrent network calls.
  - Client-side offscreen canvas downsampling and JPEG compression reducing payloads from ~70KB to ~4KB.
  - Self-scheduling 700ms cadence with zero frame queuing.
- **🔊 Real-Time Speech Synthesis (TTS)**:
  - Converts recognized sign sequences into natural spoken voice using the Web Speech API (`SpeechSynthesisUtterance`).
- **🎨 Glassmorphic Dark UI**:
  - Built with Tailwind CSS and Framer Motion micro-interactions.
  - Live scanning feedback, real-time latency tracker, and one-click clipboard copying.

---

## 🏗️ Architecture

```
HandGesture/
├── backend/                  # Flask REST API & MediaPipe AI Engine
│   ├── app.py                # Server entry point, CORS, logging, singleton pre-warming
│   ├── routes/
│   │   └── predict.py        # POST /predict endpoint (multipart & base64)
│   ├── services/
│   │   ├── hand_detector.py  # Thread-safe Singleton MediaPipe detector
│   │   └── sign_classifier.py# Pluggable ML classifier module
│   ├── utils/
│   │   └── image_utils.py    # Fast base64 buffer decoding & aspect-ratio resizing
│   ├── requirements.txt      # Python dependencies
│   └── Procfile              # Gunicorn process config for Render
│
├── frontend/                 # Next.js 14 App Router
│   ├── app/
│   │   ├── globals.css       # Tailwind & glassmorphism theme
│   │   ├── layout.js         # SEO & Root Layout
│   │   └── page.js           # Frame extraction loop, request locks, Web Speech TTS
│   └── components/
│       ├── WebcamFeed.jsx    # React-Webcam feed with offscreen downsampler
│       ├── Controls.jsx      # Start, Stop, Clear, Speak buttons
│       └── OutputDisplay.jsx # Real-time text stream and copy action
└── render.yaml               # Render Cloud Blueprint
```

---

## 🚀 Getting Started Locally

### 1. Prerequisites
- Python 3.10+
- Node.js 18+

### 2. Backend Setup
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```
*Backend runs on `http://localhost:5000` (or `PORT=5050 python app.py` if port 5000 is occupied).*

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:3000`.*

---

## 📡 API Reference

### `POST /predict`
Accepts `multipart/form-data` with key `image` or JSON with `{ "image": "data:image/jpeg;base64,..." }`.

**Response:**
```json
{
  "success": true,
  "prediction": "A",
  "detected": true,
  "confidence": 0.95,
  "latency_ms": 4.24,
  "landmarks": [
    { "x": 0.521, "y": 0.742, "z": -0.012 }
  ]
}
```

### `GET /health`
**Response:**
```json
{
  "service": "Sign Language Translator API",
  "status": "healthy",
  "version": "1.0.0"
}
```

---

## 📄 License
MIT License. Created by [@godragnor1-ux](https://github.com/godragnor1-ux).
