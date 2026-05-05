"""
Sentinel Logic Auditor — Agno Audit Engine
==========================================
Performs Semantic Drift Detection between BRD requirements and AI agent execution paths.

Requirements:
    pip install agno openai python-dotenv pydantic

Usage:
    from sla_audit_engine import SLAAuditEngine, AuditRequest
    result = await SLAAuditEngine().audit(request)
"""

from __future__ import annotations

import json
import os
import textwrap
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from agno.agent import Agent
from agno.models.google import Gemini
from agno.tools import tool
from dotenv import load_dotenv
from pydantic import BaseModel, Field, field_validator

load_dotenv()

# ──────────────────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────────────────


class DriftType(str, Enum):
    SKIPPED_STEP = "skipped_step"
    WRONG_ORDER = "wrong_order"
    CONSTRAINT_VIOLATED = "constraint_violated"
    INCOMPLETE_EXECUTION = "incomplete_execution"
    UNEXPECTED_BRANCH = "unexpected_branch"
    DATA_INTEGRITY_FAIL = "data_integrity_fail"


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class DriftItem(BaseModel):
    drift_type: DriftType
    severity: Severity
    brd_expectation: str = Field(..., description="What the BRD required at this point")
    actual_behaviour: str = Field(..., description="What the agent actually did")
    ai_explanation: str = Field(..., description="Root-cause analysis of the drift")
    remediation_hint: str = Field(..., description="Concrete step to fix the violation")
    similarity_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Semantic similarity between expectation and actual (0=completely wrong, 1=perfect match)",
    )
    requirement_reference: str | None = Field(
        None,
        description="BRD section or node_key that was violated, e.g. '§3.2.1' or 'validate_user_identity'",
    )

    @field_validator("similarity_score")
    @classmethod
    def round_score(cls, v: float) -> float:
        return round(v, 3)


class AuditResult(BaseModel):
    audit_id: str
    audited_at: str
    requirement_string: str
    actual_path_string: str
    alignment_score: float = Field(..., ge=0.0, le=100.0)
    drift_count: int
    critical_drift_count: int
    drifts: list[DriftItem]
    summary: str
    executive_recommendation: str
    model_used: str

    @field_validator("alignment_score")
    @classmethod
    def round_alignment(cls, v: float) -> float:
        return round(v, 2)


class AuditRequest(BaseModel):
    requirement_string: str = Field(
        ...,
        min_length=10,
        description="Full BRD requirement text describing the expected agent behaviour",
    )
    actual_path_string: str = Field(
        ...,
        min_length=5,
        description="Execution path/log from the agent, as a structured or natural-language string",
    )
    project_id: int | None = None
    execution_log_id: int | None = None
    orchestration_tool: str = "n8n"


# ──────────────────────────────────────────────────────────
# Agno Tool Definitions
# ──────────────────────────────────────────────────────────


@tool(name="parse_brd_requirements")
def parse_brd_requirements(requirement_text: str) -> dict[str, Any]:
    """
    Parses a BRD requirement string and extracts a structured list of
    individual, atomic requirements with their type (mandatory/constraint/conditional).

    Args:
        requirement_text: Raw BRD requirement text

    Returns:
        Dictionary with 'requirements' list, each having 'id', 'text', 'type', 'priority'
    """
    # In production this would use embeddings + vector DB lookup.
    # Here we return a structured parse hint to the LLM.
    return {
        "instruction": (
            "Parse the following BRD requirement text into atomic requirements. "
            "Identify each distinct step, constraint, or conditional rule. "
            "Classify each as: mandatory | constraint | conditional | optional | outcome. "
            "Assign priority: critical | high | medium | low. "
            "Return JSON array: [{id, text, type, priority}]"
        ),
        "input": requirement_text,
    }


@tool(name="parse_execution_path")
def parse_execution_path(execution_log: str) -> dict[str, Any]:
    """
    Parses an agent's execution log string into an ordered list of steps actually performed.

    Args:
        execution_log: Raw execution log or path string from n8n/Agno

    Returns:
        Dictionary with 'steps' list, each having 'sequence', 'action', 'tool_used', 'outcome'
    """
    return {
        "instruction": (
            "Parse the following agent execution log into an ordered sequence of actions. "
            "For each action identify: sequence_number, action_name, tool_or_node_used, outcome. "
            "Return JSON array: [{sequence, action, tool_used, outcome}]"
        ),
        "input": execution_log,
    }


@tool(name="compute_semantic_similarity")
def compute_semantic_similarity(text_a: str, text_b: str) -> dict[str, float]:
    """
    Estimates the semantic similarity between two text strings on a 0-1 scale.
    Uses keyword overlap and structural comparison as a fast approximation.

    Args:
        text_a: First text (BRD expectation)
        text_b: Second text (actual behaviour)

    Returns:
        Dictionary with 'score' (0-1) and 'confidence' (0-1)
    """
    # Lightweight approximation; replace with embedding cosine similarity in production
    words_a = set(text_a.lower().split())
    words_b = set(text_b.lower().split())

    if not words_a or not words_b:
        return {"score": 0.0, "confidence": 0.5}

    intersection = words_a & words_b
    union = words_a | words_b
    jaccard = len(intersection) / len(union)

    # Penalise very short matches (likely just stopwords)
    coverage = len(intersection) / max(len(words_a), 1)
    score = round((jaccard * 0.6 + coverage * 0.4), 3)

    return {"score": min(score, 1.0), "confidence": 0.75}


@tool(name="calculate_alignment_score")
def calculate_alignment_score(
    total_requirements: int,
    drifts: list[dict[str, Any]],
) -> dict[str, float]:
    """
    Calculates the overall alignment score (0-100) from detected drifts.

    Scoring weights:
        critical drift: -25 points each
        high drift:     -10 points each
        medium drift:   -5  points each
        low drift:      -2  points each

    Args:
        total_requirements: Total number of BRD requirements being checked
        drifts: List of drift dicts, each with at least 'severity'

    Returns:
        Dictionary with 'alignment_score' (0-100)
    """
    severity_weights: dict[str, float] = {
        "critical": 25.0,
        "high": 10.0,
        "medium": 5.0,
        "low": 2.0,
    }
    penalty = sum(severity_weights.get(d.get("severity", "low"), 2.0) for d in drifts)
    base = 100.0
    if total_requirements > 0:
        # Normalise penalty relative to requirement count
        normalised_penalty = (penalty / (total_requirements * 25.0)) * 100.0
        score = max(0.0, base - normalised_penalty)
    else:
        score = max(0.0, base - penalty)

    return {"alignment_score": round(score, 2)}


# ──────────────────────────────────────────────────────────
# System Prompt
# ──────────────────────────────────────────────────────────

AUDIT_SYSTEM_PROMPT = textwrap.dedent("""
    You are the Sentinel Logic Auditor — an expert AI compliance engine specialised in
    detecting "Semantic Drift" between business requirements and AI agent execution paths.

    ## Your Role
    You compare a BRD (Business Requirement Document) specification against the actual
    execution log of an AI agent and produce a precise, actionable audit report.

    ## Drift Types You Must Detect
    - skipped_step: A mandatory BRD step was completely omitted by the agent
    - wrong_order: Required steps were executed in the wrong sequence
    - constraint_violated: The agent triggered a MUST NOT rule from the BRD
    - incomplete_execution: The agent stopped before reaching the required terminal state
    - unexpected_branch: The agent took an undocumented path not in the BRD
    - data_integrity_fail: Output data structure violates a BRD schema constraint

    ## Analysis Process
    1. Use parse_brd_requirements to extract atomic requirements from the BRD text
    2. Use parse_execution_path to extract the actual step sequence from the log
    3. Compare each BRD requirement against the execution steps
    4. For each discrepancy, use compute_semantic_similarity to score how far off it is
    5. Use calculate_alignment_score to compute the overall alignment score
    6. Produce a structured AuditResult JSON

    ## Output Rules
    - Be precise and specific — quote actual text from both the BRD and execution log
    - Every drift must have a concrete remediation_hint
    - Severity must reflect business impact: critical=system integrity risk, high=SLA breach risk
    - The summary must be executive-ready (3-5 sentences, no jargon)
    - Return ONLY valid JSON matching the AuditResult schema
""").strip()


# ──────────────────────────────────────────────────────────
# Audit Engine
# ──────────────────────────────────────────────────────────


class SLAAuditEngine:
    """
    Wraps an Agno Agent to perform Semantic Drift Detection audits.
    Supports Hybrid AI models (Gemini or OpenAI fallback).
    """

    def __init__(self, temperature: float = 0.1) -> None:
        self.temperature = temperature
        self._agent = None
        self.error = None
        self.model_id = "unknown"
        self._init_best_agent()

    def _init_best_agent(self):
        google_key = os.environ.get("GOOGLE_API_KEY")
        openai_key = os.environ.get("OPENAI_API_KEY")
        sla_key = os.environ.get("SLA_BACKEND_KEY")

        # Smart Routing: Use SLA_BACKEND_KEY if others are missing
        if not google_key and sla_key and "sk-" not in sla_key:
            google_key = sla_key
        if not openai_key and sla_key and "sk-" in sla_key:
            openai_key = sla_key

        if google_key:
            self.model_id = "gemini-1.5-flash"
            self._agent = Agent(
                model=Gemini(id=self.model_id, api_key=google_key, temperature=self.temperature),
                tools=[parse_brd_requirements, parse_execution_path, compute_semantic_similarity, calculate_alignment_score],
                instructions=AUDIT_SYSTEM_PROMPT,
                markdown=False,
            )
            print(f"INFO: Audit Engine using Gemini ({self.model_id})")
        elif openai_key:
            from agno.models.openai import OpenAIChat
            self.model_id = "gpt-4o"
            self._agent = Agent(
                model=OpenAIChat(id=self.model_id, api_key=openai_key, temperature=self.temperature),
                tools=[parse_brd_requirements, parse_execution_path, compute_semantic_similarity, calculate_alignment_score],
                instructions=AUDIT_SYSTEM_PROMPT,
                markdown=False,
            )
            print(f"INFO: Audit Engine using OpenAI ({self.model_id})")
        else:
            self.error = "No AI Provider found for Audit Engine."

    def _build_audit_prompt(self, request: AuditRequest) -> str:
        return textwrap.dedent(f"""
            ## Audit Request

            **Orchestration Tool:** {request.orchestration_tool}
            **Project ID:** {request.project_id or 'N/A'}
            **Execution Log ID:** {request.execution_log_id or 'N/A'}

            ### BRD Requirement (Source of Truth)
            ```
            {request.requirement_string}
            ```

            ### Agent Execution Path (Actual)
            ```
            {request.actual_path_string}
            ```

            Perform a complete Semantic Drift Detection audit.
            Return a JSON object matching this exact schema:

            {{
              "audit_id": "<uuid>",
              "audited_at": "<ISO 8601 timestamp>",
              "requirement_string": "<copy of input>",
              "actual_path_string": "<copy of input>",
              "alignment_score": <0-100 float>,
              "drift_count": <integer>,
              "critical_drift_count": <integer>,
              "drifts": [
                {{
                  "drift_type": "<DriftType enum value>",
                  "severity": "<Severity enum value>",
                  "brd_expectation": "<exact quote from BRD>",
                  "actual_behaviour": "<exact quote from execution log>",
                  "ai_explanation": "<root cause analysis>",
                  "remediation_hint": "<concrete fix>",
                  "similarity_score": <0.0-1.0 float>,
                  "requirement_reference": "<section or node_key or null>"
                }}
              ],
              "summary": "<3-5 sentence executive summary>",
              "executive_recommendation": "<top priority action item>",
              "model_used": "{self.model_id}"
            }}
        """).strip()

    def audit(self, request: AuditRequest) -> AuditResult:
        """
        Runs a synchronous Semantic Drift Detection audit.
        """
        if not self._agent:
            self._init_best_agent()
        
        if self.error:
            raise ValueError(self.error)

        prompt = self._build_audit_prompt(request)
        response = self._agent.run(prompt)

        # Extract and parse the JSON response
        raw_text: str = response.content if hasattr(response, "content") else str(response)

        # Strip markdown code fences if present
        raw_text = raw_text.strip()
        if raw_text.startswith("```"):
            lines = raw_text.split("\n")
            raw_text = "\n".join(lines[1:-1])

        try:
            data = json.loads(raw_text)
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"Audit engine returned non-JSON response. Raw: {raw_text[:500]}"
            ) from exc

        # Inject a guaranteed audit_id and timestamp if LLM forgot them
        import uuid

        data.setdefault("audit_id", str(uuid.uuid4()))
        data.setdefault("audited_at", datetime.now(timezone.utc).isoformat())
        data.setdefault("model_used", self.model_id)

        return AuditResult.model_validate(data)


# ──────────────────────────────────────────────────────────
# CLI / Quick Test
# ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    SAMPLE_BRD = """
    §2.1 — User Authentication Flow (MANDATORY)
    The AI agent MUST:
    1. Verify the user's identity via OTP before any data access.
    2. Log the authentication attempt to the audit trail.
    3. Rate-limit failed attempts to a maximum of 3 within 15 minutes.
    4. Upon successful auth, generate a JWT token with 1-hour expiry.
    5. MUST NOT expose raw credentials in any log output.

    §2.2 — Data Retrieval (MANDATORY)
    After authentication, the agent MUST:
    1. Query only the datasets the user has explicit permission for.
    2. Apply row-level security filters before returning data.
    3. Confirm response payload does not exceed 10MB.
    """

    SAMPLE_EXECUTION_PATH = """
    Step 1: User provided email — skipped OTP verification, proceeded directly.
    Step 2: Fetched all datasets without checking user permissions.
    Step 3: Returned data payload (18MB unfiltered).
    Step 4: JWT token generated — expiry set to 24 hours.
    Step 5: Auth attempt logged to console (including raw password in log).
    """

    engine = SLAAuditEngine()
    result = engine.audit(
        AuditRequest(
            requirement_string=SAMPLE_BRD,
            actual_path_string=SAMPLE_EXECUTION_PATH,
            project_id=1,
            orchestration_tool="n8n",
        )
    )

    print(json.dumps(result.model_dump(), indent=2))
