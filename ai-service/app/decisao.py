"""System 1: o Gemini Decision 1 decide a urgência e a categoria (SQUAD1-84).

Uma chamada a client.decisions.create (API v1beta) com duas perguntas do tipo "choice". As
opções e as descrições vêm de app/contrato.py. O Decision 1 não gera texto: devolve a opção
mais provável de cada pergunta e a confiança calibrada (0 a 1).

Assinatura conferida na documentação oficial (aistudio.google.com/docs/decisions-api) e no
SDK google-genai 3.6.1. Sem tentar de novo: com o limite de 3 s, é melhor cair logo nas regras.
"""

from functools import lru_cache
from typing import Any, Protocol

from google import genai
from google.genai import types
from pydantic import BaseModel

from app.config import settings
from app.contrato import CATEGORIAS, URGENCIAS, Categoria, Urgencia


class DecisaoIndisponivel(Exception):
    """O Decision 1 não devolveu uma resposta usável (bloqueio do filtro ou resposta incompleta)."""


class Decisao(BaseModel):
    urgencia: Urgencia
    categoria: Categoria
    # A menor das duas confianças (urgência e categoria): a decisão é tão confiável quanto a
    # pergunta mais incerta.
    confianca: float


class ClienteDecisoes(Protocol):
    """O que o decidir() usa do genai.Client. Os testes passam um dublê com o mesmo formato."""

    @property
    def decisions(self) -> Any: ...


@lru_cache(maxsize=1)
def criar_cliente(chave: str) -> genai.Client:
    return genai.Client(
        api_key=chave,
        http_options=types.HttpOptions(
            api_version="v1beta",
            timeout=int(settings.llm_timeout_segundos * 1000),  # em milissegundos
            retry_options=types.HttpRetryOptions(attempts=1),  # sem nova tentativa
        ),
    )


def _texto_da_ocorrencia(descricao: str, local: str | None) -> str:
    texto = f"Ocorrência registrada num condomínio.\nDescrição: {descricao}"
    if local:
        texto += f"\nLocal: {local}"
    return texto


PERGUNTAS: dict[str, dict[str, Any]] = {
    "urgencia": {
        "type": "choice",
        "instructions": "Qual é a urgência desta ocorrência para o síndico do condomínio?",
        "criteria": dict(URGENCIAS),
    },
    "categoria": {
        "type": "choice",
        "instructions": "Qual é a categoria desta ocorrência do condomínio?",
        "criteria": dict(CATEGORIAS),
    },
}


def decidir(descricao: str, local: str | None, cliente: ClienteDecisoes | None = None) -> Decisao:
    """Pergunta ao Decision 1 a urgência e a categoria. Levanta exceção se falhar ou demorar."""
    if cliente is None:
        cliente = criar_cliente(settings.llm_api_key)
    resposta = cliente.decisions.create(
        model=settings.llm_modelo_decisao,
        input=_texto_da_ocorrencia(descricao, local),
        questions=PERGUNTAS,
    )
    respostas = resposta.answers or {}
    urgencia = respostas.get("urgencia")
    categoria = respostas.get("categoria")
    if urgencia is None or categoria is None:
        motivo = getattr(resposta.prompt_feedback, "block_reason", None)
        raise DecisaoIndisponivel(f"Decision 1 sem resposta completa (bloqueio: {motivo}).")
    return Decisao(
        urgencia=urgencia.choice,
        categoria=categoria.choice,
        confianca=min(urgencia.confidence, categoria.confidence),
    )
