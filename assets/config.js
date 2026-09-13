// Connecté au projet Supabase "Organisation Famille"
const SUPABASE_URL = "https://ycmmogllnkwbwaacrsme.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljbW1vZ2xsbmt3YndhYWNyc21lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMDUwOTksImV4cCI6MjEwNDg4MTA5OX0.ShRBIuImtuC7e--N084VTW8D7glr-dSv6l3fW4frfYs";

// Mot de passe famille : on ne stocke jamais le mot de passe en clair dans le code.
// Pour changer le mot de passe : ouvrir la console du navigateur sur n'importe quelle page de l'appli et taper
//   await crypto.subtle.digest('SHA-256', new TextEncoder().encode("votre_nouveau_mot_de_passe"))
//     .then(b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join(''))
// puis remplacer la valeur ci-dessous par le résultat affiché.
// Valeur actuelle = hash de "famille2026" (à changer avant mise en ligne !)
const FAMILLE_PASSWORD_HASH = "76547607c9bce205b694b471fc23440e910e7934800bd65c20118cfece1c81ca";
