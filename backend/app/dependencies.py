from collections.abc import Iterator

from sqlalchemy.orm import Session

from app.database import SessionLocal


def get_db() -> Iterator[Session]:
    """Abre uma sessão de banco por requisição e garante o fechamento."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
