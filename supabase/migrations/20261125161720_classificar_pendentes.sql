-- Rede de segurança do gatilho classificar_ocorrencia (SQUAD1-80). Ao abrir o painel, o
-- gestor pede ao ai-service que classifique as ocorrências que ficaram sem prioridade porque
-- o aviso se perdeu (ai-service fora do ar, reinício no meio da classificação, Vault vazio).
-- Mesmo padrão de private.avisar_ai_service(): endereço e segredo do Vault, chamada pelo
-- pg_net. A função não devolve dado nenhum; o segredo nunca sai do banco.

create or replace function public.classificar_pendentes()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_url text;
  v_segredo text;
begin
  if v_uid is null or not exists (
    select 1
    from public.vinculos v
    where v.usuario_id = v_uid
      and v.tipo = 'gestor'
      and v.status = 'ativo'
      and v.inicio_vigencia <= current_date
      and (v.fim_vigencia is null or v.fim_vigencia >= current_date)
  ) then
    raise exception using errcode = '42501',
      message = 'Apenas o gestor de um condomínio pode pedir a classificação das pendentes.';
  end if;

  -- Sem pendente, não acorda o ai-service (o Render dorme no plano grátis). As de menos de
  -- 2 minutos ficam de fora: o aviso do gatilho ainda pode estar a caminho (espera até 90 s).
  if not exists (
    select 1
    from public.ocorrencias o
    where o.urgencia_atual is null
      and o.created_at < now() - interval '2 minutes'
  ) then
    return;
  end if;

  -- Falha aqui não pode quebrar o painel: só vai para o log.
  begin
    select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'ai_service_url';
    select decrypted_secret into v_segredo
    from vault.decrypted_secrets where name = 'ai_webhook_secret';

    if nullif(btrim(v_url), '') is null or nullif(btrim(v_segredo), '') is null then
      raise log 'classificar_pendentes: ai_service_url ou ai_webhook_secret ausente no Vault';
      return;
    end if;

    perform net.http_post(
      url := rtrim(btrim(v_url), '/') || '/classificar-pendentes',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Webhook-Secret', v_segredo
      ),
      -- 90 s, como o gatilho: o Render leva de 13 a 18 s para acordar.
      timeout_milliseconds := 90000
    );
  exception when others then
    raise log 'classificar_pendentes: falha ao chamar o ai-service: %', sqlerrm;
  end;
end;
$$;

comment on function public.classificar_pendentes() is
  'Gestor ativo pede ao ai-service a classificação das ocorrências que ficaram sem prioridade. Só chama se houver pendente com mais de 2 minutos. Não devolve dado nenhum.';

revoke execute on function public.classificar_pendentes() from public, anon;
grant execute on function public.classificar_pendentes() to authenticated;
