# Prioridade no card (SQUAD1-64)

Data: 25/11/2026

## Produto e acesso

| Decisão | Motivo |
| --- | --- |
| O painel do gestor atualiza ao recarregar a página, sem Realtime nesta sprint. A ocorrência nova aparece como "Aguardando triagem" até recarregar | Decisão da Riane (a issue deixava para a planning): mais simples e sem mudar o banco |
| Depois que o gestor confirma ou muda a prioridade, o card mostra "Definida por você" (ou "Definida pelo gestor", se foi outro gestor do condomínio) e a justificativa dele, se escreveu. O motivo da IA sai do card | Decisão da Riane: a escolha do gestor fica no lugar da sugestão da IA, como pede o "pronto quando" da issue |
| A prioridade muda por um seletor no card, que salva ao escolher. "Confirmar" (só enquanto a prioridade é da IA) e "Adicionar motivo", que abre um campo opcional, ficam logo abaixo | Decisão da Riane: corrigir um falso urgente com um clique; o motivo continua opcional |
| A ocorrência concluída sem classificação da IA fica sem etiqueta de prioridade, e nenhuma concluída tem seletor | Decisão da Riane: "Aguardando triagem" numa concluída não diz nada; o banco não deixa mudar a prioridade de ocorrência concluída |
| O motivo no card aparece em até 2 linhas. Quando a frase é cortada, "Ver tudo" mostra o texto inteiro e "Ver menos" volta a cortar | Sugestão do Danilo na PR (o motivo da IA tem até 200 caracteres e aparecia pela metade); decisão da Riane. Cortar mantém o card curto mesmo com o motivo do gestor, que vai até 800 caracteres, e é o mesmo jeito do comentário do funcionário |
