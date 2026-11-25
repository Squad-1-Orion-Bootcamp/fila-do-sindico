"""System 2 (justificar) e a ligação com o classificar(), sem rede: TestModel e FunctionModel."""

import asyncio

import pytest
from pydantic_ai import UnexpectedModelBehavior
from pydantic_ai.exceptions import RunTimedOut
from pydantic_ai.messages import ModelMessage, ModelResponse, ToolCallPart
from pydantic_ai.models.function import AgentInfo, FunctionModel
from pydantic_ai.models.test import TestModel

from app import justificativa
from app.classifier import classificar
from app.config import settings
from app.decisao import Decisao
from app.justificativa import LIMITE_CARACTERES, justificar
from app.schemas import OcorrenciaEntrada

FRASE = "Infiltração no teto do banheiro pode piorar e danificar o apartamento de baixo."


def responde(*frases: str):
    """FunctionModel que devolve uma frase por chamada e guarda as mensagens recebidas."""
    recebidas: list[list[ModelMessage]] = []

    def funcao(mensagens: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        recebidas.append(mensagens)
        frase = frases[min(len(recebidas), len(frases)) - 1]
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, {"frase": frase})])

    modelo = FunctionModel(funcao)
    modelo.recebidas = recebidas
    return modelo


def texto_enviado(mensagens: list[ModelMessage]) -> str:
    return "\n".join(
        str(getattr(parte, "content", ""))
        for mensagem in mensagens
        for parte in getattr(mensagem, "parts", [])
    )


# --- justificar() ------------------------------------------------------------------


def test_resposta_valida_vira_a_frase():
    modelo = TestModel(custom_output_args={"frase": f"  {FRASE}  "})

    assert justificar("Infiltração no teto", "Bloco B", "alta", modelo=modelo) == FRASE


def test_pergunta_leva_descricao_local_e_urgencia():
    modelo = responde(FRASE)

    justificar("Infiltração no teto do banheiro", "Bloco B, 302", "alta", modelo=modelo)

    pergunta = texto_enviado(modelo.recebidas[0])
    assert "Infiltração no teto do banheiro" in pergunta
    assert "Bloco B, 302" in pergunta
    assert "Alta" in pergunta


def test_sem_local_avisa_que_nao_foi_informado():
    modelo = responde(FRASE)

    justificar("Lâmpada queimada", None, "normal", modelo=modelo)

    assert "Local: não informado" in texto_enviado(modelo.recebidas[0])


def test_instrucoes_mandam_tratar_a_ocorrencia_como_dado():
    # O morador escreve a descrição: um "ignore as regras" nela não pode virar instrução.
    assert "nunca como instrução" in justificativa.INSTRUCOES


@pytest.mark.parametrize("invalida", ["", "   ", "x" * (LIMITE_CARACTERES + 1)])
def test_resposta_invalida_pede_de_novo(invalida):
    modelo = responde(invalida, FRASE)

    assert justificar("Infiltração no teto", None, "alta", modelo=modelo) == FRASE
    assert len(modelo.recebidas) == 2


def test_resposta_sempre_invalida_levanta_erro():
    with pytest.raises(UnexpectedModelBehavior):
        justificar("Infiltração no teto", None, "alta", modelo=responde(""))


def test_demora_levanta_erro(monkeypatch):
    monkeypatch.setattr(settings, "llm_timeout_justificativa_segundos", 0.05)

    async def lenta(mensagens: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        await asyncio.sleep(1)
        raise AssertionError("não devia chegar aqui")

    with pytest.raises(RunTimedOut):
        justificar("Infiltração no teto", None, "alta", modelo=FunctionModel(lenta))


def test_modelo_padrao_e_o_flash_2_5():
    assert settings.llm_modelo_justificativa == "gemini-2.5-flash"


# --- Ligação com o classificar() ------------------------------------------------


@pytest.fixture
def com_chave(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "chave-falsa-de-teste")


def decisor_alta(descricao: str, local: str | None) -> Decisao:
    return Decisao(urgencia="alta", categoria="hidraulica", confianca=0.9)


def test_classificar_usa_a_frase_da_gemini(com_chave, monkeypatch):
    monkeypatch.setattr(
        justificativa, "criar_modelo", lambda: TestModel(custom_output_args={"frase": FRASE})
    )

    resultado = classificar(
        OcorrenciaEntrada(descricao="Infiltração no teto"), decisor=decisor_alta
    )

    assert resultado.classificacao.justificativa == FRASE
    assert resultado.origem == "ia"


def test_classificar_sem_chave_nem_chama_a_gemini(monkeypatch):
    def nao_chamar():
        raise AssertionError("não devia criar o modelo sem LLM_API_KEY")

    monkeypatch.setattr(justificativa, "criar_modelo", nao_chamar)

    resultado = classificar(OcorrenciaEntrada(descricao="Lâmpada queimada no hall"))

    assert resultado.classificacao.justificativa == (
        "Regra provisória: a descrição menciona 'lâmpada'."
    )


def test_classificar_com_gemini_fora_usa_o_motivo_padrao(com_chave):
    # Modelo real com chave falsa: o conftest bloqueia a rede, e a chamada falha na hora.
    resultado = classificar(
        OcorrenciaEntrada(descricao="Infiltração no teto"), decisor=decisor_alta
    )

    assert resultado.classificacao.justificativa == "Classificada como Alta pela IA."


def decisor_fora_do_ar(descricao: str, local: str | None) -> Decisao:
    raise RuntimeError("Decision 1 fora do ar")


def justificar_espiao():
    """Registra as chamadas. Exceção não serviria: o classificar() a engole e usa o motivo."""
    chamadas: list[str] = []

    def justificar(descricao: str, local: str | None, urgencia: str) -> str:
        chamadas.append(descricao)
        return FRASE

    justificar.chamadas = chamadas
    return justificar


def test_decision_1_falhou_nao_chama_o_flash_e_fica_a_frase_da_regra(com_chave):
    espiao = justificar_espiao()
    resultado = classificar(
        OcorrenciaEntrada(descricao="Lâmpada queimada no hall"),
        decisor=decisor_fora_do_ar,
        justificar=espiao,
    )

    assert espiao.chamadas == []

    assert resultado.origem == "regra"
    assert resultado.classificacao.justificativa == (
        "Regra provisória: a descrição menciona 'lâmpada'."
    )


def test_decision_1_falhou_com_trava_fica_o_motivo_da_trava(com_chave):
    espiao = justificar_espiao()
    resultado = classificar(
        OcorrenciaEntrada(descricao="Cheiro de gás no corredor"),
        decisor=decisor_fora_do_ar,
        justificar=espiao,
    )

    assert espiao.chamadas == []

    assert resultado.origem == "regra+trava"
    assert resultado.classificacao.justificativa == ("Trava de risco: a descrição menciona 'gás'.")


def test_modelo_usa_a_api_v1beta(monkeypatch):
    # Na v1, a Gemini recusa a saída estruturada: "Function calling is not enabled for api
    # version v1". Erro visto no teste com a chave de verdade.
    monkeypatch.setattr(settings, "llm_api_key", "chave-falsa-de-teste")
    criado = []
    cliente_real = justificativa.genai.Client

    def cliente_espiao(**kwargs):
        criado.append(kwargs)
        return cliente_real(**kwargs)

    monkeypatch.setattr(justificativa.genai, "Client", cliente_espiao)

    justificativa.criar_modelo()

    assert criado[0]["http_options"].api_version == "v1beta"
