"""
FastAPI wrapper around sla_audit_engine.py
Exposes POST /audit so Laravel can call it via HTTP.

Run: uvicorn agno_api:app --host 0.0.0.0 --port 8001
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from sla_audit_engine import AuditRequest, AuditResult, SLAAuditEngine
from requirement_parser import RequirementParserAgent, RequirementStudioResponse

app = FastAPI(
    title="SLA Agno Audit Microservice",
    version="1.0.0",
    description="Semantic Drift Detection & Requirement Extraction API powered by Agno",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# Shared engine instances
_audit_engine = SLAAuditEngine()
_parser_agent = RequirementParserAgent()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "sla-agno-engine", "time": datetime.now(timezone.utc).isoformat()}


@app.post("/audit", response_model=AuditResult)
async def audit(request: AuditRequest) -> AuditResult:
    """
    Run a Semantic Drift Detection audit.
    Called by Laravel's AgnoAuditBridgeService.
    """
    try:
        result = _audit_engine.audit(request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audit engine error: {str(e)}") from e


class ParseRequest(BaseModel):
    brd_text: str

@app.post("/parse-requirements", response_model=RequirementStudioResponse)
async def parse_requirements(request: ParseRequest) -> RequirementStudioResponse:
    """
    Parse raw BRD text into structured requirements.
    Called by Laravel's RequirementIngestionController.
    """
    try:
        result = _parser_agent.parse(request.brd_text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parser error: {str(e)}") from e
