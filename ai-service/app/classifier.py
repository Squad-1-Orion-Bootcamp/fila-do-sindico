from app.schemas import Classificacao, OcorrenciaEntrada

# PROVISÓRIO: regras por palavra-chave, como no protótipo.
# Na Sprint 2 este módulo passa a chamar o LLM com saída estruturada,
# mantendo a mesma assinatura para o resto do sistema não mudar.
_REGRAS: list[tuple[tuple[str, ...], str, str]] = [
    (("gás", "gas", "fogo", "incêndio", "fumaça"), "seguranca", "alta"),
    (("vazamento", "vazando", "alagado", "infiltração"), "hidraulica", "alta"),
    (("elevador", "preso"), "elevador", "alta"),
    (("barulho", "som alto", "festa"), "convivencia", "baixa"),
    (("lâmpada", "lampada", "luz"), "eletrica", "media"),
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
        urgencia="media",
        categoria="outros",
        justificativa="Regra provisória: nenhuma palavra-chave reconhecida.",
    )
