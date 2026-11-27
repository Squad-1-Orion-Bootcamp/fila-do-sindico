# Decisões do time

Registro curto das decisões, com o motivo.
**Um arquivo por decisão (ou por issue)**, para duas PRs nunca editarem o mesmo arquivo.

## Como registrar

1. Crie um arquivo novo nesta pasta: `AAAA-MM-DD-squad1-XX-assunto.md`
   (sem issue: `AAAA-MM-DD-assunto.md`).
   A data no começo deixa a pasta em ordem cronológica.
2. Use o modelo abaixo.
3. Não edite o arquivo de outra issue para acrescentar a sua decisão: crie o seu.

```markdown
# Assunto da decisão (SQUAD1-XX)

Data: 25/11/2026

## Produto e acesso

| Decisão | Motivo |
| --- | --- |
| ... | ... |

## Técnica

| Decisão | Motivo |
| --- | --- |
| ... | ... |
```

Use só as seções que tiver ("Produto e acesso", "Técnica", "Privacidade"...).

## Quando uma decisão for trocada

No arquivo antigo, acrescente logo abaixo da data:
`Substituída em DD/MM/AAAA por [nome-do-arquivo-novo](nome-do-arquivo-novo.md).`
A decisão antiga fica, para o histórico.

## Onde procurar

`ls docs/decisoes` lista tudo em ordem de data.
Para achar um assunto: `grep -ril "delegação" docs/decisoes`.
