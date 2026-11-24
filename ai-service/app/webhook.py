"""POST /webhook: aviso do banco a cada ocorrência nova (gatilho classificar_ocorrencia).

Contrato com a SQUAD1-59: cabeçalho X-Webhook-Secret e corpo {id, descricao, local}.
Responde 202 na hora e classifica em segundo plano. Só o id do corpo é usado: a descrição e
o local vêm do banco, para ninguém conseguir mudar a prioridade de uma ocorrência mandando
outro texto.
"""

import hmac
import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Response, status
from pydantic import BaseModel

from app import banco
from app.classifier import classificar
from app.config import settings
from app.schemas import OcorrenciaEntrada

logger = logging.getLogger(__name__)

router = APIRouter()

# Enquanto o LLM (SQUAD1-62) não entra, toda classificação sai das regras provisórias.
ORIGEM = "regra"
MODELO_VERSAO = "regras-provisorias"


class AvisoOcorrencia(BaseModel):
    """Corpo que o gatilho manda. descricao e local chegam, mas não são usados."""

    id: UUID


def conferir_segredo(x_webhook_secret: Annotated[str | None, Header()] = None) -> None:
    """Roda antes de ler o corpo: sem o segredo certo, a resposta é sempre 401."""
    esperado = settings.webhook_secret
    if not esperado:
        logger.warning("WEBHOOK_SECRET vazio: o webhook recusa toda chamada.")
    if (
        not esperado
        or x_webhook_secret is None
        or not hmac.compare_digest(x_webhook_secret.encode(), esperado.encode())
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Segredo do webhook inválido.")


def classificar_e_gravar(ocorrencia_id: UUID) -> None:
    """Segundo plano. Qualquer falha fica no log e a ocorrência continua em "Aguardando
    triagem", para o "classificar pendentes" (SQUAD1-80) pegar depois."""
    try:
        ocorrencia = banco.buscar_ocorrencia(ocorrencia_id)
        if ocorrencia is None:
            logger.warning("Ocorrência %s não encontrada no banco.", ocorrencia_id)
            return
        if ocorrencia.ja_classificada:
            logger.info("Ocorrência %s já classificada: nada a fazer.", ocorrencia_id)
            return
        resultado = classificar(
            OcorrenciaEntrada(descricao=ocorrencia.descricao, local=ocorrencia.local)
        )
        banco.gravar_classificacao(ocorrencia_id, resultado, ORIGEM, MODELO_VERSAO)
        logger.info("Ocorrência %s classificada como %s.", ocorrencia_id, resultado.urgencia)
    except Exception:
        logger.exception("Falha ao classificar a ocorrência %s.", ocorrencia_id)


@router.post(
    "/webhook",
    status_code=status.HTTP_202_ACCEPTED,
    response_class=Response,
    dependencies=[Depends(conferir_segredo)],
)
def receber_aviso(aviso: AvisoOcorrencia, tarefas: BackgroundTasks) -> Response:
    tarefas.add_task(classificar_e_gravar, aviso.id)
    return Response(status_code=status.HTTP_202_ACCEPTED)
