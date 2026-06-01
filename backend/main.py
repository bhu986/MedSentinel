import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import List, Any, Optional
import pandas as pd

# Import our custom modules
import database
import groq_client
import utils
from engines import clinical_detection, medical_logic, nl_query, dataset_query

# Load environment variables
load_dotenv()
logger = utils.setup_logger("main")

# Initialize FastAPI App
app = FastAPI(
    title="MedSentinel API",
    description="AI-Powered Clinical Data Quality & Anomaly Detection",
    version="2.0.0"
)

# Setup CORS (Allows your Next.js frontend to communicate with this backend securely)
origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
origins = [origin.strip() for origin in origins_raw.split(",") if origin.strip()]

# Bulletproof local development fallbacks
if "http://localhost:3000" not in origins:
    origins.append("http://localhost:3000")
if "http://127.0.0.1:3000" not in origins:
    origins.append("http://127.0.0.1:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows POST, GET, OPTIONS, PUT, DELETE
    allow_headers=["*"], # Allows all custom frontend headers
)

@app.get("/")
def read_root():
    return {"message": "Welcome to the MedSentinel Clinical API v2"}

@app.get("/api/health")
def health_check(db: Session = Depends(database.get_db)):
    health_status = {
        "status": "online",
        "database": "disconnected",
        "groq_ai": "disconnected"
    }
    try:
        db.execute(text("SELECT 1"))
        health_status["database"] = "connected"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")

    if groq_client.check_groq_connectivity():
        health_status["groq_ai"] = "connected"

    return health_status


# ─── Input Schemas ────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str

class DatasetUpload(BaseModel):
    columns: List[str]
    rows: List[List[Any]]

class DatasetQueryRequest(BaseModel):
    """
    Used by the new /api/query-dataset endpoint.
    Accepts both the natural language question AND the full
    uploaded dataset (columns + rows) so Groq can reason over it
    using Pandas instead of SQL.
    """
    question: str
    columns: List[str]
    rows: List[List[Any]]


# ─── Existing Routes ─────────────────────────────────────────────────────────

@app.post("/api/detect")
def run_full_detection_pipeline(db: Session = Depends(database.get_db)):
    """
    Pulls data from PostgreSQL, runs the ML anomaly detection,
    asks Groq for medical reasons, and saves the results back.
    """
    try:
        query = "SELECT * FROM vitals"
        df = pd.read_sql(query, db.get_bind())

        if df.empty:
            return {"message": "No vital signs found in database to analyze."}

        feature_cols = ['heart_rate', 'blood_pressure_sys', 'blood_pressure_dia', 'temperature', 'o2_saturation']
        df = clinical_detection.run_anomaly_detection(df, feature_cols)
        df = medical_logic.evaluate_clinical_anomalies(df)
        df.to_sql('vitals', con=db.get_bind(), if_exists='replace', index=False)

        return {
            "status": "success",
            "message": "Detection pipeline complete.",
            "total_records_scanned": len(df),
            "anomalies_flagged": int(len(df[df['is_anomaly'] == True]))
        }

    except Exception as e:
        logger.error(f"Detection pipeline failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/query")
def natural_language_query(request: QueryRequest):
    """
    Legacy endpoint: translates English → SQL and queries PostgreSQL.
    Only works for the built-in patients/vitals/labs tables.
    For uploaded datasets use /api/query-dataset instead.
    """
    logger.info(f"[Legacy SQL Query] {request.question}")
    result = nl_query.process_natural_query(request.question)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@app.post("/api/upload-dataset")
async def upload_dataset(payload: DatasetUpload):
    """
    Accepts an uploaded dataset from the frontend, runs the ML/AI pipeline,
    and returns anomaly-scored records.
    """
    try:
        df = pd.DataFrame(payload.rows, columns=payload.columns)
        numeric_cols = df.select_dtypes(include=['number']).columns.tolist()

        if not numeric_cols:
            raise HTTPException(
                status_code=400,
                detail="Dataset must contain at least one numeric column for anomaly detection."
            )

        df = clinical_detection.run_anomaly_detection(df, numeric_cols)
        df = medical_logic.evaluate_clinical_anomalies(df)

        anomalies_flagged = int(df['is_anomaly'].sum()) if 'is_anomaly' in df.columns else 0
        df = df.where(pd.notnull(df), None)
        cleaned_data = df.to_dict(orient="records")

        return {
            "status": "success",
            "total_records": len(df),
            "anomalies_flagged": anomalies_flagged,
            "cleaned_data": cleaned_data
        }

    except Exception as e:
        logger.error(f"Dataset Upload Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── NEW: Dataset Natural Language Query ─────────────────────────────────────

@app.post("/api/query-dataset")
async def query_uploaded_dataset(request: DatasetQueryRequest):
    """
    NEW ENDPOINT — Answers natural language questions about a user-uploaded
    dataset using Groq + Pandas (NOT SQL, NOT PostgreSQL).
    """
    logger.info(f"[Dataset NL Query] question='{request.question[:80]}...' "
                f"columns={request.columns} rows={len(request.rows)}")

    if not request.columns or not request.rows:
        raise HTTPException(
            status_code=400,
            detail="No dataset provided. Upload a dataset before querying."
        )

    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    result = dataset_query.process_dataset_query(
        question=request.question,
        columns=request.columns,
        rows=request.rows
    )

    # Surface errors cleanly to the frontend
    if "error" in result:
        logger.warning(f"Dataset query returned error: {result['error']}")
        raise HTTPException(status_code=422, detail={
            "error": result["error"],
            "code_executed": result.get("code_executed", ""),
        })

    return {
        "data":         result.get("data", []),
        "row_count":    result.get("row_count", 0),
        "code_executed": result.get("code_executed", ""),
        "sql_executed": f"[Pandas]\n{result.get('code_executed', '')}",  # reuse frontend key
    }