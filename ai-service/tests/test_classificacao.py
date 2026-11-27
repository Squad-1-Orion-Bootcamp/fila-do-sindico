"""Orquestração do classificar() e o System 1 (decidir), sem rede: só dublês."""

from types import SimpleNamespace

import httpx
import pytest

from app import decisao
from app.classifier import classificar
from app.config import settings
from app.contrato import CATEGORIAS, URGENCIAS
from app.decisao import Decisao, DecisaoIndisponivel, decidir
from app.schemas import OcorrenciaEntrada


@pytest.fixture
def com_chave(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "chave-falsa-de-teste")


def decisor_fixo(urgencia="alta", categoria="hidraulica", confianca=0.91):
    chamadas: list[tuple[str, str | None]] = []

    def decisor(descricao: str, local: str | None) -> Decisao:
        chamadas.append((descricao, local))
        return Decisao(urgencia=urgencia, categoria=categoria, confianca=confianca)

    decisor.chamadas = chamadas
    return decisor


def decisor_que_falha(erro: Exception):
    def decisor(descricao: str, local: str | None) -> Decisao:
        raise erro

    return decisor


def entrada(descricao: str, local: str | None = None) -> OcorrenciaEntrada:
    return OcorrenciaEntrada(descricao=descricao, local=local)


# --- Orquestração -------------------------------------------------------------


def test_decision_1_decide(com_chave):
    decisor = decisor_fixo()
    resultado = classificar(entrada("Infiltração no teto", "Bloco B"), decisor=decisor)

    assert decisor.chamadas == [("Infiltração no teto", "Bloco B")]
    assert resultado.classificacao.urgencia == "alta"
    assert resultado.classificacao.categoria == "hidraulica"
    assert resultado.classificacao.justificativa == "Classificada como Alta pela IA."
    assert resultado.origem == "ia"
    assert resultado.modelo_versao == "gemini-decision-1"
    assert resultado.confianca == 0.91


def test_decision_1_com_erro_cai_nas_regras(com_chave):
    erro = RuntimeError("API fora do ar")
    resultado = classificar(entrada("Cano vazando na garagem"), decisor=decisor_que_falha(erro))

    assert resultado.classificacao.urgencia == "alta"
    assert resultado.classificacao.categoria == "hidraulica"
    assert resultado.origem == "regra"
    assert resultado.modelo_versao == "regras-provisorias"
    assert resultado.confianca is None


def test_decision_1_demorado_cai_nas_regras(com_chave):
    # O SDK desiste depois de LLM_TIMEOUT_SEGUNDOS e levanta o timeout do httpx.
    erro = httpx.ReadTimeout("passou de 3 s")
    resultado = classificar(entrada("Barulho de festa no 5º"), decisor=decisor_que_falha(erro))

    assert resultado.classificacao.urgencia == "baixa"
    assert resultado.classificacao.categoria == "convivencia"
    assert resultado.origem == "regra"


def test_sem_chave_nem_chama_o_decision_1():
    decisor = decisor_fixo()
    resultado = classificar(entrada("Lâmpada queimada no hall"), decisor=decisor)

    assert decisor.chamadas == []
    assert resultado.origem == "regra"
    assert resultado.modelo_versao == "regras-provisorias"
    assert (
        resultado.classificacao.justificativa == "Regra provisória: a descrição menciona 'lâmpada'."
    )


def test_trava_com_ia_vira_urgente_e_ia_mais_trava(com_chave):
    decisor = decisor_fixo(urgencia="normal", categoria="seguranca")
    resultado = classificar(entrada("Cheiro de gás na escada"), decisor=decisor)

    assert resultado.classificacao.urgencia == "urgente"
    assert resultado.classificacao.categoria == "seguranca"
    assert resultado.origem == "ia+trava"
    assert resultado.modelo_versao == "gemini-decision-1"
    assert resultado.classificacao.justificativa == "Trava de risco: a descrição menciona 'gás'."


def test_trava_com_regras_vira_urgente_e_regra_mais_trava():
    resultado = classificar(entrada("Barulho e choque no salão de festas"))

    assert resultado.classificacao.urgencia == "urgente"
    assert resultado.classificacao.categoria == "convivencia"
    assert resultado.origem == "regra+trava"
    assert resultado.modelo_versao == "regras-provisorias"


def test_justificativa_recebe_a_urgencia_final(com_chave):
    recebido = []

    def justificar(descricao, local, urgencia):
        recebido.append((descricao, local, urgencia))
        return "  Cheiro de gás é risco de explosão.  "

    resultado = classificar(
        entrada("Cheiro de gás na escada", "Bloco A"),
        decisor=decisor_fixo(urgencia="normal", categoria="seguranca"),
        justificar=justificar,
    )

    assert recebido == [("Cheiro de gás na escada", "Bloco A", "urgente")]
    assert resultado.classificacao.justificativa == "Cheiro de gás é risco de explosão."


def test_justificativa_com_erro_usa_o_motivo_padrao(com_chave):
    def justificar(descricao, local, urgencia):
        raise RuntimeError("System 2 fora do ar")

    resultado = classificar(
        entrada("Infiltração no teto"), decisor=decisor_fixo(), justificar=justificar
    )

    assert resultado.classificacao.justificativa == "Classificada como Alta pela IA."
    assert resultado.origem == "ia"


def test_justificativa_vazia_usa_o_motivo_padrao(com_chave):
    resultado = classificar(
        entrada("Infiltração no teto"),
        decisor=decisor_fixo(),
        justificar=lambda descricao, local, urgencia: "   ",
    )

    assert resultado.classificacao.justificativa == "Classificada como Alta pela IA."


# --- System 1: decidir() com um cliente dublê --------------------------------


class ClienteFalso:
    """Mesmo formato do genai.Client: cliente.decisions.create(...)."""

    def __init__(self, resposta=None, erro: Exception | None = None):
        self.resposta = resposta
        self.erro = erro
        self.pedidos: list[dict] = []
        self.decisions = self

    def create(self, **pedido):
        self.pedidos.append(pedido)
        if self.erro is not None:
            raise self.erro
        return self.resposta


def resposta(urgencia="urgente", categoria="elevador", conf_urgencia=0.97, conf_categoria=0.88):
    return SimpleNamespace(
        answers={
            "urgencia": SimpleNamespace(type="choice", choice=urgencia, confidence=conf_urgencia),
            "categoria": SimpleNamespace(
                type="choice", choice=categoria, confidence=conf_categoria
            ),
        },
        prompt_feedback=None,
    )


def test_decidir_manda_duas_perguntas_choice_com_as_descricoes_do_contrato():
    cliente = ClienteFalso(resposta())
    decidir("Pessoa presa no elevador", "Bloco C", cliente=cliente)

    (pedido,) = cliente.pedidos
    assert pedido["model"] == "gemini-decision-1"
    assert "Pessoa presa no elevador" in pedido["input"]
    assert "Bloco C" in pedido["input"]
    perguntas = pedido["questions"]
    assert set(perguntas) == {"urgencia", "categoria"}
    assert perguntas["urgencia"]["type"] == "choice"
    assert perguntas["urgencia"]["criteria"] == URGENCIAS
    assert perguntas["categoria"]["type"] == "choice"
    assert perguntas["categoria"]["criteria"] == CATEGORIAS


def test_decidir_devolve_a_escolha_e_a_menor_confianca():
    resultado = decidir("Pessoa presa no elevador", None, cliente=ClienteFalso(resposta()))

    assert resultado == Decisao(urgencia="urgente", categoria="elevador", confianca=0.88)


def test_decidir_sem_local_nao_manda_a_linha_do_local():
    cliente = ClienteFalso(resposta())
    decidir("Lâmpada queimada", None, cliente=cliente)

    assert "Local:" not in cliente.pedidos[0]["input"]


def test_decidir_bloqueado_pelo_filtro_levanta():
    bloqueada = SimpleNamespace(
        answers=None, prompt_feedback=SimpleNamespace(block_reason="SAFETY")
    )
    with pytest.raises(DecisaoIndisponivel, match="SAFETY"):
        decidir("texto", None, cliente=ClienteFalso(bloqueada))


def test_decidir_com_opcao_fora_do_contrato_levanta():
    with pytest.raises(ValueError):
        decidir("texto", None, cliente=ClienteFalso(resposta(categoria="jardinagem")))


def test_decidir_repassa_o_erro_do_cliente():
    with pytest.raises(httpx.ConnectError):
        decidir("texto", None, cliente=ClienteFalso(erro=httpx.ConnectError("sem rede")))


def test_cliente_de_verdade_sem_nova_tentativa_e_com_limite_de_3_segundos():
    decisao.criar_cliente.cache_clear()
    cliente = decisao.criar_cliente("chave-falsa-de-teste")
    try:
        opcoes = cliente._api_client._http_options
        assert opcoes.api_version == "v1beta"
        assert opcoes.timeout == 3000
        assert opcoes.retry_options.attempts == 1
    finally:
        decisao.criar_cliente.cache_clear()
