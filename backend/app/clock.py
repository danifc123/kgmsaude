from datetime import datetime
from zoneinfo import ZoneInfo

from app.config import get_settings


def agora_local() -> datetime:
    """Retorna o horário atual no fuso do espaço, sem tzinfo (padrão do banco)."""
    return datetime.now(ZoneInfo(get_settings().timezone)).replace(tzinfo=None, microsecond=0)
