from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuração lida de variáveis de ambiente ou de ai-service/.env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # URL do Supabase. Fora do Docker: http://127.0.0.1:54321.
    # Dentro do docker compose: http://host.docker.internal:54321 (o compose já define).
    supabase_url: str = "http://127.0.0.1:54321"
    # Chave service_role do Supabase: a função gravar_classificacao só aceita essa chave.
    # Fica só aqui no servidor, nunca no front (regra 1 do AGENTS.md).
    supabase_service_role_key: str = ""
    # Segredo do gatilho do banco que chama o POST /webhook (o mesmo valor do Vault do
    # Supabase). Vazio, o webhook recusa toda chamada.
    webhook_secret: str = ""
    # Chave do provedor de LLM (Gemini), quando o classificador passar a usar o LLM.
    llm_api_key: str = ""


settings = Settings()
