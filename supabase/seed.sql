-- Dados de desenvolvimento, carregados por `npx supabase db reset`.
-- Só dados de teste, nunca dados reais. Senha de todas as contas: senha123
-- Atenção: inclui um admin com senha conhecida. Num banco na nuvem, troque as senhas (ou não
-- crie o admin) antes de rodar este arquivo.
--
-- | Conta                     | Papel   | Situação                                        |
-- | ------------------------- | ------- | ----------------------------------------------- |
-- | admin@teste.local         | admin   | admin da plataforma                             |
-- | gestor.aurora@teste.local | gestor  | gestor ativo do Condomínio Aurora               |
-- | gestor.bosque@teste.local | gestor  | gestor ativo do Residencial Bosque              |
-- | gestor.novo@teste.local   | gestor  | ainda sem condomínio (para testar o cadastro)   |
-- | morador.ana@teste.local   | morador | aprovada no Aurora, bloco A, unidade 101        |
-- | morador.bruno@teste.local | morador | pedido pendente no Bosque, unidade 12           |
--
-- Para o teste de isolamento (skill nova-tabela): o gestor do Aurora não pode ver nada do
-- Bosque, e vice-versa.
--
-- Demo: a gestora principal tem 3 condomínios fictícios, com moradores, ocorrências urgentes e
-- simples em vários status, e um cadastro pendente em cada condomínio.
--
-- | Conta                        | Papel   | Situação                                          |
-- | ---------------------------- | ------- | ------------------------------------------------- |
-- | gestora.helena@teste.local   | gestor  | gestora dos 3 condomínios abaixo                  |
-- | morador.carlos@teste.local   | morador | Edifício Jacarandá, bloco A, 302                  |
-- | morador.fernanda@teste.local | morador | Edifício Jacarandá, bloco A, 104                  |
-- | morador.marcos@teste.local   | morador | Edifício Jacarandá, bloco B, 201                  |
-- | morador.patricia@teste.local | morador | Residencial Ipê Amarelo, unidade 12               |
-- | morador.roberto@teste.local  | morador | Residencial Ipê Amarelo, unidade 34               |
-- | morador.lucia@teste.local    | morador | Residencial Ipê Amarelo, unidade 51               |
-- | morador.eduardo@teste.local  | morador | Vila das Palmeiras, casa 7                        |
-- | morador.sonia@teste.local    | morador | Vila das Palmeiras, casa 15                       |
-- | morador.andre@teste.local    | morador | Vila das Palmeiras, casa 3                        |
-- | morador.juliana@teste.local  | morador | pendente no Edifício Jacarandá, bloco B, 403      |
-- | morador.thiago@teste.local   | morador | pendente no Residencial Ipê Amarelo, unidade 22   |
-- | morador.renata@teste.local   | morador | pendente no Vila das Palmeiras, casa 21           |

-- ---------------------------------------------------------------------------
-- Contas (auth.users + auth.identities). O trigger handle_new_user cria os perfis.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.criar_conta(p_id uuid, p_email text, p_dados jsonb)
returns void
language sql
as $$
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('senha123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', p_dados, now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), p_id, p_id::text, 'email',
    jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
    now(), now(), now()
  );
$$;

select pg_temp.criar_conta('00000000-0000-0000-0000-00000000a001', 'admin@teste.local',
  '{"nome":"Admin Teste","tipo_cadastro":"gestor"}');
select pg_temp.criar_conta('00000000-0000-0000-0000-00000000a002', 'gestor.aurora@teste.local',
  '{"nome":"Gestora Aurora","tipo_cadastro":"gestor"}');
select pg_temp.criar_conta('00000000-0000-0000-0000-00000000a003', 'gestor.bosque@teste.local',
  '{"nome":"Gestor Bosque","tipo_cadastro":"gestor"}');
select pg_temp.criar_conta('00000000-0000-0000-0000-00000000a004', 'gestor.novo@teste.local',
  '{"nome":"Gestor Novo","tipo_cadastro":"gestor"}');

-- Admin da plataforma (o trigger muda profiles.role para 'admin').
insert into public.administradores_plataforma (usuario_id)
values ('00000000-0000-0000-0000-00000000a001');

-- ---------------------------------------------------------------------------
-- Condomínios cadastrados pelos próprios gestores (Sprint 1: vínculo já nasce ativo,
-- mesmo resultado de cadastrar_condominio).
-- ---------------------------------------------------------------------------
insert into public.condominios (id, nome, cnpj, criado_por) values
  ('00000000-0000-0000-0000-00000000c001', 'Condomínio Aurora', '11111111000111', '00000000-0000-0000-0000-00000000a002'),
  ('00000000-0000-0000-0000-00000000c002', 'Residencial Bosque', '22222222000122', '00000000-0000-0000-0000-00000000a003');

insert into public.vinculos (id, usuario_id, condominio_id, tipo, aprovado_por) values
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-00000000c001', 'gestor', '00000000-0000-0000-0000-00000000a002'),
  ('00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-00000000a003', '00000000-0000-0000-0000-00000000c002', 'gestor', '00000000-0000-0000-0000-00000000a003');

-- ---------------------------------------------------------------------------
-- Moradores: o trigger cria o perfil e a solicitação de vínculo pendente.
-- ---------------------------------------------------------------------------
select pg_temp.criar_conta('00000000-0000-0000-0000-00000000a005', 'morador.ana@teste.local',
  '{"nome":"Ana Moradora","tipo_cadastro":"morador","condominio_id":"00000000-0000-0000-0000-00000000c001","unidade":"101"}');
select pg_temp.criar_conta('00000000-0000-0000-0000-00000000a006', 'morador.bruno@teste.local',
  '{"nome":"Bruno Morador","tipo_cadastro":"morador","condominio_id":"00000000-0000-0000-0000-00000000c002","unidade":"12"}');

-- Ana aprovada pela gestora do Aurora (mesmo resultado de aprovar_solicitacao_vinculo).
update public.solicitacoes_vinculo set bloco_solicitado = 'A'
where solicitante_id = '00000000-0000-0000-0000-00000000a005';

insert into public.imoveis (id, condominio_id, bloco, unidade)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000c001', 'A', '101');

insert into public.vinculos (id, usuario_id, condominio_id, tipo, aprovado_por)
values ('00000000-0000-0000-0000-00000000b003', '00000000-0000-0000-0000-00000000a005',
        '00000000-0000-0000-0000-00000000c001', 'morador', '00000000-0000-0000-0000-00000000a002');

insert into public.vinculos_imovel (vinculo_id, imovel_id, condominio_id)
values ('00000000-0000-0000-0000-00000000b003', '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000c001');

update public.solicitacoes_vinculo
set status = 'aprovada',
    analisado_por = '00000000-0000-0000-0000-00000000a002',
    analisado_em = now(),
    imovel_id = '00000000-0000-0000-0000-00000000d001',
    vinculo_aprovado_id = '00000000-0000-0000-0000-00000000b003'
where solicitante_id = '00000000-0000-0000-0000-00000000a005';

-- ===========================================================================
-- Demo: gestora com 3 condomínios, moradores e ocorrências.
-- Aprovações passam pela função de verdade (aprovar_solicitacao_vinculo), como se a gestora
-- clicasse em "Aprovar". Urgência e categoria ficam vazias: quem preenche é a IA (Sprint 2).
-- ===========================================================================

-- Aprova o pedido do morador em nome da gestora. O bloco é gravado antes, porque o cadastro
-- só envia a unidade.
create or replace function pg_temp.aprovar_morador(p_gestor uuid, p_morador uuid, p_bloco text)
returns void
language plpgsql
as $$
declare
  v_solicitacao uuid;
begin
  update public.solicitacoes_vinculo
  set bloco_solicitado = p_bloco
  where solicitante_id = p_morador and status = 'pendente'
  returning id into v_solicitacao;

  -- auth.uid() passa a ser a gestora até o fim da transação.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', p_gestor, 'role', 'authenticated')::text, true);
  perform public.aprovar_solicitacao_vinculo(v_solicitacao);
end;
$$;

-- Ocorrência registrada pelo morador há p_idade. Em andamento e concluída ganham o histórico
-- de status, como se a gestora tivesse mudado pelo painel.
create or replace function pg_temp.criar_ocorrencia(
  p_morador uuid, p_local text, p_descricao text, p_status text, p_idade interval)
returns void
language plpgsql
as $$
declare
  v_condominio uuid;
  v_gestor uuid;
  v_id uuid;
  v_criada timestamptz := now() - p_idade;
  v_em_andamento timestamptz := now() - p_idade / 2;
  v_concluida timestamptz := now() - p_idade / 4;
begin
  select v.condominio_id, v.aprovado_por into v_condominio, v_gestor
  from public.vinculos v
  where v.usuario_id = p_morador and v.tipo = 'morador' and v.status = 'ativo';

  insert into public.ocorrencias (
    condominio_id, registrado_por, local, descricao, status, created_at, updated_at, concluido_em
  ) values (
    v_condominio, p_morador, p_local, p_descricao, p_status, v_criada,
    case p_status when 'novo' then v_criada when 'em_andamento' then v_em_andamento else v_concluida end,
    case when p_status = 'concluido' then v_concluida end
  )
  returning id into v_id;

  if p_status in ('em_andamento', 'concluido') then
    insert into public.historico_status (ocorrencia_id, autor_id, status_anterior, status_novo, created_at)
    values (v_id, v_gestor, 'novo', 'em_andamento', v_em_andamento);
  end if;
  if p_status = 'concluido' then
    insert into public.historico_status (ocorrencia_id, autor_id, status_anterior, status_novo, created_at)
    values (v_id, v_gestor, 'em_andamento', 'concluido', v_concluida);
  end if;
end;
$$;

-- Gestora e condomínios (mesmo resultado de cadastrar_condominio).
select pg_temp.criar_conta('00000000-0000-0000-0000-00000000a101', 'gestora.helena@teste.local',
  '{"nome":"Helena Prado","tipo_cadastro":"gestor"}');

insert into public.condominios (id, nome, cnpj, criado_por) values
  ('00000000-0000-0000-0000-00000000c101', 'Edifício Jacarandá', '61111111000161', '00000000-0000-0000-0000-00000000a101'),
  ('00000000-0000-0000-0000-00000000c102', 'Residencial Ipê Amarelo', '62222222000162', '00000000-0000-0000-0000-00000000a101'),
  ('00000000-0000-0000-0000-00000000c103', 'Vila das Palmeiras', '63333333000163', '00000000-0000-0000-0000-00000000a101');

insert into public.vinculos (usuario_id, condominio_id, tipo, aprovado_por) values
  ('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000c101', 'gestor', '00000000-0000-0000-0000-00000000a101'),
  ('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000c102', 'gestor', '00000000-0000-0000-0000-00000000a101'),
  ('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000c103', 'gestor', '00000000-0000-0000-0000-00000000a101');

-- Moradores: o trigger cria o perfil e o pedido pendente.
select pg_temp.criar_conta('00000000-0000-0000-0000-00000000a111', 'morador.carlos@teste.local',
  '{"nome":"Carlos Lima","tipo_cadastro":"morador","condominio_id":"00000000-0000-0000-0000-00000000c101","unidade":"302"}');
select pg_temp.criar_conta('00000000-0000-0000-0000-00000000a112', 'morador.fernanda@teste.local',
  '{"nome":"Fernanda Rocha","tipo_cadastro":"morador","condominio_id":"00000000-0000-0000-0000-00000000c101","unidade":"104"}');
select pg_temp.criar_conta('00000000-0000-0000-0000-00000000a113', 'morador.marcos@teste.local',
  '{"nome":"Marcos Teixeira","tipo_cadastro":"morador","condominio_id":"00000000-0000-0000-0000-00000000c101","unidade":"201"}');
select pg_temp.criar_conta('00000000-0000-0000-0000-00000000a114', 'morador.patricia@teste.local',
  '{"nome":"Patrícia Gomes","tipo_cadastro":"morador","condominio_id":"00000000-0000-0000-0000-00000000c102","unidade":"12"}');
select pg_temp.criar_conta('00000000-0000-0000-0000-00000000a115', 'morador.roberto@teste.local',
  '{"nome":"Roberto Nunes","tipo_cadastro":"morador","condominio_id":"00000000-0000-0000-0000-00000000c102","unidade":"34"}');
select pg_temp.criar_conta('00000000-0000-0000-0000-00000000a116', 'morador.lucia@teste.local',
  '{"nome":"Lúcia Ferraz","tipo_cadastro":"morador","condominio_id":"00000000-0000-0000-0000-00000000c102","unidade":"51"}');
select pg_temp.criar_conta('00000000-0000-0000-0000-00000000a117', 'morador.eduardo@teste.local',
  '{"nome":"Eduardo Pires","tipo_cadastro":"morador","condominio_id":"00000000-0000-0000-0000-00000000c103","unidade":"Casa 7"}');
select pg_temp.criar_conta('00000000-0000-0000-0000-00000000a118', 'morador.sonia@teste.local',
  '{"nome":"Sônia Ribeiro","tipo_cadastro":"morador","condominio_id":"00000000-0000-0000-0000-00000000c103","unidade":"Casa 15"}');
select pg_temp.criar_conta('00000000-0000-0000-0000-00000000a119', 'morador.andre@teste.local',
  '{"nome":"André Costa","tipo_cadastro":"morador","condominio_id":"00000000-0000-0000-0000-00000000c103","unidade":"Casa 3"}');

-- Pendentes, um por condomínio, para mostrar a aprovação.
select pg_temp.criar_conta('00000000-0000-0000-0000-00000000a121', 'morador.juliana@teste.local',
  '{"nome":"Juliana Alves","tipo_cadastro":"morador","condominio_id":"00000000-0000-0000-0000-00000000c101","unidade":"403"}');
select pg_temp.criar_conta('00000000-0000-0000-0000-00000000a122', 'morador.thiago@teste.local',
  '{"nome":"Thiago Barros","tipo_cadastro":"morador","condominio_id":"00000000-0000-0000-0000-00000000c102","unidade":"22"}');
select pg_temp.criar_conta('00000000-0000-0000-0000-00000000a123', 'morador.renata@teste.local',
  '{"nome":"Renata Dias","tipo_cadastro":"morador","condominio_id":"00000000-0000-0000-0000-00000000c103","unidade":"Casa 21"}');

update public.solicitacoes_vinculo set bloco_solicitado = 'B', created_at = now() - interval '3 hours'
where solicitante_id = '00000000-0000-0000-0000-00000000a121';
update public.solicitacoes_vinculo set created_at = now() - interval '1 day 2 hours'
where solicitante_id = '00000000-0000-0000-0000-00000000a122';
update public.solicitacoes_vinculo set created_at = now() - interval '35 minutes'
where solicitante_id = '00000000-0000-0000-0000-00000000a123';

-- Aprovados pela gestora.
select pg_temp.aprovar_morador('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000a111', 'A');
select pg_temp.aprovar_morador('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000a112', 'A');
select pg_temp.aprovar_morador('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000a113', 'B');
select pg_temp.aprovar_morador('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000a114', '');
select pg_temp.aprovar_morador('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000a115', '');
select pg_temp.aprovar_morador('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000a116', '');
select pg_temp.aprovar_morador('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000a117', '');
select pg_temp.aprovar_morador('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000a118', '');
select pg_temp.aprovar_morador('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000a119', '');

-- Ocorrências: urgentes (gás, elevador com gente presa, vazamento, fio solto) e simples.
select pg_temp.criar_ocorrencia('00000000-0000-0000-0000-00000000a112', 'Elevador social',
  'Elevador parado entre o 2º e o 3º andar com uma pessoa presa dentro.', 'novo', interval '10 minutes');
select pg_temp.criar_ocorrencia('00000000-0000-0000-0000-00000000a111', 'Corredor do 3º andar, bloco A',
  'Cheiro forte de gás no corredor, perto dos apartamentos 301 e 302.', 'novo', interval '25 minutes');
select pg_temp.criar_ocorrencia('00000000-0000-0000-0000-00000000a113', 'Escada do bloco B',
  'Lâmpada da escada queimada entre o 1º e o 2º andar.', 'em_andamento', interval '2 days');
select pg_temp.criar_ocorrencia('00000000-0000-0000-0000-00000000a111', 'Apartamento 402, bloco A',
  'Barulho de obra depois das 22h no apartamento de cima.', 'concluido', interval '6 days');

select pg_temp.criar_ocorrencia('00000000-0000-0000-0000-00000000a114', 'Garagem do subsolo',
  'Vazamento forte no teto da garagem. A água está escorrendo pela parede do quadro de luz.', 'novo', interval '1 hour');
select pg_temp.criar_ocorrencia('00000000-0000-0000-0000-00000000a115', 'Portão da garagem',
  'Portão da garagem abrindo e fechando muito devagar.', 'novo', interval '1 day 3 hours');
select pg_temp.criar_ocorrencia('00000000-0000-0000-0000-00000000a116', 'Apartamento 51',
  'Interfone do apartamento não toca quando chamam da portaria.', 'em_andamento', interval '3 days');
select pg_temp.criar_ocorrencia('00000000-0000-0000-0000-00000000a114', 'Lixeira do térreo',
  'Lixo acumulado na lixeira do térreo desde sábado.', 'concluido', interval '8 days');

select pg_temp.criar_ocorrencia('00000000-0000-0000-0000-00000000a117', 'Rua interna, perto da casa 7',
  'Fio da rede elétrica caído na rua interna, soltando faíscas.', 'novo', interval '40 minutes');
select pg_temp.criar_ocorrencia('00000000-0000-0000-0000-00000000a118', 'Área da piscina',
  'Som alto na área da piscina depois das 23h.', 'novo', interval '5 hours');
select pg_temp.criar_ocorrencia('00000000-0000-0000-0000-00000000a119', 'Entrada do condomínio',
  'Lâmpada do poste da entrada queimada.', 'em_andamento', interval '1 day 6 hours');
select pg_temp.criar_ocorrencia('00000000-0000-0000-0000-00000000a118', 'Rua interna, perto da casa 15',
  'Buraco no asfalto da rua interna.', 'concluido', interval '10 days');

-- ---------------------------------------------------------------------------
-- Ocorrências (urgência e categoria vazias: "Aguardando triagem").
-- ---------------------------------------------------------------------------
insert into public.ocorrencias (condominio_id, registrado_por, imovel_id, local, descricao, status) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000a005', '00000000-0000-0000-0000-00000000d001',
   'Apartamento 101', 'Infiltração no teto do banheiro, vindo do andar de cima.', 'novo'),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000a005', null,
   'Garagem', 'Lâmpada da vaga 14 queimada há uma semana.', 'em_andamento'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000a003', null,
   'Portão principal', 'Portão eletrônico fechando devagar.', 'novo');
