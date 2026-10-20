-- 20/10 : « il faut garder les Italiens et adapter le message pour eux » ; « on relance ceux étant
-- déjà contactés » (numéros déjà démarchés dans la prospection hébergements).
-- Appliqué tel quel par MCP le 20/10 (texte complet de texte_whatsapp_prospect : voir la base,
-- `select pg_get_functiondef('public.texte_whatsapp_prospect(uuid,text)'::regprocedure)`).
alter table public.prospects_restaurant add column if not exists langue text not null default 'fr';
alter table public.prospects_restaurant drop constraint if exists prospects_restaurant_langue_connue;
alter table public.prospects_restaurant add constraint prospects_restaurant_langue_connue check (langue in ('fr','it'));
update public.prospects_restaurant set langue = 'it'
 where slug in ('dagli-amici','il-palazzetto','alta-marea-restaurant','a-casa-di-giorgia-lodge-nosy-be-andilana',
                'ismael-escursioni','pily-pily-ristorante','la-dolce-vita','amodomio-nosy-be',
                'danae-barea-restaurant-pizza-cabaret','coin-sauvage','mamma-mia');
-- texte_whatsapp_prospect : branche italienne (premier message et relance), sinon le texte français.
-- pro_page : renvoie 'langue' (patch par ancre sur 'type').
-- Lot 8 (priorité 5) : les fiches italiennes + 7 numéros déjà démarchés côté hébergements, avec
-- l'accroche « Je vous avais écrit fin septembre au sujet de vos clients hébergés ; cette fois, c'est
-- pour votre restaurant. »
