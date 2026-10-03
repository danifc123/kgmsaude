from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"


class Settings(BaseSettings):
    """Configurações da aplicação, lidas do ambiente ou do arquivo .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    admin_email: str = "admin@kgsaude.local"
    admin_password: str = "admin"
    antecedencia_minima_minutos: int = 120
    cors_origins: list[str] = ["http://127.0.0.1:8000"]
    database_url: str = "sqlite:///./kg.db"
    dias_maximos_agendamento: int = 30
    environment: str = "development"
    intervalo_grade_minutos: int = 30
    jwt_expira_minutos: int = 60 * 12
    jwt_secret: str = "dev-secret-troque-em-producao"
    sinal_percentual: int = 50
    timezone: str = "America/Fortaleza"


@lru_cache
def get_settings() -> Settings:
    """Retorna a instância única de Settings."""
    return Settings()
