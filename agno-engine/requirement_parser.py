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
from agno.models.google import Gemini
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
    def __init__(self):
        self.agent = None
        self.error = None
        self._init_best_agent()

    def _init_best_agent(self):
        google_key = os.environ.get("GOOGLE_API_KEY")
        openai_key = os.environ.get("OPENAI_API_KEY")
        sla_key = os.environ.get("SLA_BACKEND_KEY")
        sla_secret = os.environ.get("SLA_SECRET_KEY")

        # Smart Routing: Use SLA_BACKEND_KEY or SLA_SECRET_KEY if others are missing
        master_key = sla_key or sla_secret
        
        if not google_key and master_key and "sk-" not in master_key:
            google_key = master_key
        if not openai_key and master_key and "sk-" in master_key:
            openai_key = master_key

        if google_key:
            self.agent = Agent(
                model=Gemini(id="gemini-1.5-flash", api_key=google_key),
                instructions=SYSTEM_PROMPT,
                markdown=False,
                description="Requirement Studio Agent (Powered by Gemini)"
            )
            print("INFO: Initialized Gemini Requirement Parser")
        elif openai_key:
            self.agent = Agent(
                model=OpenAIChat(id="gpt-4o", api_key=openai_key),
                instructions=SYSTEM_PROMPT,
                markdown=False,
                description="Requirement Studio Agent (Powered by OpenAI)"
            )
            print("INFO: Initialized OpenAI Requirement Parser")
        else:
            self.error = "No AI Provider found. Please add SLA_SECRET_KEY to Render."

    def parse(self, brd_text: str) -> RequirementStudioResponse:
        # Re-check in case environment changed
        if not self.agent:
            self._init_best_agent()
            
        try:
            if self.error or not self.agent:
                # If no agent or keys, go straight to free mode
                return self._mechanical_parse(brd_text)
                
            prompt = f"Analyze and parse the following BRD text into structured requirements:\n\n{brd_text}"
            response = self.agent.run(prompt)
            
            raw_text = response.content if hasattr(response, "content") else str(response)
            raw_text = raw_text.strip()
            
            # If the response contains "quota" or "billing", it's an error from OpenAI
            if "quota" in raw_text.lower() or "billing" in raw_text.lower() or "limit" in raw_text.lower():
                print("DEBUG: Quota/Billing error detected in AI response. Switching to Mechanical.")
                return self._mechanical_parse(brd_text)

            # Clean markdown
            if "```json" in raw_text:
                raw_text = raw_text.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_text:
                raw_text = raw_text.split("```")[1].split("```")[0].strip()
            
            try:
                data = json.loads(raw_text)
                resp = RequirementStudioResponse.model_validate(data)
                resp.raw_content = brd_text
                return resp
            except:
                # If JSON parsing fails (e.g. AI returned an error message instead of JSON)
                return self._mechanical_parse(brd_text)

        except Exception as e:
            print(f"DEBUG: AI Parser exception caught: {str(e)}. Falling back to Mechanical Parser.")
            return self._mechanical_parse(brd_text)

    def _mechanical_parse(self, text: str) -> RequirementStudioResponse:
        """
        Enhanced Regex-based fallback parser with keyword intelligence.
        """
        import re
        lines = text.split('\n')
        requirements = []
        
        # 1. Broad Requirement Pattern (must, shall, etc.)
        req_pattern = re.compile(r'([^.?!]*(?:shall|must|required|should|strictly|prohibited|must not)[^.?!]*[.?!])', re.IGNORECASE)
        
        # 2. Specialized Keyword Patterns
        special_patterns = {
            "CMS": re.compile(r'([^.?!]*\bCMS\b[^.?!]*[.?!])', re.IGNORECASE),
            "Timeline": re.compile(r'([^.?!]*\b(?:Timeline|Deadline|Date|Schedule)\b[^.?!]*[.?!])', re.IGNORECASE),
            "Out of Scope": re.compile(r'([^.?!]*\b(?:Out Of Scope|Not Responsible|Excluded)\b[^.?!]*[.?!])', re.IGNORECASE)
        }

        found_texts = []

        # Process specialized keywords first
        for category, pattern in special_patterns.items():
            for line in lines:
                matches = pattern.findall(line)
                for m in matches:
                    clean_m = m.strip()
                    if len(clean_m) > 10 and clean_m not in found_texts:
                        found_texts.append(clean_m)
                        rtype = RequirementType.CONSTRAINT if "scope" in category.lower() else RequirementType.MANDATORY
                        requirements.append(ExtractedRequirement(
                            node_key=f"REQ_{category.replace(' ', '_').upper()}_{len(requirements)+1}",
                            node_label=f"{category} Requirement",
                            requirement_text=clean_m,
                            priority=Priority.HIGH,
                            category=category,
                            requirement_type=rtype,
                            section_reference="Keyword Scan"
                        ))

        # Fill in with general mandatory requirements
        for line in lines:
            matches = req_pattern.findall(line)
            for m in matches:
                clean_m = m.strip()
                if len(clean_m) > 15 and clean_m not in found_texts:
                    found_texts.append(clean_m)
                    requirements.append(ExtractedRequirement(
                        node_key=f"REQ_GEN_{len(requirements)+1:03d}",
                        node_label=f"Rule {len(requirements)+1}",
                        requirement_text=clean_m,
                        priority=Priority.HIGH if "must" in clean_m.lower() or "shall" in clean_m.lower() else Priority.MEDIUM,
                        category="General",
                        section_reference="Manual Scan"
                    ))
        
        return RequirementStudioResponse(
            requirements=requirements[:30], 
            project_summary="[SAFE MODE] Extracted via Mechanical Regex Scan with Keyword Intelligence.",
            raw_content=text
        )
