// Nécessite config.js chargé avant ce fichier, et le script CDN @supabase/supabase-js chargé avant aussi.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- Portail de connexion ----------
// Vrai compte Supabase Auth par personne (email + mot de passe) : c'est cette session
// authentifiee qui permet aux regles RLS de bloquer l'acces anonyme.
async function verifierMotDePasse() {
  const email = document.getElementById('gate-email').value;
  const saisie = document.getElementById('gate-input').value;
  const { error } = await sb.auth.signInWithPassword({ email, password: saisie });
  if (!error) {
    document.getElementById('gate').style.display = 'none';
    document.getElementById('app').classList.add('pret');
    initPage();
  } else {
    console.error('Erreur de connexion Supabase :', error);
    document.getElementById('gate-erreur').textContent = "Connexion refusée : " + error.message;
  }
}

async function demarrerPortail() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    document.getElementById('gate').style.display = 'none';
    document.getElementById('app').classList.add('pret');
    initPage();
    return;
  }
  document.getElementById('gate-form').addEventListener('submit', (e) => {
    e.preventDefault();
    verifierMotDePasse();
  });
}

// ---------- Membres (mis en cache le temps de la session) ----------
let _membresCache = null;
async function getMembres() {
  if (_membresCache) return _membresCache;
  const { data, error } = await sb.from('membres').select('*').order('ordre');
  if (error) { console.error(error); return []; }
  _membresCache = data;
  return data;
}

function badgeMembre(membre) {
  if (!membre) return `<span class="badge-membre" style="background:var(--tous)">👨‍👩‍👧‍👦 Tous</span>`;
  return `<span class="badge-membre" style="background:${membre.couleur}">${membre.icone} ${membre.nom}</span>`;
}

function avatarMembre(membre, styleSupplementaire = '') {
  const couleur = membre ? membre.couleur : 'var(--tous)';
  const icone = membre ? membre.icone : '👨‍👩‍👧‍👦';
  return `<span class="avatar" style="--m-color:${couleur};${styleSupplementaire}">${icone}</span>`;
}

// ---------- Dates ----------
function dateAujourdhui() {
  return formatDateLocale(new Date());
}
function formatDateLocale(d) {
  const annee = d.getFullYear();
  const mois = String(d.getMonth() + 1).padStart(2, '0');
  const jour = String(d.getDate()).padStart(2, '0');
  return `${annee}-${mois}-${jour}`;
}
function formatDateLongue(d) {
  return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
function formatHeure(t) {
  return t ? t.slice(0, 5) : '';
}

// Un événement couvre-t-il la date donnée (comparaison en jours, pas en heures) ?
function evenementCouvre(evt, dateStr) {
  const debut = evt.date_debut.slice(0, 10);
  const fin = evt.date_fin ? evt.date_fin.slice(0, 10) : debut;
  return dateStr >= debut && dateStr <= fin;
}

// ---------- Navigation ----------
function marquerNavActive() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav.modules a').forEach(a => {
    if (a.getAttribute('href') === page) a.classList.add('actif');
  });
}

function lundiDeLaSemaine(date) {
  const d = new Date(date);
  const jour = d.getDay(); // 0=dimanche
  const decalage = jour === 0 ? -6 : 1 - jour;
  d.setDate(d.getDate() + decalage);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---------- Tâches ménagères ----------
// Une tâche est due ce jour-là : quotidien/mensuel/ponctuel toujours, hebdo seulement les
// jours cochés. Règle centrale réutilisée par toutes les pages qui affichent des tâches du jour.
function tacheApplicableCeJour(tache, jourSemaine) {
  return tache.frequence === 'quotidien' || tache.frequence === 'mensuel' || tache.frequence === 'ponctuel'
    || (tache.frequence === 'hebdo' && (tache.jours_semaine || []).includes(jourSemaine));
}

// Construit l'ensemble des clés "tache_id|date" exclues ce jour-là (taches_menage_exceptions),
// pour un filtrage en O(1) par tache. Avec une seule date (scope un jour), la clé est juste l'id.
function clesExclusion(exceptions, dateUnique) {
  return new Set(exceptions.map(e => dateUnique ? e.tache_id : `${e.tache_id}|${e.date}`));
}

// ---------- Notifications push (agenda) ----------
// Cle publique VAPID (pas un secret : elle identifie juste notre serveur d'envoi aupres du
// navigateur). La cle privee correspondante ne vit que cote serveur (Edge Function Supabase).
const VAPID_CLE_PUBLIQUE = 'BKeTGlXPex8I26lHSUABbhKyFbxA15xP7iVNKoMisv9ON2moT6t1ZivOwKagQr-Z1ljqSlFzucaDrdO7zcHHhX8';

function urlBase64VersUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const chaine = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const brut = atob(chaine);
  return Uint8Array.from([...brut].map(c => c.charCodeAt(0)));
}

async function notificationsActivees() {
  if (!('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return false;
  const abonnement = await registration.pushManager.getSubscription();
  return !!abonnement;
}

// Demande la permission, cree l'abonnement push et l'enregistre en base. Retourne true/false
// selon le succes ; affiche elle-meme un message d'erreur le cas echeant (pas de retour silencieux).
async function activerNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert("Les notifications ne sont pas prises en charge sur cet appareil/navigateur.");
    return false;
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    alert('Permission refusee : les notifications ne pourront pas s\'afficher.');
    return false;
  }
  const registration = await navigator.serviceWorker.ready;
  let abonnement = await registration.pushManager.getSubscription();
  if (!abonnement) {
    abonnement = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64VersUint8Array(VAPID_CLE_PUBLIQUE)
    });
  }
  const json = abonnement.toJSON();
  const { error } = await sb.from('push_subscriptions').upsert({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth
  }, { onConflict: 'endpoint' });
  if (error) {
    console.error(error);
    alert("Erreur lors de l'enregistrement de l'abonnement.");
    return false;
  }
  return true;
}

document.addEventListener('DOMContentLoaded', () => {
  marquerNavActive();
  demarrerPortail();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
});
