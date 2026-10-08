-- L'escale Créole : descriptifs « recette » de l'assiette de crudités et des beignets (2026-10-08).
-- Crudités : on garde la liste de légumes de la carte du restaurant. FR + EN + IT.
create temp table _desc (nom text, fr text, en text, it text) on commit drop;
insert into _desc values
  ('Assiette de crudité',
   'Carottes, chou blanc, tomate, concombre, poivrons, salade… et le secret du chef pour l''assaisonnement. Les légumes sont lavés, râpés ou émincés, puis dressés en assiette et assaisonnés : une entrée fraîche et croquante.',
   'Carrots, white cabbage, tomato, cucumber, peppers, lettuce… and the chef''s secret dressing. The vegetables are washed, grated or sliced, then plated and dressed: a fresh, crunchy starter.',
   'Carote, cavolo bianco, pomodoro, cetriolo, peperoni, insalata… e il condimento segreto dello chef. Le verdure vengono lavate, grattugiate o affettate, poi impiattate e condite: un antipasto fresco e croccante.'),
  ('Beignets crevettes ou calamars',
   'Crevettes ou calamars, pâte à beignet légère… et le secret du chef. Les fruits de mer sont enrobés de pâte, puis frits jusqu''à être bien dorés et croustillants. Servis en portion.',
   'Shrimp or squid, light batter… and the chef''s secret. The seafood is coated in batter, then fried until golden and crisp. Served as a portion.',
   'Gamberi o calamari, pastella leggera… e il segreto dello chef. I frutti di mare vengono avvolti nella pastella, poi fritti fino a diventare dorati e croccanti. Serviti in porzione.');

update public.products p set description = d.fr
  from _desc d
 where p.restaurant_id = '128e68ab-8e64-4f48-bf79-acc67f3deca9' and not p.is_archived and p.name = d.nom;

insert into public.traductions_catalogue (fr, langue, texte, source)
select fr, 'en', en, 'manuel' from _desc
union all
select fr, 'it', it, 'manuel' from _desc
on conflict (fr, langue) do nothing;
