from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv
from urllib.parse import quote_plus
from pathlib import Path
import os

from config import settings

load_dotenv()


def _build_database_url():
    backend = settings.DB_BACKEND

    if backend == "sqlite":
        sqlite_path = Path(settings.SQLITE_PATH)
        sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{sqlite_path.as_posix()}"

    db_user = os.getenv("DB_USER", "root")
    db_password = os.getenv("DB_PASSWORD", "kritik6979@")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "3306")
    db_name = os.getenv("DB_NAME", "threatlens")
    return f"mysql+pymysql://{db_user}:{quote_plus(db_password)}@{db_host}:{db_port}/{db_name}"


DATABASE_URL = _build_database_url()
ENGINE_KWARGS = {
    "pool_pre_ping": True,
    "pool_recycle": 3600,
}

if DATABASE_URL.startswith("sqlite:///"):
    ENGINE_KWARGS.update({
        "connect_args": {"check_same_thread": False},
    })

engine = create_engine(DATABASE_URL, **ENGINE_KWARGS)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_runtime_schema():
    """Lightweight additive migrations for the local prototype."""
    inspector = inspect(engine)

    incident_columns = {col["name"] for col in inspector.get_columns("incidents")} if inspector.has_table("incidents") else set()
    incident_additions = {
        "first_seen": "ALTER TABLE incidents ADD COLUMN first_seen DATETIME",
        "last_seen": "ALTER TABLE incidents ADD COLUMN last_seen DATETIME",
        "opened_at": "ALTER TABLE incidents ADD COLUMN opened_at DATETIME",
        "resolved_at": "ALTER TABLE incidents ADD COLUMN resolved_at DATETIME",
        "sla_due_at": "ALTER TABLE incidents ADD COLUMN sla_due_at DATETIME",
        "source": "ALTER TABLE incidents ADD COLUMN source VARCHAR(100)",
        "case_key": "ALTER TABLE incidents ADD COLUMN case_key VARCHAR(255)",
        "workflow_state": "ALTER TABLE incidents ADD COLUMN workflow_state VARCHAR(50)",
        "owner": "ALTER TABLE incidents ADD COLUMN owner VARCHAR(100)",
        "alert_count": "ALTER TABLE incidents ADD COLUMN alert_count INTEGER",
        "analyst_notes": "ALTER TABLE incidents ADD COLUMN analyst_notes TEXT",
        "status_history": "ALTER TABLE incidents ADD COLUMN status_history JSON",
        "evidence": "ALTER TABLE incidents ADD COLUMN evidence JSON",
        "explanation": "ALTER TABLE incidents ADD COLUMN explanation JSON",
        "recommended_actions": "ALTER TABLE incidents ADD COLUMN recommended_actions JSON",
        "tags": "ALTER TABLE incidents ADD COLUMN tags JSON",
        "asset_id": "ALTER TABLE incidents ADD COLUMN asset_id INTEGER",
    }

    with engine.begin() as connection:
        for column_name, statement in incident_additions.items():
            if column_name not in incident_columns:
                connection.execute(text(statement))

        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_incidents_last_seen ON incidents (last_seen)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_incidents_source ON incidents (source)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_incidents_case_key ON incidents (case_key)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_incidents_workflow_state ON incidents (workflow_state)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_incidents_owner ON incidents (owner)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_incidents_asset_id ON incidents (asset_id)"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
