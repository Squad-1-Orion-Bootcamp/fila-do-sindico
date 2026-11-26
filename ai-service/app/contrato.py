"""Contrato da classificação: fonte única dos valores e das descrições (SQUAD1-56).

O Decision 1, as regras provisórias e o schema usam estas constantes. No Decision 1, a
descrição de cada opção faz o papel do prompt: mudar o texto muda a classificação.

PROPOSTA: as descrições e a lista de categorias ainda vão ser revisadas pelo Pedro na
SQUAD1-56. Mudar uma chave (ex.: renomear uma categoria) exige combinar com o banco e o front.
"""

from typing import Literal, get_args

# Os mesmos valores do banco (ocorrencias.urgencia_atual).
Urgencia = Literal["urgente", "alta", "normal", "baixa"]

Categoria = Literal[
    "seguranca",
    "hidraulica",
    "eletrica",
    "elevador",
    "convivencia",
    "estrutura",
    "limpeza",
    "outros",
]

URGENCIAS: dict[Urgencia, str] = {
    "urgente": (
        "Risco imediato à vida, à saúde ou ao prédio, que pede ação na hora: cheiro de gás, "
        "fumaça ou fogo, choque elétrico, pessoa presa no elevador."
    ),
    "alta": (
        "Problema que afeta um serviço essencial ou piora rápido se esperar, sem risco imediato: "
        "vazamento, infiltração, falta de água ou de luz, elevador parado sem ninguém preso."
    ),
    "normal": (
        "Defeito ou manutenção que pode esperar alguns dias sem risco: lâmpada queimada, "
        "interfone com defeito, porta que não fecha direito."
    ),
    "baixa": (
        "Assunto sem impacto na segurança nem nos serviços do prédio: barulho, festa, "
        "reclamação de convivência, sugestão ou dúvida."
    ),
}

CATEGORIAS: dict[Categoria, str] = {
    "seguranca": (
        "Risco à segurança das pessoas: gás, fogo, fumaça, invasão, portão ou porta de acesso "
        "aberta ou quebrada."
    ),
    "hidraulica": (
        "Água e esgoto: vazamento, cano estourado, infiltração, falta de água, entupimento."
    ),
    "eletrica": "Energia e iluminação: lâmpada, tomada, disjuntor, fiação, falta de luz.",
    "elevador": "Elevador parado, com defeito, com barulho estranho ou com pessoa presa.",
    "convivencia": (
        "Relação entre moradores: barulho, festa, animais, vaga da garagem, uso das áreas comuns."
    ),
    "estrutura": (
        "Construção do prédio: rachadura, reboco caindo, telhado, piso, portas e janelas das "
        "áreas comuns."
    ),
    "limpeza": "Limpeza das áreas comuns: sujeira, lixo acumulado, mau cheiro, pragas.",
    "outros": "Assunto que não se encaixa em nenhuma das outras categorias.",
}

# Nome de cada urgência como o gestor lê na tela.
ROTULOS_URGENCIA: dict[Urgencia, str] = {
    "urgente": "Urgente",
    "alta": "Alta",
    "normal": "Normal",
    "baixa": "Baixa",
}

# Confere, ao importar, que os dicionários cobrem exatamente os valores do contrato.
assert set(URGENCIAS) == set(get_args(Urgencia)) == set(ROTULOS_URGENCIA)
assert set(CATEGORIAS) == set(get_args(Categoria))
