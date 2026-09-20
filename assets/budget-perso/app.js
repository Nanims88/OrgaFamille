import * as DB from './db.js';
import * as C from './calc.js';

const CLE_PIN = 'budgetperso_pin_hash';
const CLE_SESSION = 'budgetperso_ok';
const CLE_THEME = 'budgetperso_theme';

function eur(n) {
  return (n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}
function dateFR(iso) {
  if (!iso) return '';
  return C.parseISODate(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
function auj() { return C.toISODate(new Date()); }
function moisFR(n) {
  return new Date(2000, n - 1, 1).toLocaleDateString('fr-FR', { month: 'long' });
}

async function sha256(txt) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Le code est cree localement au premier lancement : rien n'est ecrit dans le depot.
async function demarrerPortail() {
  if (sessionStorage.getItem(CLE_SESSION) === '1') { entrerDansApp(); return; }
  const hashExistant = localStorage.getItem(CLE_PIN);
  const titre = document.getElementById('gate-titre');
  const sousTitre = document.getElementById('gate-soustitre');
  if (!hashExistant) {
    titre.textContent = 'Creer un code';
    sousTitre.textContent = 'Choisis un code a 4 chiffres ou plus, garde-le pour toi.';
  }
  document.getElementById('gate-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const saisie = document.getElementById('gate-input').value.trim();
    if (!saisie) return;
    if (!localStorage.getItem(CLE_PIN)) {
      localStorage.setItem(CLE_PIN, await sha256(saisie));
      sessionStorage.setItem(CLE_SESSION, '1');
      entrerDansApp();
      return;
    }
    const hash = await sha256(saisie);
    if (hash === localStorage.getItem(CLE_PIN)) {
      sessionStorage.setItem(CLE_SESSION, '1');
      entrerDansApp();
    } else {
      document.getElementById('gate-erreur').textContent = 'Code incorrect.';
    }
  });
}

function entrerDansApp() {
  document.getElementById('gate').style.display = 'none';
  document.getElementById('app').classList.add('pret');
  if (localStorage.getItem(CLE_THEME) === 'sombre') document.body.classList.add('theme-sombre');
  DB.initialiserSiVide().then(() => {
    window.addEventListener('hashchange', route);
    route();
  });
}

const ONGLETS = [
  { id: 'accueil', label: '🏠 Accueil' },
  { id: 'saisie', label: '⚡ Saisie' },
  { id: 'semaine', label: '📆 Semaine' },
  { id: 'cycle', label: '🔄 Cycle' },
  { id: 'echeancier', label: '📅 Echeancier' },
  { id: 'dettes', label: '💳 Dettes' },
  { id: 'objectifs', label: '🎯 Objectifs' },
  { id: 'bonus', label: '🎁 Bonus' },
  { id: 'parametres', label: '⚙️ Parametres' },
  { id: 'donnees', label: '📁 Import / Export' }
];

const RENDUS = {
  accueil: renderAccueil,
  saisie: renderSaisie,
  semaine: renderSemaine,
  cycle: renderCycle,
  echeancier: renderEcheancier,
  dettes: renderDettes,
  objectifs: renderObjectifs,
  bonus: renderBonus,
  parametres: renderParametres,
  donnees: renderDonnees
};

async function route() {
  const id = (location.hash.slice(1) || 'accueil');
  document.querySelectorAll('nav.modules a').forEach(a => a.classList.toggle('actif', a.dataset.onglet === id));
  const zone = document.getElementById('vue');
  zone.innerHTML = '<p class="vide">Chargement…</p>';
  const rendu = RENDUS[id] || renderAccueil;
  await rendu(zone);
}

function construireNav() {
  const nav = document.getElementById('nav-onglets');
  nav.innerHTML = ONGLETS.map(o => `<a href="#${o.id}" data-onglet="${o.id}">${o.label}</a>`).join('');
}

async function infosCycle(refDate = new Date()) {
  const config = await DB.getConfig();
  const { debut, fin } = C.cycleContenant(refDate, config.jourCycle);
  const nbLundis = C.compterLundis(debut, fin);
  const carburantHebdo = C.carburantHebdo(config.enveloppe.carburant);
  const budgetCycleEnveloppe = C.enveloppeCycleTotal({
    carburantHebdoMontant: carburantHebdo,
    nbLundis,
    courses: config.enveloppe.coursesMensuel,
    tabac: config.enveloppe.tabacMensuel,
    variable: config.enveloppe.variableMensuel
  });
  const enveloppeHebdo = C.enveloppeHebdomadaire(budgetCycleEnveloppe, nbLundis);
  return { config, debut, fin, nbLundis, carburantHebdo, budgetCycleEnveloppe, enveloppeHebdo };
}

async function transactionsEntre(debutISO, finISO) {
  const toutes = await DB.getAll('transactions');
  return toutes.filter(t => t.date >= debutISO && t.date <= finISO);
}

function totalDepenses(transactions, filtreCategorie) {
  return transactions
    .filter(t => t.montant < 0 && (!filtreCategorie || filtreCategorie(t.categorie)))
    .reduce((s, t) => s + Math.abs(t.montant), 0);
}

function totalChargesFixes(config) {
  return config.chargesFixes.reduce((s, c) => s + c.montant, 0);
}

function lundiCourant(refDate = new Date()) {
  const d = new Date(refDate);
  const jour = d.getDay();
  const decalage = jour === 0 ? -6 : 1 - jour;
  d.setDate(d.getDate() + decalage);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function resteSemaineCourante() {
  const { config, debut, fin, enveloppeHebdo } = await infosCycle();
  const lundis = C.listerLundis(debut, fin);
  const virements = await DB.getAll('virementsHebdo');
  const idsCategoriesEnveloppe = new Set(config.categories.filter(c => c.enveloppe).map(c => c.id));

  let reportPrecedent = 0;
  let derniereSemaine = null;
  for (const lundi of lundis) {
    const dateLundi = C.toISODate(lundi);
    const dimanche = C.addDays(lundi, 6);
    const dateFinSemaine = C.toISODate(dimanche <= fin ? dimanche : fin);
    const transactionsSemaine = await transactionsEntre(dateLundi, dateFinSemaine);
    const depense = totalDepenses(transactionsSemaine, id => idsCategoriesEnveloppe.has(id));
    const virement = virements.find(v => v.dateLundi === dateLundi);
    const montantVirement = virement ? virement.montantVirement : enveloppeHebdo;
    const { disponible, reste } = C.soldeSemaine({ budgetSemaine: montantVirement, reportPrecedent, depense });
    derniereSemaine = { dateLundi, dateFinSemaine, disponible, reste, depense, montantVirement, aujourdhui: lundi <= new Date() && new Date() <= dimanche };
    reportPrecedent = reste;
  }
  return derniereSemaine;
}

async function renderAccueil(zone) {
  const { config, debut, fin, enveloppeHebdo, budgetCycleEnveloppe } = await infosCycle();
  const semaine = await resteSemaineCourante();
  const transactionsCycle = await transactionsEntre(C.toISODate(debut), C.toISODate(fin));
  const idsEnveloppe = new Set(config.categories.filter(c => c.enveloppe).map(c => c.id));
  const depenseCycle = totalDepenses(transactionsCycle, id => idsEnveloppe.has(id));
  const resteCycle = C.round2(budgetCycleEnveloppe - depenseCycle);

  const echeances14j = await echeancesProchaines(14);
  const projection = await calculerProjectionAuto();

  const pourcentSemaine = semaine.disponible > 0 ? Math.min(100, Math.max(0, (semaine.reste / semaine.disponible) * 100)) : 0;
  const classeJaugeSemaine = semaine.reste < 0 ? 'danger' : (pourcentSemaine < 25 ? 'attention' : '');

  zone.innerHTML = `
    <div class="stat-grid">
      <div class="stat-carte ${config.dernierSolde.montant < 0 ? 'negatif' : 'positif'}">
        <div class="label">Solde compte principal</div>
        <div class="valeur">${eur(config.dernierSolde.montant)}</div>
        <div style="font-size:.75rem;color:var(--ink-soft)">${config.dernierSolde.date ? 'saisi le ' + dateFR(config.dernierSolde.date) : 'non saisi'}</div>
      </div>
      <div class="stat-carte ${resteCycle < 0 ? 'negatif' : 'positif'}">
        <div class="label">Reste du cycle (enveloppe)</div>
        <div class="valeur">${eur(resteCycle)}</div>
      </div>
      <div class="stat-carte">
        <div class="label">Coussin</div>
        <div class="valeur">${eur(config.coussinActuel)} / ${eur(config.coussinCible)}</div>
      </div>
    </div>

    <div class="carte jauge-ligne">
      <div class="jauge-entete"><span>Semaine du ${dateFR(semaine.dateLundi)}</span><span>${eur(semaine.reste)} restant</span></div>
      <div class="jauge-fond"><div class="jauge-barre ${classeJaugeSemaine}" style="width:${pourcentSemaine}%"></div></div>
      <p style="font-size:.82rem;color:var(--ink-soft);margin:8px 0 0">Virement du lundi : ${eur(semaine.montantVirement)} — depense : ${eur(semaine.depense)}</p>
      <p style="font-size:.72rem;color:var(--ink-soft);margin:4px 0 0">Enveloppe theorique : ${eur(enveloppeHebdo)}/semaine</p>
    </div>

    ${projection.premierFranchissementDecouvert ? `
      <div class="alerte danger">
        <strong>⚠️ Risque de depassement du decouvert autorise</strong>
        Le ${dateFR(projection.premierFranchissementDecouvert.date)}, il manquerait ${eur(projection.premierFranchissementDecouvert.montantACouvrir)} pour rester dans les ${eur(-config.seuilDecouvertAutorise)} autorises.
      </div>` : (projection.premierFranchissementZero ? `
      <div class="alerte">
        <strong>À surveiller : passage sous 0</strong>
        Le ${dateFR(projection.premierFranchissementZero.date)}, le solde passerait sous 0 (${eur(projection.premierFranchissementZero.montantACouvrir)} a couvrir).
      </div>` : '')}

    <h2 class="section-titre">Prochaines echeances (14 jours)</h2>
    <div class="carte liste-echeances">
      ${echeances14j.length ? echeances14j.map(e => `
        <div class="item-ligne">
          <span>${dateFR(e.date)} — ${e.libelle}</span>
          <span class="montant">${eur(e.montant)}</span>
        </div>`).join('') : '<div class="vide" style="padding:16px">Rien de prevu</div>'}
    </div>

    <h2 class="section-titre">Objectifs</h2>
    <div id="mini-objectifs"></div>
  `;
  const zoneObjectifs = zone.querySelector('#mini-objectifs');
  zoneObjectifs.innerHTML = await rendreListeObjectifsCourte();
}

async function echeancesProchaines(nbJours) {
  const config = await DB.getConfig();
  const dettes = await DB.getAll('dettes');
  const debut = new Date();
  const fin = C.addDays(debut, nbJours);
  const liste = [];

  const { debut: debutCycle, fin: finCycle } = C.cycleContenant(debut, config.jourCycle);
  const prochainDebutCycle = debutCycle <= debut ? C.addDays(finCycle, 1) : debutCycle;
  if (prochainDebutCycle <= fin) {
    liste.push({ date: C.toISODate(prochainDebutCycle), libelle: 'Paie', montant: config.revenuNetMensuel });
    for (const c of config.chargesFixes) {
      liste.push({ date: C.toISODate(prochainDebutCycle), libelle: c.libelle, montant: -c.montant });
    }
  }

  for (const d of dettes) {
    if (d.type === 'echeancier') {
      for (const e of (d.echeances || [])) {
        const dateE = C.parseISODate(e.date);
        if (dateE >= debut && dateE <= fin) liste.push({ date: e.date, libelle: `${d.nom}`, montant: -e.montant });
      }
    }
  }
  return liste.sort((a, b) => a.date.localeCompare(b.date));
}

async function calculerProjectionAuto() {
  const config = await DB.getConfig();
  const mouvements = (await echeancesProchaines(31)).map(e => ({ date: e.date, libelle: e.libelle, montant: e.montant }));
  return C.projectionTresorerie({
    soldeInitial: config.dernierSolde.montant,
    dateDebut: config.dernierSolde.date || auj(),
    mouvements,
    seuilDecouvert: config.seuilDecouvertAutorise
  });
}

async function rendreListeObjectifsCourte() {
  const objectifs = await calculerObjectifs();
  return `<div class="carte">${objectifs.slice(0, 3).map(o => `
    <div class="jauge-ligne" style="margin-bottom:10px">
      <div class="jauge-entete"><span>${o.libelle}</span><span>${o.texte}</span></div>
      <div class="jauge-fond"><div class="jauge-barre ${o.pourcent >= 100 ? '' : (o.pourcent < 40 ? 'danger' : 'attention')}" style="width:${o.pourcent}%"></div></div>
    </div>`).join('')}</div>`;
}

let categorieChoisie = null;
async function renderSaisie(zone) {
  const config = await DB.getConfig();
  categorieChoisie = null;
  zone.innerHTML = `
    <div class="carte">
      <h2 class="section-titre" style="margin-top:0">Saisie rapide</h2>
      <div class="champ-groupe">
        <label>Montant depense (EUR)</label>
        <input id="saisie-montant" type="number" step="0.01" inputmode="decimal" placeholder="0.00" style="font-size:1.4rem;padding:12px;border-radius:10px;border:2px solid var(--border);">
      </div>
      <div class="champ-groupe">
        <label>Categorie</label>
        <div class="chips" id="saisie-categories">
          ${config.categories.map(c => `<button type="button" class="chip" data-cat="${c.id}">${c.libelle}</button>`).join('')}
        </div>
      </div>
      <div class="champ-groupe">
        <label>Compte</label>
        <div class="chips" id="saisie-comptes">
          <button type="button" class="chip" data-compte="principal">Compte principal</button>
          <button type="button" class="chip" data-compte="joint">Compte joint</button>
          <button type="button" class="chip" data-compte="enveloppe">Enveloppe (Boursorama)</button>
        </div>
      </div>
      <p id="saisie-message" style="font-weight:700;color:var(--ok);min-height:1.2em;"></p>
    </div>
    <h2 class="section-titre">Dernieres saisies</h2>
    <div class="carte" id="saisie-historique"></div>
  `;
  zone.querySelectorAll('#saisie-categories .chip').forEach(btn => {
    btn.addEventListener('click', () => {
      zone.querySelectorAll('#saisie-categories .chip').forEach(b => b.classList.remove('actif'));
      btn.classList.add('actif');
      categorieChoisie = btn.dataset.cat;
    });
  });
  zone.querySelectorAll('#saisie-comptes .chip').forEach(btn => {
    btn.addEventListener('click', () => enregistrerSaisie(zone, btn.dataset.compte));
  });
  await rafraichirHistoriqueSaisie(zone);
}

async function enregistrerSaisie(zone, compte) {
  const montant = parseFloat(document.getElementById('saisie-montant').value);
  const message = document.getElementById('saisie-message');
  if (!montant || montant <= 0) { message.style.color = 'var(--danger)'; message.textContent = 'Indique un montant.'; return; }
  if (!categorieChoisie) { message.style.color = 'var(--danger)'; message.textContent = 'Choisis une categorie.'; return; }
  await DB.put('transactions', {
    id: DB.nouvelId(), date: auj(), categorie: categorieChoisie, compte, montant: -Math.abs(montant), libelle: 'Saisie rapide'
  });
  document.getElementById('saisie-montant').value = '';
  categorieChoisie = null;
  zone.querySelectorAll('.chip').forEach(b => b.classList.remove('actif'));
  message.style.color = 'var(--ok)';
  message.textContent = 'Ajoute ✅';
  await rafraichirHistoriqueSaisie(zone);
}

async function rafraichirHistoriqueSaisie(zone) {
  const toutes = await DB.getAll('transactions');
  const dix = toutes.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  zone.querySelector('#saisie-historique').innerHTML = dix.length ? dix.map(t => `
    <div class="item-ligne">
      <span>${dateFR(t.date)} — ${t.libelle} <span class="pastille-categorie">${t.categorie}</span></span>
      <span class="montant">${eur(t.montant)}</span>
    </div>`).join('') : '<p class="vide" style="padding:12px">Aucune saisie.</p>';
}

async function renderSemaine(zone) {
  const { config, debut, fin, enveloppeHebdo } = await infosCycle();
  const lundis = C.listerLundis(debut, fin);
  const virements = await DB.getAll('virementsHebdo');
  const idsEnveloppe = new Set(config.categories.filter(c => c.enveloppe).map(c => c.id));

  let reportPrecedent = 0;
  const lignes = [];
  for (const lundi of lundis) {
    const dateLundi = C.toISODate(lundi);
    const dimanche = C.addDays(lundi, 6);
    const dateFinSemaine = C.toISODate(dimanche <= fin ? dimanche : fin);
    const transactionsSemaine = await transactionsEntre(dateLundi, dateFinSemaine);
    const depense = totalDepenses(transactionsSemaine, id => idsEnveloppe.has(id));
    const virement = virements.find(v => v.dateLundi === dateLundi);
    const montantVirement = virement ? virement.montantVirement : null;
    const budgetEffectif = montantVirement !== null ? montantVirement : enveloppeHebdo;
    const { disponible, reste } = C.soldeSemaine({ budgetSemaine: budgetEffectif, reportPrecedent, depense });
    lignes.push({ dateLundi, dateFinSemaine, disponible, reste, depense, montantVirement, budgetEffectif, fait: !!virement });
    reportPrecedent = reste;
  }

  zone.innerHTML = `
    <p style="color:var(--ink-soft)">Cycle du ${dateFR(C.toISODate(debut))} au ${dateFR(C.toISODate(fin))} — ${lundis.length} lundi(s), enveloppe theorique ${eur(enveloppeHebdo)}/semaine.</p>
    ${lignes.map(l => `
      <div class="carte jauge-ligne">
        <div class="jauge-entete">
          <span>Semaine du ${dateFR(l.dateLundi)} au ${dateFR(l.dateFinSemaine)}</span>
          <span>${eur(l.reste)} restant</span>
        </div>
        <div class="jauge-fond"><div class="jauge-barre ${l.reste < 0 ? 'danger' : ''}" style="width:${l.disponible > 0 ? Math.min(100, Math.max(0, l.reste / l.disponible * 100)) : 0}%"></div></div>
        <p style="font-size:.82rem;color:var(--ink-soft);margin:8px 0 0">Disponible : ${eur(l.disponible)} (virement ${l.fait ? eur(l.montantVirement) : 'a faire, ' + eur(l.budgetEffectif)}) — Depense : ${eur(l.depense)}</p>
        ${!l.fait ? `<button class="btn" data-lundi="${l.dateLundi}" data-montant="${l.budgetEffectif}" style="margin-top:8px">Faire le virement (${eur(l.budgetEffectif)})</button>` : ''}
      </div>
    `).join('')}
  `;
  zone.querySelectorAll('button[data-lundi]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const montant = parseFloat(prompt('Montant du virement', btn.dataset.montant));
      if (!montant && montant !== 0) return;
      await DB.put('virementsHebdo', { id: DB.nouvelId(), dateLundi: btn.dataset.lundi, montantVirement: montant });
      renderSemaine(zone);
    });
  });
}

async function renderCycle(zone) {
  const { config, debut, fin, budgetCycleEnveloppe, nbLundis } = await infosCycle();
  const transactions = await transactionsEntre(C.toISODate(debut), C.toISODate(fin));
  const budgetsCategorie = {
    carburant: C.round2(C.carburantHebdo(config.enveloppe.carburant) * nbLundis),
    courses: config.enveloppe.coursesMensuel,
    tabac: config.enveloppe.tabacMensuel,
    variable: config.enveloppe.variableMensuel
  };
  const parCategorie = {};
  for (const t of transactions) {
    if (t.montant >= 0) continue;
    parCategorie[t.categorie] = (parCategorie[t.categorie] || 0) + Math.abs(t.montant);
  }
  const totalDepense = Object.values(parCategorie).reduce((s, v) => s + v, 0);
  const chargesFixesTotal = totalChargesFixes(config);
  const ecart = C.round2(config.revenuNetMensuel - chargesFixesTotal - budgetCycleEnveloppe);

  zone.innerHTML = `
    <p style="color:var(--ink-soft)">Cycle du ${dateFR(C.toISODate(debut))} au ${dateFR(C.toISODate(fin))}</p>
    <div class="stat-grid">
      <div class="stat-carte"><div class="label">Revenu</div><div class="valeur">${eur(config.revenuNetMensuel)}</div></div>
      <div class="stat-carte"><div class="label">Charges fixes</div><div class="valeur">${eur(chargesFixesTotal)}</div></div>
      <div class="stat-carte"><div class="label">Enveloppe budget</div><div class="valeur">${eur(budgetCycleEnveloppe)}</div></div>
      <div class="stat-carte ${ecart < 0 ? 'negatif' : 'positif'}"><div class="label">Ecart budget / revenu</div><div class="valeur">${eur(ecart)}</div></div>
    </div>
    ${ecart < 0 ? `<div class="alerte danger"><strong>Ce cycle est deficitaire de ${eur(-ecart)}.</strong> C'est affiche volontairement, sans le masquer.</div>` : ''}

    <h2 class="section-titre">Reel vs budget (enveloppe)</h2>
    <table class="tableau-simple">
      <thead><tr><th>Categorie</th><th>Budget</th><th>Reel</th><th>Ecart</th></tr></thead>
      <tbody>
        ${Object.entries(budgetsCategorie).map(([cat, budget]) => {
          const reel = parCategorie[cat] || 0;
          const e = C.round2(budget - reel);
          return `<tr><td>${cat}</td><td>${eur(budget)}</td><td>${eur(reel)}</td><td style="color:${e < 0 ? 'var(--danger)' : 'var(--ok)'}">${eur(e)}</td></tr>`;
        }).join('')}
        <tr><td>Total</td><td>${eur(budgetCycleEnveloppe)}</td><td>${eur(totalDepense)}</td><td>${eur(C.round2(budgetCycleEnveloppe - totalDepense))}</td></tr>
      </tbody>
    </table>

    <h2 class="section-titre">Cloture du cycle</h2>
    <div class="carte">
      <p style="font-size:.85rem;color:var(--ink-soft)">Le reste de l'enveloppe va au coussin (jusqu'a ${eur(config.coussinCible)}) puis au pret auto.</p>
      <button class="btn" id="btn-cloturer">Calculer la repartition du reste</button>
      <div id="resultat-cloture"></div>
    </div>
  `;
  document.getElementById('btn-cloturer').addEventListener('click', async () => {
    const resteCycle = C.round2(budgetCycleEnveloppe - totalDepense);
    const r = C.affectationFinDeCycle({ resteCycle, coussinActuel: config.coussinActuel, coussinCible: config.coussinCible });
    document.getElementById('resultat-cloture').innerHTML = `
      <p style="margin-top:10px">Reste du cycle : <strong>${eur(resteCycle)}</strong></p>
      <p>→ Coussin : ${eur(r.versementCoussin)} · → Pret auto : ${eur(r.versementPretAuto)}</p>
      <button class="btn" id="btn-appliquer-cloture">Appliquer</button>
    `;
    document.getElementById('btn-appliquer-cloture').addEventListener('click', async () => {
      config.coussinActuel = C.round2(config.coussinActuel + r.versementCoussin);
      await DB.sauverConfig(config);
      const dettes = await DB.getAll('dettes');
      const pretAuto = dettes.find(d => d.id === 'dette-pret-auto');
      if (pretAuto && r.versementPretAuto > 0) {
        pretAuto.capitalRestant = Math.max(0, C.round2(pretAuto.capitalRestant - r.versementPretAuto));
        await DB.put('dettes', pretAuto);
      }
      renderCycle(zone);
    });
  });
}

async function renderEcheancier(zone) {
  const config = await DB.getConfig();
  const echeances30j = await echeancesProchaines(30);

  const mouvementsManuelsKey = 'mouvements-manuels';
  if (!zone.dataset.mouvements) zone.dataset.mouvements = JSON.stringify([]);

  zone.innerHTML = `
    <h2 class="section-titre" style="margin-top:0">Echeancier (30 jours)</h2>
    <div class="carte liste-echeances">
      ${echeances30j.length ? echeances30j.map(e => `
        <div class="item-ligne"><span>${dateFR(e.date)} — ${e.libelle}</span><span class="montant">${eur(e.montant)}</span></div>
      `).join('') : '<div class="vide" style="padding:16px">Rien de prevu</div>'}
    </div>

    <h2 class="section-titre">Projection de tresorerie</h2>
    <div class="carte">
      <div class="champ-groupe"><label>Solde saisi</label><input id="proj-solde" type="number" step="0.01" value="${config.dernierSolde.montant || ''}"></div>
      <div class="champ-groupe"><label>Date du solde</label><input id="proj-date" type="date" value="${config.dernierSolde.date || auj()}"></div>
      <button class="btn" id="proj-enregistrer-solde">Enregistrer ce solde</button>

      <h3 style="margin:18px 0 8px">Mouvements prevus</h3>
      <div id="proj-mouvements"></div>
      <div class="action-flottante">
        <input id="proj-mvt-date" type="date" value="${auj()}" style="padding:8px;border-radius:8px;border:2px solid var(--border)">
        <input id="proj-mvt-libelle" type="text" placeholder="Libelle" style="flex:1;padding:8px;border-radius:8px;border:2px solid var(--border)">
        <input id="proj-mvt-montant" type="number" step="0.01" placeholder="Montant (+ ou -)" style="width:130px;padding:8px;border-radius:8px;border:2px solid var(--border)">
        <button class="btn" id="proj-ajouter-mvt">Ajouter</button>
      </div>
      <button class="btn" id="proj-auto" style="margin-top:10px">+ Ajouter les echeances a venir</button>
      <button class="btn" id="proj-calculer" style="margin-top:10px">Calculer la projection</button>
      <div id="proj-resultat"></div>
    </div>
  `;

  let mouvements = [];
  const rafraichirMouvements = () => {
    document.getElementById('proj-mouvements').innerHTML = mouvements.length ? mouvements.map((m, i) => `
      <div class="item-ligne"><span>${dateFR(m.date)} — ${m.libelle}</span><span class="montant">${eur(m.montant)} <a href="#" data-i="${i}" class="supprimer-mvt" style="margin-left:8px">✕</a></span></div>
    `).join('') : '<p class="vide" style="padding:10px">Aucun mouvement.</p>';
    zone.querySelectorAll('.supprimer-mvt').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      mouvements.splice(parseInt(a.dataset.i, 10), 1);
      rafraichirMouvements();
    }));
  };
  rafraichirMouvements();

  document.getElementById('proj-enregistrer-solde').addEventListener('click', async () => {
    config.dernierSolde = { montant: parseFloat(document.getElementById('proj-solde').value) || 0, date: document.getElementById('proj-date').value };
    await DB.sauverConfig(config);
    alert('Solde enregistre.');
  });

  document.getElementById('proj-ajouter-mvt').addEventListener('click', () => {
    const date = document.getElementById('proj-mvt-date').value;
    const libelle = document.getElementById('proj-mvt-libelle').value || 'Mouvement';
    const montant = parseFloat(document.getElementById('proj-mvt-montant').value);
    if (!date || isNaN(montant)) return;
    mouvements.push({ date, libelle, montant });
    document.getElementById('proj-mvt-libelle').value = '';
    document.getElementById('proj-mvt-montant').value = '';
    rafraichirMouvements();
  });

  document.getElementById('proj-auto').addEventListener('click', async () => {
    const dateDebut = document.getElementById('proj-date').value || auj();
    const debut = C.parseISODate(dateDebut);
    const auto = await echeancesProchaines(45);
    for (const e of auto) {
      if (C.parseISODate(e.date) >= debut) mouvements.push(e);
    }
    rafraichirMouvements();
  });

  document.getElementById('proj-calculer').addEventListener('click', () => {
    const soldeInitial = parseFloat(document.getElementById('proj-solde').value) || 0;
    const dateDebut = document.getElementById('proj-date').value || auj();
    const res = C.projectionTresorerie({ soldeInitial, dateDebut, mouvements, seuilDecouvert: config.seuilDecouvertAutorise });
    document.getElementById('proj-resultat').innerHTML = `
      ${res.premierFranchissementDecouvert ? `<div class="alerte danger"><strong>⚠️ Sous le decouvert autorise le ${dateFR(res.premierFranchissementDecouvert.date)}</strong>Il manquerait ${eur(res.premierFranchissementDecouvert.montantACouvrir)}.</div>` : ''}
      ${!res.premierFranchissementDecouvert && res.premierFranchissementZero ? `<div class="alerte"><strong>Passage sous 0 le ${dateFR(res.premierFranchissementZero.date)}</strong>${eur(res.premierFranchissementZero.montantACouvrir)} a couvrir.</div>` : ''}
      ${!res.premierFranchissementZero ? `<div class="alerte" style="border-left-color:var(--ok);background:#F1F8EC"><strong>Pas de passage sous 0 detecte.</strong></div>` : ''}
      <table class="tableau-simple">
        <thead><tr><th>Date</th><th>Libelle</th><th>Mouvement</th><th>Solde</th></tr></thead>
        <tbody>
          ${res.chronologie.map(c => `<tr><td>${dateFR(c.date)}</td><td>${c.libelle}</td><td>${c.montant ? eur(c.montant) : ''}</td><td style="color:${c.solde < 0 ? 'var(--danger)' : 'inherit'}">${eur(c.solde)}</td></tr>`).join('')}
        </tbody>
      </table>
    `;
  });
}

async function renderDettes(zone) {
  const dettes = await DB.getAll('dettes');
  zone.innerHTML = `<div id="liste-dettes"></div>`;
  const liste = zone.querySelector('#liste-dettes');
  liste.innerHTML = dettes.map(d => `
    <div class="carte" style="margin-bottom:14px" data-id="${d.id}">
      <h3 style="margin-bottom:8px">${d.nom}</h3>
      ${d.type === 'echeancier' ? `
        <p>Reste du : <strong>${eur(d.capitalRestant)}</strong></p>
        <table class="tableau-simple">
          <thead><tr><th>Echeance</th><th>Montant</th></tr></thead>
          <tbody>${(d.echeances || []).map(e => `<tr><td>${dateFR(e.date)}</td><td>${eur(e.montant)}</td></tr>`).join('')}</tbody>
        </table>
      ` : `
        <div class="stat-grid">
          <div class="stat-carte"><div class="label">Capital restant</div><div class="valeur">${eur(d.capitalRestant)}</div></div>
          <div class="stat-carte"><div class="label">Taux annuel</div><div class="valeur">${d.tauxAnnuel}%</div></div>
          <div class="stat-carte"><div class="label">Mensualite</div><div class="valeur">${eur(d.mensualite)}</div></div>
        </div>
        <button class="btn btn-voir-tableau" data-id="${d.id}">Voir le tableau d'amortissement</button>
        <div class="tableau-amortissement" id="tableau-${d.id}" style="margin-top:10px"></div>

        <h4 style="margin-top:16px">Simulateur "et si je verse en plus"</h4>
        <div class="action-flottante">
          <input type="number" step="0.01" placeholder="Montant EUR" class="sim-montant" data-id="${d.id}" style="width:130px;padding:8px;border-radius:8px;border:2px solid var(--border)">
          <input type="number" placeholder="Au mois n°" value="1" class="sim-mois" data-id="${d.id}" style="width:110px;padding:8px;border-radius:8px;border:2px solid var(--border)">
          <button class="btn btn-simuler" data-id="${d.id}">Simuler</button>
        </div>
        <div class="resultat-sim" id="sim-${d.id}"></div>
      `}
    </div>
  `).join('');

  liste.querySelectorAll('.btn-voir-tableau').forEach(btn => btn.addEventListener('click', () => {
    const d = dettes.find(x => x.id === btn.dataset.id);
    const { tableau, nbMensualites, interetsTotal } = C.tableauAmortissement({ capital: d.capitalRestant, tauxAnnuel: d.tauxAnnuel, mensualite: d.mensualite });
    const apercu = [...tableau.slice(0, 6), ...(tableau.length > 12 ? [{ mois: '…' }] : []), ...tableau.slice(-2)];
    document.getElementById(`tableau-${d.id}`).innerHTML = `
      <p style="font-size:.85rem;color:var(--ink-soft)">${nbMensualites} mensualites restantes — ${eur(interetsTotal)} d'interets au total.</p>
      <table class="tableau-simple">
        <thead><tr><th>Mois</th><th>Interet</th><th>Capital</th><th>Restant</th></tr></thead>
        <tbody>${apercu.map(l => l.interet === undefined ? '<tr><td colspan="4">…</td></tr>' : `<tr><td>${l.mois}</td><td>${eur(l.interet)}</td><td>${eur(l.capitalRembourse)}</td><td>${eur(l.restant)}</td></tr>`).join('')}</tbody>
      </table>`;
  }));

  liste.querySelectorAll('.btn-simuler').forEach(btn => btn.addEventListener('click', () => {
    const d = dettes.find(x => x.id === btn.dataset.id);
    const montant = parseFloat(liste.querySelector(`.sim-montant[data-id="${d.id}"]`).value);
    const mois = parseInt(liste.querySelector(`.sim-mois[data-id="${d.id}"]`).value, 10) || 1;
    if (!montant) return;
    const r = C.simulerVersementSupplementaire({ capital: d.capitalRestant, tauxAnnuel: d.tauxAnnuel, mensualite: d.mensualite, versementExtra: montant, moisApplication: mois });
    document.getElementById(`sim-${d.id}`).innerHTML = `
      <p style="margin-top:8px">Sans le versement : ${r.nbMensualitesBase} mensualites. Avec ${eur(montant)} au mois ${mois} : <strong>${r.nbMensualitesAvecExtra} mensualites</strong> (${r.moisGagnes} de gagnes) et <strong>${eur(r.interetsEconomises)}</strong> d'interets economises.</p>`;
  }));
}

async function calculerObjectifs() {
  const config = await DB.getConfig();
  const dettes = await DB.getAll('dettes');
  const { debut, fin } = C.cycleContenant(new Date(), config.jourCycle);
  const transactionsCycle = await transactionsEntre(C.toISODate(debut), C.toISODate(fin));

  return config.objectifs.map(o => {
    if (o.type === 'montant') {
      const actuel = o.id === 'obj-coussin' ? config.coussinActuel : config.epargneActuelle;
      const pourcent = C.progressionObjectif(actuel, o.cible);
      return { libelle: o.libelle, pourcent, texte: `${eur(actuel)} / ${eur(o.cible)}` };
    }
    if (o.type === 'plafondMensuel') {
      const depense = totalDepenses(transactionsCycle, id => id === o.categorie);
      const pourcent = Math.min(100, C.progressionObjectif(depense, o.cible));
      return { libelle: o.libelle, pourcent: 100 - pourcent, texte: `${eur(depense)} / ${eur(o.cible)}`, depasse: depense > o.cible };
    }
    if (o.type === 'date') {
      const dette = dettes.find(d => d.id === (o.id === 'obj-izicarte' ? 'dette-izicarte' : 'dette-pret-auto'));
      if (!dette || dette.capitalRestant <= 0) return { libelle: o.libelle, pourcent: 100, texte: 'Soldee ✅' };
      const { nbMensualites } = C.tableauAmortissement({ capital: dette.capitalRestant, tauxAnnuel: dette.tauxAnnuel, mensualite: dette.mensualite });
      const dateProjetee = new Date();
      dateProjetee.setMonth(dateProjetee.getMonth() + nbMensualites);
      const cible = C.parseISODate(o.cible);
      const aTemps = dateProjetee <= cible;
      return { libelle: o.libelle, pourcent: aTemps ? 80 : 30, texte: `estime ${dateProjetee.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} (objectif ${dateFR(o.cible)})`, aTemps };
    }
    if (o.type === 'compteur') {
      const rejets = transactionsCycle.filter(t => t.categorie === 'frais_bancaires' && t.rejet).length;
      return { libelle: o.libelle, pourcent: rejets === 0 ? 100 : 0, texte: `${rejets} ce cycle` };
    }
    return { libelle: o.libelle, pourcent: 0, texte: '' };
  });
}

async function renderObjectifs(zone) {
  const objectifs = await calculerObjectifs();
  zone.innerHTML = objectifs.map(o => `
    <div class="carte jauge-ligne">
      <div class="jauge-entete"><span>${o.libelle}</span><span>${o.texte}</span></div>
      <div class="jauge-fond"><div class="jauge-barre ${o.pourcent >= 80 ? '' : (o.pourcent >= 40 ? 'attention' : 'danger')}" style="width:${o.pourcent}%"></div></div>
    </div>
  `).join('');
}

async function renderBonus(zone) {
  const config = await DB.getConfig();
  const dettes = await DB.getAll('dettes');
  const izicarte = dettes.find(d => d.id === 'dette-izicarte');
  const evenements = await DB.getAll('evenements');

  zone.innerHTML = `
    <h2 class="section-titre" style="margin-top:0">Revenu exceptionnel</h2>
    <div class="carte">
      <div class="champ-groupe"><label>Montant total (13e mois + interessement, etc.)</label><input id="bonus-total" type="number" step="0.01" value="2800"></div>
      <div class="champ-groupe"><label>Part Noel</label><input id="bonus-noel" type="number" step="0.01" value="${config.affectationBonus.montantNoel}"></div>
      <div class="champ-groupe"><label>Solde Izicarte a couvrir</label><input id="bonus-izicarte" type="number" step="0.01" value="${izicarte ? izicarte.capitalRestant : 0}"></div>
      <div class="champ-groupe"><label>Part pret auto sur le reste (%)</label><input id="bonus-part-pret" type="number" value="${config.affectationBonus.partPretAuto * 100}"></div>
      <button class="btn" id="bonus-calculer">Calculer la repartition</button>
      <div id="bonus-resultat"></div>
    </div>

    <h2 class="section-titre">Evenements</h2>
    <div class="carte" id="liste-evenements"></div>
    <div class="action-flottante">
      <input id="evt-nom" type="text" placeholder="Nom" style="flex:1;padding:8px;border-radius:8px;border:2px solid var(--border)">
      <input id="evt-montant" type="number" step="0.01" placeholder="Montant" style="width:120px;padding:8px;border-radius:8px;border:2px solid var(--border)">
      <input id="evt-date" type="date" style="padding:8px;border-radius:8px;border:2px solid var(--border)">
      <button class="btn" id="evt-ajouter">Ajouter</button>
    </div>
  `;

  const rafraichirEvenements = async () => {
    const liste = await DB.getAll('evenements');
    document.getElementById('liste-evenements').innerHTML = liste.length ? liste.map(e => `
      <div class="item-ligne"><span>${dateFR(e.date)} — ${e.nom}</span><span class="montant">${eur(e.montant)}</span></div>
    `).join('') : '<p class="vide" style="padding:10px">Aucun evenement.</p>';
  };
  await rafraichirEvenements();
  if (!evenements.length) {
    await DB.put('evenements', { id: DB.nouvelId(), nom: 'Anniversaire', montant: 80, date: `${new Date().getFullYear()}-10-15` });
    await DB.put('evenements', { id: DB.nouvelId(), nom: 'Noel', montant: 400, date: `${new Date().getFullYear()}-12-20` });
    await rafraichirEvenements();
  }

  document.getElementById('evt-ajouter').addEventListener('click', async () => {
    const nom = document.getElementById('evt-nom').value;
    const montant = parseFloat(document.getElementById('evt-montant').value);
    const date = document.getElementById('evt-date').value;
    if (!nom || !montant || !date) return;
    await DB.put('evenements', { id: DB.nouvelId(), nom, montant, date });
    document.getElementById('evt-nom').value = '';
    document.getElementById('evt-montant').value = '';
    await rafraichirEvenements();
  });

  document.getElementById('bonus-calculer').addEventListener('click', () => {
    const bonusTotal = parseFloat(document.getElementById('bonus-total').value) || 0;
    const noel = parseFloat(document.getElementById('bonus-noel').value) || 0;
    const izicarteRestant = parseFloat(document.getElementById('bonus-izicarte').value) || 0;
    const partPretAuto = (parseFloat(document.getElementById('bonus-part-pret').value) || 0) / 100;
    const r = C.affectationBonus({ bonusTotal, noel, izicarteRestant, partPretAuto, partLivret: 1 - partPretAuto });
    document.getElementById('bonus-resultat').innerHTML = `
      <div class="stat-grid" style="margin-top:14px">
        <div class="stat-carte"><div class="label">Noel</div><div class="valeur">${eur(r.versementNoel)}</div></div>
        <div class="stat-carte"><div class="label">Izicarte</div><div class="valeur">${eur(r.versementIzicarte)}</div></div>
        <div class="stat-carte"><div class="label">Pret auto</div><div class="valeur">${eur(r.versementPretAuto)}</div></div>
        <div class="stat-carte"><div class="label">Livret</div><div class="valeur">${eur(r.versementLivret)}</div></div>
      </div>
      <button class="btn" id="bonus-appliquer" style="margin-top:10px">Appliquer</button>
    `;
    document.getElementById('bonus-appliquer').addEventListener('click', async () => {
      const dettesActuelles = await DB.getAll('dettes');
      const izi = dettesActuelles.find(d => d.id === 'dette-izicarte');
      const pret = dettesActuelles.find(d => d.id === 'dette-pret-auto');
      if (izi) { izi.capitalRestant = Math.max(0, C.round2(izi.capitalRestant - r.versementIzicarte)); await DB.put('dettes', izi); }
      if (pret) { pret.capitalRestant = Math.max(0, C.round2(pret.capitalRestant - r.versementPretAuto)); await DB.put('dettes', pret); }
      const cfg = await DB.getConfig();
      cfg.epargneActuelle = C.round2(cfg.epargneActuelle + r.versementLivret);
      await DB.sauverConfig(cfg);
      alert('Applique : Izicarte, pret auto et epargne mis a jour.');
    });
  });
}

async function renderParametres(zone) {
  const config = await DB.getConfig();
  zone.innerHTML = `
    <h2 class="section-titre" style="margin-top:0">Cycle et revenu</h2>
    <div class="carte">
      <div class="champ-groupe"><label>Jour de debut du cycle</label><input id="p-jour-cycle" type="number" min="1" max="28" value="${config.jourCycle}"></div>
      <div class="champ-groupe"><label>Revenu net mensuel</label><input id="p-revenu" type="number" step="0.01" value="${config.revenuNetMensuel}"></div>
      <div class="champ-groupe"><label>Decouvert autorise</label><input id="p-decouvert" type="number" step="0.01" value="${config.decouvertAutorise}"></div>
      <div class="champ-groupe"><label>Taux agios annuel (%)</label><input id="p-agios" type="number" step="0.01" value="${config.tauxAgios}"></div>
      <div class="champ-groupe"><label>Commission par rejet</label><input id="p-commission-rejet" type="number" step="0.01" value="${config.commissionRejet}"></div>
      <div class="champ-groupe"><label>Coussin cible</label><input id="p-coussin-cible" type="number" step="0.01" value="${config.coussinCible}"></div>
      <div class="champ-groupe"><label>Coussin actuel</label><input id="p-coussin-actuel" type="number" step="0.01" value="${config.coussinActuel}"></div>
      <div class="champ-groupe"><label>Epargne actuelle</label><input id="p-epargne" type="number" step="0.01" value="${config.epargneActuelle}"></div>
    </div>

    <h2 class="section-titre">Charges fixes (par cycle)</h2>
    <div class="carte" id="p-charges"></div>
    <div class="action-flottante">
      <input id="cf-libelle" type="text" placeholder="Libelle" style="flex:1;padding:8px;border-radius:8px;border:2px solid var(--border)">
      <input id="cf-montant" type="number" step="0.01" placeholder="Montant" style="width:120px;padding:8px;border-radius:8px;border:2px solid var(--border)">
      <button class="btn" id="cf-ajouter">Ajouter</button>
    </div>

    <h2 class="section-titre">Enveloppe carte</h2>
    <div class="carte">
      <div class="champ-groupe"><label>Km aller-retour</label><input id="p-km" type="number" step="0.1" value="${config.enveloppe.carburant.kmAR}"></div>
      <div class="champ-groupe"><label>Jours travailles/semaine</label><input id="p-jours-travail" type="number" step="0.1" value="${config.enveloppe.carburant.joursTravailles}"></div>
      <div class="champ-groupe"><label>Conso /100km (L)</label><input id="p-conso" type="number" step="0.1" value="${config.enveloppe.carburant.conso100}"></div>
      <div class="champ-groupe"><label>Prix/L</label><input id="p-prix-l" type="number" step="0.01" value="${config.enveloppe.carburant.prixL}"></div>
      <div class="champ-groupe"><label>Courses (mensuel)</label><input id="p-courses" type="number" step="0.01" value="${config.enveloppe.coursesMensuel}"></div>
      <div class="champ-groupe"><label>Tabac (mensuel, objectif)</label><input id="p-tabac" type="number" step="0.01" value="${config.enveloppe.tabacMensuel}"></div>
      <div class="champ-groupe"><label>Variable (mensuel)</label><input id="p-variable" type="number" step="0.01" value="${config.enveloppe.variableMensuel}"></div>
    </div>

    <h2 class="section-titre">Apparence et securite</h2>
    <div class="carte">
      <button class="btn" id="p-theme">Basculer theme clair/sombre</button>
      <button class="btn" id="p-changer-code" style="margin-left:8px">Changer le code d'acces</button>
    </div>

    <button class="btn" id="p-sauver" style="margin-top:16px">Enregistrer les parametres</button>
  `;

  const rafraichirCharges = () => {
    document.getElementById('p-charges').innerHTML = config.chargesFixes.map(c => `
      <div class="item-ligne">
        <span>${c.libelle}</span>
        <span><input type="number" step="0.01" value="${c.montant}" data-id="${c.id}" class="cf-montant-input" style="width:100px"> <a href="#" data-id="${c.id}" class="cf-supprimer">✕</a></span>
      </div>`).join('');
    zone.querySelectorAll('.cf-supprimer').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      const i = config.chargesFixes.findIndex(c => c.id === a.dataset.id);
      if (i >= 0) config.chargesFixes.splice(i, 1);
      rafraichirCharges();
    }));
  };
  rafraichirCharges();

  document.getElementById('cf-ajouter').addEventListener('click', () => {
    const libelle = document.getElementById('cf-libelle').value;
    const montant = parseFloat(document.getElementById('cf-montant').value);
    if (!libelle || !montant) return;
    config.chargesFixes.push({ id: DB.nouvelId(), libelle, montant });
    document.getElementById('cf-libelle').value = '';
    document.getElementById('cf-montant').value = '';
    rafraichirCharges();
  });

  document.getElementById('p-theme').addEventListener('click', () => {
    document.body.classList.toggle('theme-sombre');
    localStorage.setItem(CLE_THEME, document.body.classList.contains('theme-sombre') ? 'sombre' : 'clair');
  });

  document.getElementById('p-changer-code').addEventListener('click', async () => {
    const nouveau = prompt('Nouveau code :');
    if (!nouveau) return;
    localStorage.setItem(CLE_PIN, await sha256(nouveau));
    alert('Code mis a jour.');
  });

  document.getElementById('p-sauver').addEventListener('click', async () => {
    config.jourCycle = parseInt(document.getElementById('p-jour-cycle').value, 10);
    config.revenuNetMensuel = parseFloat(document.getElementById('p-revenu').value);
    config.decouvertAutorise = parseFloat(document.getElementById('p-decouvert').value);
    config.seuilDecouvertAutorise = -Math.abs(config.decouvertAutorise);
    config.tauxAgios = parseFloat(document.getElementById('p-agios').value);
    config.commissionRejet = parseFloat(document.getElementById('p-commission-rejet').value);
    config.coussinCible = parseFloat(document.getElementById('p-coussin-cible').value);
    config.coussinActuel = parseFloat(document.getElementById('p-coussin-actuel').value);
    config.epargneActuelle = parseFloat(document.getElementById('p-epargne').value);
    config.enveloppe.carburant.kmAR = parseFloat(document.getElementById('p-km').value);
    config.enveloppe.carburant.joursTravailles = parseFloat(document.getElementById('p-jours-travail').value);
    config.enveloppe.carburant.conso100 = parseFloat(document.getElementById('p-conso').value);
    config.enveloppe.carburant.prixL = parseFloat(document.getElementById('p-prix-l').value);
    config.enveloppe.coursesMensuel = parseFloat(document.getElementById('p-courses').value);
    config.enveloppe.tabacMensuel = parseFloat(document.getElementById('p-tabac').value);
    config.enveloppe.variableMensuel = parseFloat(document.getElementById('p-variable').value);
    zone.querySelectorAll('.cf-montant-input').forEach(input => {
      const cf = config.chargesFixes.find(c => c.id === input.dataset.id);
      if (cf) cf.montant = parseFloat(input.value);
    });
    await DB.sauverConfig(config);
    alert('Parametres enregistres.');
  });
}

function parserCSV(texte) {
  const lignes = texte.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const delimiteur = texte.includes(';') ? ';' : ',';
  return lignes.map(l => {
    const parts = l.split(delimiteur).map(p => p.trim().replace(/^"|"$/g, ''));
    return parts;
  });
}

function estDateValide(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{2}\/\d{2}\/\d{4}$/.test(s);
}
function normaliserDate(s) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [j, m, a] = s.split('/');
  return `${a}-${m}-${j}`;
}
function normaliserMontant(s) {
  return parseFloat(s.replace(/\s/g, '').replace(',', '.'));
}

async function renderDonnees(zone) {
  const regles = await DB.getAll('reglesImport');
  zone.innerHTML = `
    <h2 class="section-titre" style="margin-top:0">Import CSV bancaire</h2>
    <div class="carte">
      <p style="font-size:.85rem;color:var(--ink-soft)">Colle un export CSV (date;libelle;montant), une ligne par operation.</p>
      <textarea class="champ-import" id="import-texte" placeholder="2026-09-21;BURALISTE LE FLORE;-8.50"></textarea>
      <input type="file" id="import-fichier" accept=".csv,text/csv" style="margin-top:8px">
      <button class="btn" id="import-analyser" style="margin-top:8px">Analyser</button>
      <div id="import-apercu"></div>
    </div>

    <h2 class="section-titre">Regles libelle → categorie</h2>
    <div class="carte" id="liste-regles"></div>
    <div class="action-flottante">
      <input id="regle-motif" type="text" placeholder="Motif (regex, ex: LIDL|AUCHAN)" style="flex:1;padding:8px;border-radius:8px;border:2px solid var(--border)">
      <input id="regle-categorie" type="text" placeholder="Categorie" style="width:150px;padding:8px;border-radius:8px;border:2px solid var(--border)">
      <button class="btn" id="regle-ajouter">Ajouter</button>
    </div>

    <h2 class="section-titre">Export</h2>
    <div class="carte">
      <button class="btn" id="export-json">Exporter en JSON</button>
      <button class="btn" id="export-csv" style="margin-left:8px">Exporter en Excel (CSV)</button>
    </div>
  `;

  const rafraichirRegles = async () => {
    const r = await DB.getAll('reglesImport');
    document.getElementById('liste-regles').innerHTML = r.map(x => `
      <div class="item-ligne"><span>${x.motif}</span><span class="pastille-categorie">${x.categorie}</span></div>
    `).join('');
  };
  await rafraichirRegles();

  document.getElementById('regle-ajouter').addEventListener('click', async () => {
    const motif = document.getElementById('regle-motif').value;
    const categorie = document.getElementById('regle-categorie').value;
    if (!motif || !categorie) return;
    await DB.put('reglesImport', { id: DB.nouvelId(), motif, categorie });
    document.getElementById('regle-motif').value = '';
    document.getElementById('regle-categorie').value = '';
    await rafraichirRegles();
  });

  document.getElementById('import-fichier').addEventListener('change', async (e) => {
    const fichier = e.target.files[0];
    if (!fichier) return;
    document.getElementById('import-texte').value = await fichier.text();
  });

  document.getElementById('import-analyser').addEventListener('click', async () => {
    const regles = await DB.getAll('reglesImport');
    const lignes = parserCSV(document.getElementById('import-texte').value);
    const operations = lignes
      .filter(l => l.length >= 3 && estDateValide(l[0]))
      .map(l => {
        const date = normaliserDate(l[0]);
        const libelle = l[1];
        const montant = normaliserMontant(l[2]);
        const regle = regles.find(r => new RegExp(r.motif, 'i').test(libelle));
        return { date, libelle, montant, categorie: regle ? regle.categorie : 'autre' };
      });
    document.getElementById('import-apercu').innerHTML = `
      <table class="tableau-simple" style="margin-top:12px">
        <thead><tr><th>Date</th><th>Libelle</th><th>Categorie</th><th>Montant</th></tr></thead>
        <tbody>${operations.map((o, i) => `
          <tr><td>${dateFR(o.date)}</td><td>${o.libelle}</td><td>
            <select class="import-cat" data-i="${i}">
              ${['carburant', 'courses', 'tabac', 'variable', 'amazon', '4x', 'abonnements', 'frais_bancaires', 'autre'].map(c => `<option value="${c}" ${c === o.categorie ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </td><td>${eur(o.montant)}</td></tr>
        `).join('')}</tbody>
      </table>
      <button class="btn" id="import-confirmer" style="margin-top:10px">Importer ${operations.length} operation(s)</button>
    `;
    document.getElementById('import-confirmer')?.addEventListener('click', async () => {
      zone.querySelectorAll('.import-cat').forEach(sel => {
        operations[parseInt(sel.dataset.i, 10)].categorie = sel.value;
      });
      for (const o of operations) {
        await DB.put('transactions', { id: DB.nouvelId(), date: o.date, categorie: o.categorie, compte: 'principal', montant: o.montant, libelle: o.libelle });
      }
      alert(`${operations.length} operation(s) importee(s).`);
      document.getElementById('import-texte').value = '';
      document.getElementById('import-apercu').innerHTML = '';
    });
  });

  document.getElementById('export-json').addEventListener('click', async () => {
    const data = await DB.exporterTout();
    telecharger(JSON.stringify(data, null, 2), 'budget-perso.json', 'application/json');
  });

  document.getElementById('export-csv').addEventListener('click', async () => {
    const transactions = await DB.getAll('transactions');
    const lignes = ['Date;Categorie;Compte;Libelle;Montant'];
    for (const t of transactions.sort((a, b) => a.date.localeCompare(b.date))) {
      lignes.push([t.date, t.categorie, t.compte, t.libelle, String(t.montant).replace('.', ',')].join(';'));
    }
    telecharger('﻿' + lignes.join('\r\n'), 'budget-perso.csv', 'text/csv;charset=utf-8');
  });
}

function telecharger(contenu, nomFichier, type) {
  const blob = new Blob([contenu], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', () => {
  construireNav();
  document.getElementById('date-jour').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  demarrerPortail();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('assets/budget-perso/sw.js').catch(() => {});
  }
});
