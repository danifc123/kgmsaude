from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configurações da aplicação, lidas do ambiente ou do arquivo .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    cors_origins: list[str] = ["http://127.0.0.1:8843"]
    database_url: str = "sqlite:///./kg.db"
    environment: str = "development"


@lru_cache
def get_settings() -> Settings:
    """Retorna a instância única de Settings."""
    return Settings()
