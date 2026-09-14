// Nécessite config.js chargé avant ce fichier, et le script CDN @supabase/supabase-js chargé avant aussi.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

// ---------- Portail mot de passe ----------
async function verifierMotDePasse() {
  const saisie = document.getElementById('gate-input').value;
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(saisie));
  const hash = [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
  if (hash === FAMILLE_PASSWORD_HASH) {
    sessionStorage.setItem('famille_ok', '1');
    document.getElementById('gate').style.display = 'none';
    document.getElementById('app').classList.add('pret');
    initPage();
  } else {
    document.getElementById('gate-erreur').textContent = "Mot de passe incorrect, réessaie.";
  }
}

function demarrerPortail() {
  if (sessionStorage.getItem('famille_ok') === '1') {
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

function avatarMembre(membre) {
  if (!membre) return `<span class="avatar" style="--m-color:var(--tous)">👨‍👩‍👧‍👦</span>`;
  return `<span class="avatar" style="--m-color:${membre.couleur}">${membre.icone}</span>`;
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

document.addEventListener('DOMContentLoaded', () => {
  marquerNavActive();
  demarrerPortail();
});
