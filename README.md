<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Groq_LPU-Llama_3.3_70B-FF6B35?style=for-the-badge" />
  <img src="https://img.shields.io/badge/scikit--learn-1.6-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white" />
</p>

<h1 align="center">🏥 MedSentinel</h1>

<p align="center">
  <b>AI-Powered Clinical Data Quality & Anomaly Detection Platform</b>
</p>  
A full-stack system that ingests patient vitals and lab results, detects statistical anomalies using machine learning, generates AI clinical explanations, and lets you query your data in plain English — built for healthcare data integrity.

[Quick Start](#-quick-start) •
[Features](#-features) •
[Architecture](#%EF%B8%8F-system-architecture) •
[Pipeline](#-detection-pipeline) •
[Project Structure](#-project-structure) •
[API Reference](#-api-reference) •
[Tech Stack](#-tech-stack) •
[Security](#-security-model) •
[Environment Variables](#-environment-variables)

---

## ✨ Features

| Category | Feature | Description |
| --- | --- | --- |
| 🔍 **Anomaly Detection** | Isolation Forest ML | Scans numeric clinical data for statistical outliers with a 0–100 threat score per record |
| 🧠 **AI Clinical Reasoning** | Groq LLM (Llama 3.3 70B) | Sends flagged vitals to an AI Chief Medical Officer for concise biological explanations |
| 💬 **Natural Language Query** | English → SQL | Ask plain-English questions about your patient database — the AI writes and executes the SQL |
| 📤 **CSV Upload & Analysis** | Pandas + ML Pipeline | Upload any clinical CSV and receive anomaly scores without touching the database |
| 🛡️ **HIPAA-Aware Vault** | SHA-256 Pseudonymisation | MRNs and identifiers are salted and hashed before storage — PII never reaches the LLM |
| 📊 **Clinical Dashboard** | Recharts + AG Grid | Visual threat charts, interactive data tables, and processing overlays |
| 📋 **Report Generation** | PDF + CSV Export | Export anomaly reports and cleaned datasets with one click |
| 🔒 **Security** | SQL Injection Protection | All natural language queries are sanitised; only `SELECT` statements are permitted |
| 🎬 **Cinematic UI** | Three.js + GSAP + Framer Motion | Scroll-driven animations, 3D visualisations, and smooth page transitions |

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Purpose |
| --- | --- | --- |
| **Python** | 3.11+ | Backend runtime |
| **Node.js** | 18+ | Frontend runtime |
| **npm** | 9+ | Package management |
| **PostgreSQL** | 15+ | Patient data storage |
| **Groq API Key** | — | LLM inference ([Get one free →](https://console.groq.com)) |

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/MedSentinel.git
cd MedSentinel
```

### 2. Backend Setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install all dependencies
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `.env` file inside the `backend/` directory:

```env
# ━━━ REQUIRED ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GROQ_API_KEY=gsk_your_key_here
DATABASE_URL=postgresql://user:password@localhost:5432/medsentinel

# ━━━ OPTIONAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Custom salt for HIPAA pseudonymisation (defaults to built-in dev salt)
# DS_PII_SALT=your_custom_salt

# CORS whitelist (defaults to localhost:3000)
# CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 4. Initialise the Database

```bash
# Create the schema and seed sample patient data
python create_db_script.py
python seed_db.py
```

### 5. Start the Backend

```bash
uvicorn main:app --reload
```

The API server starts at **http://localhost:8000**:

| URL | Description |
| --- | --- |
| `http://localhost:8000/` | Welcome message |
| `http://localhost:8000/api/health` | Database & Groq connectivity status |
| `http://localhost:8000/docs` | Interactive Swagger API documentation |

### 6. Frontend Setup

Open a **new terminal**:

```bash
cd frontend

# Install dependencies
npm install
```

### 7. Start the Frontend

```bash
npm run dev
```

The application opens at **http://localhost:3000**.

---

## 🏗️ System Architecture

MedSentinel uses a **decoupled client-server architecture** with a multi-engine backend:

```
┌─────────────────────────────────────────────────────┐
│         BROWSER  —  Next.js 16 + React 19           │
│  Landing │ Dashboard │ Upload │ Report │ Chat        │
└────────────────────┬────────────────────────────────┘
                     │  Axios REST
┌────────────────────▼────────────────────────────────┐
│           FastAPI Backend  (Python 3.11+)            │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │              Detection Engines               │   │
│  │  clinical_detection.py  │  medical_logic.py  │   │
│  │  nl_query.py            │  dataset_query.py  │   │
│  │  hipaa_vault.py                              │   │
│  └──────────────┬───────────────────────────────┘   │
│                 │                                    │
│        groq_client.py  (LLM wrapper + retry)        │
└────────┬────────┴───────────────────────────────────┘
         │                      │
┌────────▼────────┐    ┌────────▼────────────┐
│   PostgreSQL    │    │   Groq Cloud LPU    │
│ patients/vitals │    │  Llama 3.3 70B      │
│ labs tables     │    │  (AI explanations)  │
└─────────────────┘    └─────────────────────┘
```

---

## 🔄 Detection Pipeline

Every dataset — whether uploaded CSV or database pull — flows through the same 4-stage pipeline:

```
1. INGEST          2. ML DETECTION        3. AI REASONING        4. PERSIST / RETURN
  CSV Upload    →   Isolation Forest   →   Groq LLM explains  →   PostgreSQL / JSON
  DB Pull           Threat Score 0–100     flagged anomalies       API Response
                    Review Status
```

| Stage | Engine | What Happens |
| --- | --- | --- |
| **1. Ingest** | `main.py` | CSV parsed via Pandas / DB query via SQLAlchemy → DataFrame created |
| **2. ML Detection** | `clinical_detection.py` | Isolation Forest runs on numeric columns → `is_anomaly` bool + `threat_score` (0–100) + `review_status` assigned |
| **3. AI Reasoning** | `medical_logic.py` + `groq_client.py` | Top flagged rows sent to Groq as structured JSON → LLM returns `ai_reason` explaining the clinical concern |
| **4. Persist / Return** | `main.py` | Results written back to PostgreSQL (DB flow) or returned as JSON (CSV upload flow) |

---

## 📁 Project Structure

```
MedSentinel/
├── backend/
│   ├── main.py                  # FastAPI app, all route definitions, CORS setup
│   ├── database.py              # SQLAlchemy engine & session factory
│   ├── models.py                # ORM models: Patient, VitalSign, LabResult
│   ├── schemas.py               # Pydantic request / response schemas
│   ├── groq_client.py           # Centralised Groq LLM client with JSON mode
│   ├── utils.py                 # Logger setup and shared utilities
│   ├── create_db_script.py      # One-time database schema creation
│   ├── init_db.py               # Table initialisation helper
│   ├── seed_db.py               # Sample patient data seeder
│   ├── test_groq.py             # Groq connectivity smoke test
│   ├── requirements.txt         # Python dependencies
│   └── engines/
│       ├── __init__.py          # Re-exports all engine functions
│       ├── clinical_detection.py # Isolation Forest + threat scoring
│       ├── medical_logic.py     # Groq AI clinical explanation generator
│       ├── nl_query.py          # Natural language → SQL (PostgreSQL)
│       ├── dataset_query.py     # Natural language → Pandas (uploaded CSV)
│       └── hipaa_vault.py       # SHA-256 MRN/PII pseudonymisation
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Cinematic 3D landing page
│   │   ├── layout.tsx           # Root layout & global font setup
│   │   ├── globals.css          # Tailwind base + custom CSS variables
│   │   ├── dashboard/
│   │   │   └── page.tsx         # Main anomaly detection dashboard
│   │   ├── upload/
│   │   │   └── page.tsx         # CSV upload & live analysis page
│   │   └── report/
│   │       └── page.tsx         # Report viewer & export page
│   ├── components/
│   │   ├── ClinicalChat.tsx     # Natural language query chat interface
│   │   ├── ThreatChart.tsx      # Recharts threat score visualisation
│   │   ├── ProcessingOverlay.tsx # Full-screen processing animation
│   │   └── Navbar.tsx           # Navigation bar
│   ├── lib/
│   │   └── api.ts               # Axios API service layer
│   ├── types/
│   │   └── index.ts             # Shared TypeScript interfaces
│   ├── utils/
│   │   ├── csvExport.js         # Client-side CSV download utility
│   │   └── reportGenerator.js  # PDF report generation (jsPDF)
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   └── tailwind.config.ts
│
└── .gitignore
```

---

## 📡 API Reference

All endpoints served at `http://localhost:8000`. Interactive docs at `/docs`.

### Core Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Welcome message |
| `GET` | `/api/health` | Check database & Groq connectivity |
| `POST` | `/api/detect` | Run ML + AI pipeline on all vitals in the database |
| `POST` | `/api/upload-dataset` | Upload a CSV payload → get anomaly scores back immediately |

### Query Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/query` | Natural language → SQL query against PostgreSQL (`patients`, `vitals`, `labs`) |
| `POST` | `/api/query-dataset` | Natural language → Pandas query against an uploaded dataset |

### Request / Response Examples

**POST `/api/upload-dataset`**
```json
// Request
{
  "columns": ["heart_rate", "blood_pressure_sys", "temperature", "o2_saturation"],
  "rows": [[72, 120, 98.6, 98], [180, 210, 104.1, 85]]
}

// Response
{
  "status": "success",
  "total_records": 2,
  "anomalies_flagged": 1,
  "cleaned_data": [...]
}
```

**POST `/api/query`**
```json
// Request
{ "question": "Show me all patients with a threat score above 75" }

// Response
{
  "sql_executed": "SELECT * FROM vitals WHERE threat_score > 75",
  "row_count": 4,
  "data": [...]
}
```

---

## 🔧 Tech Stack

### Backend

| Package | Version | Purpose |
| --- | --- | --- |
| **FastAPI** | 0.115 | Async REST API framework with auto-generated Swagger docs |
| **SQLAlchemy** | 2.0 | ORM for PostgreSQL — models, sessions, migrations |
| **scikit-learn** | 1.6 | Isolation Forest anomaly detection |
| **Pandas** | 2.2 | DataFrame operations, CSV parsing, SQL result handling |
| **NumPy** | 2.2 | Threat score normalisation and array math |
| **Groq SDK** | 0.11 | LLM client for Llama 3.3 70B on Groq LPU hardware |
| **Polars** | 1.27 | High-performance DataFrame operations |
| **DuckDB** | 1.2 | In-process SQL for uploaded dataset queries |
| **psycopg2** | 2.9 | PostgreSQL driver |
| **SlowAPI** | 0.1.9 | Rate limiting middleware |
| **python-dotenv** | 1.1 | Environment variable management |

### Frontend

| Package | Version | Purpose |
| --- | --- | --- |
| **Next.js** | 16 | React framework with App Router |
| **React** | 19 | UI component library |
| **Three.js** | 0.184 | 3D particle background visualisations |
| **@react-three/fiber** | 9.6 | React renderer for Three.js |
| **GSAP** | 3.15 | Scroll-driven cinematic animations |
| **Framer Motion** | 12 | Page transitions & micro-animations |
| **Lenis** | 1.0 | Smooth scroll engine |
| **Recharts** | 3.8 | Threat score and anomaly charts |
| **AG Grid** | 35 | High-performance clinical data table |
| **PapaParse** | 5.5 | Client-side CSV parsing |
| **jsPDF** | 4.2 | PDF report generation |
| **Axios** | 1.16 | HTTP client |
| **Tailwind CSS** | 4 | Utility-first CSS framework |

---

## 🔐 Security Model

| Layer | Implementation |
| --- | --- |
| **HIPAA Pseudonymisation** | Patient MRNs are salted and hashed with SHA-256 before storage — raw identifiers never persist |
| **PII Vault** | `hipaa_vault.py` strips identifiers and detects SSN patterns before any data reaches the LLM |
| **SQL Injection Protection** | Natural language queries are validated; `DROP`, `DELETE`, `UPDATE`, `INSERT`, and `ALTER` are blocked before execution |
| **Read-Only Enforcement** | `/api/query` only permits `SELECT` statements — destructive mutations are rejected at the string level |
| **CORS Whitelist** | Configurable allowed origins; defaults to `localhost:3000` for local development |
| **Audit Logging** | Every detection run and query is logged via the structured logger for traceability |

> **HIPAA Note:** The salt used for pseudonymisation defaults to a development value. Set `DS_PII_SALT` to a strong, secret value in any environment handling real patient data.

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | ✅ **Yes** | — | Your Groq Cloud API key ([get one free](https://console.groq.com)) |
| `DATABASE_URL` | ✅ **Yes** | — | PostgreSQL connection string |
| `DS_PII_SALT` | No | Built-in dev salt | Cryptographic salt for SHA-256 MRN hashing |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Comma-separated allowed CORS origins |

---

## 🗒️ Usage Guide

1. **Open** the app at `http://localhost:3000`
2. **Navigate** to the Dashboard to run detection on seeded patient vitals
3. **Upload** your own CSV — any dataset with numeric columns will be scored automatically
4. **Review** anomaly flags with AI-generated clinical explanations and 0–100 threat scores
5. **Query** your data in plain English via the Clinical Chat (e.g. *"Show me all records flagged for review with O2 saturation below 90"*)
6. **Export** anomaly reports as PDF or download cleaned data as CSV

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📜 License

This project is for educational and portfolio purposes.

---

Built with ❤️ using **FastAPI**, **Next.js**, **Groq**, **scikit-learn**, and **Three.js**
