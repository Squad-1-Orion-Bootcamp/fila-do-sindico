# Link público da tarefa (SQUAD1-75)

Data: 24/11/2026

## Técnica

| Decisão | Motivo |
| --- | --- |
| `ver_tarefa` devolve a situação do link para todo token que existe: `ativa` com condomínio, local e descrição; `concluida` (encerrada pelo funcionário ou pelo gestor) ou `revogada` (troca de responsável ou "assumir de volta") sem nenhum dado da tarefa. Token inválido ou inexistente devolve lista vazia | A US 3 pede um aviso para "tarefa encerrada" e outro para "não está mais atribuída". O token tem 32 bytes aleatórios, então a situação só chega a quem recebeu o link |
| `concluir_tarefa` responde "Esta tarefa já foi encerrada." ou "Esta tarefa não está mais atribuída a você." para um token que não vale mais, e "Este link não está mais disponível." para token inválido ou inexistente | Os mesmos avisos da página, também quando o link para de valer com a página aberta |
| As duas funções do link valem para `anon` e `authenticated` | Quem abre o link num navegador com sessão (por exemplo, o gestor no próprio celular) chama como `authenticated`. O acesso vem do token, não do papel |
| Comentário só com espaços é gravado como nulo | Não guardar comentário em branco |
| A conclusão pelo visitante grava o histórico com `autor_id = null` | O funcionário não tem conta e a coluna permite ausência de autor |
