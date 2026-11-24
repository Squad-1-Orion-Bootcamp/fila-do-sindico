import re
import unicodedata

# Lista única de termos que forçam urgência "urgente" sem diferenciar maiúsculas e acentos.
PALAVRAS_DE_RISCO: tuple[str, ...] = (
    "gás",
    "choque",
    "elétrica",
    "fumaça",
    "vazamento grave",
    "rachadura",
)


def normalizar_texto(texto: str) -> str:
    """Remove acentos e converte para minúsculas para comparação insensível a caixa."""
    sem_acentos = "".join(
        caractere
        for caractere in unicodedata.normalize("NFD", texto)
        if unicodedata.category(caractere) != "Mn"
    )
    return sem_acentos.casefold()


def _compilar_padrao(termo: str) -> re.Pattern[str]:
    partes = [re.escape(parte) for parte in normalizar_texto(termo).split()]
    expressao = r"\s+".join(partes)
    # Fronteira de palavra evita falsos positivos como "vagas" ou "desgaste" casarem com "gas".
    return re.compile(rf"\b{expressao}\b")


_PADROES_DE_RISCO: tuple[tuple[str, re.Pattern[str]], ...] = tuple(
    (termo, _compilar_padrao(termo)) for termo in PALAVRAS_DE_RISCO
)


def aplicar_trava(descricao: str) -> str | None:
    """Retorna a primeira palavra de risco encontrada na descrição, ou None."""
    texto_normalizado = normalizar_texto(descricao)
    for termo, padrao in _PADROES_DE_RISCO:
        if padrao.search(texto_normalizado):
            return termo
    return None
