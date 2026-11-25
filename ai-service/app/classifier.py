from app.schemas import Classificacao, OcorrenciaEntrada, Urgencia

# PROVISÓRIO: regras por palavra-chave, como no protótipo.
# Na Sprint 2 este módulo passa a chamar o LLM com saída estruturada,
# mantendo a mesma assinatura para o resto do sistema não mudar.
# A primeira regra que bate decide, então as mais graves vêm antes.
_REGRAS: list[tuple[tuple[str, ...], str, Urgencia]] = [
    (("gás", "gas", "fogo", "incêndio", "fumaça"), "seguranca", "urgente"),
    (("preso", "presa"), "elevador", "urgente"),
    (("vazamento", "vazando", "alagado", "infiltração"), "hidraulica", "alta"),
    (("elevador",), "elevador", "alta"),
    (("barulho", "som alto", "festa"), "convivencia", "baixa"),
    (("lâmpada", "lampada", "luz"), "eletrica", "normal"),
]


def classificar(ocorrencia: OcorrenciaEntrada) -> Classificacao:
    texto = f"{ocorrencia.descricao} {ocorrencia.local or ''}".lower()
    for palavras, categoria, urgencia in _REGRAS:
        encontrada = next((p for p in palavras if p in texto), None)
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
