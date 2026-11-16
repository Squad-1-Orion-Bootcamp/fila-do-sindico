from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuração lida de variáveis de ambiente ou de ai-service/.env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # URL do Supabase. Fora do Docker: http://127.0.0.1:54321.
    # Dentro do docker compose: http://host.docker.internal:54321 (o compose já define).
    supabase_url: str = "http://127.0.0.1:54321"
    # Segredo compartilhado com o Database Webhook do Supabase (Sprint 2).
    webhook_secret: str = ""
    # Chave do provedor de LLM, quando o time escolher qual usar.
    llm_api_key: str = ""


settings = Settings()
