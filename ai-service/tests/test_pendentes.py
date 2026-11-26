"""Classificar pendentes (SQUAD1-80): listagem no banco e a rota, sem rede."""

from collections.abc import Callable
from uuid import UUID, uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app import banco, pendentes, webhook
from app.banco import OcorrenciaParaClassificar
from app.config import settings
from app.main import app

SEGREDO = "segredo-de-teste"

client = TestClient(app)


@pytest.fixture(autouse=True)
def configuracao(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "webhook_secret", SEGREDO)
    monkeypatch.setattr(settings, "supabase_url", "http://banco.teste")
    monkeypatch.setattr(settings, "supabase_secret_key", "sb_secret_chave-de-teste")


def cliente_falso(
    monkeypatch: pytest.MonkeyPatch, responder: Callable[[httpx.Request], httpx.Response]
) -> list[httpx.Request]:
    pedidos: list[httpx.Request] = []

    def transporte(pedido: httpx.Request) -> httpx.Response:
        pedidos.append(pedido)
        return responder(pedido)

    monkeypatch.setattr(banco, "_transporte", httpx.MockTransport(transporte))
    return pedidos


# --- banco.listar_pendentes ------------------------------------------------------


def test_listar_pendentes_pede_as_mais_antigas_com_limite(monkeypatch):
    pedidos = cliente_falso(monkeypatch, lambda _: httpx.Response(200, json=[]))

    banco.listar_pendentes(20)

    pedido = pedidos[0]
    assert pedido.method == "GET"
    assert pedido.url.path == "/rest/v1/ocorrencias"
    assert dict(pedido.url.params) == {
        "select": "id",
        "urgencia_atual": "is.null",
        "order": "created_at.asc",
        "limit": "20",
    }


def test_listar_pendentes_devolve_os_ids(monkeypatch):
    ids = [uuid4(), uuid4()]
    cliente_falso(monkeypatch, lambda _: httpx.Response(200, json=[{"id": str(i)} for i in ids]))

    assert banco.listar_pendentes(20) == ids


def test_listar_pendentes_com_erro_levanta(monkeypatch):
    cliente_falso(monkeypatch, lambda _: httpx.Response(500, json={"message": "fora"}))

    with pytest.raises(httpx.HTTPStatusError):
        banco.listar_pendentes(20)


# --- POST /classificar-pendentes ------------------------------------------------


def instalar(
    monkeypatch: pytest.MonkeyPatch, ids: list[UUID] | Exception
) -> tuple[list[int], list[UUID]]:
    """Troca a listagem e o classificar_e_gravar. Devolve os limites pedidos e os ids
    classificados."""
    limites: list[int] = []
    classificados: list[UUID] = []

    def listar(limite: int) -> list[UUID]:
        limites.append(limite)
        if isinstance(ids, Exception):
            raise ids
        return ids

    monkeypatch.setattr(pendentes.banco, "listar_pendentes", listar)
    monkeypatch.setattr(pendentes, "classificar_e_gravar", classificados.append)
    return limites, classificados


def pedir(segredo: str | None = SEGREDO) -> httpx.Response:
    cabecalhos = {} if segredo is None else {"X-Webhook-Secret": segredo}
    return client.post("/classificar-pendentes", headers=cabecalhos)


def test_segredo_errado_da_401_e_nao_lista(monkeypatch):
    limites, _ = instalar(monkeypatch, [uuid4()])

    assert pedir("outro").status_code == 401
    assert pedir(None).status_code == 401
    assert limites == []


def test_responde_202_e_classifica_cada_pendente(monkeypatch):
    ids = [uuid4(), uuid4(), uuid4()]
    _, classificados = instalar(monkeypatch, ids)

    resposta = pedir()

    assert resposta.status_code == 202
    assert resposta.content == b""
    assert classificados == ids


def test_pede_no_maximo_20(monkeypatch):
    limites, _ = instalar(monkeypatch, [])

    pedir()

    assert limites == [20]


def test_pendente_ja_classificada_nao_grava(monkeypatch):
    alvo = uuid4()
    monkeypatch.setattr(pendentes.banco, "listar_pendentes", lambda limite: [alvo])
    monkeypatch.setattr(
        webhook.banco,
        "buscar_ocorrencia",
        lambda _: OcorrenciaParaClassificar(alvo, "Vazamento", None, ja_classificada=True),
    )
    gravadas: list[UUID] = []
    monkeypatch.setattr(
        webhook.banco, "gravar_classificacao", lambda ocorrencia_id, *_: gravadas.append(alvo)
    )

    assert pedir().status_code == 202
    assert gravadas == []


def test_erro_ao_listar_fica_no_log(monkeypatch, caplog):
    _, classificados = instalar(monkeypatch, RuntimeError("Supabase fora"))

    resposta = pedir()

    assert resposta.status_code == 202
    assert classificados == []
    assert "Falha ao listar" in caplog.text


def test_rodada_em_andamento_nao_comeca_outra(monkeypatch):
    limites, _ = instalar(monkeypatch, [uuid4()])

    assert pendentes._rodando.acquire(blocking=False)
    try:
        pendentes.classificar_pendentes()
    finally:
        pendentes._rodando.release()

    assert limites == []
