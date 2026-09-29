from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def get_health() -> dict[str, str]:
    """Verifica se a API está no ar. Retorna {"status": "ok"}."""
    return {"status": "ok"}
