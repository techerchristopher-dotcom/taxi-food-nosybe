-- Montants lus à voix haute : en LETTRES (2026-10-13).
--
-- Test de l'agent vocal Rounded : « 30000 ariary » était prononcé « trois zéro zéro zéro
-- zéro ». Le message d'ouverture est lu par la synthèse vocale tel quel (pas par le LLM) :
-- il faut donc lui donner « trente mille ». `nombre_en_lettres(n, langue)` couvre 0 à
-- 999 999 999, en français (règles des traits d'union, « et un », « quatre-vingts »,
-- « cents » et « mille » invariable) et en italien (Les Siciliens).
-- `appel_textes()` et la charge envoyée au workflow d'appel l'utilisent.

create or replace function public.nombre_en_lettres_fr(p bigint)
returns text language plpgsql immutable set search_path to 'public' as $$
declare
  u text[] := array['zéro','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix',
                    'onze','douze','treize','quatorze','quinze','seize','dix-sept','dix-huit','dix-neuf'];
  d text[] := array['','','vingt','trente','quarante','cinquante','soixante'];
  r text; c int; m int;
begin
  if p is null then return null; end if;
  if p < 0 then return 'moins ' || public.nombre_en_lettres_fr(-p); end if;
  if p < 20 then return u[p + 1]; end if;
  if p < 70 then
    return d[p / 10 + 1] || case when p % 10 = 0 then ''
                                 when p % 10 = 1 then ' et un'
                                 else '-' || u[p % 10 + 1] end;
  end if;
  if p < 80 then   -- soixante-dix … soixante-dix-neuf, « soixante et onze »
    return 'soixante' || case when p = 71 then ' et onze' else '-' || u[p - 60 + 1] end;
  end if;
  if p < 100 then  -- quatre-vingts, quatre-vingt-un … quatre-vingt-dix-neuf
    return case when p = 80 then 'quatre-vingts' else 'quatre-vingt-' || u[p - 80 + 1] end;
  end if;
  if p < 1000 then
    c := p / 100;
    r := case when c = 1 then 'cent' else u[c + 1] || ' cent' end;
    if p % 100 = 0 then
      return r || case when c > 1 then 's' else '' end;
    end if;
    return r || ' ' || public.nombre_en_lettres_fr(p % 100);
  end if;
  if p < 1000000 then
    m := (p / 1000)::int;
    r := case when m = 1 then 'mille' else
           -- « quatre-vingts » et « deux cents » perdent leur s devant « mille »
           regexp_replace(public.nombre_en_lettres_fr(m), '(vingt|cent)s$', '\1') || ' mille' end;
    return r || case when p % 1000 = 0 then '' else ' ' || public.nombre_en_lettres_fr(p % 1000) end;
  end if;
  m := (p / 1000000)::int;
  r := public.nombre_en_lettres_fr(m) || ' million' || case when m > 1 then 's' else '' end;
  return r || case when p % 1000000 = 0 then '' else ' ' || public.nombre_en_lettres_fr(p % 1000000) end;
end $$;

create or replace function public.nombre_en_lettres_it(p bigint)
returns text language plpgsql immutable set search_path to 'public' as $$
declare
  u text[] := array['zero','uno','due','tre','quattro','cinque','sei','sette','otto','nove','dieci',
                    'undici','dodici','tredici','quattordici','quindici','sedici','diciassette','diciotto','diciannove'];
  d text[] := array['','','venti','trenta','quaranta','cinquanta','sessanta','settanta','ottanta','novanta'];
  r text; c int; m int; t text;
begin
  if p is null then return null; end if;
  if p < 0 then return 'meno ' || public.nombre_en_lettres_it(-p); end if;
  if p < 20 then return u[p + 1]; end if;
  if p < 100 then
    t := d[p / 10 + 1];
    if p % 10 in (1, 8) then t := left(t, length(t) - 1); end if;   -- ventuno, ventotto
    return t || case when p % 10 = 0 then '' when p % 10 = 3 then 'tré' else u[p % 10 + 1] end;
  end if;
  if p < 1000 then
    c := p / 100;
    r := case when c = 1 then 'cento' else u[c + 1] || 'cento' end;
    if p % 100 = 0 then return r; end if;
    t := public.nombre_en_lettres_it(p % 100);
    if p % 100 between 80 and 89 then r := left(r, length(r) - 1); end if;   -- centottanta
    return r || case when p % 100 = 3 then 'tré' else t end;
  end if;
  if p < 1000000 then
    m := (p / 1000)::int;
    r := case when m = 1 then 'mille' else regexp_replace(public.nombre_en_lettres_it(m), 'tré$', 'tre') || 'mila' end;   -- trentatremila
    if p % 1000 = 0 then return r; end if;
    return r || case when p % 1000 = 3 then 'tré' else public.nombre_en_lettres_it(p % 1000) end;
  end if;
  m := (p / 1000000)::int;
  r := case when m = 1 then 'un milione' else public.nombre_en_lettres_it(m) || ' milioni' end;
  return r || case when p % 1000000 = 0 then '' else ' ' || public.nombre_en_lettres_it(p % 1000000) end;
end $$;

create or replace function public.nombre_en_lettres(p bigint, p_langue text default 'fr')
returns text language sql immutable set search_path to 'public' as $$
  select case when p_langue = 'it' then public.nombre_en_lettres_it(p) else public.nombre_en_lettres_fr(p) end
$$;

-- appel_textes : le montant (et les minutes) en lettres.
do $m$
declare v text;
begin
  v := pg_get_functiondef('public.appel_textes(text,text,integer,integer)'::regprocedure);
  if v like '%nombre_en_lettres%' then return; end if;
  if position($a$replace(to_char(coalesce(p_total, 0), 'FM999,999,999'), ',', ' ') as m$a$ in v) = 0 then
    raise exception 'ancre introuvable dans appel_textes';
  end if;
  v := replace(v, $a$replace(to_char(coalesce(p_total, 0), 'FM999,999,999'), ',', ' ') as m$a$,
                  $a$public.nombre_en_lettres(coalesce(p_total, 0), p_langue) as m$a$);
  v := replace(v, $a$|| p_minutes ||$a$, $a$|| public.nombre_en_lettres(p_minutes, p_langue) ||$a$);
  execute v;
end $m$;

revoke all on function public.nombre_en_lettres_fr(bigint) from public, anon, authenticated;
revoke all on function public.nombre_en_lettres_it(bigint) from public, anon, authenticated;
revoke all on function public.nombre_en_lettres(bigint, text) from public, anon, authenticated;
