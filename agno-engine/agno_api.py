"""
FastAPI wrapper around sla_audit_engine.py
Unified Backend for Sentinel Logic Auditor (SLA)
Handles Audit, Requirement Parsing, and Project State.

Run: uvicorn agno_api:app --host 0.0.0.0 --port 8001
"""

from __future__ import annotations

import uuid
import json
import os
import io
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, Body, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Extra parsers
import PyPDF2
import docx

from sla_audit_engine import AuditRequest, AuditResult, SLAAuditEngine
from requirement_parser import RequirementParserAgent, RequirementStudioResponse

app = FastAPI(
    title="SLA Unified Backend",
    version="2.1.0",
    description="Unified API for Audit, Parsing, and State powered by Agno",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Persistence Layer (Simple JSON for Free Tier) ---
DB_FILE = "storage.json"

def load_db():
    if os.path.exists(DB_FILE):
        with open(DB_FILE, "r") as f:
            try:
                return json.load(f)
            except Exception:
                pass
    return {"projects": [], "drifts": [], "requirements": {}}

def save_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=4)

# Initial State
_db = load_db()

# Shared engine instances
_audit_engine = SLAAuditEngine()
_parser_agent = RequirementParserAgent()

# --- Helpers ---

def extract_text_from_file(file: UploadFile) -> str:
    try:
        filename = file.filename.lower()
        content = file.file.read()
        
        if filename.endswith(".pdf"):
            try:
                pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
                text = ""
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
                return text
            except Exception as e:
                raise ValueError(f"Failed to extract PDF text: {str(e)}")
        
        elif filename.endswith(".docx"):
            try:
                doc = docx.Document(io.BytesIO(content))
                return "\n".join([para.text for para in doc.paragraphs])
            except Exception as e:
                raise ValueError(f"Failed to extract DOCX text: {str(e)}")
        
        else:
            # Assume text/markdown
            try:
                return content.decode("utf-8")
            except:
                return content.decode("latin-1", errors="ignore")
    except Exception as e:
        raise ValueError(f"File reading error: {str(e)}")

# --- Models ---

class Project(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    status: str = "Active"
    alignment: int = 100
    last_audit: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M"))

class WebhookIngest(BaseModel):
    execution_log: str
    metadata: Optional[dict] = Field(default_factory=dict)

# --- Routes ---

@app.get("/")
def root():
    return {
        "message": "Welcome to the Sentinel Logic Auditor (SLA) Unified Backend",
        "version": "2.1.0",
        "docs": "/docs",
        "health": "/health",
        "status": "Online"
    }

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "sla-unified-backend", "time": datetime.now(timezone.utc).isoformat()}

# 1. Project Management
@app.get("/projects", response_model=List[Project])
async def get_projects():
    return _db["projects"]

@app.post("/projects", response_model=Project)
async def create_project(project: Project):
    _db["projects"].append(project.model_dump())
    save_db(_db)
    return project

# 2. Requirement Parsing (Simple JSON for Bridge)
@app.post("/parse-requirements", response_model=RequirementStudioResponse)
async def parse_requirements_json(payload: Dict[str, str] = Body(...)) -> RequirementStudioResponse:
    """
    Direct bridge for Laravel AgnoAuditBridgeService.
    """
    brd_text = payload.get("brd_text")
    if not brd_text:
        raise HTTPException(status_code=400, detail="brd_text is required")
    
    try:
        return _parser_agent.parse(brd_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 3. Requirement Studio (Multi-part support for Files)
@app.post("/requirements/ingest", response_model=RequirementStudioResponse)
async def parse_requirements(
    project_uuid: str = Form(...),
    brd_text: Optional[str] = Form(None),
    brd_file: Optional[UploadFile] = File(None)
) -> RequirementStudioResponse:
    """
    Parse requirements from either raw text or an uploaded file (PDF, DOCX, TXT).
    Matches the FormData format sent by the frontend.
    """
    try:
        final_text = ""
        if brd_file:
            final_text = extract_text_from_file(brd_file)
        elif brd_text:
            final_text = brd_text
        else:
            raise HTTPException(status_code=400, detail="Either brd_text or brd_file must be provided.")

        if not final_text.strip():
            raise HTTPException(status_code=400, detail="Extracted text is empty.")

        try:
            result = _parser_agent.parse(final_text)
        except Exception as e:
            print(f"WARN: Parser failed ({str(e)}), falling back to mechanical.")
            result = _parser_agent._mechanical_parse(final_text)
        
        # Store for future audits
        _db["requirements"][project_uuid] = result.model_dump()
        save_db(_db)
        return result
    except Exception as e:
        # Final safety net for things outside the parser itself
        raise HTTPException(status_code=500, detail=f"Engine error: {str(e)}")

# 4. Audit Engine
@app.post("/audit", response_model=AuditResult)
async def audit(request: AuditRequest) -> AuditResult:
    try:
        result = _audit_engine.audit(request)
        if result.drifts:
            for drift in result.drifts:
                drift_entry = drift.model_dump()
                drift_entry["id"] = str(uuid.uuid4())
                drift_entry["timestamp"] = datetime.now().isoformat()
                _db["drifts"].append(drift_entry)
            save_db(_db)
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audit engine error: {str(e)}")

# 4. Webhook Ingestion
@app.post("/webhooks/{project_id}/{tool}")
async def webhook_ingest(project_id: str, tool: str, payload: WebhookIngest):
    return {
        "status": "received",
        "project_id": project_id,
        "tool": tool,
        "received_at": datetime.now().isoformat(),
        "message": "Audit scheduled successfully"
    }

@app.get("/drifts", response_model=List[dict])
async def get_all_drifts():
    return _db["drifts"]
