-- Dados de desenvolvimento, carregados por `npx supabase db reset`.
-- Só dados de teste, nunca dados reais. Senha de todas as contas: senha123
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
