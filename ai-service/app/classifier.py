import re

from app.schemas import Classificacao, OcorrenciaEntrada, Urgencia
from app.trava import aplicar_trava, normalizar_texto

# PROVISÓRIO: regras por palavra-chave, como no protótipo.
# Na Sprint 2 este módulo passa a chamar o LLM com saída estruturada,
# mantendo a mesma assinatura para o resto do sistema não mudar.
# A primeira regra que bate decide, então as mais graves vêm antes.
_REGRAS: list[tuple[tuple[str, ...], str, Urgencia]] = [
    (("gás", "fogo", "incêndio", "fumaça"), "seguranca", "urgente"),
    (("preso", "presa"), "elevador", "urgente"),
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


def classificar(ocorrencia: OcorrenciaEntrada) -> Classificacao:
    """Classifica a ocorrência aplicando a trava de risco sobre a descrição."""
    resultado = classificar_por_regras(ocorrencia)
    termo_risco = aplicar_trava(ocorrencia.descricao)
    if termo_risco is not None:
        # Com regras provisórias, a justificativa cita o termo da trava; na Sprint 2 com
        # LLM (SQUAD1-62), a justificativa gerada pela IA pode ser preservada.
        return resultado.model_copy(
            update={
                "urgencia": "urgente",
                "justificativa": f"Trava de risco: a descrição menciona '{termo_risco}'.",
            }
        )
    return resultado
