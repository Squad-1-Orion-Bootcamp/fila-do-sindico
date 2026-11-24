import json
from uuid import UUID, uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app import banco, webhook
from app.banco import OcorrenciaParaClassificar
from app.config import settings
from app.main import app
from app.schemas import Classificacao

SEGREDO = "segredo-de-teste"

client = TestClient(app)


@pytest.fixture(autouse=True)
def configuracao(monkeypatch):
    monkeypatch.setattr(settings, "webhook_secret", SEGREDO)
    monkeypatch.setattr(settings, "supabase_url", "http://banco.teste")
    monkeypatch.setattr(settings, "supabase_secret_key", "sb_secret_chave-de-teste")


class BancoFalso:
    """Substitui o app.banco nos testes do webhook."""

    def __init__(self, ocorrencia: OcorrenciaParaClassificar | None):
        self.ocorrencia = ocorrencia
        self.gravadas: list[tuple[UUID, Classificacao, str, str]] = []

    def buscar_ocorrencia(self, ocorrencia_id: UUID) -> OcorrenciaParaClassificar | None:
        return self.ocorrencia

    def gravar_classificacao(self, ocorrencia_id, classificacao, origem, modelo_versao) -> None:
        self.gravadas.append((ocorrencia_id, classificacao, origem, modelo_versao))


def instalar_banco(monkeypatch, ocorrencia: OcorrenciaParaClassificar | None) -> BancoFalso:
    falso = BancoFalso(ocorrencia)
    monkeypatch.setattr(webhook.banco, "buscar_ocorrencia", falso.buscar_ocorrencia)
    monkeypatch.setattr(webhook.banco, "gravar_classificacao", falso.gravar_classificacao)
    return falso


def ocorrencia(descricao: str, ja_classificada: bool = False) -> OcorrenciaParaClassificar:
    return OcorrenciaParaClassificar(
        id=uuid4(), descricao=descricao, local="Bloco A", ja_classificada=ja_classificada
    )


def avisar(ocorrencia_id: UUID, segredo: str | None = SEGREDO, **corpo_extra):
    cabecalhos = {} if segredo is None else {"X-Webhook-Secret": segredo}
    corpo = {"id": str(ocorrencia_id), "descricao": "texto", "local": None, **corpo_extra}
    return client.post("/webhook", json=corpo, headers=cabecalhos)


# --- Segredo -----------------------------------------------------------------


def test_segredo_errado_da_401_e_nao_classifica(monkeypatch):
    falso = instalar_banco(monkeypatch, ocorrencia("Cheiro de gás"))
    resposta = avisar(uuid4(), segredo="outro")
    assert resposta.status_code == 401
    assert falso.gravadas == []


def test_sem_cabecalho_da_401(monkeypatch):
    instalar_banco(monkeypatch, ocorrencia("Cheiro de gás"))
    assert avisar(uuid4(), segredo=None).status_code == 401


def test_servidor_sem_segredo_recusa_tudo(monkeypatch):
    monkeypatch.setattr(settings, "webhook_secret", "")
    falso = instalar_banco(monkeypatch, ocorrencia("Cheiro de gás"))
    assert avisar(uuid4(), segredo="").status_code == 401
    assert falso.gravadas == []


def test_segredo_errado_da_401_mesmo_com_corpo_invalido():
    resposta = client.post("/webhook", json={"id": "nao-e-uuid"}, headers={"X-Webhook-Secret": "x"})
    assert resposta.status_code == 401


# --- Sucesso -----------------------------------------------------------------


def test_sucesso_responde_202_sem_corpo_e_grava(monkeypatch):
    alvo = ocorrencia("Cheiro forte de gás no corredor")
    falso = instalar_banco(monkeypatch, alvo)

    resposta = avisar(alvo.id)

    assert resposta.status_code == 202
    assert resposta.content == b""
    assert len(falso.gravadas) == 1
    ocorrencia_id, classificacao, origem, modelo_versao = falso.gravadas[0]
    assert ocorrencia_id == alvo.id
    assert classificacao.urgencia == "urgente"
    assert classificacao.categoria == "seguranca"
    assert origem == "regra"
    assert modelo_versao == "regras-provisorias"


def test_classifica_pelo_texto_do_banco_e_nao_pelo_do_corpo(monkeypatch):
    alvo = ocorrencia("Lâmpada da garagem queimada")
    falso = instalar_banco(monkeypatch, alvo)

    avisar(alvo.id, descricao="Cheiro de gás e fumaça")

    assert falso.gravadas[0][1].urgencia == "normal"


# --- Ocorrência repetida ou inexistente ----------------------------------------


def test_ocorrencia_ja_classificada_nao_grava_de_novo(monkeypatch):
    alvo = ocorrencia("Cano vazando", ja_classificada=True)
    falso = instalar_banco(monkeypatch, alvo)

    resposta = avisar(alvo.id)

    assert resposta.status_code == 202
    assert falso.gravadas == []


def test_ocorrencia_inexistente_nao_grava(monkeypatch):
    falso = instalar_banco(monkeypatch, None)
    assert avisar(uuid4()).status_code == 202
    assert falso.gravadas == []


def test_erro_no_banco_nao_derruba_o_servico(monkeypatch):
    def falhar(_):
        raise httpx.ConnectError("banco fora do ar")

    monkeypatch.setattr(webhook.banco, "buscar_ocorrencia", falhar)
    assert avisar(uuid4()).status_code == 202
    assert client.get("/health").status_code == 200


# --- Cliente do banco (app.banco) ---------------------------------------------


def cliente_falso(monkeypatch, responder):
    pedidos: list[httpx.Request] = []

    def transporte(pedido: httpx.Request) -> httpx.Response:
        pedidos.append(pedido)
        return responder(pedido)

    monkeypatch.setattr(banco, "_transporte", httpx.MockTransport(transporte))
    return pedidos


def test_buscar_ocorrencia_usa_a_chave_secreta_e_ve_se_ja_foi_classificada(monkeypatch):
    alvo = uuid4()
    linha = {"id": str(alvo), "descricao": "Vazamento", "local": None, "classificacoes_ia": []}
    pedidos = cliente_falso(monkeypatch, lambda _: httpx.Response(200, json=[linha]))

    resultado = banco.buscar_ocorrencia(alvo)

    assert resultado == OcorrenciaParaClassificar(alvo, "Vazamento", None, False)
    pedido = pedidos[0]
    assert pedido.url.path == "/rest/v1/ocorrencias"
    assert pedido.url.params["id"] == f"eq.{alvo}"
    assert pedido.url.params["classificacoes_ia.status_processamento"] == "eq.sucesso"
    assert pedido.headers["apikey"] == "sb_secret_chave-de-teste"
    # A chave nova não é JWT: o Supabase pede que ela não vá no Authorization.
    assert "authorization" not in pedido.headers


def test_chave_antiga_em_jwt_vai_tambem_no_authorization(monkeypatch):
    monkeypatch.setattr(settings, "supabase_secret_key", "eyJ.chave.antiga")
    pedidos = cliente_falso(monkeypatch, lambda _: httpx.Response(200, json=[]))

    banco.buscar_ocorrencia(uuid4())

    assert pedidos[0].headers["apikey"] == "eyJ.chave.antiga"
    assert pedidos[0].headers["authorization"] == "Bearer eyJ.chave.antiga"


def test_buscar_ocorrencia_classificada(monkeypatch):
    alvo = uuid4()
    linha = {"id": str(alvo), "descricao": "x", "local": "y", "classificacoes_ia": [{"id": "c"}]}
    cliente_falso(monkeypatch, lambda _: httpx.Response(200, json=[linha]))
    assert banco.buscar_ocorrencia(alvo).ja_classificada is True


def test_buscar_ocorrencia_inexistente(monkeypatch):
    cliente_falso(monkeypatch, lambda _: httpx.Response(200, json=[]))
    assert banco.buscar_ocorrencia(uuid4()) is None


def test_gravar_classificacao_chama_a_funcao_do_banco(monkeypatch):
    alvo = uuid4()
    pedidos = cliente_falso(monkeypatch, lambda _: httpx.Response(200, json=str(uuid4())))
    classificacao = Classificacao(urgencia="alta", categoria="hidraulica", justificativa="Vaza.")

    banco.gravar_classificacao(alvo, classificacao, "regra", "regras-provisorias")

    pedido = pedidos[0]
    assert pedido.url.path == "/rest/v1/rpc/gravar_classificacao"
    assert json.loads(pedido.content) == {
        "p_ocorrencia_id": str(alvo),
        "p_urgencia": "alta",
        "p_categoria": "hidraulica",
        "p_justificativa": "Vaza.",
        "p_origem": "regra",
        "p_modelo_versao": "regras-provisorias",
    }


def test_gravar_classificacao_com_erro_do_banco_levanta(monkeypatch):
    cliente_falso(
        monkeypatch, lambda _: httpx.Response(400, json={"message": "Urgência inválida."})
    )
    classificacao = Classificacao(urgencia="alta", categoria="x", justificativa="y")
    with pytest.raises(httpx.HTTPStatusError):
        banco.gravar_classificacao(uuid4(), classificacao, "regra", "regras-provisorias")


def test_sem_service_role_nao_chama_o_banco(monkeypatch):
    monkeypatch.setattr(settings, "supabase_secret_key", "")
    with pytest.raises(banco.BancoNaoConfigurado):
        banco.buscar_ocorrencia(uuid4())
