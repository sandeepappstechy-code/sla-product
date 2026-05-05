"""
Sentinel Logic Auditor — Requirement Parser Agent
=================================================
Specialized Agno Agent to extract atomic business requirements from raw BRD text.
"""

from __future__ import annotations

import json
import os
import textwrap
from enum import Enum
from typing import List

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

class RequirementType(str, Enum):
    MANDATORY = "mandatory"
    CONDITIONAL = "conditional"
    OPTIONAL = "optional"
    CONSTRAINT = "constraint"
    OUTCOME = "outcome"

class Priority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class ExtractedRequirement(BaseModel):
    node_key: str = Field(..., description="Unique machine-readable slug, e.g. 'validate_otp'")
    node_label: str = Field(..., description="Short human-readable title")
    requirement_text: str = Field(..., description="The full extracted requirement text")
    section_reference: str | None = Field(None, description="Section number if available, e.g. '§2.1'")
    requirement_type: RequirementType = Field(default=RequirementType.MANDATORY)
    priority: Priority = Field(default=Priority.HIGH)
    category: str = Field(..., description="Compliance, Functional, or Security")

class RequirementStudioResponse(BaseModel):
    requirements: List[ExtractedRequirement]
    project_summary: str = Field(..., description="One paragraph summary of the project scope")
    raw_content: str = Field(default="", description="The raw BRD text that was parsed")

SYSTEM_PROMPT = textwrap.dedent("""
    You are the Sentinel Logic Auditor Requirement Studio Agent.
    Your task is to analyze raw Business Requirement Documents (BRDs) and decompose them 
    into a structured set of atomic requirements that can be used for logic auditing.

    ## Extraction Rules
    - node_key: Create a unique, underscore-separated slug for each requirement.
    - node_label: A concise title (max 60 chars).
    - requirement_text: Capture the full nuance of the requirement.
    - section_reference: Extract section headers or numbers (e.g., §3.1).
    - category: Classify as 'Compliance', 'Functional', or 'Security'.
    - priority: Assign based on business impact.

    ## Classification Guide
    - MANDATORY: Use for MUST/REQUIRED statements.
    - CONSTRAINT: Use for MUST NOT/PROHIBITED statements.
    - CONDITIONAL: Use for IF/THEN logic.

    Return ONLY a valid JSON object matching the RequirementStudioResponse schema.
""").strip()

class RequirementParserAgent:
    def __init__(self, model_id: str = "gpt-4o"):
        self.agent = Agent(
            model=OpenAIChat(id=model_id, api_key=os.environ["OPENAI_API_KEY"]),
            instructions=SYSTEM_PROMPT,
            markdown=False,
            description="Agent that converts raw BRD text into a structured requirement graph."
        )

    def parse(self, brd_text: str) -> RequirementStudioResponse:
        prompt = f"Analyze and parse the following BRD text into structured requirements:\n\n{brd_text}"
        response = self.agent.run(prompt)
        
        raw_text = response.content if hasattr(response, "content") else str(response)
        
        # Clean markdown if present
        raw_text = raw_text.strip()
        if raw_text.startswith("```"):
            lines = raw_text.split("\n")
            raw_text = "\n".join(lines[1:-1])
        
        try:
            data = json.loads(raw_text)
            resp = RequirementStudioResponse.model_validate(data)
            resp.raw_content = brd_text # Populate the raw content
            return resp
        except Exception as e:
            # Check if it looks like an API key error
            if "Incorrect API key" in str(e) or "invalid_api_key" in str(e):
                raise ValueError("Invalid OpenAI API Key. Please check your Render environment variables.")
            
            raise ValueError(f"Failed to parse requirements: {str(e)}\nRaw Response: {raw_text}")
