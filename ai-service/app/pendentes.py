"""POST /classificar-pendentes: rede de segurança do webhook (SQUAD1-80).

O banco chama esta rota quando o gestor abre o painel (função classificar_pendentes). Classifica
as ocorrências que ficaram sem prioridade porque o aviso do gatilho se perdeu (ai-service fora
do ar, reinício no meio da classificação, Vault sem configuração).
"""

import logging
import threading

from fastapi import APIRouter, BackgroundTasks, Depends, Response, status

from app import banco
from app.webhook import classificar_e_gravar, conferir_segredo

logger = logging.getLogger(__name__)

router = APIRouter()

# Para não estourar a cota grátis da Gemini numa chamada só. As demais ficam para a próxima.
LIMITE_POR_CHAMADA = 20

# Dois gestores abrindo o painel juntos não classificam a mesma ocorrência duas vezes.
_rodando = threading.Lock()


def classificar_pendentes() -> None:
    """Segundo plano. Falhas ficam no log; as pendentes continuam para a próxima chamada."""
    if not _rodando.acquire(blocking=False):
        logger.info("Classificação das pendentes já em andamento: nada a fazer.")
        return
    try:
        try:
            ids = banco.listar_pendentes(LIMITE_POR_CHAMADA)
        except Exception:
            logger.exception("Falha ao listar as ocorrências pendentes.")
            return
        logger.info("%d ocorrência(s) pendente(s) para classificar.", len(ids))
        for ocorrencia_id in ids:
            classificar_e_gravar(ocorrencia_id)
    finally:
        _rodando.release()


@router.post(
    "/classificar-pendentes",
    status_code=status.HTTP_202_ACCEPTED,
    response_class=Response,
    dependencies=[Depends(conferir_segredo)],
)
def receber_pedido(tarefas: BackgroundTasks) -> Response:
    tarefas.add_task(classificar_pendentes)
    return Response(status_code=status.HTTP_202_ACCEPTED)
