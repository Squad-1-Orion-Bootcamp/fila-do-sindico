import re
import unicodedata

# Lista única de termos que forçam urgência "urgente". A comparação não diferencia maiúsculas
# nem acentos ("incendio" casa com "incêndio") e aceita plural ("rachaduras", "choques").
# Termos e regras decididos pelo time em 25/11/2026
# (docs/decisoes/2026-11-25-squad1-58-trava-de-palavras-de-risco.md).
PALAVRAS_DE_RISCO: tuple[str, ...] = (
    "gás",
    # O plural de "gás" é "gases", que o "s" opcional não cobre.
    "gases",
    "choque",
    "elétrica",
    "fumaça",
    "vazamento grave",
    "rachadura",
    "fogo",
    "incêndio",
)

# Pessoa presa no elevador: a descrição precisa ter "preso", "presa", "presos" ou "presas" E
# "elevador", em qualquer ordem. Sozinho, "preso" não basta ("portão preso", "carro preso").
TERMO_ELEVADOR = "pessoa presa no elevador"

# Expressões em que a palavra de risco tem outro sentido: saem do texto antes da trava e das
# regras. A lista é proposta do time e aguarda a confirmação da product builder
# (docs/decisoes/2026-11-26-squad1-88-excecoes-da-trava.md).
# Escreva no singular e com acento: o plural e a falta de acento já são aceitos, e "de", "do" e
# "da" valem um pelo outro ("fumaça do churrasco" casa com "fumaça de churrasco").
EXCECOES: tuple[str, ...] = (
    "fumaça de cigarro",
    "fumaça de churrasco",
    "fumaça da churrasqueira",
    "choque de realidade",
    "fogo de artifício",
    "conta de gás",
    "leitura do gás",
    "bicicleta elétrica",
)


def normalizar_texto(texto: str) -> str:
    """Remove acentos e converte para minúsculas para comparação insensível a caixa."""
    sem_acentos = "".join(
        caractere
        for caractere in unicodedata.normalize("NFD", texto)
        if unicodedata.category(caractere) != "Mn"
    )
    return sem_acentos.casefold()


def padrao_de_termo(termo: str) -> re.Pattern[str]:
    """Padrão que casa o termo como palavra inteira, com plural opcional em cada palavra.

    Usado pela trava e pelas regras provisórias. Aplique sobre um texto já normalizado.
    """
    partes = [rf"{re.escape(parte)}s?" for parte in normalizar_texto(termo).split()]
    expressao = r"\s+".join(partes)
    # Fronteira de palavra evita falsos positivos como "vagas" ou "desgaste" casarem com "gas".
    return re.compile(rf"\b{expressao}\b")


_PADROES_DE_RISCO: tuple[tuple[str, re.Pattern[str]], ...] = tuple(
    (termo, padrao_de_termo(termo)) for termo in PALAVRAS_DE_RISCO
)
_PRESO = re.compile(r"\bpres[ao]s?\b")
_ELEVADOR = re.compile(r"\belevador(es)?\b")

_CONECTIVOS = {"de", "do", "da"}


def _padrao_de_excecao(expressao: str) -> re.Pattern[str]:
    """Como o padrao_de_termo, mas com "de", "do" e "da" (e plurais) valendo um pelo outro."""
    partes = [
        r"d[aeo]s?" if parte in _CONECTIVOS else rf"{re.escape(parte)}s?"
        for parte in normalizar_texto(expressao).replace("-", " ").split()
    ]
    expressao_regex = r"\s+".join(partes)
    return re.compile(rf"\b{expressao_regex}\b")


_PADROES_DE_EXCECAO: tuple[re.Pattern[str], ...] = tuple(
    _padrao_de_excecao(expressao) for expressao in EXCECOES
)


def remover_excecoes(texto_normalizado: str) -> str:
    """Troca cada expressão de EXCECOES por um espaço. Aplique sobre um texto já normalizado.

    Hífen vira espaço antes da comparação, para uma expressão com hífen (ex.: "porta
    corta-fogo", se entrar na lista) casar com ou sem ele. A troca é por um
    espaço, não por vazio, para não juntar as palavras vizinhas.
    """
    texto = texto_normalizado.replace("-", " ")
    for padrao in _PADROES_DE_EXCECAO:
        texto = padrao.sub(" ", texto)
    return texto


def aplicar_trava(descricao: str) -> str | None:
    """Retorna o termo de risco encontrado na descrição, ou None.

    Olha só a descrição, nunca o local: "Sala elétrica" no local deixaria tudo urgente.
    As expressões de EXCECOES não contam ("fumaça de cigarro" não dispara "fumaça").
    """
    texto_normalizado = remover_excecoes(normalizar_texto(descricao))
    for termo, padrao in _PADROES_DE_RISCO:
        if padrao.search(texto_normalizado):
            return termo
    if _PRESO.search(texto_normalizado) and _ELEVADOR.search(texto_normalizado):
        return TERMO_ELEVADOR
    return None
