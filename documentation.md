# Sentinel Logic Auditor (SLA) — Documentation

## Project Overview
The Sentinel Logic Auditor is an enterprise-grade platform designed to audit AI Agent logic (n8n, Agno, Zapier) against Business Requirement Documents (BRDs). It uses "Semantic Drift Detection" to ensure that AI agents adhere to mandatory business steps and security constraints.

## Technical Stack
- **Backend**: PHP 8.3 / Laravel 11 (API-first)
- **AI Orchestration**: Agno (formerly Phi-Framework)
- **Database**: PostgreSQL / MySQL with JSON graph support
- **Frontend**: Vanilla JS, CSS3, HTML5
- **Design System**: Responsive "Glassmorphism" UI with Dark & Light theme support
- **Reporting**: Marp-compatible Markdown for high-fidelity decks

## Key Features & Recent Updates

### 🌓 Multi-Theme Architecture
- **Dual Aesthetic**: Fully supports **Dark Enterprise** and **Professional Light** modes.
- **Persistence**: Theme preferences are saved to `localStorage` and persist across sessions.
- **Smooth Transitions**: Implemented CSS-based theme transitions for a seamless visual experience.

### 📱 Full Mobile Responsiveness
- **Adaptive Layouts**: All core views (Dashboard, Analytics, Studio) stack vertically on small viewports.
- **Mobile Header**: Fixed top header with a hamburger menu and a semi-transparent backdrop for the sidebar.
- **Responsive Data Tables**: Horizontal scrolling and dynamic column sizing for data-heavy views.

### ⚙️ Persistent Configuration
- **Advanced Settings**: Customize Audit Thresholds (Minimum Alignment, Similarity Alerts) and Notification Channels (Slack/Teams).
- **State Preservation**: All settings are saved in real-time to the browser's local storage.

### 🧪 Intelligent Audit Simulation
- **Event Generation**: The "Run Audit" engine now dynamically generates realistic drift events.
- **Real-time Feedback**: Detected violations are instantly injected into the Live Audit Feed with AI-driven remediation hints.

## Core Modules

### 1. Requirement Studio
- **Ingestion**: Supports PDF, DOCX, Markdown, and TXT files.
- **AI Parsing**: Uses the Agno `RequirementParserAgent` to extract structured JSON requirements.
- **Mapping**: Allows Business Analysts to activate, ignore, or edit requirements before locking them for audit.

### 2. Logic Map
- Visualizes the "Source of Truth" (BRD) vs "Actual Execution" (Agent Logs).
- Highlights matched, skipped, and violated steps using semantic similarity scoring.

### 3. Drift Alerts & Remediation
- **Detection**: Flags skipped steps, wrong ordering, and constraint violations.
- **Self-Healing**: Generates automated fix artifacts:
    - **n8n Nodes**: Ready-to-paste JSON configurations.
    - **Agno Patches**: Python decorators and tool overrides.
    - **PR Descriptions**: Standardized documentation for developers.

### 4. Historical Analytics
- **Trends**: Tracks project alignment scores over a 30-day window.
- **Breakdown**: Visualizes drift types to identify systemic logic failures.
- **Sparklines**: Real-time performance indicators per project.

## Installation & Setup

### Backend (Laravel)
1. Navigate to `/backend`.
2. Run `composer install`.
3. Configure `.env` with DB credentials and `AGNO_SERVICE_URL`.
4. Run migrations: `php artisan migrate`.

### Agno Engine (Python)
1. Navigate to `/agno-engine`.
2. Create a virtual environment: `python -m venv venv`.
3. Install dependencies: `pip install -r requirements.txt`.
4. Run server: `python main.py` (Default: port 8001).

### Frontend
1. Serve the `/frontend` directory via any web server (e.g., Live Server, Nginx, or Python's `http.server`).
2. The application will automatically connect to the backend APIs defined in `app.js`.
