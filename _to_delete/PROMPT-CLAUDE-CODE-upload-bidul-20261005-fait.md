# Prompt Claude Code — pousser les deux visuels du 2026-10-05

Colle ce bloc dans Claude Code, à la racine du dépôt `taxi-food-nosybe`.

---

Deux plats du jour de Chez Bidule & Truc ont été créés en base ce matin, et leurs visuels sont
dans le dépôt, mais `photo_url` est encore NULL : il manque l'upload dans le bucket, que je ne
peux pas faire sans la clé `service_role`.

**Les fichiers**, déjà dans la série (1024 × 1024, fond sombre, vaisselle noire) :

- `visuels-reseaux/plats-du-jour/chez-bidul-truc/plat-couscous-royal.png`
- `visuels-reseaux/plats-du-jour/chez-bidul-truc/plat-medaillon-de-filet-de-zebu-sauce-champignons.png`

**Ce qu'il faut faire**

1. Les téléverser dans le bucket `produits`, dossier `chez-bidul-truc/`, sous exactement ces
   noms (c'est la convention de tous les autres plats du vivier) :
   - `chez-bidul-truc/plat-couscous-royal.png`
   - `chez-bidul-truc/plat-medaillon-de-filet-de-zebu-sauce-champignons.png`

   La clé `service_role` est dans `.secrets.local`. **Elle ne doit apparaître ni dans un
   message, ni dans un commit.**

2. Puis renseigner `photo_url` :

```sql
update public.products set photo_url =
  'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-bidul-truc/plat-couscous-royal.png'
where id = 'e6b484a2-0568-4617-8dc9-f235a80f8a8f';

update public.products set photo_url =
  'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-bidul-truc/plat-medaillon-de-filet-de-zebu-sauce-champignons.png'
where id = '2754f0a0-2be6-473e-ac5c-16424bed36e7';
```

3. **Vérifier que les deux URL répondent 200** avant de dire que c'est fait — un `photo_url`
   renseigné qui pointe sur un 404 est pire que NULL, l'appli affiche une image cassée.

4. Contrôler le résultat :

```sql
select nom, prix, photo_url is not null as photo from plats_du_jour_publics()
where restaurant_nom = 'Chez Bidule & Truc';
```

Puis commit. **Ne pousse pas**, Christopher relit.
