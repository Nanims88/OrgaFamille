// Connecté au projet Supabase "Organisation Famille"
const SUPABASE_URL = "https://ycmmogllnkwbwaacrsme.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljbW1vZ2xsbmt3YndhYWNyc21lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMDUwOTksImV4cCI6MjEwNDg4MTA5OX0.ShRBIuImtuC7e--N084VTW8D7glr-dSv6l3fW4frfYs";

// Authentification : chacun se connecte avec un vrai compte Supabase Auth (email + mot
// de passe), pas de hash local ni de mot de passe en clair dans le code. C'est cette
// session authentifiee qui satisfait les regles RLS cote base de donnees.
// Pour ajouter quelqu'un ou changer un mot de passe : Supabase > Authentication > Users.
