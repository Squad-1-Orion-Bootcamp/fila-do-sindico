"""Exceções da trava (SQUAD1-88): expressões em que a palavra de risco tem outro sentido."""

import pytest

from app.classifier import classificar, classificar_por_regras
from app.config import settings
from app.decisao import Decisao
from app.schemas import OcorrenciaEntrada
from app.trava import EXCECOES, aplicar_trava, normalizar_texto, remover_excecoes


@pytest.mark.parametrize("expressao", EXCECOES)
def test_cada_excecao_sozinha_nao_dispara_a_trava(expressao: str) -> None:
    assert aplicar_trava(expressao) is None
    assert aplicar_trava(f"Reclamação sobre {expressao} no bloco B") is None


@pytest.mark.parametrize(
    "descricao",
    [
        "FUMACAS DE CIGARRO",
        "fogos de artificio",
        "Fumaça do churrasco",
        "Fumaça da churrasqueira do vizinho",
        "Contas do gás atrasadas",
        "Leitura de gás errada",
        "Bicicletas elétricas na garagem",
        "Choque de realidade",
    ],
)
def test_excecao_ignora_acento_maiusculas_plural_e_conectivo(descricao: str) -> None:
    assert aplicar_trava(descricao) is None


@pytest.mark.parametrize(
    "descricao",
    ["fumaça de cigarro e cheiro de gás", "cheiro de gás e fumaça de cigarro"],
)
def test_excecao_com_risco_real_continua_urgente(descricao: str) -> None:
    assert aplicar_trava(descricao) == "gás"
    assert classificar(OcorrenciaEntrada(descricao=descricao)).classificacao.urgencia == "urgente"


def test_mesma_palavra_fora_da_expressao_continua_disparando() -> None:
    descricao = "reclamei da fumaça de cigarro, mas agora sai fumaça do quadro de luz"
    assert aplicar_trava(descricao) == "fumaça"


def test_troca_por_espaco_nao_junta_palavras_vizinhas() -> None:
    texto = remover_excecoes(normalizar_texto("Gás/fumaça de cigarro/choque"))
    assert texto == "gas/ /choque"
    assert aplicar_trava("Gás/fumaça de cigarro/choque") == "gás"


def test_hifen_vale_como_espaco() -> None:
    assert remover_excecoes("fogos-de-artificio no reveillon") == "  no reveillon"


def test_regras_ignoram_a_excecao() -> None:
    cigarro = classificar_por_regras(
        OcorrenciaEntrada(descricao="vizinho fumando, sai fumaça de cigarro")
    )
    assert (cigarro.urgencia, cigarro.categoria) == ("normal", "outros")

    gas = classificar_por_regras(OcorrenciaEntrada(descricao="cheiro de gás"))
    assert (gas.urgencia, gas.categoria) == ("alta", "seguranca")


@pytest.mark.parametrize(
    ("descricao", "termo"),
    [
        ("levei um choque de realidade com a taxa", None),
        ("vizinho fumando, sai fumaça de cigarro", None),
        ("tem uma rachadura enorme na viga da garagem", "rachadura"),
    ],
)
def test_frases_da_squad_03(descricao: str, termo: str | None) -> None:
    assert aplicar_trava(descricao) == termo


def test_decision_1_recebe_o_texto_original_e_pode_marcar_urgente(monkeypatch) -> None:
    # A exceção só tira a obrigação de urgente: a IA continua lendo a frase inteira.
    monkeypatch.setattr(settings, "llm_api_key", "chave-falsa-de-teste")
    recebidas: list[str] = []

    def decisor(descricao: str, local: str | None) -> Decisao:
        recebidas.append(descricao)
        return Decisao(urgencia="urgente", categoria="seguranca", confianca=0.8)

    descricao = "Fumaça de cigarro entrando pelo duto, morador com asma passando mal"
    resultado = classificar(
        OcorrenciaEntrada(descricao=descricao),
        decisor=decisor,
        justificar=lambda descricao, local, urgencia: "Morador com asma passando mal.",
    )
    assert recebidas == [descricao]
    assert resultado.classificacao.urgencia == "urgente"
    assert resultado.origem == "ia"
