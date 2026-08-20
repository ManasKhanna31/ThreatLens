# ThreatLens SaaS Testing Guide

This guide provides step-by-step instructions for validating every major component of the ThreatLens platform.

## 1. Environment Verification
Before testing, ensure both services are running:
- **Backend**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health) (Should show `status: healthy`)
- **Frontend**: [http://localhost:3001](http://localhost:3001)

---

## 2. Authentication Flow (SaaS Core)
Test the gatekeeper system.
1. **Access Protected Route**: Try to go directly to [http://localhost:3001/dashboard](http://localhost:3001/dashboard). 
   - *Expected*: You should be automatically redirected to `/login`.
2. **First User Signup (Admin Boostrapping)**:
   - Go to the **Signup** page.
   - Fill in details (e.g., `admin_user`, `admin@threatlens.io`, `SecurePass123!`).
   - *Expected*: After clicking "Sign Up", you should be logged in and redirected to the Dashboard.
   - *Note*: The first user ever created in the database is automatically assigned the `admin` role.
3. **Logout & Login**:
   - In the sidebar, click **Sign Out**.
   - Go to the **Login** page.
   - Enter the credentials you just created.
   - *Expected*: Successful login and return to Dashboard.
4. **Invalid Login**:
   - Try logging in with a wrong password.
   - *Expected*: A clear error message should appear.

---

## 3. Threat Analysis & AI SOC
Test the log ingestion and intelligence engine.
1. **Navigate to "Log Analysis"** in the sidebar.
2. **Use a Sample Log**:
   - Click on the **"PowerShell"** or **"Brute Force"** chip below the input box.
   - This will populate the box with a malicious-looking log.
3. **Execute Analysis**:
   - Click **"Analyze Log"**.
   - *Expected*: A loading bar appears, then results populate the right-hand card.
4. **Inspect Tabs**:
   - **Overview**: Check the Risk Score (e.g., 85/100) and Severity.
   - **Threat Details**: View the MITRE ATT&CK technique mapping and related CVEs.
   - **Intelligence**: View geolocation (IP data) and reputation scoring.
   - **AI Summary**: Read the LLaMA-generated SOC report.
   - **Map**: Verify the attacker's location is plotted on the Leaflet map.

---

## 4. SOC Dashboard
Test the high-level reporting.
1. **Navigate to "Dashboard"**.
2. **Verify Metrics**:
   - Check if "Active Threats", "Risk Score", and "Response Time" cards are visible.
3. **Visualizations**:
   - Ensure the **Activity Timeline** (Line/Bar chart) and **MITRE Coverage** (Radar chart) are rendering.
4. **Live Feed**:
   - Verify the "Live Threat Feed" card shows the most recent analyzed logs.

---

## 5. MITRE Explorer
Test the knowledge base.
1. **Navigate to "MITRE Explorer"**.
2. **Interact**:
   - Browse the Tactic/Technique list.
   - *Expected*: Clicking a technique should show its description and detection logic.

---

## 6. Advanced Backend Testing (API Docs)
Verify the API surface area.
1. **Open Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
2. **Try Authorize**:
   - Click the green **"Authorize"** button.
   - You can't use this easily without a token, but you can see all protected routes (padlock icon).
3. **Auth Endpoint**:
   - Find `POST /api/v1/auth/login`.
   - Use "Try it out" to send your credentials.
   - *Expected*: Receives a JSON response with `access_token` and `refresh_token`.

---

## 7. Database Verification (MySQL)
If you want to check the records manually:
1. Open MySQL Workbench or terminal.
2. Run: `SELECT * FROM threatlens.users;`
   - *Expected*: You should see your created user with their hashed password and assigned role.
3. Run: `SELECT * FROM threatlens.incidents;`
   - *Expected*: Logs you analyzed via the frontend are persisted here.
