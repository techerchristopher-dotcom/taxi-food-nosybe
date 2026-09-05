-- Telephones publics des deux premiers partenaires, fournis par le porteur du
-- projet le 2026-09-05.
--
-- Ce numero n'est pas decoratif : il alimente trois choses a la fois — le
-- bouton « 📞 resto » du tableau de bord de pilotage, le champ
-- `restaurant.telephone` envoye a n8n (donc l'e-mail au client et le message
-- Telegram), et le lien d'appel propose au client depuis ses commandes.
--
-- Format international, sans espace : c'est ce qu'attend `tel:` sur mobile, et
-- un numero local sans indicatif ne se compose pas depuis un telephone
-- etranger — la moitie des clients de Nosy Be.
update public.restaurants set phone = '+261322759576'
 where id = '958faac6-61ab-4ff5-9226-b8adab46ed24';   -- La Cabane

update public.restaurants set phone = '+261322664143'
 where id = '700e8f32-e966-476a-b371-02884d08dea1';   -- Chez Bidul & Truc
