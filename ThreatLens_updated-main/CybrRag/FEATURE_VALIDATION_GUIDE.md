# ThreatLens v2.1 — Feature Validation Guide

This guide provides step-by-step instructions and example logs to test every major module of the ThreatLens platform.

---

## Phase 1: Real-Time Detection (Threat Studio)
Navigate to **Threat Studio** (⚡) in the sidebar. This is where you test real-time parsing, rules, and risk scoring.

### Test 1: Credential Dumping (Mimikatz)
**Copy this log:**
`2024-05-05 10:00:00 PROCESS_CREATE process=mimikatz.exe user=jdoe src_ip=203.0.113.99 event_id=4688 host=PROD-DB-01`

1. Paste into the input box and click **Analyze Threat**.
2. **What to look for:**
   - **Risk Score:** Should be HIGH/CRITICAL (80+).
   - **Threat Type:** "Credential Dumping Attempt".
   - **MITRE:** Mapping to `T1003`.
   - **AI Summary:** A generated report explaining why Mimikatz is dangerous.

### Test 2: Suspicious PowerShell (Obfuscation)
**Copy this log:**
`Jan 15 11:45:23 server01 PowerShell[1234]: Invoke-Expression -EncodedCommand dABlAHMAdA== user=SYSTEM event_id=4104`

1. Paste and Analyze.
2. **What to look for:**
   - **Parsed Fields:** Should correctly identify `log_type: windows`.
   - **Threat Type:** "Suspicious PowerShell Execution".
   - **Risk Factor:** Check the "Risk Factors" tab to see points added for PowerShell and System user.

---

## Phase 2: Multi-Stage Campaigns
Navigate to **Campaigns** (🕸️) in the sidebar.

1. **Step A:** Submit the **Mimikatz** log from Phase 1.
2. **Step B:** Submit this **Lateral Movement** log from the **SAME IP**:
   `2024-05-05 10:15:00 SERVICE_START service=psexecsvc.exe src_ip=203.0.113.99 event_id=7045`
3. **Navigate to Campaigns:**
   - You should see an active campaign for `203.0.113.99`.
   - **What to look for:** The "Stage Chain" should show `Credential Access → Lateral Movement`.

---

## Phase 3: Investigation Hub
Navigate to **Investigate** (🔍) in the sidebar.

1. Enter the IP: `203.0.113.99` and click **Investigate**.
2. **What to look for:**
   - **Dossier:** Total events, incident count, and linked campaigns.
   - **Attack Timeline:** A chronological list of both logs you submitted, showing exactly when the attacker moved from dumping credentials to lateral movement.

---

## Phase 4: SOAR & Automation
Navigate to **SOAR** (⚙️) in the sidebar.

1. **Create a Rule:**
   - Click **+ New Rule**.
   - Name: "Auto-block Critical".
   - Condition: `risk_level` = `CRITICAL`.
   - Action: `block_ip`.
   - Click **Create Rule**.
2. **Trigger the Rule:**
   - Go back to **Threat Studio**.
   - Submit a high-risk log (e.g. the Mimikatz one).
3. **Verify:**
   - Go to the **SOAR** page → **IP Blocklist** tab.
   - The IP `203.0.113.99` should now be automatically blocked.

---

## Phase 5: Threat Intelligence
Navigate to **Threat Intel** (🌐) in the sidebar.

1. Click **Ingest Latest Feeds**.
2. Wait for the success message.
3. **What to look for:**
   - The **Feed Overview** charts should populate with counts from CISA, Feodo, and URLhaus.
   - Go to **IOC Browser** and search for `CISA` to see specific vulnerabilities.

---

## Phase 6: AI SOC Copilot
Navigate to **AI Copilot** (🤖) in the sidebar.

**Ask these questions:**
1. "Which IPs have been blocked automatically?"
2. "Summarize the campaign for 203.0.113.99."
3. "Are there any multi-stage attacks I should worry about?"

**What to look for:** The AI should correctly query your database and give answers based on the logs you just analyzed in the previous steps.
