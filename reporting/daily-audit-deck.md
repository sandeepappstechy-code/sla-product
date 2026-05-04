---
marp: true
theme: default
paginate: true
header: "**SENTINEL LOGIC AUDITOR** · Confidential"
footer: "© 2024 SLA Platform · Generated {{ date }}"
style: |
  /* ═══════════════════════════════════════════════════
     SLA MARP THEME — Daily Audit Deck
     Professional dark enterprise aesthetic
  ═══════════════════════════════════════════════════ */

  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');

  :root {
    --bg-primary: #0d1117;
    --bg-secondary: #161b22;
    --bg-card: #1c2128;
    --accent-blue: #388bfd;
    --accent-cyan: #39d353;
    --accent-red: #f85149;
    --accent-amber: #d29922;
    --accent-purple: #a371f7;
    --text-primary: #e6edf3;
    --text-secondary: #8b949e;
    --text-muted: #484f58;
    --border: #30363d;
  }

  section {
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 18px;
    line-height: 1.6;
    padding: 60px 72px;
  }

  /* Header */
  header {
    font-family: 'Inter', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
    padding-bottom: 12px;
  }

  /* Footer */
  footer {
    font-size: 10px;
    color: var(--text-muted);
    border-top: 1px solid var(--border);
  }

  /* Page numbers */
  section::after {
    font-size: 10px;
    color: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
  }

  /* Title slide */
  section.title {
    background: linear-gradient(135deg, #0d1117 0%, #1a1f35 50%, #0d1117 100%);
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  /* Headings */
  h1 { font-size: 2.4em; font-weight: 800; color: var(--text-primary); margin-bottom: 0.2em; line-height: 1.2; }
  h2 { font-size: 1.5em; font-weight: 700; color: var(--accent-blue); margin-bottom: 0.4em; border-bottom: 2px solid var(--border); padding-bottom: 0.3em; }
  h3 { font-size: 1.1em; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.3em; }

  /* Code blocks */
  code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85em;
    background: var(--bg-card);
    color: var(--accent-cyan);
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid var(--border);
  }

  pre code {
    display: block;
    padding: 16px 20px;
    border-left: 3px solid var(--accent-blue);
    border-radius: 0 6px 6px 0;
    overflow-x: auto;
    font-size: 0.78em;
    line-height: 1.7;
  }

  /* Tables */
  table { width: 100%; border-collapse: collapse; font-size: 0.85em; }
  th {
    background: var(--bg-card);
    color: var(--text-secondary);
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.75em;
    letter-spacing: 0.08em;
    padding: 10px 14px;
    border-bottom: 2px solid var(--border);
    text-align: left;
  }
  td { padding: 10px 14px; border-bottom: 1px solid var(--border); color: var(--text-primary); }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: var(--bg-card); }

  /* Blockquotes → used for callout boxes */
  blockquote {
    border-left: 4px solid var(--accent-blue);
    background: var(--bg-card);
    padding: 14px 20px;
    border-radius: 0 8px 8px 0;
    color: var(--text-secondary);
    margin: 16px 0;
  }

  /* Severity badges via strong */
  strong.critical { color: var(--accent-red); }
  strong.high     { color: var(--accent-amber); }
  strong.medium   { color: #58a6ff; }
  strong.low      { color: var(--text-secondary); }

  /* Score pill classes */
  .score-good    { color: var(--accent-cyan); font-weight: 700; font-size: 1.2em; }
  .score-warning { color: var(--accent-amber); font-weight: 700; font-size: 1.2em; }
  .score-danger  { color: var(--accent-red); font-weight: 700; font-size: 1.2em; }
---

<!-- _class: title -->

# 🛡️ Sentinel Logic Auditor
## Daily Audit Report

**Project:** {{ project_name }}
**Audit Window:** {{ audit_date_start }} – {{ audit_date_end }}
**Generated:** {{ generated_at }}
**Prepared by:** SLA Automated Reporting Engine v1.0

---

# Executive Summary

> **Overall Platform Alignment Score: <span class="score-{{ score_class }}">{{ alignment_score }}%</span>**

| Metric | Value | Δ vs Yesterday |
|---|---|---|
| Total Executions Audited | {{ total_executions }} | {{ delta_executions }} |
| Logic Drifts Detected | {{ total_drifts }} | {{ delta_drifts }} |
| Critical Violations | {{ critical_drifts }} | {{ delta_critical }} |
| Avg. Audit Latency | {{ avg_audit_latency_ms }}ms | {{ delta_latency }} |
| Projects at Risk (< 80%) | {{ projects_at_risk }} | {{ delta_at_risk }} |

**Key Finding:** {{ executive_key_finding }}

---

# Project Alignment Scores

| Project | Score | Trend | Critical Drifts | Status |
|---|---|---|---|---|
{{ #each projects }}
| {{ name }} | {{ score }}% | {{ trend_arrow }} | {{ critical_count }} | {{ status_badge }} |
{{ /each }}

> Projects below **80%** require immediate engineering review.
> Projects below **60%** are flagged for escalation to the business stakeholder.

---

# 🔴 Critical Drifts — Immediate Action Required

{{ #each critical_drifts }}

## Drift #{{ @index_plus_1 }}: {{ drift_type_label }}

**Project:** `{{ project_name }}` · **Execution ID:** `{{ execution_id }}`
**Severity:** 🔴 CRITICAL · **Detected at:** {{ detected_at }}

### BRD Expectation
> {{ brd_expectation }}

### Actual Agent Behaviour
> {{ actual_behaviour }}

### Root Cause
{{ ai_explanation }}

### ✅ Remediation
{{ remediation_hint }}

---

{{ /each }}

# Drift Type Distribution

```
DRIFT TYPE BREAKDOWN — {{ audit_date }}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  skipped_step         ████████████████░░░░  {{ skipped_step_pct }}%
  constraint_violated  ███████████░░░░░░░░░  {{ constraint_violated_pct }}%
  wrong_order          ████████░░░░░░░░░░░░  {{ wrong_order_pct }}%
  incomplete_execution █████░░░░░░░░░░░░░░░  {{ incomplete_pct }}%
  unexpected_branch    ███░░░░░░░░░░░░░░░░░  {{ unexpected_branch_pct }}%
  data_integrity_fail  ██░░░░░░░░░░░░░░░░░░  {{ data_integrity_pct }}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total Drifts: {{ total_drifts }}   Executions Scanned: {{ total_executions }}
```

---

# BRD Coverage Analysis

| Requirement Node | Type | Audit Hits | Audit Misses | Miss Rate |
|---|---|---|---|---|
{{ #each requirement_nodes }}
| `{{ node_key }}` | {{ requirement_type }} | {{ audit_hit_count }} | {{ audit_miss_count }} | {{ miss_rate }}% |
{{ /each }}

> Nodes with miss rate > **20%** are highlighted for BRD revision or agent retraining.

---

# Recommendations

## Immediate (< 24h)
{{ #each immediate_actions }}
- 🔴 **{{ project }}:** {{ action }}
{{ /each }}

## Short-term (< 1 week)
{{ #each short_term_actions }}
- 🟡 **{{ project }}:** {{ action }}
{{ /each }}

## Strategic (< 1 month)
{{ #each strategic_actions }}
- 🟢 {{ action }}
{{ /each }}

---

# Appendix A — Raw Drift Log

| Execution ID | Project | Drift Type | Severity | Similarity | Status |
|---|---|---|---|---|---|
{{ #each all_drifts }}
| `{{ execution_id }}` | {{ project_name }} | {{ drift_type }} | {{ severity }} | {{ similarity_score }} | {{ resolution_status }} |
{{ /each }}

---

# Appendix B — Audit Engine Metadata

```json
{
  "engine_version": "{{ engine_version }}",
  "model_used":     "{{ model_used }}",
  "audit_window":   "{{ audit_date_start }} / {{ audit_date_end }}",
  "total_tokens":   {{ total_tokens_used }},
  "avg_latency_ms": {{ avg_audit_latency_ms }},
  "orchestration_tools": {{ orchestration_tools_json }},
  "generated_at":   "{{ generated_at }}"
}
```

> This report was generated automatically by the Sentinel Logic Auditor.
> For questions, contact the AI Governance team.

---

<!-- _class: title -->

# End of Report

**Next Audit:** {{ next_audit_scheduled }}
**SLA Platform** · Sentinel Logic Auditor · v1.0
