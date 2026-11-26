# Modelo da justificativa: Gemini 3.5 Flash Lite (SQUAD1-93)

Data: 26/11/2026

Decisão técnica do time, sem decisão de produto.
Substitui o modelo e o "thinking" da [justificativa pelo Gemini](2026-11-25-squad1-85-justificativa-pelo-gemini.md); o resto daquela decisão continua valendo.

## Técnica

| Decisão | Motivo |
| --- | --- |
| O System 2 usa o `gemini-3.5-flash-lite` por padrão (`LLM_MODELO_JUSTIFICATIVA`) | Teste de 26/11 com a chave do time: o `gemini-2.5-flash` responde 404 ("no longer available to new users"); o `gemini-3.8-flash` e o `gemini-3.5-flash` passaram dos 8 s (o 3.8 deu 503 por demanda alta, e o 3.5 levou 70 s); o `gemini-3.5-flash-lite` respondeu em 4,6 s |
| O `thinking_budget = 0` vai só para os modelos 2.5 | No 2.5 o "thinking" vem ligado por padrão e atrasa a frase; o 3.5 Flash Lite recusa esse campo com 400 `INVALID_ARGUMENT` |
| A falha da justificativa vai para o log com o código HTTP, o status do Google e o modelo (ex.: `ModelNotFoundError 404 NOT_FOUND, modelo gemini-2.5-flash`), nunca com a chave | Antes, o log mostrava só o tipo do erro, e o motivo padrão escondeu o problema desde o merge da SQUAD1-85 |
