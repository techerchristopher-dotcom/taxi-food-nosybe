-- Ingrédients principaux en icônes sur la fiche d'un plat (2026-10-08, demande du porteur du projet).
--
-- UN DICTIONNAIRE fermé (`ingredients` : clé, emoji, nom en français) + un lien plat ↔ ingrédients
-- (`product_ingredients`, 3 à 6 par plat, ordonnés). Même ingrédient = même icône et même
-- traduction partout, pour tous les restaurants. Les noms se traduisent par `traductions_catalogue`
-- comme le reste du menu (l'app applique `tr()`).
--
-- `au_choix` = pastille en POINTILLÉS sur la fiche : le client décide en commandant (viande
-- poulet ou zébu, crevettes ou calamars) — et le piment, TOUJOURS au choix, pour ne pas effrayer
-- qui n'en mange pas (« Piment en option »).
-- ⚠️ Règle de vérité : un plat ne porte que des ingrédients ÉCRITS dans son descriptif. Ce qui
-- relève du « secret du chef » n'a jamais d'icône.
--
-- Lecture PUBLIQUE (contenu de catalogue), écriture réservée à l'admin.
-- ⚠️ Emoji choisis pour s'afficher sur les vieux Android : pas d'emoji zébu (🐂 le remplace) ;
-- 🫚 et 🫑 (Unicode récents) vérifiés à l'écran par le porteur du projet le 2026-10-08.

create table if not exists public.ingredients (
  cle    text primary key check (cle ~ '^[a-z_]+$'),
  emoji  text not null check (length(btrim(emoji)) > 0),
  nom    text not null check (length(btrim(nom)) > 0)
);

create table if not exists public.product_ingredients (
  product_id     uuid not null references public.products(id) on delete cascade,
  ingredient_cle text not null references public.ingredients(cle),
  au_choix       boolean not null default false,
  sort_order     integer not null default 0,
  primary key (product_id, ingredient_cle)
);

alter table public.ingredients enable row level security;
alter table public.product_ingredients enable row level security;

drop policy if exists ingredients_lecture on public.ingredients;
create policy ingredients_lecture on public.ingredients for select to anon, authenticated using (true);
drop policy if exists ingredients_admin on public.ingredients;
create policy ingredients_admin on public.ingredients for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists product_ingredients_lecture on public.product_ingredients;
create policy product_ingredients_lecture on public.product_ingredients for select to anon, authenticated using (true);
drop policy if exists product_ingredients_admin on public.product_ingredients;
create policy product_ingredients_admin on public.product_ingredients for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke insert, update, delete, truncate on public.ingredients, public.product_ingredients from anon;
grant select on public.ingredients, public.product_ingredients to anon, authenticated;
grant insert, update, delete on public.ingredients, public.product_ingredients to authenticated;

insert into public.ingredients (cle, emoji, nom) values
  ('saucisse_porc', '🐖', 'Saucisse de porc'),
  ('porc', '🐖', 'Porc'),
  ('poulet', '🐔', 'Poulet'),
  ('zebu', '🐂', 'Zébu'),
  ('cabri', '🐐', 'Cabri'),
  ('poisson', '🐟', 'Poisson'),
  ('crevette', '🦐', 'Crevettes'),
  ('calamar', '🦑', 'Calamars'),
  ('fromage', '🧀', 'Fromage'),
  ('oeuf', '🥚', 'Œuf'),
  ('tomate', '🍅', 'Tomate'),
  ('oignon', '🧅', 'Oignon'),
  ('ail', '🧄', 'Ail'),
  ('gingembre', '🫚', 'Gingembre'),
  ('piment', '🌶️', 'Piment en option'),
  ('gros_piment', '🫑', 'Gros piment (doux)'),
  ('citron', '🍋', 'Citron'),
  ('riz', '🍚', 'Riz'),
  ('nouilles', '🍜', 'Nouilles'),
  ('bouillon', '🍲', 'Bouillon'),
  ('legumes', '🥬', 'Légumes'),
  ('brede', '🥬', 'Brède chinois'),
  ('chou', '🥬', 'Chou blanc'),
  ('carotte', '🥕', 'Carotte'),
  ('concombre', '🥒', 'Concombre'),
  ('salade', '🥗', 'Salade'),
  ('poivre_vert', '🌿', 'Poivre vert'),
  ('creme', '🥛', 'Crème'),
  ('thym', '🌿', 'Thym'),
  ('massale', '🍛', 'Massalé'),
  ('sauce_soja', '🥢', 'Sauce soja'),
  ('pate', '🥟', 'Pâte fine')
on conflict (cle) do update set emoji = excluded.emoji, nom = excluded.nom;

insert into public.traductions_catalogue (fr, langue, texte, source) values
  ('Saucisse de porc', 'en', 'Pork sausage', 'manuel'),
  ('Saucisse de porc', 'it', 'Salsiccia di maiale', 'manuel'),
  ('Porc', 'en', 'Pork', 'manuel'),
  ('Porc', 'it', 'Maiale', 'manuel'),
  ('Poulet', 'en', 'Chicken', 'manuel'),
  ('Poulet', 'it', 'Pollo', 'manuel'),
  ('Zébu', 'en', 'Zebu', 'manuel'),
  ('Zébu', 'it', 'Zebù', 'manuel'),
  ('Cabri', 'en', 'Goat', 'manuel'),
  ('Cabri', 'it', 'Capretto', 'manuel'),
  ('Poisson', 'en', 'Fish', 'manuel'),
  ('Poisson', 'it', 'Pesce', 'manuel'),
  ('Crevettes', 'en', 'Shrimp', 'manuel'),
  ('Crevettes', 'it', 'Gamberi', 'manuel'),
  ('Calamars', 'en', 'Squid', 'manuel'),
  ('Calamars', 'it', 'Calamari', 'manuel'),
  ('Fromage', 'en', 'Cheese', 'manuel'),
  ('Fromage', 'it', 'Formaggio', 'manuel'),
  ('Œuf', 'en', 'Egg', 'manuel'),
  ('Œuf', 'it', 'Uovo', 'manuel'),
  ('Tomate', 'en', 'Tomato', 'manuel'),
  ('Tomate', 'it', 'Pomodoro', 'manuel'),
  ('Oignon', 'en', 'Onion', 'manuel'),
  ('Oignon', 'it', 'Cipolla', 'manuel'),
  ('Ail', 'en', 'Garlic', 'manuel'),
  ('Ail', 'it', 'Aglio', 'manuel'),
  ('Gingembre', 'en', 'Ginger', 'manuel'),
  ('Gingembre', 'it', 'Zenzero', 'manuel'),
  ('Piment en option', 'en', 'Chili (optional)', 'manuel'),
  ('Piment en option', 'it', 'Peperoncino (a scelta)', 'manuel'),
  ('Gros piment (doux)', 'en', 'Large pepper (mild)', 'manuel'),
  ('Gros piment (doux)', 'it', 'Peperone grosso (dolce)', 'manuel'),
  ('Citron', 'en', 'Lemon', 'manuel'),
  ('Citron', 'it', 'Limone', 'manuel'),
  ('Riz', 'en', 'Rice', 'manuel'),
  ('Riz', 'it', 'Riso', 'manuel'),
  ('Nouilles', 'en', 'Noodles', 'manuel'),
  ('Nouilles', 'it', 'Noodles', 'manuel'),
  ('Bouillon', 'en', 'Broth', 'manuel'),
  ('Bouillon', 'it', 'Brodo', 'manuel'),
  ('Légumes', 'en', 'Vegetables', 'manuel'),
  ('Légumes', 'it', 'Verdure', 'manuel'),
  ('Brède chinois', 'en', 'Chinese greens', 'manuel'),
  ('Brède chinois', 'it', 'Verdure cinesi', 'manuel'),
  ('Chou blanc', 'en', 'White cabbage', 'manuel'),
  ('Chou blanc', 'it', 'Cavolo bianco', 'manuel'),
  ('Carotte', 'en', 'Carrot', 'manuel'),
  ('Carotte', 'it', 'Carota', 'manuel'),
  ('Concombre', 'en', 'Cucumber', 'manuel'),
  ('Concombre', 'it', 'Cetriolo', 'manuel'),
  ('Salade', 'en', 'Lettuce', 'manuel'),
  ('Salade', 'it', 'Insalata', 'manuel'),
  ('Poivre vert', 'en', 'Green peppercorn', 'manuel'),
  ('Poivre vert', 'it', 'Pepe verde', 'manuel'),
  ('Crème', 'en', 'Cream', 'manuel'),
  ('Crème', 'it', 'Panna', 'manuel'),
  ('Thym', 'en', 'Thyme', 'manuel'),
  ('Thym', 'it', 'Timo', 'manuel'),
  ('Massalé', 'en', 'Massalé spices', 'manuel'),
  ('Massalé', 'it', 'Massalé', 'manuel'),
  ('Sauce soja', 'en', 'Soy sauce', 'manuel'),
  ('Sauce soja', 'it', 'Salsa di soia', 'manuel'),
  ('Pâte fine', 'en', 'Thin pastry', 'manuel'),
  ('Pâte fine', 'it', 'Pasta sottile', 'manuel')
on conflict (fr, langue) do nothing;
