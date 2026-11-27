"""Orquestração da classificação (SQUAD1-84).

1. Trava de palavras de risco (app/trava.py).
2. System 1: o Gemini Decision 1 decide a urgência e a categoria (app/decisao.py).
   Sem LLM_API_KEY, com erro ou demora, as regras provisórias abaixo decidem.
3. Equipamento de incêndio na descrição: urgência normal ou baixa sobe para "alta" (SQUAD1-88).
   Com a trava ativa, a urgência vira "urgente" e a origem ganha "+trava".
4. System 2: a Gemini explica a urgência final em uma frase (app/justificativa.py), só quando
   o Decision 1 respondeu. Sem ele, com erro ou demora, fica o motivo padrão.
"""

import logging
from collections.abc import Callable

from app.config import settings
from app.contrato import ROTULOS_URGENCIA
from app.decisao import Decisao, decidir
from app.justificativa import descrever_erro
from app.justificativa import justificar as justificar_com_gemini
from app.schemas import (
    Categoria,
    Classificacao,
    OcorrenciaEntrada,
    Origem,
    ResultadoClassificacao,
    Urgencia,
)
from app.trava import (
    aplicar_trava,
    equipamento_de_incendio,
    normalizar_texto,
    padrao_de_termo,
    remover_excecoes,
)

logger = logging.getLogger(__name__)

MODELO_REGRAS = "regras-provisorias"

Decisor = Callable[[str, str | None], Decisao]
# (descricao, local, urgencia) -> frase do motivo. Interface do System 2 (SQUAD1-85).
Justificador = Callable[[str, str | None, Urgencia], str]

# Reserva: regras por palavra-chave, usadas quando o Decision 1 não responde. Vão até "alta":
# quem marca "urgente" é a trava (app/trava.py), que olha só a descrição.
_REGRAS: list[tuple[tuple[str, ...], Categoria, Urgencia]] = [
    (("gás", "gas", "gases", "fogo", "incêndio", "fumaça"), "seguranca", "alta"),
    (("vazamento", "vazando", "alagado", "infiltração"), "hidraulica", "alta"),
    (("elevador", "elevadores", "preso"), "elevador", "alta"),
    (("barulho", "som alto", "festa"), "convivencia", "baixa"),
    (("lâmpada", "lampada", "luz", "luzes"), "eletrica", "normal"),
]

# Mesma comparação por palavra da trava: "gas" não casa com "gasto", "vagas" nem "desgaste".
# O plural em "-es" ("gases", "elevadores", "luzes") não vem do "s" opcional: fica na lista.
_REGRAS_COMPILADAS = [
    (tuple((termo, padrao_de_termo(termo)) for termo in termos), categoria, urgencia)
    for termos, categoria, urgencia in _REGRAS
]


def classificar_por_regras(ocorrencia: OcorrenciaEntrada) -> Classificacao:
    """Classifica a ocorrência usando apenas as regras provisórias por palavra-chave."""
    texto_normalizado = normalizar_texto(f"{ocorrencia.descricao} {ocorrencia.local or ''}")
    # Problema em equipamento de incêndio é no mínimo "alta" (decisão da Júlia, SQUAD1-88).
    # Vem antes das exceções, que tiram essas expressões do texto.
    equipamento = equipamento_de_incendio(texto_normalizado)
    if equipamento:
        return Classificacao(
            urgencia="alta",
            categoria="seguranca",
            justificativa=f"Regra provisória: a descrição menciona '{equipamento}'.",
        )
    # As mesmas exceções da trava: "fumaça de cigarro" não vira segurança.
    texto = remover_excecoes(texto_normalizado)
    for termos, categoria, urgencia in _REGRAS_COMPILADAS:
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

    # Piso da Júlia (SQUAD1-88): problema em equipamento de incêndio é no mínimo "alta". Fica no
    # código, não no prompt: a frase no prompt mudou casos que não são de incêndio (SQUAD1-66).
    # A origem não muda.
    if urgencia in ("normal", "baixa") and equipamento_de_incendio(
        normalizar_texto(ocorrencia.descricao)
    ):
        urgencia = "alta"

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
                "Justificativa falhou (%s, modelo %s): usando o motivo padrão.",
                descrever_erro(erro),
                settings.llm_modelo_justificativa,
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
