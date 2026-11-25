"""Classificar pendentes (SQUAD1-80): listagem no banco e a rota, sem rede."""

from collections.abc import Callable
from uuid import uuid4

import httpx
import pytest

from app import banco
from app.config import settings

SEGREDO = "segredo-de-teste"


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
