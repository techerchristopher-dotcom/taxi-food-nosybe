-- Canal Telegram admin, lu par la fonction Edge notifier-message (service_role seul).
create or replace function public.lire_chat_telegram_admin()
returns text language sql stable security definer set search_path = public
as $$ select decrypted_secret from vault.decrypted_secrets where name = 'telegram_admin_chat_id' $$;
revoke all on function public.lire_chat_telegram_admin() from public, anon, authenticated;
grant execute on function public.lire_chat_telegram_admin() to service_role;
