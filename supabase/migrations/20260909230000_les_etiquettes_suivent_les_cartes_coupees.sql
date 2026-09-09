-- Les etiquettes d'accueil suivent les cartes coupees.
--
-- Couper des categories laisse deux libelles en arriere, et tous deux mentent
-- au client AVANT qu'il ouvre la carte :
--
--   * `food_types` — les filtres de l'accueil. Chez Bidul restait reference
--     « Tapas » : un client qui filtre sur Tapas y atterrissait et n'y trouvait
--     que des pizzas. La Cabane restait referencee « Milkshake ».
--   * `cuisine_type` — la ligne sous le nom du restaurant. La Cabane
--     s'annoncait « Snacks, Burgers, Crepes & Milkshakes ».
--
-- Ce n'est pas cosmetique : c'est la promesse faite au client sur l'ecran
-- d'accueil, avant meme d'ouvrir la carte. Une carte juste sous une etiquette
-- fausse reste une deception.
--
-- ⚠️ A refaire a la main le jour ou ces categories rouvrent — rien ne
-- synchronise `food_types` / `cuisine_type` avec `categories.is_active`.

update public.restaurants
   set food_types = array['Pizza']
 where id = '700e8f32-e966-476a-b371-02884d08dea1';

update public.restaurants
   set food_types   = array['Tacos','Kebab','Burger','Américain','Panini','Crêpe'],
       cuisine_type = 'Snacks, Burgers & Crêpes'
 where id = '958faac6-61ab-4ff5-9226-b8adab46ed24';
