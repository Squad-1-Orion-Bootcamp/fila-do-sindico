# Classificação pela IA no banco (SQUAD1-59)

Data: 24/11/2026

## Produto e acesso

| Decisão | Motivo |
| --- | --- |
| O morador não vê a prioridade nem o motivo da IA da própria ocorrência, só o status. Vale no banco, não só na tela: ele não lê `urgencia_atual`, `categoria_atual` nem `classificacoes_ia` pela API | Decisão do Lucas (SQUAD1-56); com a SQUAD1-59 esses dados passam a ser preenchidos |
| As decisões do gestor (`decisoes`: prioridade escolhida, justificativa, notas, destinatário) também são só do gestor ativo e do admin. Responde a SQUAD1-49 | Mesma regra: o morador vê só o status (SQUAD1-56 e US 3, em que o comentário do funcionário fica só para o síndico) |

## Técnica

| Decisão | Motivo |
| --- | --- |
| O banco avisa o ai-service por um gatilho com `pg_net` criado em migração, e não pelos "Database Webhooks" do painel | A regra 3 do `AGENTS.md`: toda mudança no banco é migração; o gatilho vai igual para local, stage e prod |
| O endereço do ai-service e o segredo do webhook ficam no Vault de cada banco, cadastrados à mão uma vez por ambiente | Cada ambiente tem o próprio ai-service, e a regra 6 proíbe segredo no código |
| O gatilho espera até 90 s pela resposta do ai-service (`timeout_milliseconds := 90000`) | No plano grátis, o Render dorme depois de 15 minutos sem uso e leva de 13 a 18 s para acordar; com 5 s, a primeira ocorrência depois de uma pausa nunca seria classificada. O `pg_net` é assíncrono, então o morador não espera (proposta e teste do Danilo na revisão da #24) |
| O gatilho nunca impede o registro da ocorrência: sem o Vault configurado ou com erro no `pg_net`, a ocorrência fica sem prioridade | Registrar a ocorrência é mais importante que classificá-la na hora; o "classificar pendentes" (SQUAD1-80) pega depois |
| `gravar_classificacao` só pode ser chamada pela `service_role`, e chamar de novo para a mesma ocorrência não muda nada | Só o ai-service grava a classificação; o `pg_net` e o "classificar pendentes" podem mandar a mesma ocorrência duas vezes |
| Cada classificação guarda a origem: `ia`, `regra`, `ia+trava` ou `regra+trava` | Mostra quantas vezes a IA respondeu e quantas vezes as regras assumiram (proposta da IA de 23/11) |
| O painel do gestor lê as ocorrências pela função `listar_ocorrencias_gestor()`, e não por `.from('ocorrencias')` | Gestor e morador usam o mesmo papel no banco, e permissão por coluna vale para o papel inteiro: para fechar `urgencia_atual` para o morador, a coluna sai da leitura direta de todos |
