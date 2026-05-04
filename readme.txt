SENTINEL LOGIC AUDITOR (SLA) - INSTRUCTION MANUAL
==================================================

QUICK START:
------------
1. Start the Agno Engine:
   cd agno-engine
   pip install -r requirements.txt
   uvicorn agno_api:app --host 0.0.0.0 --port 8001

2. Start the Laravel Backend:
   cd backend
   php artisan migrate
   php artisan serve --port=8000

3. Launch the Frontend:
   Open frontend/index.html in your browser.


NEW FEATURES (v2.0):
-------------------
- THEME TOGGLE: Click the Sun/Moon icon in the top navigation bar to switch 
  between Dark and Light modes. Your preference is saved automatically.
- DYNAMIC AUDITS: Click "Run Audit" on the dashboard to simulate a live check. 
  The system will now dynamically generate drifts and update scores in real-time.
- MOBILE READY: Use the application on any device. The sidebar backdrop 
  on mobile allows for easy navigation and dimming effects.


DASHBOARD USAGE:
----------------
1. REQUIREMENT STUDIO:
   - Select a project from the dropdown.
   - Drop a BRD file (PDF/DOCX/MD) or paste raw text.
   - Review extracted requirements in the sandbox.
   - Click "Activate" for the logic nodes you wish to track.
   - Click "Lock All & Activate" to synchronize with the audit engine.

2. AGENT LINKING:
   - Copy the Webhook URL and API Key from the Developer Handoff panel.
   - Integrate these into your n8n (HTTP Request) or Agno (WebClient) workflow.
   - The platform will now listen for execution logs on these endpoints.

3. REMEDIATION:
   - If a "Drift Alert" occurs, navigate to the Remediation view.
   - Review the "Expectation" vs "Actual Behaviour" breakdown.
   - Use the Export tabs (n8n, Agno, PR) to generate and download fix artifacts.

4. SETTINGS:
   - Configure Slack/Teams webhooks for real-time alerting.
   - Adjust "Minimum Alignment" and "Similarity Alert" thresholds.
   - All settings are persistent across browser sessions.


SUPPORT:
--------
Refer to documentation.md for full technical specifications and API docs.
