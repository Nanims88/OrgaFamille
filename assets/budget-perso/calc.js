// Fonctions de calcul pures — pas de DOM, pas d'I/O. Testées dans tests/calc.test.js.

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Cycle budgétaire : du jourCycle du mois M au (jourCycle - 1) du mois M+1.
// debut peut être une Date ou une string ISO.
export function finDeCycle(debut) {
  const d = new Date(debut);
  const fin = new Date(d);
  fin.setMonth(fin.getMonth() + 1);
  fin.setDate(fin.getDate() - 1);
  return fin;
}

// Retourne le cycle {debut, fin} auquel appartient refDate, pour un jour de cycle donné (ex: 25).
export function cycleContenant(refDate, jourCycle = 25) {
  const d = new Date(refDate);
  let debut;
  if (d.getDate() >= jourCycle) {
    debut = new Date(d.getFullYear(), d.getMonth(), jourCycle);
  } else {
    debut = new Date(d.getFullYear(), d.getMonth() - 1, jourCycle);
  }
  return { debut, fin: finDeCycle(debut) };
}

// Nombre de lundis entre deux dates (inclusif).
export function compterLundis(debut, fin) {
  let n = 0;
  const cur = new Date(debut);
  cur.setHours(0, 0, 0, 0);
  const fin2 = new Date(fin);
  fin2.setHours(0, 0, 0, 0);
  while (cur <= fin2) {
    if (cur.getDay() === 1) n++;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

// Liste des lundis (Date) entre deux dates (inclusif).
export function listerLundis(debut, fin) {
  const lundis = [];
  const cur = new Date(debut);
  cur.setHours(0, 0, 0, 0);
  const fin2 = new Date(fin);
  fin2.setHours(0, 0, 0, 0);
  while (cur <= fin2) {
    if (cur.getDay() === 1) lundis.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return lundis;
}

export function enveloppeHebdomadaire(budgetCycle, nbLundis) {
  if (!nbLundis) return 0;
  return round2(budgetCycle / nbLundis);
}

// Carburant : km aller-retour x jours travaillés x conso/100km x prix/L.
export function carburantHebdo({ kmAR, joursTravailles, conso100, prixL }) {
  return round2(kmAR * joursTravailles * (conso100 / 100) * prixL);
}

export function enveloppeCycleTotal({ carburantHebdoMontant, nbLundis, courses, tabac, variable }) {
  return round2(carburantHebdoMontant * nbLundis + courses + tabac + variable);
}

// Report d'une semaine à l'autre : le reste (positif ou négatif) s'ajoute au budget de la semaine suivante.
export function soldeSemaine({ budgetSemaine, reportPrecedent = 0, depense = 0 }) {
  const disponible = round2(budgetSemaine + reportPrecedent);
  const reste = round2(disponible - depense);
  return { disponible, reste };
}

// Fin de cycle : le reste alimente le coussin jusqu'à la cible, puis va au prêt auto.
export function affectationFinDeCycle({ resteCycle, coussinActuel, coussinCible = 400 }) {
  let versementCoussin = 0;
  let versementPretAuto = 0;
  if (resteCycle <= 0) return { versementCoussin: 0, versementPretAuto: 0 };
  const manqueCoussin = Math.max(0, coussinCible - coussinActuel);
  versementCoussin = round2(Math.min(resteCycle, manqueCoussin));
  versementPretAuto = round2(resteCycle - versementCoussin);
  return { versementCoussin, versementPretAuto };
}

// Tableau d'amortissement d'un prêt à mensualité fixe.
export function tableauAmortissement({ capital, tauxAnnuel, mensualite, maxMois = 600 }) {
  const tauxMensuel = tauxAnnuel / 100 / 12;
  let restant = capital;
  const tableau = [];
  let interetsTotal = 0;
  let mois = 0;
  while (restant > 0.01 && mois < maxMois) {
    mois++;
    const interet = round2(restant * tauxMensuel);
    let capitalRembourse = round2(mensualite - interet);
    let paiement = mensualite;
    if (capitalRembourse >= restant) {
      capitalRembourse = restant;
      paiement = round2(restant + interet);
      restant = 0;
    } else {
      restant = round2(restant - capitalRembourse);
    }
    interetsTotal = round2(interetsTotal + interet);
    tableau.push({ mois, interet, capitalRembourse, paiement, restant });
  }
  return { tableau, nbMensualites: mois, interetsTotal: round2(interetsTotal) };
}

// Simulateur "et si je verse X en plus" à un mois donné (défaut : dès le mois 1).
export function simulerVersementSupplementaire({ capital, tauxAnnuel, mensualite, versementExtra, moisApplication = 1 }) {
  const base = tableauAmortissement({ capital, tauxAnnuel, mensualite });
  const tauxMensuel = tauxAnnuel / 100 / 12;
  let restant = capital;
  let mois = 0;
  let interetsTotal = 0;
  while (restant > 0.01 && mois < 600) {
    mois++;
    const interet = round2(restant * tauxMensuel);
    let paye = mensualite;
    if (mois === moisApplication) paye = round2(paye + versementExtra);
    let capitalRembourse = round2(paye - interet);
    if (capitalRembourse >= restant) {
      restant = 0;
    } else {
      restant = round2(restant - capitalRembourse);
    }
    interetsTotal = round2(interetsTotal + interet);
  }
  return {
    nbMensualitesBase: base.nbMensualites,
    nbMensualitesAvecExtra: mois,
    moisGagnes: base.nbMensualites - mois,
    interetsEconomises: round2(base.interetsTotal - interetsTotal)
  };
}

// Projection de trésorerie : solde initial + mouvements datés -> chronologie + alertes de franchissement.
// mouvements: [{ date: 'YYYY-MM-DD', libelle, montant }] (montant négatif = dépense/échéance)
export function projectionTresorerie({ soldeInitial, dateDebut, mouvements, seuilDecouvert = -500 }) {
  const tries = [...mouvements].sort((a, b) => a.date.localeCompare(b.date));
  let solde = soldeInitial;
  const chronologie = [{ date: dateDebut, libelle: 'Solde de départ', montant: 0, solde }];
  let premierFranchissementZero = null;
  let premierFranchissementDecouvert = null;
  let soldeMinimum = solde;
  let dateSoldeMinimum = dateDebut;

  if (solde < 0 && !premierFranchissementZero) {
    premierFranchissementZero = { date: dateDebut, montantACouvrir: round2(-solde) };
  }
  if (solde < seuilDecouvert && !premierFranchissementDecouvert) {
    premierFranchissementDecouvert = { date: dateDebut, montantACouvrir: round2(seuilDecouvert - solde) };
  }

  for (const mvt of tries) {
    solde = round2(solde + mvt.montant);
    chronologie.push({ date: mvt.date, libelle: mvt.libelle, montant: mvt.montant, solde });
    if (solde < soldeMinimum) { soldeMinimum = solde; dateSoldeMinimum = mvt.date; }
    if (solde < 0 && !premierFranchissementZero) {
      premierFranchissementZero = { date: mvt.date, montantACouvrir: round2(-solde) };
    }
    if (solde < seuilDecouvert && !premierFranchissementDecouvert) {
      premierFranchissementDecouvert = { date: mvt.date, montantACouvrir: round2(seuilDecouvert - solde) };
    }
  }

  return {
    chronologie,
    soldeFinal: solde,
    soldeMinimum,
    dateSoldeMinimum,
    premierFranchissementZero,
    premierFranchissementDecouvert
  };
}

// Répartition d'un revenu exceptionnel (bonus / rachat AV) selon les règles paramétrables.
export function affectationBonus({ bonusTotal, noel = 0, izicarteRestant = 0, partPretAuto = 0.6, partLivret = 0.4 }) {
  let reste = round2(bonusTotal);
  const versementNoel = round2(Math.min(reste, noel));
  reste = round2(reste - versementNoel);
  const versementIzicarte = round2(Math.min(reste, izicarteRestant));
  reste = round2(reste - versementIzicarte);
  const versementPretAuto = round2(reste * partPretAuto);
  const versementLivret = round2(reste - versementPretAuto);
  return { versementNoel, versementIzicarte, versementPretAuto, versementLivret };
}

export function progressionObjectif(valeurActuelle, cible) {
  if (!cible) return 0;
  return Math.max(0, Math.min(100, round2((valeurActuelle / cible) * 100)));
}
