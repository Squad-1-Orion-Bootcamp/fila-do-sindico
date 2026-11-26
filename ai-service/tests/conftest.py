import pytest
from pydantic_ai import models

from app.config import settings

# Rede de segurança: nenhum agente do Pydantic AI chama um modelo de verdade nos testes.
models.ALLOW_MODEL_REQUESTS = False


@pytest.fixture(autouse=True)
def sem_chave_da_gemini(monkeypatch):
    """Nenhum teste chama a Gemini de verdade, mesmo com LLM_API_KEY no ai-service/.env.

    Sem a chave, o classificar() usa só as regras. Os testes do Decision 1 põem uma chave
    falsa e passam um dublê no lugar do cliente.
    """
    monkeypatch.setattr(settings, "llm_api_key", "")
