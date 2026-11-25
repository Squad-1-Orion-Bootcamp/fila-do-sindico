from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuração lida de variáveis de ambiente ou de ai-service/.env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # URL do Supabase. Fora do Docker: http://127.0.0.1:54321.
    # Dentro do docker compose: http://host.docker.internal:54321 (o compose já define).
    supabase_url: str = "http://127.0.0.1:54321"
    # Chave secreta do Supabase (sb_secret_..., em Project Settings → API Keys). Ela entra no
    # banco com o papel service_role, o único que pode chamar gravar_classificacao. A chave
    # antiga em formato JWT (service_role) também funciona. Fica só aqui no servidor, nunca no
    # front (regra 1 do AGENTS.md).
    supabase_secret_key: str = ""
    # Segredo do gatilho do banco que chama o POST /webhook (o mesmo valor do Vault do
    # Supabase). Vazio, o webhook recusa toda chamada.
    webhook_secret: str = ""
    # Chave da API da Gemini (aistudio.google.com). Vazia, o classificar() nem chama o
    # Decision 1 e usa só as regras provisórias (origem "regra").
    llm_api_key: str = ""
    # Modelo do System 1 (Decisions API, v1beta) e o tempo limite da chamada.
    llm_modelo_decisao: str = "gemini-decision-1"
    llm_timeout_segundos: float = 3.0
    # Modelo do System 2 (a frase da justificativa) e o tempo limite da execução inteira,
    # contando a nova tentativa quando a resposta vem inválida.
    llm_modelo_justificativa: str = "gemini-2.5-flash"
    llm_timeout_justificativa_segundos: float = 8.0


settings = Settings()
