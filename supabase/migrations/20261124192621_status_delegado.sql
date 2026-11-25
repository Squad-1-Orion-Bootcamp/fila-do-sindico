-- Status "Delegado" da ocorrência (SQUAD1-57, história SQUAD1-53).
-- O quadro passa a ter quatro status: novo, em_andamento, delegado e concluido.
-- Delegado só vem da delegação para um funcionário (US 3, SQUAD1-74). A troca manual pelo
-- gestor (alterar_status_ocorrencia) continua só entre novo, em_andamento e concluido, e não
-- muda aqui. O gestor pode tirar uma ocorrência de delegado trocando o status manualmente.

alter table public.ocorrencias drop constraint ocorrencias_status_check;
alter table public.ocorrencias add constraint ocorrencias_status_check
  check (status in ('novo', 'em_andamento', 'delegado', 'concluido'));

-- O histórico precisa aceitar delegado nos dois lados: quando a ocorrência é delegada e quando
-- sai de delegado.
alter table public.historico_status drop constraint historico_status_status_anterior_check;
alter table public.historico_status add constraint historico_status_status_anterior_check
  check (status_anterior is null or status_anterior in ('novo', 'em_andamento', 'delegado', 'concluido'));

alter table public.historico_status drop constraint historico_status_status_novo_check;
alter table public.historico_status add constraint historico_status_status_novo_check
  check (status_novo in ('novo', 'em_andamento', 'delegado', 'concluido'));
