import pytest

from app.classifier import classificar as _classificar
from app.schemas import Classificacao, OcorrenciaEntrada
from app.trava import PALAVRAS_DE_RISCO, aplicar_trava


def classificar(ocorrencia: OcorrenciaEntrada) -> Classificacao:
    return _classificar(ocorrencia).classificacao


@pytest.mark.parametrize(
    ("termo", "descricao"),
    [
        ("gás", "Cheiro de gás na cozinha do térreo"),
        ("choque", "Morador levou choque ao ligar o interfone"),
        ("elétrica", "Pane elétrica no painel do subsolo"),
        ("fumaça", "Muita fumaça saindo da casa de máquinas"),
        ("vazamento grave", "Vazamento grave na tubulação principal"),
        ("rachadura", "Apareceu uma rachadura na parede da escada"),
        ("incêndio", "Princípio de incêndio na lixeira do térreo"),
        ("fogo", "Fogo no quadro de luz da garagem"),
        ("pessoa presa", "Elevador parou com uma pessoa presa"),
        ("preso no elevador", "Meu filho ficou preso no elevador"),
        ("presa no elevador", "Vizinha está presa no elevador social"),
    ],
)
def test_trava_dispara_para_cada_palavra_de_risco(termo: str, descricao: str) -> None:
    assert aplicar_trava(descricao) == termo

    resultado = classificar(OcorrenciaEntrada(descricao=descricao))
    assert resultado.urgencia == "urgente"
    assert resultado.justificativa == f"Trava de risco: a descrição menciona '{termo}'."


def test_todas_as_palavras_de_risco_tem_cobertura() -> None:
    assert len(PALAVRAS_DE_RISCO) == 11
    for termo in PALAVRAS_DE_RISCO:
        assert aplicar_trava(f"Ocorrência com {termo} no local") == termo


@pytest.mark.parametrize(
    ("descricao", "termo_esperado"),
    [
        ("CHEIRO DE GAS NO CORREDOR", "gás"),
        ("Cheiro de Gás!", "gás"),
        ("Tomei CHOQUE no interruptor", "choque"),
        ("PANE ELETRICA no quadro", "elétrica"),
        ("Fiação Elétrica exposta", "elétrica"),
        ("FUMACA saindo da garagem", "fumaça"),
        ("VAZAMENTO   GRAVE no subsolo", "vazamento grave"),
        ("RACHADURA na viga", "rachadura"),
        ("INCENDIO no salão", "incêndio"),
        ("Pessoa  PRESA na cabine", "pessoa presa"),
    ],
)
def test_trava_ignora_maiusculas_e_acentos(descricao: str, termo_esperado: str) -> None:
    assert aplicar_trava(descricao) == termo_esperado
    resultado = classificar(OcorrenciaEntrada(descricao=descricao))
    assert resultado.urgencia == "urgente"


@pytest.mark.parametrize(
    ("descricao", "urgencia_esperada", "categoria_esperada"),
    [
        ("Lâmpada queimada no corredor", "normal", "eletrica"),
        ("Barulho de festa no apartamento 302", "baixa", "convivencia"),
        ("Cano vazando na garagem", "alta", "hidraulica"),
        ("Pintura descascando no hall", "normal", "outros"),
    ],
)
def test_frases_sem_risco_nao_disparam_trava(
    descricao: str,
    urgencia_esperada: str,
    categoria_esperada: str,
) -> None:
    assert aplicar_trava(descricao) is None

    resultado = classificar(OcorrenciaEntrada(descricao=descricao))
    assert resultado.urgencia == urgencia_esperada
    assert resultado.urgencia != "urgente"
    assert resultado.categoria == categoria_esperada


@pytest.mark.parametrize(
    "descricao",
    [
        "Carro ocupando duas vagas na garagem",
        "Desgaste no piso do elevador",
        "Gasto alto de água no bloco B",
    ],
)
def test_trava_evita_falsos_positivos_por_substring(descricao: str) -> None:
    assert aplicar_trava(descricao) is None

    resultado = classificar(OcorrenciaEntrada(descricao=descricao))
    assert resultado.urgencia != "urgente"
    assert not resultado.justificativa.startswith("Trava de risco:")


def test_local_nao_aciona_a_trava() -> None:
    com_gas_no_local = classificar(
        OcorrenciaEntrada(descricao="Porta emperrada", local="Abrigo de gás")
    )
    assert com_gas_no_local.urgencia != "urgente"

    com_eletrica_no_local = classificar(
        OcorrenciaEntrada(descricao="Fechadura quebrada", local="Sala elétrica")
    )
    assert com_eletrica_no_local.urgencia == "normal"


def test_trava_tem_precedencia_sobre_classificacao_baixa() -> None:
    resultado = classificar(OcorrenciaEntrada(descricao="Barulho e choque no salão de festas"))
    assert resultado.urgencia == "urgente"
    assert resultado.categoria == "convivencia"
    assert resultado.justificativa == "Trava de risco: a descrição menciona 'choque'."


@pytest.mark.parametrize(
    "descricao",
    [
        "Fogão do salão de festas não acende",
        "Fogos de artifício no réveillon do prédio",
        "Portão da garagem ficou preso aberto",
    ],
)
def test_novos_termos_de_emergencia_nao_disparam_por_engano(descricao: str) -> None:
    assert aplicar_trava(descricao) is None
