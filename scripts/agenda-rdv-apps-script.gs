// Copie de référence (secret retiré) du script Google Apps déployé le 20/10/2026 sur le compte
// techerchristopher@gmail.com, projet « Taxi Food — RDV prospection → Agenda ».
// Taxi Food — rendez-vous de prospection → Google Agenda (créé le 20/10/2026).
// Appelé par la base Supabase (fonction rdv_agenda_envoyer) à chaque rendez-vous pris ou annulé.
// Rappel : notification 1 h avant. Un événement porte la marque « tfrdv:<id> » pour pouvoir le retrouver.
const SECRET = '<au Vault Supabase : agenda_apps_script_secret>';

function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  if (d.secret !== SECRET) return ContentService.createTextOutput('refus');
  const cal = CalendarApp.getDefaultCalendar();
  const marque = 'tfrdv:' + d.event_id;
  const debut = new Date(d.debut_utc);
  const fin = new Date(d.fin_utc);
  // Toujours repartir d'un état propre : on supprime l'éventuel événement déjà créé pour ce rendez-vous.
  cal.getEvents(new Date(debut.getTime() - 86400000), new Date(fin.getTime() + 86400000)).forEach(function (ev) {
    if ((ev.getDescription() || '').indexOf(marque) >= 0) ev.deleteEvent();
  });
  if (d.action === 'supprimer') return ContentService.createTextOutput('supprime');
  const ev = cal.createEvent(d.titre, debut, fin, { location: d.lieu, description: d.description + '\n\n' + marque });
  ev.removeAllReminders();
  ev.addPopupReminder(60);
  return ContentService.createTextOutput('cree');
}

// À lancer une fois depuis l'éditeur pour accorder l'accès à l'agenda.
function autoriser() {
  CalendarApp.getDefaultCalendar().getName();
}
