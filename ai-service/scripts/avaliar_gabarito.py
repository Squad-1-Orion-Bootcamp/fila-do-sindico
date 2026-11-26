"""Roda um sistema de classificação contra o gabarito (SQUAD1-66).

    cd ai-service
    uv run python -m scripts.avaliar_gabarito --sistema regras --rotulo develop
    uv run python -m scripts.avaliar_gabarito --sistema ia --rotulo develop

- regras, "só regras (IA fora do ar)": trava + regras de reserva, como o classificar() faz com
  a IA fora. Sem rede.
- ia, "sistema completo (IA + trava)": o classificar() de verdade, com o Decision 1.
  Precisa de LLM_API_KEY no ai-service/.env.
  A justificativa (System 2) não entra na avaliação: um justificar falso devolve "", para não
  gastar cota. Pausa de 2 s entre os casos.

Resumo em Markdown no terminal; o detalhe vai para
tests/gabarito/resultados/AAAA-MM-DD-<sistema>-<rotulo>.json.
"""

import argparse
import json
import subprocess
import sys
import time
from datetime import date
from pathlib import Path

from app.classifier import classificar
from app.config import settings
from app.schemas import OcorrenciaEntrada
from app.trava import aplicar_trava
from scripts.metricas import NOMES_DOS_SISTEMAS, Previsto, calcular, resumo_markdown

PASTA_GABARITO = Path(__file__).resolve().parent.parent / "tests" / "gabarito"
PAUSA_IA_SEGUNDOS = 2.0


def _sem_justificativa(descricao: str, local: str | None, urgencia: str) -> str:
    return ""


def prever(caso: dict, sistema: str) -> Previsto:
    ocorrencia = OcorrenciaEntrada(descricao=caso["descricao"], local=caso["local"])
    resultado = classificar(ocorrencia, justificar=_sem_justificativa)
    if sistema == "regras" and "ia" in resultado.origem:
        raise RuntimeError("A rodada só regras chamou a IA: a chave deveria estar vazia.")
    return Previsto(
        id=caso["id"],
        urgencia=resultado.classificacao.urgencia,
        categoria=resultado.classificacao.categoria,
        origem=resultado.origem,
        confianca=resultado.confianca,
        termo_trava=aplicar_trava(caso["descricao"]),
    )


def commit_atual() -> str:
    saida = subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=True
    )
    return saida.stdout.strip()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--sistema", choices=["regras", "ia"], required=True)
    parser.add_argument("--rotulo", required=True, help="nome da rodada, ex.: develop")
    parser.add_argument(
        "--casos",
        help="só estes ids, separados por vírgula (ex.: c34,c41). Rodada parcial: não grava "
        "o resultado em tests/gabarito/resultados/",
    )
    args = parser.parse_args()

    if args.sistema == "regras":
        # Como o classificar() faz quando a IA está fora: sem chave, só trava e regras.
        settings.llm_api_key = ""
    elif not settings.llm_api_key:
        sys.exit("Sistema completo (IA + trava): falta LLM_API_KEY no ai-service/.env.")

    casos = json.loads((PASTA_GABARITO / "casos.json").read_text(encoding="utf-8"))
    if args.casos:
        ids = [i.strip() for i in args.casos.split(",") if i.strip()]
        desconhecidos = sorted(set(ids) - {c["id"] for c in casos})
        if desconhecidos:
            sys.exit(f"Casos que não existem no gabarito: {', '.join(desconhecidos)}")
        casos = [c for c in casos if c["id"] in ids]
    previstos: list[Previsto] = []
    for indice, caso in enumerate(casos):
        if args.sistema == "ia" and indice:
            time.sleep(PAUSA_IA_SEGUNDOS)
        previstos.append(prever(caso, args.sistema))
        p = previstos[-1]
        confianca = "—" if p["confianca"] is None else f"{p['confianca']:.2f}"
        print(f"{caso['id']}: {p['urgencia']} ({p['origem']}, {confianca})", file=sys.stderr)

    cabecalho = {
        "data": date.today().isoformat(),
        "sistema": args.sistema,
        "nome_do_sistema": NOMES_DOS_SISTEMAS[args.sistema],
        "rotulo": args.rotulo,
        "commit": commit_atual(),
        "modelo": settings.llm_modelo_decisao if args.sistema == "ia" else None,
    }
    metricas = calcular(casos, previstos, args.sistema)
    if args.casos:
        print(resumo_markdown(metricas, cabecalho))
        print("\nRodada parcial (--casos): resultado não gravado.")
        return

    pasta = PASTA_GABARITO / "resultados"
    pasta.mkdir(exist_ok=True)
    arquivo = pasta / f"{cabecalho['data']}-{args.sistema}-{args.rotulo}.json"
    arquivo.write_text(
        json.dumps(
            {**cabecalho, "metricas": metricas, "previstos": previstos},
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(resumo_markdown(metricas, cabecalho))
    print(f"\nDetalhe em {arquivo.relative_to(PASTA_GABARITO.parent.parent)}")


if __name__ == "__main__":
    main()
