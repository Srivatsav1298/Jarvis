# 🦾 IronmanJARVIS AI Operating System

IronmanJARVIS is a premium, local-first AI Operating System and desktop/web assistant designed as a natural, seamless extension of a single user's productivity workflow. 

It combines natural conversation, low-latency voice interaction, deep long-term memory, and system automation into a beautiful, unified desktop experience.

---

## ✨ Key Features

- **🗣️ Low-Latency Voice Interface**: Wake word detection, Voice Activity Detection (VAD), Faster Whisper STT, and Docker-powered Kokoro TTS.
- **🧠 Multi-layered Memory**: Four-tier memory architecture (Working, Conversation, Long-term, and Knowledge Base) for deep contextual recall.
- **📰 Intelligence News Feed**: Real-time RSS-based aggregator prioritizing global Technology feeds (TechCrunch, Ars Technica, The Verge, HN), alongside World, Sports, Finance, Trending, and Latest news.
- **💼 Automated Job Scanner**: Daily 07:00 Oslo cron scraper targeting key roles (AI Engineer, Python/FastAPI, Data Engineer, SQL) across `finn.no` (via Jina Reader), `Jobbnorge`, and `LinkedIn` with automated AI relevance match scoring, salary insights, and visa sponsorship tags.
- **⚡ Realtime Synchronization**: Full-duplex WebSocket-based architecture for instant event handling and UI updates.
- **🧩 Extensible Capability Registry**: Modular service layer that allows safe execution of tasks (Reminders, Calendar, Email, automation) without giving LLMs direct access to the OS.
- **🎨 Premium Visual Dashboard**: Rich glassmorphic UI built with React, Tailwind CSS, Framer Motion, and interactive Orb visualizations.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 + Vite
- **Language**: TypeScript
- **State Management**: Zustand
- **Animations & Visuals**: Framer Motion, React Three Fiber (Orb Visualization)
- **Styling**: Tailwind CSS

### Backend
- **Framework**: FastAPI (Python 3.12+)
- **Database**: SQLite (via SQLAlchemy ORM & Alembic migrations)
- **Package Manager**: UV
- **AI & Voice Services**: OmniRouter, Kokoro TTS (local Docker engine), Faster Whisper, Silero VAD
- **Services & Scraping**: `feedparser` (RSS news aggregator), Jina Reader integration (for public job boards)

---

## 🚀 Quick Start

### 1. Prerequisites
- [Python 3.12+](https://www.python.org/downloads/)
- [Node.js 18+](https://nodejs.org/)
- [Docker](https://www.docker.com/) (required for Kokoro TTS engine)
- [UV](https://github.com/astral-sh/uv) (recommended Python package manager)

---

### 2. Running the Voice Container
Build and start the Kokoro TTS engine container:
```bash
docker compose up -d kokoro
```
*Note: First-time startup will take about 30 seconds to download the `Kokoro-82M` models.*

---

### 3. Backend Setup & Run
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   uv sync
   ```
3. Copy environment configuration and configure your API keys:
   ```bash
   cp .env.example .env
   ```
4. Run database migrations:
   ```bash
   uv run alembic upgrade head
   ```
5. Start the FastAPI development server:
   ```bash
   uv run uvicorn app.main:app --reload
   ```
The backend server runs on `http://localhost:8000`.

---

### 4. Frontend Setup & Run
1. From the project root, install Node dependencies:
   ```bash
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
The frontend application runs on `http://localhost:5173` (or `http://localhost:5174`).

---

## 📂 Project Structure

```
├── backend/                  # FastAPI Application
│   ├── app/
│   │   ├── api/              # REST Endpoints
│   │   ├── services/         # Business Logic Layer
│   │   ├── ai/               # AI & Voice Engine (Kokoro, Whisper)
│   │   ├── websocket/        # Realtime WebSocket Handlers
│   │   └── models/           # SQLAlchemy DB Models
│   └── tests/                # Pytest Suite
│
├── src/                      # React Frontend Application
│   ├── components/           # Reusable UI Primitives & Visual Orb
│   ├── features/             # Feature-specific Components & Hooks
│   ├── layouts/              # App Shell and Sidebar layouts
│   └── stores/               # Zustand Global State Stores
│
└── docker-compose.yml        # Docker configuration for offline assets
```

---

## 🧪 Testing

- **Backend tests**: `cd backend && uv run pytest`
- **Frontend tests**: `npm run test`
- **Lints & Typechecks**: `npm run lint && npm run typecheck`
