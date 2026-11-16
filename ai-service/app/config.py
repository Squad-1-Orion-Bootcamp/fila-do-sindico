from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuração lida de variáveis de ambiente ou de ai-service/.env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Segredo compartilhado com o Database Webhook do Supabase (Sprint 2).
    webhook_secret: str = ""
    # Chave do provedor de LLM, quando o time escolher qual usar.
    llm_api_key: str = ""


settings = Settings()
