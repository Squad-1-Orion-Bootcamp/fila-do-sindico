"""Métricas da avaliação contra o gabarito (SQUAD1-66), sem rede.

Recebe os casos de tests/gabarito/casos.json e o que um sistema previu para cada um, e calcula
as métricas. Nenhum total fica fixo aqui: tudo sai dos casos. A chamada à IA fica em
scripts/avaliar_gabarito.py, e os testes usam previsões de mentira.
"""

import re
from typing import Any, TypedDict, get_args

from app.contrato import Urgencia
from app.trava import normalizar_texto

URGENCIAS: tuple[str, ...] = get_args(Urgencia)

# Nome de cada --sistema para quem lê o resultado.
NOMES_DOS_SISTEMAS: dict[str, str] = {
    "ia": "sistema completo (IA + trava)",
    "regras": "só regras (IA fora do ar)",
}

# Equipamentos de incêndio da decisão da Júlia (SQUAD1-88). Procurados na descrição, para a
# avaliação funcionar também em branches que ainda não têm essa lista no app/trava.py.
_EQUIPAMENTO_DE_INCENDIO = re.compile(r"\b(extintor(es)?|corta[\s-]?fogo|escadas? de incendio)\b")


class Previsto(TypedDict):
    id: str
    urgencia: str
    categoria: str
    origem: str
    confianca: float | None
    termo_trava: str | None


def eh_fronteira(caso: dict[str, Any]) -> bool:
    return caso["motivo"].startswith("Fronteira")


def eh_equipamento_de_incendio(caso: dict[str, Any]) -> bool:
    return bool(_EQUIPAMENTO_DE_INCENDIO.search(normalizar_texto(caso["descricao"])))


def caiu_nas_regras(previsto: Previsto) -> bool:
    """No sistema completo: o Decision 1 não respondeu (erro ou demora) e as regras decidiram."""
    return "ia" not in previsto["origem"]


def _contagem(acertos: int, total: int) -> dict[str, int]:
    return {"acertos": acertos, "total": total}


def calcular(
    casos: list[dict[str, Any]], previstos: list[Previsto], sistema: str
) -> dict[str, Any]:
    """Calcula as métricas a até h.

    No sistema completo (--sistema ia), os casos que caíram nas regras saem das métricas e
    aparecem em "quedas_nas_regras", para o número da IA não se misturar com o das regras.
    """
    por_id = {p["id"]: p for p in previstos}
    faltando = [c["id"] for c in casos if c["id"] not in por_id]
    if faltando:
        raise ValueError(f"Casos sem previsão: {', '.join(faltando)}")

    quedas = [c["id"] for c in casos if caiu_nas_regras(por_id[c["id"]])] if sistema == "ia" else []
    avaliados = [(c, por_id[c["id"]]) for c in casos if c["id"] not in quedas]

    urgentes = [(c, p) for c, p in avaliados if c["urgencia"] == "urgente"]
    sem_palavra = [(c, p) for c, p in urgentes if not c["palavra_de_risco"]]
    injecao = [(c, p) for c, p in avaliados if c["tipo"] == "injecao"]

    matriz = {esperado: dict.fromkeys(URGENCIAS, 0) for esperado in URGENCIAS}
    for c, p in avaliados:
        matriz[c["urgencia"]][p["urgencia"]] += 1

    erros = [
        {
            "id": c["id"],
            "descricao": c["descricao"],
            "esperado": f"{c['urgencia']} / {c['categoria']}",
            "previsto": f"{p['urgencia']} / {p['categoria']}",
            "origem": p["origem"],
            "fronteira": eh_fronteira(c),
        }
        for c, p in avaliados
        if (c["urgencia"], c["categoria"]) != (p["urgencia"], p["categoria"])
    ]

    return {
        "casos": len(casos),
        "avaliados": len(avaliados),
        "quedas_nas_regras": quedas,
        "urgentes_detectados": _contagem(
            sum(p["urgencia"] == "urgente" for _, p in urgentes), len(urgentes)
        ),
        "urgentes_sem_palavra_detectados": _contagem(
            sum(p["urgencia"] == "urgente" for _, p in sem_palavra), len(sem_palavra)
        ),
        "falsos_urgentes": [
            c["id"]
            for c, p in avaliados
            if p["urgencia"] == "urgente" and c["urgencia"] != "urgente"
        ],
        "acerto_urgencia": _contagem(
            sum(c["urgencia"] == p["urgencia"] for c, p in avaliados), len(avaliados)
        ),
        "matriz_urgencia": matriz,
        "acerto_categoria": _contagem(
            sum(c["categoria"] == p["categoria"] for c, p in avaliados), len(avaliados)
        ),
        "injecao": _contagem(
            sum(
                (c["urgencia"], c["categoria"]) == (p["urgencia"], p["categoria"])
                for c, p in injecao
            ),
            len(injecao),
        ),
        "equipamento_de_incendio": [
            {
                "id": c["id"],
                "esperado": c["urgencia"],
                "previsto": p["urgencia"],
                "certo": c["urgencia"] == p["urgencia"],
            }
            for c, p in avaliados
            if eh_equipamento_de_incendio(c)
        ],
        "erros": erros,
    }


def fracao(contagem: dict[str, int]) -> str:
    """ "x de y (z%)": o número absoluto primeiro, porque a amostra é pequena."""
    acertos, total = contagem["acertos"], contagem["total"]
    if total == 0:
        return "0 de 0"
    return f"{acertos} de {total} ({round(100 * acertos / total)}%)"


def _curta(texto: str, limite: int = 50) -> str:
    texto = " ".join(texto.split())
    return texto if len(texto) <= limite else texto[: limite - 1] + "…"


def resumo_markdown(metricas: dict[str, Any], cabecalho: dict[str, Any]) -> str:
    """Resumo para o terminal (e para colar), em Markdown."""
    m = metricas
    linhas = [
        f"## Avaliação: {NOMES_DOS_SISTEMAS[cabecalho['sistema']]} / {cabecalho['rotulo']}",
        "",
        f"Commit `{cabecalho['commit']}`, {cabecalho['data']}, {m['casos']} casos.",
    ]
    if cabecalho["sistema"] == "ia":
        quedas = m["quedas_nas_regras"]
        linhas.append(
            f"Caíram nas regras (fora das métricas): {len(quedas)}"
            + (f" ({', '.join(quedas)})" if quedas else "")
            + f". Avaliados: {m['avaliados']}."
        )
    equip = m["equipamento_de_incendio"]
    linhas += [
        "",
        "| Métrica | Resultado |",
        "| --- | --- |",
        f"| a) Urgentes detectados | {fracao(m['urgentes_detectados'])} |",
        f"| b) Urgentes sem palavra de risco detectados | "
        f"{fracao(m['urgentes_sem_palavra_detectados'])} |",
        f"| c) Falsos urgentes | {len(m['falsos_urgentes'])}"
        + (f" ({', '.join(m['falsos_urgentes'])})" if m["falsos_urgentes"] else "")
        + " |",
        f"| d) Acerto de urgência | {fracao(m['acerto_urgencia'])} |",
        f"| e) Acerto de categoria | {fracao(m['acerto_categoria'])} |",
        f"| f) Injeção com o rótulo certo | {fracao(m['injecao'])} |",
        f"| g) Equipamento de incêndio | "
        f"{fracao({'acertos': sum(e['certo'] for e in equip), 'total': len(equip)})} |",
        "",
        "Matriz de urgência (linha: esperado; coluna: previsto):",
        "",
        "| | " + " | ".join(URGENCIAS) + " |",
        "| --- |" + " --- |" * len(URGENCIAS),
    ]
    for esperado, linha in m["matriz_urgencia"].items():
        linhas.append(f"| **{esperado}** | " + " | ".join(str(linha[u]) for u in URGENCIAS) + " |")
    linhas += ["", "Equipamento de incêndio, caso a caso:", ""]
    linhas += [
        f"- {e['id']}: esperado {e['esperado']}, previsto {e['previsto']}"
        + ("" if e["certo"] else " **(erro)**")
        for e in equip
    ]
    linhas += ["", f"Erros ({len(m['erros'])}):", ""]
    if m["erros"]:
        linhas += ["| id | Descrição | Esperado | Previsto | Origem | Fronteira |"]
        linhas += ["| --- | --- | --- | --- | --- | --- |"]
        linhas += [
            f"| {e['id']} | {_curta(e['descricao'])} | {e['esperado']} | {e['previsto']} "
            f"| {e['origem']} | {'sim' if e['fronteira'] else ''} |"
            for e in m["erros"]
        ]
    return "\n".join(linhas)
