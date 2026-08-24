-- 20260824191500_notifier_nouveau_contact_par_n8n.sql
-- Applique sur la base de production le 2026-08-24 via le connecteur MCP.
--
-- Prevenir Christopher par e-mail des qu'un contact est laisse sur le site,
-- et accuser reception au client quand il a donne une adresse.
--
-- Le trigger POSTE la ligne inseree vers un webhook n8n, qui rend les deux
-- e-mails et les envoie par Gmail. Le payload reprend la FORME d'un webhook
-- de base Supabase ({type, table, record, schema}) : c'est celle qu'attendent
-- deja les workflows n8n du groupe, cote Rentanoo comme ici.
--
-- Meme mecanique que notify_order_status() : pg_net, donc ASYNCHRONE. Une
-- inscription n'attend jamais l'envoi d'un e-mail, et un n8n injoignable ne
-- fait pas echouer le formulaire — c'est la propriete qui compte, la liaison
-- de Nosy Be n'etant pas fiable.
--
-- ⚠️ L'URL du webhook N'EST PAS dans ce fichier. Elle vit dans le Vault
-- (secret « n8n_contact_webhook_url ») et a ete posee par une commande
-- separee : elle vaut declencheur, qui l'a peut poster n'importe quoi.
-- Pour rejouer ce fichier sur une base neuve, creer d'abord le secret :
--   select vault.create_secret('<url>', 'n8n_contact_webhook_url', '<note>');

create or replace function public.n8n_contact_webhook_url()
returns text
language sql
security definer
set search_path to 'public', 'vault'
as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = 'n8n_contact_webhook_url';
$$;

revoke all on function public.n8n_contact_webhook_url() from public, anon, authenticated;

create or replace function public.notifier_nouveau_contact()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_url text := public.n8n_contact_webhook_url();
begin
  -- Secret absent (projet neuf, restauration) : on ne notifie pas, mais on
  -- n'empeche surtout pas l'inscription de s'enregistrer.
  if v_url is null or btrim(v_url) = '' then
    return null;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object(
      'type',   'INSERT',
      'table',  tg_table_name,
      'schema', tg_table_schema,
      'record', to_jsonb(new)
    )
  );
  return null;
end;
$$;

revoke all on function public.notifier_nouveau_contact() from public, anon, authenticated;

drop trigger if exists waitlist_signups_notifier on public.waitlist_signups;
create trigger waitlist_signups_notifier
  after insert on public.waitlist_signups
  for each row execute function public.notifier_nouveau_contact();

drop trigger if exists restaurant_leads_notifier on public.restaurant_leads;
create trigger restaurant_leads_notifier
  after insert on public.restaurant_leads
  for each row execute function public.notifier_nouveau_contact();

drop trigger if exists courier_leads_notifier on public.courier_leads;
create trigger courier_leads_notifier
  after insert on public.courier_leads
  for each row execute function public.notifier_nouveau_contact();
