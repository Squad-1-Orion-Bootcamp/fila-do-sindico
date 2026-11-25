"""Orquestração da classificação (SQUAD1-84).

1. Trava de palavras de risco (app/trava.py).
2. System 1: o Gemini Decision 1 decide a urgência e a categoria (app/decisao.py).
   Sem LLM_API_KEY, com erro ou demora, as regras provisórias abaixo decidem.
3. Com a trava ativa, a urgência vira "urgente" e a origem ganha "+trava".
4. System 2: a Gemini explica a urgência final em uma frase (app/justificativa.py), só quando
   o Decision 1 respondeu. Sem ele, com erro ou demora, fica o motivo padrão.
"""

import logging
import re
from collections.abc import Callable

from app.config import settings
from app.contrato import ROTULOS_URGENCIA
from app.decisao import Decisao, decidir
from app.justificativa import justificar as justificar_com_gemini
from app.schemas import (
    Categoria,
    Classificacao,
    OcorrenciaEntrada,
    Origem,
    ResultadoClassificacao,
    Urgencia,
)
from app.trava import aplicar_trava, normalizar_texto

logger = logging.getLogger(__name__)

MODELO_REGRAS = "regras-provisorias"

Decisor = Callable[[str, str | None], Decisao]
# (descricao, local, urgencia) -> frase do motivo. Interface do System 2 (SQUAD1-85).
Justificador = Callable[[str, str | None, Urgencia], str]

# Reserva: regras por palavra-chave, usadas quando o Decision 1 não responde.
# A primeira regra que bate decide, então as mais graves vêm antes.
_REGRAS: list[tuple[tuple[str, ...], Categoria, Urgencia]] = [
    (("gás", "fogo", "incêndio", "fumaça"), "seguranca", "urgente"),
    (("preso no elevador", "presa no elevador"), "elevador", "urgente"),
    (("vazamento", "vazando", "alagado", "infiltração"), "hidraulica", "alta"),
    (("elevador",), "elevador", "alta"),
    (("barulho", "som alto", "festa"), "convivencia", "baixa"),
    (("lâmpada", "luz"), "eletrica", "normal"),
]


def _padrao(termo: str) -> re.Pattern[str]:
    # Palavra inteira, sem acento e sem diferenciar maiúsculas, como na trava: "gas" não casa
    # com "vagas" nem com "desgaste". O "s?" aceita o plural simples ("vazamentos").
    partes = [re.escape(parte) for parte in normalizar_texto(termo).split()]
    return re.compile(rf"\b{r'\s+'.join(partes)}s?\b")


_REGRAS_COMPILADAS = [
    (tuple((termo, _padrao(termo)) for termo in termos), categoria, urgencia)
    for termos, categoria, urgencia in _REGRAS
]


def classificar_por_regras(ocorrencia: OcorrenciaEntrada) -> Classificacao:
    """Classifica a ocorrência usando apenas as regras provisórias por palavra-chave.

    As regras de "urgente" olham só a descrição, como a trava: o local sozinho ("Abrigo de
    gás") não torna a ocorrência urgente. As outras olham a descrição e o local.
    """
    descricao = normalizar_texto(ocorrencia.descricao)
    descricao_e_local = normalizar_texto(f"{ocorrencia.descricao} {ocorrencia.local or ''}")
    for termos, categoria, urgencia in _REGRAS_COMPILADAS:
        texto = descricao if urgencia == "urgente" else descricao_e_local
        encontrada = next((termo for termo, padrao in termos if padrao.search(texto)), None)
        if encontrada:
            return Classificacao(
                urgencia=urgencia,
                categoria=categoria,
                justificativa=f"Regra provisória: a descrição menciona '{encontrada}'.",
            )
    return Classificacao(
        urgencia="normal",
        categoria="outros",
        justificativa="Regra provisória: nenhuma palavra-chave reconhecida.",
    )


def motivo_padrao(urgencia: Urgencia, origem: Origem, termo_risco: str | None) -> str:
    """Motivo usado enquanto não há justificativa gerada, ou quando ela falha."""
    if termo_risco is not None:
        return f"Trava de risco: a descrição menciona '{termo_risco}'."
    rotulo = ROTULOS_URGENCIA[urgencia]
    if origem == "ia":
        return f"Classificada como {rotulo} pela IA."
    return f"Classificada como {rotulo} pelas regras provisórias."


def classificar(
    ocorrencia: OcorrenciaEntrada,
    *,
    decisor: Decisor = decidir,
    justificar: Justificador = justificar_com_gemini,
) -> ResultadoClassificacao:
    """Classifica a ocorrência. Nunca levanta exceção por falha da IA: as regras assumem."""
    termo_risco = aplicar_trava(ocorrencia.descricao)

    decisao: Decisao | None = None
    if settings.llm_api_key:
        try:
            decisao = decisor(ocorrencia.descricao, ocorrencia.local)
        except Exception as erro:
            logger.warning("Decision 1 falhou (%s): usando as regras.", type(erro).__name__)

    if decisao is not None:
        urgencia: Urgencia = decisao.urgencia
        categoria: Categoria = decisao.categoria
        origem: Origem = "ia"
        modelo_versao = settings.llm_modelo_decisao
        justificativa_regra = None
    else:
        pelas_regras = classificar_por_regras(ocorrencia)
        urgencia, categoria = pelas_regras.urgencia, pelas_regras.categoria
        origem, modelo_versao = "regra", MODELO_REGRAS
        justificativa_regra = pelas_regras.justificativa

    if termo_risco is not None:
        urgencia = "urgente"
        origem = "ia+trava" if origem == "ia" else "regra+trava"

    justificativa = ""
    # Só com o Decision 1 respondendo: se ele falhou, a Gemini provavelmente está fora, e a
    # frase da regra ou da trava já diz o que decidiu.
    if decisao is not None:
        try:
            justificativa = justificar(ocorrencia.descricao, ocorrencia.local, urgencia).strip()
        except Exception as erro:
            logger.warning(
                "Justificativa falhou (%s): usando o motivo padrão.", type(erro).__name__
            )
    if not justificativa:
        # Sem trava e pelas regras, a frase da regra já diz qual palavra decidiu.
        justificativa = (
            justificativa_regra
            if justificativa_regra and termo_risco is None
            else motivo_padrao(urgencia, origem, termo_risco)
        )

    confianca = decisao.confianca if decisao is not None else None
    logger.info(
        "Classificada como %s/%s (origem %s, confiança %s).",
        urgencia,
        categoria,
        origem,
        "—" if confianca is None else f"{confianca:.2f}",
    )
    return ResultadoClassificacao(
        classificacao=Classificacao(
            urgencia=urgencia, categoria=categoria, justificativa=justificativa
        ),
        origem=origem,
        modelo_versao=modelo_versao,
        confianca=confianca,
    )
