import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cycleContenant,
  finDeCycle,
  compterLundis,
  enveloppeHebdomadaire,
  carburantHebdo,
  tableauAmortissement,
  simulerVersementSupplementaire,
  projectionTresorerie,
  affectationFinDeCycle,
  affectationBonus,
  progressionObjectif,
  toISODate,
  lundiDeLaSemaine,
  soldeTheorique
} from '../assets/budget-perso/calc.js';

test('lundiDeLaSemaine : retrouve le lundi de la semaine, y compris un dimanche', () => {
  assert.equal(toISODate(lundiDeLaSemaine(new Date(2026, 8, 23))), '2026-09-21'); // mercredi -> lundi meme semaine
  assert.equal(toISODate(lundiDeLaSemaine(new Date(2026, 8, 20))), '2026-09-14'); // dimanche -> lundi semaine precedente
  assert.equal(toISODate(lundiDeLaSemaine(new Date(2026, 8, 21))), '2026-09-21'); // deja un lundi
});

test('cycle 25/10/2026 -> 24/11/2026 : 5 lundis, enveloppe 148.40', () => {
  const debut = new Date(2026, 9, 25);
  const fin = finDeCycle(debut);
  assert.equal(toISODate(fin), '2026-11-24');
  const nbLundis = compterLundis(debut, fin);
  assert.equal(nbLundis, 5);
  assert.equal(enveloppeHebdomadaire(742, nbLundis), 148.4);
});

test('cycle 25/09/2026 -> 24/10/2026 : 4 lundis', () => {
  const debut = new Date(2026, 8, 25);
  const fin = finDeCycle(debut);
  assert.equal(toISODate(fin), '2026-10-24');
  assert.equal(compterLundis(debut, fin), 4);
});

test('cycle 25/11/2026 -> 24/12/2026 : 4 lundis', () => {
  const debut = new Date(2026, 10, 25);
  const fin = finDeCycle(debut);
  assert.equal(toISODate(fin), '2026-12-24');
  assert.equal(compterLundis(debut, fin), 4);
});

test('cycleContenant retrouve le bon cycle pour une date au milieu', () => {
  const { debut, fin } = cycleContenant(new Date(2026, 10, 5), 25);
  assert.equal(toISODate(debut), '2026-10-25');
  assert.equal(toISODate(fin), '2026-11-24');
});

test('carburant : 80 x 5 x 6/100 x 2.15 = 51.60 EUR/semaine', () => {
  const montant = carburantHebdo({ kmAR: 80, joursTravailles: 5, conso100: 6, prixL: 2.15 });
  assert.equal(montant, 51.6);
});

test('pret auto 6905 EUR, 6.44%, 138 EUR/mois : environ 58 mensualites', () => {
  const { nbMensualites, tableau } = tableauAmortissement({ capital: 6905, tauxAnnuel: 6.44, mensualite: 138 });
  assert.ok(nbMensualites >= 56 && nbMensualites <= 60, `attendu ~58, obtenu ${nbMensualites}`);
  assert.equal(tableau[tableau.length - 1].restant, 0);
});

test('simulateur : un versement supplementaire raccourcit la duree et reduit les interets', () => {
  const res = simulerVersementSupplementaire({
    capital: 6905, tauxAnnuel: 6.44, mensualite: 138, versementExtra: 1000, moisApplication: 1
  });
  assert.ok(res.nbMensualitesAvecExtra < res.nbMensualitesBase);
  assert.ok(res.interetsEconomises > 0);
});

test('affectation fin de cycle : coussin sous la cible absorbe le reste en priorite', () => {
  const r = affectationFinDeCycle({ resteCycle: 150, coussinActuel: 100, coussinCible: 400 });
  assert.equal(r.versementCoussin, 150);
  assert.equal(r.versementPretAuto, 0);
});

test('affectation fin de cycle : coussin plein, tout va au pret auto', () => {
  const r = affectationFinDeCycle({ resteCycle: 150, coussinActuel: 400, coussinCible: 400 });
  assert.equal(r.versementCoussin, 0);
  assert.equal(r.versementPretAuto, 150);
});

test('affectation fin de cycle : reste negatif ou nul -> aucun versement', () => {
  const r = affectationFinDeCycle({ resteCycle: -20, coussinActuel: 100, coussinCible: 400 });
  assert.equal(r.versementCoussin, 0);
  assert.equal(r.versementPretAuto, 0);
});

test('affectation bonus : Noel puis Izicarte puis 60/40 pret auto / livret', () => {
  const r = affectationBonus({ bonusTotal: 2800, noel: 400, izicarteRestant: 900, partPretAuto: 0.6, partLivret: 0.4 });
  assert.equal(r.versementNoel, 400);
  assert.equal(r.versementIzicarte, 900);
  assert.equal(r.versementPretAuto, 900);
  assert.equal(r.versementLivret, 600);
});

test('progression objectif : bornee entre 0 et 100', () => {
  assert.equal(progressionObjectif(1500, 3000), 50);
  assert.equal(progressionObjectif(4000, 3000), 100);
  assert.equal(progressionObjectif(-50, 3000), 0);
});

test('soldeTheorique : additionne le solde saisi et les mouvements depuis', () => {
  const r = soldeTheorique({
    soldeInitial: -649.75,
    transactions: [{ montant: -12.5 }, { montant: 50 }, { montant: -8.5 }]
  });
  assert.equal(r, -620.75);
});

test('soldeTheorique : sans mouvement, renvoie le solde saisi tel quel', () => {
  assert.equal(soldeTheorique({ soldeInitial: 120, transactions: [] }), 120);
});

test('scenario 20/09/2026 : detecte le trou de tresorerie et le montant a couvrir avant la paie', () => {
  const res = projectionTresorerie({
    soldeInitial: -649.75,
    dateDebut: '2026-09-20',
    mouvements: [
      { date: '2026-09-20', libelle: 'Rachat assurance-vie (attendu)', montant: 300 },
      { date: '2026-09-21', libelle: 'Prelevement', montant: -50 },
      { date: '2026-09-25', libelle: 'Paie (conge sans solde)', montant: 1870 }
    ]
  });
  assert.ok(res.premierFranchissementZero, 'doit signaler un passage sous 0');
  assert.equal(res.premierFranchissementZero.date, '2026-09-20');
  assert.ok(res.premierFranchissementDecouvert, 'doit signaler un passage sous le decouvert autorise (-500)');
  assert.equal(res.premierFranchissementDecouvert.montantACouvrir, 149.75);
  assert.equal(res.soldeMinimum, -649.75);
  assert.equal(res.dateSoldeMinimum, '2026-09-20');
  assert.ok(res.soldeFinal > 0, 'la paie doit ramener le solde au positif');
});
