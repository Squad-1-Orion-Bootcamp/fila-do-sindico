from typing import Literal

from pydantic import BaseModel, Field

Urgencia = Literal["urgente", "alta", "normal", "baixa"]


class OcorrenciaEntrada(BaseModel):
    descricao: str = Field(min_length=1)
    local: str | None = None


class Classificacao(BaseModel):
    urgencia: Urgencia
    categoria: str
    justificativa: str = Field(description="Por que essa urgência, em uma frase para o síndico")
