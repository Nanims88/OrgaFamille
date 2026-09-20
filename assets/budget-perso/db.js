// Stockage 100% local (IndexedDB). Rien ne part sur un serveur : les donnees restent
// dans le navigateur de l'appareil. Un seul enregistrement "config" + des collections.

import { toISODate } from './calc.js';

const DB_NAME = 'budget-perso';
const DB_VERSION = 1;
const STORES = ['config', 'transactions', 'dettes', 'virementsHebdo', 'objectifs', 'evenements', 'reglesImport'];

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode) {
  return openDb().then(db => db.transaction(storeName, mode).objectStore(storeName));
}

export async function getAll(storeName) {
  const store = await tx(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function get(storeName, id) {
  const store = await tx(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function put(storeName, value) {
  const store = await tx(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function remove(storeName, id) {
  const store = await tx(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function nouvelId() {
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ---------- Config par defaut (tout est modifiable dans l'ecran Parametres) ----------
export const CONFIG_DEFAUT = {
  id: 'config',
  jourCycle: 25,
  revenuNetMensuel: 2030,
  seuilDecouvertAutorise: -500,
  decouvertAutorise: 500,
  tauxAgios: 21.14,
  commissionRejet: 8,
  contributionCompteJoint: 800,
  coussinCible: 400,
  coussinActuel: 0,
  epargneActuelle: 2800,
  dernierSolde: { montant: 0, date: null },
  // Tout ce qui precede cette date est neutralise : le cycle en cours continue de servir
  // de reference (dates, nb de lundis...) mais rien avant n'est compte ni a rattraper.
  dateDemarrage: null,

  categories: [
    { id: 'carburant', libelle: 'Carburant', enveloppe: true },
    { id: 'courses', libelle: 'Courses', enveloppe: true },
    { id: 'tabac', libelle: 'Tabac', enveloppe: true },
    { id: 'variable', libelle: 'Variable', enveloppe: true },
    { id: 'amazon', libelle: 'Amazon', enveloppe: true },
    { id: 'abonnements', libelle: 'Abonnements', enveloppe: false },
    { id: 'frais_bancaires', libelle: 'Frais bancaires', enveloppe: false },
    { id: '4x', libelle: 'PayPal 4X', enveloppe: false },
    { id: 'autre', libelle: 'Autre', enveloppe: false }
  ],

  chargesFixes: [
    { id: 'cf-joint', libelle: 'Compte joint', montant: 800 },
    { id: 'cf-pret-auto', libelle: 'Pret auto', montant: 138 },
    { id: 'cf-assurance-auto', libelle: 'Assurance auto', montant: 67 },
    { id: 'cf-telephone', libelle: 'Telephone', montant: 16 },
    { id: 'cf-banque', libelle: 'Frais bancaires', montant: 12 },
    { id: 'cf-sante', libelle: 'Sante + abonnements', montant: 70 },
    { id: 'cf-lcr', libelle: 'LCR achats maison (employeur)', montant: 100, plafond: true },
    { id: 'cf-izicarte', libelle: 'Izicarte', montant: 41, jusquauSolde: true }
  ],

  enveloppe: {
    carburant: { kmAR: 80, joursTravailles: 5, conso100: 6, prixL: 2.15 },
    coursesMensuel: 110,
    tabacMensuel: 150,
    variableMensuel: 258
  },

  affectationBonus: { partPretAuto: 0.6, partLivret: 0.4, montantNoel: 400 },

  objectifs: [
    { id: 'obj-rejets', libelle: '0 rejet par cycle', type: 'compteur', cible: 0 },
    { id: 'obj-coussin', libelle: 'Coussin permanent', type: 'montant', cible: 400 },
    { id: 'obj-izicarte', libelle: 'Izicarte a 0', type: 'date', cible: '2026-11-30' },
    { id: 'obj-pret-auto', libelle: 'Pret auto solde', type: 'date', cible: '2029-03-31' },
    { id: 'obj-epargne', libelle: 'Epargne >= 3000 EUR', type: 'montant', cible: 3000, echeance: '2027-09-30' },
    { id: 'obj-tabac', libelle: 'Tabac <= 150 EUR/mois', type: 'plafondMensuel', cible: 150, categorie: 'tabac' },
    { id: 'obj-frais-bancaires', libelle: 'Frais bancaires ~12 EUR/mois', type: 'plafondMensuel', cible: 12, categorie: 'frais_bancaires' }
  ]
};

export const DETTES_DEFAUT = [
  {
    id: 'dette-izicarte', nom: 'Izicarte (credit renouvelable)', type: 'renouvelable',
    capitalInitial: 1000, capitalRestant: 1000, tauxAnnuel: 15.9, mensualite: 41,
    note: 'TAEG a ajuster entre 8,55 % et 23,40 % selon le contrat reel.'
  },
  {
    id: 'dette-pret-auto', nom: 'Pret auto', type: 'amortissable',
    capitalInitial: 6905, capitalRestant: 6905, tauxAnnuel: 6.44, mensualite: 138
  },
  {
    id: 'dette-paypal-4x', nom: 'PayPal 4X (5 plans en cours)', type: 'echeancier',
    capitalRestant: 162.25,
    echeances: [
      { date: dateDuMois(2026, 10), montant: 84.16 },
      { date: dateDuMois(2026, 11), montant: 67.59 },
      { date: dateDuMois(2026, 12), montant: 10.50 }
    ]
  }
];

function dateDuMois(annee, mois) {
  return `${annee}-${String(mois).padStart(2, '0')}-25`;
}

export const REGLES_IMPORT_DEFAUT = [
  { id: 'regle-tabac', motif: 'BURALISTE|TABAC|CHEZ FRED|DELICES DU TERR|COCOPV', categorie: 'tabac' },
  { id: 'regle-carburant', motif: 'DAC VL E LECLER', categorie: 'carburant' },
  { id: 'regle-courses', motif: 'LIDL|AUCHAN|INTERMARCHE', categorie: 'courses' },
  { id: 'regle-amazon', motif: 'AMAZON', categorie: 'amazon' },
  { id: 'regle-4x', motif: 'PAYPAL \\*Paiemen', categorie: '4x' },
  { id: 'regle-abonnements', motif: 'ANTHROPIC|APPLE\\.COM|GOOGLE|MICROSO', categorie: 'abonnements' },
  { id: 'regle-frais-bancaires', motif: 'COMMISSION INTERVENTION|OFFRE CONFORT', categorie: 'frais_bancaires' }
];

export async function initialiserSiVide() {
  const config = await get('config', 'config');
  if (!config) {
    await put('config', { ...CONFIG_DEFAUT, dateDemarrage: toISODate(new Date()) });
  }
  const dettes = await getAll('dettes');
  if (!dettes.length) {
    for (const d of DETTES_DEFAUT) await put('dettes', d);
  }
  const regles = await getAll('reglesImport');
  if (!regles.length) {
    for (const r of REGLES_IMPORT_DEFAUT) await put('reglesImport', r);
  }
}

export async function getConfig() {
  const config = (await get('config', 'config')) || CONFIG_DEFAUT;
  if (!config.dateDemarrage) {
    config.dateDemarrage = toISODate(new Date());
    await sauverConfig(config);
  }
  return config;
}

export async function sauverConfig(config) {
  config.id = 'config';
  await put('config', config);
}

export async function exporterTout() {
  const data = {};
  for (const store of STORES) data[store] = await getAll(store);
  return data;
}

export async function importerTout(data) {
  for (const store of STORES) {
    if (!Array.isArray(data[store])) continue;
    for (const item of data[store]) await put(store, item);
  }
}
