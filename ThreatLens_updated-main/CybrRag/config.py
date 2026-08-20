from dotenv import load_dotenv
from pathlib import Path
import os

load_dotenv()


class Settings:
    BASE_DIR = Path(__file__).resolve().parent
    DATA_DIR = BASE_DIR / "data"
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    NVD_API_KEY = os.getenv("NVD_API_KEY")
    VT_API_KEY = os.getenv("VT_API_KEY")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    OPENCAGE_API_KEY = os.getenv("OPENCAGE_API_KEY")
    IPINFO_TOKEN = os.getenv("IPINFO_TOKEN")

    # Runtime / Storage
    DB_BACKEND = os.getenv("DB_BACKEND", "sqlite").lower()
    SQLITE_PATH = os.getenv("SQLITE_PATH", str(DATA_DIR / "threatlens_demo.db"))

    # SMTP Email Configuration (for SOAR email alerts)
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM = os.getenv("SMTP_FROM", "")

    # JWT Authentication
    JWT_SECRET = os.getenv("JWT_SECRET", "threatlens-super-secret-key-change-in-production-2024")
    JWT_ALGORITHM = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_EXPIRE_MIN", "30"))
    JWT_REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("JWT_REFRESH_EXPIRE_DAYS", "7"))

    # Local demo collector
    ENABLE_REAL_LOG_COLLECTOR = os.getenv("ENABLE_REAL_LOG_COLLECTOR", "true").lower() == "true"
    REAL_LOG_COLLECTOR_INTERVAL_SECONDS = int(os.getenv("REAL_LOG_COLLECTOR_INTERVAL_SECONDS", "90"))
    REAL_LOG_MAX_EVENTS_PER_SWEEP = int(os.getenv("REAL_LOG_MAX_EVENTS_PER_SWEEP", "25"))
    REAL_LOG_BOOTSTRAP_MINUTES = int(os.getenv("REAL_LOG_BOOTSTRAP_MINUTES", "120"))
    REAL_LOG_STATE_PATH = os.getenv("REAL_LOG_STATE_PATH", str(DATA_DIR / "real_log_collector_state.json"))


settings = Settings()
