"""Acesso ao banco pela API REST do Supabase, com a chave secreta (papel service_role).

Só o que o webhook precisa: ler a ocorrência e gravar a classificação pela função
gravar_classificacao (migração 20261124035604_classificacao_ia.sql).
"""

from dataclasses import dataclass
from uuid import UUID

import httpx

from app.config import settings
from app.schemas import Classificacao

TEMPO_LIMITE_SEGUNDOS = 10.0


# Os testes trocam por um httpx.MockTransport; em produção fica None (rede de verdade).
_transporte: httpx.BaseTransport | None = None


class BancoNaoConfigurado(RuntimeError):
    """Falta SUPABASE_URL ou SUPABASE_SECRET_KEY no ambiente."""


@dataclass(frozen=True)
class OcorrenciaParaClassificar:
    id: UUID
    descricao: str
    local: str | None
    ja_classificada: bool


def _cabecalhos(chave: str) -> dict[str, str]:
    """A chave nova (sb_secret_...) não é JWT: vai só no apikey, como pede a documentação do
    Supabase. A chave antiga (JWT service_role) precisa também do Authorization."""
    if chave.startswith("sb_secret_"):
        return {"apikey": chave}
    return {"apikey": chave, "Authorization": f"Bearer {chave}"}


def _cliente() -> httpx.Client:
    chave = settings.supabase_secret_key
    if not settings.supabase_url:
        raise BancoNaoConfigurado("SUPABASE_URL não configurada.")
    if not chave:
        raise BancoNaoConfigurado("SUPABASE_SECRET_KEY não configurada.")
    return httpx.Client(
        base_url=f"{settings.supabase_url.rstrip('/')}/rest/v1",
        headers=_cabecalhos(chave),
        timeout=TEMPO_LIMITE_SEGUNDOS,
        transport=_transporte,
    )


def buscar_ocorrencia(ocorrencia_id: UUID) -> OcorrenciaParaClassificar | None:
    """Lê a descrição e o local no banco e diz se a IA já classificou a ocorrência."""
    with _cliente() as cliente:
        resposta = cliente.get(
            "/ocorrencias",
            params={
                "id": f"eq.{ocorrencia_id}",
                "select": "id,descricao,local,classificacoes_ia(id)",
                "classificacoes_ia.status_processamento": "eq.sucesso",
            },
        )
        resposta.raise_for_status()
        linhas = resposta.json()
    if not linhas:
        return None
    linha = linhas[0]
    return OcorrenciaParaClassificar(
        id=UUID(linha["id"]),
        descricao=linha["descricao"],
        local=linha["local"],
        ja_classificada=bool(linha["classificacoes_ia"]),
    )


def gravar_classificacao(
    ocorrencia_id: UUID, classificacao: Classificacao, origem: str, modelo_versao: str
) -> None:
    """Grava pela função do banco. Repetir não duplica, e a escolha do gestor fica."""
    with _cliente() as cliente:
        resposta = cliente.post(
            "/rpc/gravar_classificacao",
            json={
                "p_ocorrencia_id": str(ocorrencia_id),
                "p_urgencia": classificacao.urgencia,
                "p_categoria": classificacao.categoria,
                "p_justificativa": classificacao.justificativa,
                "p_origem": origem,
                "p_modelo_versao": modelo_versao,
            },
        )
        resposta.raise_for_status()
