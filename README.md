# ThreatLens

## How to Run the Backend

1. Navigate to the backend directory:
   ```bash
   cd CybrRag
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
   *(Note: A virtual environment is recommended)*

3. Configure your environment variables:
   Copy `.env.example` to `.env` and fill in the required keys:
   ```bash
   cp .env.example .env
   ```

4. Start the FastAPI server using Uvicorn:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8001 --reload
   ```
   The backend will be running at `http://localhost:8001`.

---

## How to Run the Frontend

1. Navigate to the frontend directory:
   ```bash
   cd CybrRag/cyberrag-frontend
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```
   The React application will launch at `http://localhost:3002`.
