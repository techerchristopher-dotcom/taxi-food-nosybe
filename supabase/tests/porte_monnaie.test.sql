-- Recette du porte-monnaie (migration 20261007160000). À lancer tel quel par
-- `execute_sql` : tout se passe dans un bloc qui finit par une exception, donc rien
-- n'est écrit (aucune commande, aucun mouvement ; `net.http_post` n'envoie rien).
-- ⚠️ Chaque `create_order` consomme un numéro TF- (séquence non annulable).
-- Taxi Be (masqué, sans Telegram) est rendu commandable le temps du bloc, les
-- Beignets passent à 1 800 Ar ; client = compte admin, son adresse de test.
-- Résultat attendu (2026-10-07) :
--   H sans solde : pm=0 total=3800 · A (4 args) et B (5 args nommés) : pm=0
--   C avis → code null, +1000 ; double avis refusé ; double crédit refusé (unique)
--   D solde 2500, plats 1800 → pm=1800, total=2000 (livraison seule), solde 700
--   K double débit refusé · G annulation → 2500, sortie → 700, re-annulation → 2500
--   E code livraison 2000 + solde 700 → pm=700, total=1100
--   F code plats 1000 + solde 2500 → pm=800, total=2000, solde 1700
--   I reversement : plats 1800, commission 90, net 1710 (prix plein, commission inchangée)
do $$
declare
  R constant uuid := 'ac2766bb-c4d1-4f5e-9a40-3ea0febcb886';
  U constant uuid := '9ca91352-d36d-4500-87fd-68d0f696640d';
  A constant uuid := '89317e34-4977-471e-b4db-f54a16304edc';
  P constant uuid := '480603b8-d58a-49ca-8444-dc97fff5948f';
  log text := '';
  o public.orders; o2 public.orders; j jsonb; s int; v_avis jsonb;
  items jsonb := jsonb_build_array(jsonb_build_object('product_id', P, 'quantity', 1, 'options', '[]'::jsonb));
begin
  update restaurants set listing_status='visible', is_open=true where id=R;
  update products set price=1800 where id=P;
  update categories set serving_from=null, serving_to=null where id=(select category_id from products where id=P);
  insert into promo_codes(code,type_remise,valeur,porte_sur,actif,commence_le,pris_en_charge_par) values ('TESTPMLIVR','montant',2000,'livraison',true,now()-interval '1 min','taxi_food');
  insert into promo_codes(code,type_remise,valeur,porte_sur,actif,commence_le,pris_en_charge_par) values ('TESTPMPLATS','montant',1000,'sous_total',true,now()-interval '1 min','taxi_food');
  log := log || 'solde initial=' || solde_porte_monnaie(U) || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);

  select * into o from create_order(R, A, 'especes', items, null, true);
  log := log || format('H sans solde: sub=%s liv=%s pm=%s total=%s', o.subtotal, o.delivery_fee, o.remise_porte_monnaie, o.total) || E'\n';
  select * into o from create_order(R, A, 'especes'::payment_method, items);
  log := log || format('A 4 args: total=%s pm=%s', o.total, o.remise_porte_monnaie) || E'\n';
  select * into o from create_order(p_restaurant_id=>R, p_address_id=>A, p_payment_method=>'especes', p_items=>items, p_code_promo=>null);
  log := log || format('B 5 args nommes: total=%s pm=%s commission=%s', o.total, o.remise_porte_monnaie, o.commission_amount) || E'\n';

  perform set_config('role','postgres', true);
  update orders set status='livree' where id=o.id;
  perform set_config('role','authenticated', true);
  v_avis := deposer_avis(o.id, 5, 4, 2, 'test', false, 'fr', null);
  log := log || 'C avis -> ' || v_avis::text || E'\n';
  begin
    perform deposer_avis(o.id, 5, 5, 5, null, false, 'fr', null);
    log := log || 'C double avis ACCEPTE (KO)' || E'\n';
  exception when others then log := log || 'C double avis refuse: ' || sqlerrm || E'\n'; end;
  log := log || 'C mon_avis credit=' || coalesce(mon_avis(o.id)->>'credit_porte_monnaie', '?') || E'\n';
  perform set_config('role','postgres', true);
  begin
    insert into porte_monnaie_mouvements(user_id,montant,motif,order_id,avis_id) select U,1000,'avis',o.id,id from avis where order_id=o.id;
    log := log || 'C double credit direct ACCEPTE (KO)' || E'\n';
  exception when unique_violation then log := log || 'C double credit direct refuse (unique)' || E'\n'; end;

  perform set_config('role','authenticated', true);
  s := admin_porte_monnaie_geste(U, 1500, 'test recette');
  log := log || 'D solde apres geste=' || s || E'\n';
  j := apercu_porte_monnaie(R, items, null);
  log := log || 'D apercu=' || j::text || E'\n';
  select * into o from create_order(R, A, 'especes', items, null, true);
  log := log || format('D 2500 sur 1800: sub=%s liv=%s pm=%s total=%s commission=%s remise_resto=%s | solde=%s', o.subtotal, o.delivery_fee, o.remise_porte_monnaie, o.total, o.commission_amount, o.remise_charge_restaurant, (mon_porte_monnaie()->>'solde')) || E'\n';
  perform set_config('role','postgres', true);
  begin
    insert into porte_monnaie_mouvements(user_id,montant,motif,order_id) values (U,-1,'utilisation',o.id);
    log := log || 'K double debit ACCEPTE (KO)' || E'\n';
  exception when unique_violation then log := log || 'K double debit meme commande refuse (unique)' || E'\n'; end;
  update orders set status='annulee', cancellation_reason='test' where id=o.id;
  log := log || 'G apres annulation solde=' || solde_porte_monnaie(U) || E'\n';
  update orders set status='recue' where id=o.id;
  log := log || 'G apres sortie d''annulation solde=' || solde_porte_monnaie(U) || E'\n';
  update orders set status='annulee' where id=o.id;
  log := log || 'G re-annulation solde=' || solde_porte_monnaie(U) || E'\n';

  perform set_config('role','authenticated', true);
  select * into o from create_order(R, A, 'especes', items, null, true);
  log := log || format('D2 refaite: pm=%s total=%s solde=%s', o.remise_porte_monnaie, o.total, mon_porte_monnaie()->>'solde') || E'\n';
  j := apercu_porte_monnaie(R, items, 'TESTPMLIVR');
  select * into o from create_order(R, A, 'especes', items, 'TESTPMLIVR', true);
  log := log || format('E code livraison: apercu=%s | sub=%s liv=%s code=%s(%s) pm=%s total=%s solde=%s', j, o.subtotal, o.delivery_fee, o.promo_discount, o.promo_porte_sur, o.remise_porte_monnaie, o.total, mon_porte_monnaie()->>'solde') || E'\n';
  s := admin_porte_monnaie_geste(U, 2500, 'test recette 2');
  j := apercu_porte_monnaie(R, items, 'TESTPMPLATS');
  select * into o2 from create_order(R, A, 'especes', items, 'TESTPMPLATS', true);
  log := log || format('F code plats (solde %s): apercu=%s | sub=%s code=%s(%s) pm=%s total=%s commission=%s solde=%s', s, j, o2.subtotal, o2.promo_discount, o2.promo_porte_sur, o2.remise_porte_monnaie, o2.total, o2.commission_amount, mon_porte_monnaie()->>'solde') || E'\n';

  perform set_config('role','postgres', true);
  update orders set status='livree' where id in (o.id, o2.id);
  perform set_config('role','authenticated', true);
  log := log || 'I reversement: ' || (select string_agg(format('%s plats=%s comm=%s offert=%s net=%s', x.order_number, x.plats, x.commission, x.offert, x.net), ' | ') from admin_commandes_a_reverser(R, (now() at time zone 'Indian/Antananarivo')::date, (now() at time zone 'Indian/Antananarivo')::date) x where x.order_id in (o.id, o2.id)) || E'\n';
  raise exception E'RESULTATS (transaction annulee)\n%', log;
end $$;
