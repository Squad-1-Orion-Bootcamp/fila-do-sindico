from fastapi import FastAPI

from app.classifier import classificar
from app.schemas import Classificacao, OcorrenciaEntrada
from app.webhook import router as webhook_router

app = FastAPI(title="Fila do Síndico — Serviço de IA", version="0.1.0")
app.include_router(webhook_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/classificar", response_model=Classificacao)
def classificar_ocorrencia(ocorrencia: OcorrenciaEntrada) -> Classificacao:
    return classificar(ocorrencia).classificacao
