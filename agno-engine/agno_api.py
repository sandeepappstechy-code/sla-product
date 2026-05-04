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
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from sla_audit_engine import AuditRequest, AuditResult, SLAAuditEngine
from requirement_parser import RequirementParserAgent, RequirementStudioResponse

app = FastAPI(
    title="SLA Unified Backend",
    version="2.0.0",
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
            return json.load(f)
    return {"projects": [], "drifts": [], "requirements": {}}

def save_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=4)

# Initial State
_db = load_db()

# Shared engine instances
_audit_engine = SLAAuditEngine()
_parser_agent = RequirementParserAgent()

# --- Models ---

class Project(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    status: str = "Active"
    alignment: int = 100
    last_audit: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M"))

class WebhookIngest(BaseModel):
    execution_log: str
    metadata: Optional[dict] = {}

# --- Routes ---

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "sla-unified-backend", "time": datetime.now(timezone.utc).isoformat()}

# 1. Project Management
@app.get("/projects", response_model=List[Project])
async def get_projects():
    return _db["projects"]

@app.post("/projects", response_model=Project)
async def create_project(project: Project):
    _db["projects"].append(project.dict())
    save_db(_db)
    return project

# 2. Requirement Studio (Consolidated)
class ParseRequest(BaseModel):
    brd_text: str

@app.post("/requirements/ingest", response_model=RequirementStudioResponse)
async def parse_requirements(request: ParseRequest) -> RequirementStudioResponse:
    try:
        result = _parser_agent.parse(request.brd_text)
        # Store for future audits
        _db["requirements"][str(uuid.uuid4())] = result.dict()
        save_db(_db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parser error: {str(e)}")

# 3. Audit Engine
@app.post("/audit", response_model=AuditResult)
async def audit(request: AuditRequest) -> AuditResult:
    try:
        result = _audit_engine.audit(request)
        # Store drifts if any
        if result.drifts:
            for drift in result.drifts:
                drift_entry = drift.dict()
                drift_entry["id"] = str(uuid.uuid4())
                drift_entry["timestamp"] = datetime.now().isoformat()
                _db["drifts"].append(drift_entry)
            save_db(_db)
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audit engine error: {str(e)}")

# 4. Webhook Ingestion (Unified)
@app.post("/webhooks/{project_id}/{tool}")
async def webhook_ingest(project_id: str, tool: str, payload: WebhookIngest):
    # Simulate an audit immediately on webhook arrival
    # In a real app, this would be an async job
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
