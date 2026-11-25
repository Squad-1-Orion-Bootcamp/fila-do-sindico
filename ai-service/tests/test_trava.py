import pytest

from app.classifier import classificar
from app.schemas import OcorrenciaEntrada
from app.trava import PALAVRAS_DE_RISCO, TERMO_ELEVADOR, aplicar_trava


@pytest.mark.parametrize(
    ("termo", "descricao"),
    [
        ("gás", "Cheiro de gás na cozinha do térreo"),
        ("choque", "Morador levou choque ao ligar o interfone"),
        ("elétrica", "Pane elétrica no painel do subsolo"),
        ("fumaça", "Muita fumaça saindo da casa de máquinas"),
        ("vazamento grave", "Vazamento grave na tubulação principal"),
        ("rachadura", "Apareceu uma rachadura na parede da escada"),
        ("fogo", "Cheiro de fogo no corredor"),
        ("incêndio", "Incêndio no lixo"),
    ],
)
def test_trava_dispara_para_cada_palavra_de_risco(termo: str, descricao: str) -> None:
    assert aplicar_trava(descricao) == termo

    resultado = classificar(OcorrenciaEntrada(descricao=descricao))
    assert resultado.urgencia == "urgente"
    assert resultado.justificativa == f"Trava de risco: a descrição menciona '{termo}'."


def test_todas_as_palavras_de_risco_tem_cobertura() -> None:
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
        ("incendio na casa de máquinas", "incêndio"),
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
    ("descricao", "termo"),
    [
        ("Rachaduras na parede da garagem", "rachadura"),
        ("Fios desencapados dando choques", "choque"),
        ("Vazamentos graves no subsolo", "vazamento grave"),
        ("Vazamento de gases na cozinha", "gases"),
    ],
)
def test_trava_aceita_plural(descricao: str, termo: str) -> None:
    assert aplicar_trava(descricao) == termo
    assert classificar(OcorrenciaEntrada(descricao=descricao)).urgencia == "urgente"


@pytest.mark.parametrize(
    "descricao",
    [
        "Pessoa presa no elevador",
        "elevador parado com duas pessoas presas",
        "Meu filho ficou preso no elevador social",
        "Elevadores parados e moradores presos",
    ],
)
def test_trava_dispara_com_pessoa_presa_no_elevador(descricao: str) -> None:
    assert aplicar_trava(descricao) == TERMO_ELEVADOR

    resultado = classificar(OcorrenciaEntrada(descricao=descricao))
    assert resultado.urgencia == "urgente"
    assert resultado.justificativa == f"Trava de risco: a descrição menciona '{TERMO_ELEVADOR}'."


@pytest.mark.parametrize(
    "descricao",
    [
        "Portão da garagem preso",
        "Carro preso na garagem",
        "elevador barulhento",
    ],
)
def test_preso_ou_elevador_sozinhos_nao_disparam(descricao: str) -> None:
    assert aplicar_trava(descricao) is None
    assert classificar(OcorrenciaEntrada(descricao=descricao)).urgencia != "urgente"


@pytest.mark.parametrize(
    "descricao",
    [
        "Carro ocupando duas vagas na garagem",
        "Desgaste no piso do elevador",
        "Gasto alto de água no bloco B",
    ],
)
def test_palavra_dentro_de_outra_nao_dispara_trava_nem_regra(descricao: str) -> None:
    # "gas" dentro de "vagas", "desgaste" e "gasto": nem a trava nem as regras provisórias
    # podem tratar a frase como gás (urgente ou segurança).
    assert aplicar_trava(descricao) is None

    resultado = classificar(OcorrenciaEntrada(descricao=descricao))
    assert resultado.urgencia != "urgente"
    assert resultado.categoria != "seguranca"
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

    com_elevador_no_local = classificar(
        OcorrenciaEntrada(descricao="Vizinho preso do lado de fora", local="Hall do elevador")
    )
    assert com_elevador_no_local.urgencia != "urgente"


def test_trava_tem_precedencia_sobre_classificacao_baixa() -> None:
    resultado = classificar(OcorrenciaEntrada(descricao="Barulho e choque no salão de festas"))
    assert resultado.urgencia == "urgente"
    assert resultado.categoria == "convivencia"
    assert resultado.justificativa == "Trava de risco: a descrição menciona 'choque'."
