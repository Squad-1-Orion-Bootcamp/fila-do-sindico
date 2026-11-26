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


# Equipamentos de incêndio (decisão da Júlia, 26/11): a trava não força urgente, a IA decide, e
# as regras de reserva dão no mínimo "alta". Com fumaça ou fogo na frase, a trava dispara igual.
@pytest.mark.parametrize(
    ("descricao", "equipamento"),
    [
        ("Extintor de incêndio do 4º andar vencido desde agosto", "extintor de incêndio"),
        ("Os extintores de incendio da garagem estão sem lacre", "extintores de incêndio"),
        ("porta corta-fogo da escada emperrada, não fecha sozinha", "porta corta-fogo"),
        ("Porta corta fogo do 3º andar travada aberta com um calço", "porta corta-fogo"),
        ("Escada de incêndio cheia de entulho do apto 502", "escada de incêndio"),
    ],
)
def test_equipamento_de_incendio_sem_risco_nao_dispara_a_trava_e_regra_da_alta(
    descricao: str, equipamento: str
) -> None:
    assert aplicar_trava(descricao) is None

    regra = classificar_por_regras(OcorrenciaEntrada(descricao=descricao))
    assert (regra.urgencia, regra.categoria) == ("alta", "seguranca")
    assert regra.justificativa == f"Regra provisória: a descrição menciona '{equipamento}'."

    resultado = classificar(OcorrenciaEntrada(descricao=descricao)).classificacao
    assert resultado.urgencia == "alta"


@pytest.mark.parametrize(
    ("descricao", "termo"),
    [
        ("Extintor de incêndio do 4º andar vencido e tem fumaça saindo do quadro", "fumaça"),
        ("porta corta-fogo emperrada e fogo no lixo da escada", "fogo"),
        ("Escada de incêndio com cheiro de gás forte", "gás"),
    ],
)
def test_equipamento_de_incendio_com_risco_real_continua_urgente(
    descricao: str, termo: str
) -> None:
    assert aplicar_trava(descricao) == termo
    assert classificar(OcorrenciaEntrada(descricao=descricao)).classificacao.urgencia == "urgente"


def _decisor_fixo(urgencia: str, categoria: str = "seguranca"):
    def decisor(descricao: str, local: str | None) -> Decisao:
        return Decisao(urgencia=urgencia, categoria=categoria, confianca=0.7)

    return decisor


def _classificar_com_ia(monkeypatch, descricao: str, urgencia_da_ia: str, categoria="seguranca"):
    monkeypatch.setattr(settings, "llm_api_key", "chave-falsa-de-teste")
    urgencias_justificadas: list[str] = []

    def justificar(descricao: str, local: str | None, urgencia: str) -> str:
        urgencias_justificadas.append(urgencia)
        return "Frase de teste."

    resultado = classificar(
        OcorrenciaEntrada(descricao=descricao),
        decisor=_decisor_fixo(urgencia_da_ia, categoria),
        justificar=justificar,
    )
    return resultado, urgencias_justificadas


@pytest.mark.parametrize("urgencia_da_ia", ["normal", "baixa"])
def test_piso_sobe_equipamento_de_incendio_para_alta(monkeypatch, urgencia_da_ia: str) -> None:
    resultado, justificadas = _classificar_com_ia(
        monkeypatch, "Extintor de incêndio do 4º andar vencido", urgencia_da_ia
    )
    assert resultado.classificacao.urgencia == "alta"
    assert resultado.origem == "ia"
    # O System 2 explica a urgência final, já com o piso.
    assert justificadas == ["alta"]


@pytest.mark.parametrize("urgencia_da_ia", ["alta", "urgente"])
def test_piso_nao_mexe_em_alta_nem_urgente(monkeypatch, urgencia_da_ia: str) -> None:
    resultado, _ = _classificar_com_ia(
        monkeypatch, "Extintor de incêndio do 4º andar vencido", urgencia_da_ia
    )
    assert resultado.classificacao.urgencia == urgencia_da_ia
    assert resultado.origem == "ia"


def test_equipamento_com_fogo_fica_urgente_pela_trava(monkeypatch) -> None:
    resultado, _ = _classificar_com_ia(
        monkeypatch, "porta corta-fogo emperrada e fogo no lixo da escada", "normal"
    )
    assert resultado.classificacao.urgencia == "urgente"
    assert resultado.origem == "ia+trava"


@pytest.mark.parametrize("urgencia_da_ia", ["normal", "baixa"])
def test_piso_nao_mexe_em_frase_sem_equipamento(monkeypatch, urgencia_da_ia: str) -> None:
    resultado, _ = _classificar_com_ia(
        monkeypatch, "Portão da garagem quebrado e aberto", urgencia_da_ia
    )
    assert resultado.classificacao.urgencia == urgencia_da_ia


def test_piso_olha_so_a_descricao(monkeypatch) -> None:
    monkeypatch.setattr(settings, "llm_api_key", "chave-falsa-de-teste")
    resultado = classificar(
        OcorrenciaEntrada(descricao="Lâmpada queimada", local="Escada de incêndio"),
        decisor=_decisor_fixo("normal", "eletrica"),
        justificar=lambda descricao, local, urgencia: "Frase de teste.",
    )
    assert resultado.classificacao.urgencia == "normal"
