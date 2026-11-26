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


def aplicar_trava(descricao: str) -> str | None:
    """Retorna o termo de risco encontrado na descrição, ou None.

    Olha só a descrição, nunca o local: "Sala elétrica" no local deixaria tudo urgente.
    """
    texto_normalizado = normalizar_texto(descricao)
    for termo, padrao in _PADROES_DE_RISCO:
        if padrao.search(texto_normalizado):
            return termo
    if _PRESO.search(texto_normalizado) and _ELEVADOR.search(texto_normalizado):
        return TERMO_ELEVADOR
    return None
