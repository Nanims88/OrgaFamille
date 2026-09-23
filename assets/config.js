// Connecté au projet Supabase "Organisation Famille"
const SUPABASE_URL = "https://ycmmogllnkwbwaacrsme.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljbW1vZ2xsbmt3YndhYWNyc21lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMDUwOTksImV4cCI6MjEwNDg4MTA5OX0.ShRBIuImtuC7e--N084VTW8D7glr-dSv6l3fW4frfYs";

// Authentification famille : un seul compte Supabase Auth partage par toute la famille
// (pas de hash local ni de mot de passe en clair dans le code). C'est cet identifiant
// authentifie qui satisfait les regles RLS cote base de donnees.
// Pour changer le mot de passe : Supabase > Authentication > Users > cet utilisateur > "Reset password".
const FAMILLE_AUTH_EMAIL = "famille@orgafamille.local";
