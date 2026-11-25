from app.schemas import Classificacao, OcorrenciaEntrada, Urgencia
from app.trava import aplicar_trava, normalizar_texto, padrao_de_termo

# PROVISÓRIO: regras por palavra-chave, como no protótipo.
# Na Sprint 2 este módulo passa a chamar o LLM com saída estruturada,
# mantendo a mesma assinatura para o resto do sistema não mudar.
_REGRAS: list[tuple[tuple[str, ...], str, Urgencia]] = [
    (("gás", "gas", "fogo", "incêndio", "fumaça"), "seguranca", "alta"),
    (("vazamento", "vazando", "alagado", "infiltração"), "hidraulica", "alta"),
    (("elevador", "preso"), "elevador", "alta"),
    (("barulho", "som alto", "festa"), "convivencia", "baixa"),
    (("lâmpada", "lampada", "luz"), "eletrica", "normal"),
]

# Mesma comparação por palavra da trava: "gas" não casa com "gasto", "vagas" nem "desgaste".
_REGRAS_COMPILADAS = [
    (tuple((termo, padrao_de_termo(termo)) for termo in termos), categoria, urgencia)
    for termos, categoria, urgencia in _REGRAS
]


def classificar_por_regras(ocorrencia: OcorrenciaEntrada) -> Classificacao:
    """Classifica a ocorrência usando apenas as regras provisórias por palavra-chave."""
    texto = normalizar_texto(f"{ocorrencia.descricao} {ocorrencia.local or ''}")
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
