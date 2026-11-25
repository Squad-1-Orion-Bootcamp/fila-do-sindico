# Trava de palavras de risco (SQUAD1-58)

Data: 25/11/2026

Decidido pelo time, sem product builder no momento.

## Produto e acesso

| Decisão | Motivo |
| --- | --- |
| A trava força `urgente` com: gás (e "gases"), choque, elétrica, fumaça, vazamento grave, rachadura, fogo e incêndio. Sem diferenciar maiúsculas e acentos ("incendio" vale) e aceitando plural ("rachaduras", "choques", "vazamentos graves") | A lista do card (SQUAD1-58) mais fogo e incêndio, que são risco de vida. O plural é um jeito comum de escrever, e a trava existe para não deixar passar risco |
| Pessoa presa no elevador também força `urgente`: a descrição precisa ter "preso", "presa", "presos" ou "presas" **e** "elevador", em qualquer ordem | "Preso" sozinho daria falso urgente ("portão preso", "carro preso na garagem") |
| A trava olha só a descrição, nunca o local | Um local como "Sala elétrica" ou "Abrigo de gás" deixaria urgente toda ocorrência registrada ali |
| Quando a trava dispara, a justificativa cita o termo encontrado ("Trava de risco: a descrição menciona 'gás'.") | O gestor vê por que a ocorrência ficou urgente |

## Técnica

| Decisão | Motivo |
| --- | --- |
| A trava e as regras provisórias usam a mesma comparação por palavra inteira (`padrao_de_termo` em `app/trava.py`) | "gas" não casa com "gasto", "vagas" nem "desgaste", nem na trava nem nas regras |
