from typing import Literal

from pydantic import BaseModel, Field

# Os mesmos valores do banco (ocorrencias.urgencia_atual), como no contrato da SQUAD1-56.
Urgencia = Literal["urgente", "alta", "normal", "baixa"]


class OcorrenciaEntrada(BaseModel):
    descricao: str = Field(min_length=1)
    local: str | None = None


class Classificacao(BaseModel):
    urgencia: Urgencia
    categoria: str
    justificativa: str = Field(description="Por que essa urgência, em uma frase para o síndico")
