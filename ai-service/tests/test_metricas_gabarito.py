"""Métricas da avaliação contra o gabarito (SQUAD1-66), com previsões de mentira: sem rede."""

import json
from pathlib import Path

import pytest

from scripts.metricas import Previsto, calcular, eh_equipamento_de_incendio, fracao, resumo_markdown


def caso(id_, urgencia, categoria="seguranca", palavra=False, tipo="comum", motivo="ok.", desc="x"):
    return {
        "id": id_,
        "descricao": desc,
        "local": None,
        "urgencia": urgencia,
        "categoria": categoria,
        "palavra_de_risco": palavra,
        "tipo": tipo,
        "motivo": motivo,
    }


def previsto(id_, urgencia, categoria="seguranca", origem="ia") -> Previsto:
    return Previsto(
        id=id_,
        urgencia=urgencia,
        categoria=categoria,
        origem=origem,
        confianca=None,
        termo_trava=None,
    )


CASOS = [
    caso("c1", "urgente", palavra=True),
    caso("c2", "urgente", palavra=False),
    caso("c3", "alta", "hidraulica", motivo="Fronteira (alta × normal): dúvida."),
    caso("c4", "baixa", "convivencia", tipo="injecao"),
    caso("c5", "alta", desc="Extintor de incêndio vencido"),
    caso("c6", "urgente", palavra=True, desc="porta corta-fogo e fogo no lixo"),
]


def test_metricas_contam_acertos_e_erros() -> None:
    previstos = [
        previsto("c1", "urgente"),
        previsto("c2", "alta"),  # urgente sem palavra que não foi pego
        previsto("c3", "urgente", "hidraulica"),  # falso urgente, em caso de fronteira
        previsto("c4", "baixa", "convivencia"),
        previsto("c5", "alta"),
        previsto("c6", "urgente", "estrutura"),  # urgência certa, categoria errada
    ]
    m = calcular(CASOS, previstos, "regras")

    assert m["urgentes_detectados"] == {"acertos": 2, "total": 3}
    assert m["urgentes_sem_palavra_detectados"] == {"acertos": 0, "total": 1}
    assert m["falsos_urgentes"] == ["c3"]
    assert m["acerto_urgencia"] == {"acertos": 4, "total": 6}
    assert m["acerto_categoria"] == {"acertos": 5, "total": 6}
    assert m["injecao"] == {"acertos": 1, "total": 1}
    assert m["matriz_urgencia"]["urgente"] == {"urgente": 2, "alta": 1, "normal": 0, "baixa": 0}
    assert m["matriz_urgencia"]["alta"]["urgente"] == 1
    assert [e["id"] for e in m["equipamento_de_incendio"]] == ["c5", "c6"]
    assert all(e["certo"] for e in m["equipamento_de_incendio"])
    assert [(e["id"], e["fronteira"]) for e in m["erros"]] == [
        ("c2", False),
        ("c3", True),
        ("c6", False),
    ]


def test_modo_ia_tira_das_metricas_os_casos_que_cairam_nas_regras() -> None:
    previstos = [
        previsto("c1", "urgente", origem="ia+trava"),
        previsto("c2", "alta", origem="regra"),  # o Decision 1 falhou
        previsto("c3", "alta", "hidraulica"),
        previsto("c4", "baixa", "convivencia"),
        previsto("c5", "alta", origem="regra"),
        previsto("c6", "urgente", origem="regra+trava"),
    ]
    m = calcular(CASOS, previstos, "ia")

    assert m["quedas_nas_regras"] == ["c2", "c5", "c6"]
    assert m["avaliados"] == 3
    assert m["urgentes_detectados"] == {"acertos": 1, "total": 1}
    assert m["urgentes_sem_palavra_detectados"] == {"acertos": 0, "total": 0}
    assert m["acerto_urgencia"] == {"acertos": 3, "total": 3}
    assert m["equipamento_de_incendio"] == []


def test_modo_regras_nao_tira_nenhum_caso() -> None:
    previstos = [previsto(c["id"], c["urgencia"], c["categoria"], origem="regra") for c in CASOS]
    m = calcular(CASOS, previstos, "regras")
    assert m["quedas_nas_regras"] == []
    assert m["acerto_urgencia"] == {"acertos": 6, "total": 6}
    assert m["erros"] == []


def test_caso_sem_previsao_e_erro() -> None:
    with pytest.raises(ValueError, match="c6"):
        calcular(CASOS, [previsto(c["id"], "baixa") for c in CASOS[:-1]], "regras")


@pytest.mark.parametrize(
    ("descricao", "esperado"),
    [
        ("Extintores de incêndio sem lacre", True),
        ("PORTA CORTA FOGO emperrada", True),
        ("escada de incendio com entulho", True),
        ("Escada do bloco A suja", False),
        ("Incêndio no lixo", False),
    ],
)
def test_reconhece_equipamento_de_incendio(descricao: str, esperado: bool) -> None:
    assert eh_equipamento_de_incendio({"descricao": descricao}) is esperado


def test_fracao_mostra_o_numero_absoluto_primeiro() -> None:
    assert fracao({"acertos": 7, "total": 19}) == "7 de 19 (37%)"
    assert fracao({"acertos": 0, "total": 0}) == "0 de 0"


def test_resumo_mostra_quedas_e_fronteira() -> None:
    previstos = [previsto(c["id"], c["urgencia"], c["categoria"]) for c in CASOS]
    previstos[2] = previsto("c3", "urgente", "hidraulica")
    previstos[0] = previsto("c1", "urgente", origem="regra+trava")
    m = calcular(CASOS, previstos, "ia")
    texto = resumo_markdown(
        m, {"sistema": "ia", "rotulo": "teste", "commit": "abc1234", "data": "2026-11-26"}
    )
    assert "Caíram nas regras (fora das métricas): 1 (c1)" in texto
    assert "| c) Falsos urgentes | 1 (c3) |" in texto
    assert "| sim |" in texto


def test_o_gabarito_real_tem_os_campos_que_as_metricas_usam() -> None:
    casos = json.loads(
        (Path(__file__).parent / "gabarito" / "casos.json").read_text(encoding="utf-8")
    )
    previstos = [previsto(c["id"], c["urgencia"], c["categoria"]) for c in casos]
    m = calcular(casos, previstos, "ia")
    assert m["acerto_urgencia"]["total"] == len(casos)
    assert m["urgentes_detectados"]["total"] == sum(c["urgencia"] == "urgente" for c in casos)
    assert m["erros"] == []
