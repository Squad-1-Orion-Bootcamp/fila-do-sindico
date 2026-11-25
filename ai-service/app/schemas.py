from typing import Literal

from pydantic import BaseModel, Field

from app.contrato import Categoria, Urgencia

__all__ = [
    "Categoria",
    "Classificacao",
    "OcorrenciaEntrada",
    "Origem",
    "ResultadoClassificacao",
    "Urgencia",
]

# Os mesmos valores aceitos por classificacoes_ia.origem no banco.
Origem = Literal["ia", "regra", "ia+trava", "regra+trava"]


class OcorrenciaEntrada(BaseModel):
    descricao: str = Field(min_length=1)
    local: str | None = None


class Classificacao(BaseModel):
    urgencia: Urgencia
    categoria: Categoria
    justificativa: str = Field(description="Por que essa urgência, em uma frase para o síndico")


class ResultadoClassificacao(BaseModel):
    """O que o classificar() devolve: a classificação e de onde ela veio."""

    classificacao: Classificacao
    origem: Origem
    modelo_versao: str
    # Confiança do Decision 1 (0 a 1). None quando as regras decidiram. Por enquanto só vai
    # para o log: gravar no banco fica para a Sprint 3 (precisa de migração).
    confianca: float | None = None
