
  import { supabase } from '../lib/supabase.js'; // adapte le chemin si besoin

  async function displayUserName() {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.warn("Utilisateur non connecté");
      return;
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error("Erreur chargement profil :", error.message);
      return;
    }

    const nameSpan = document.getElementById('userNameDisplay');
    if (nameSpan) {
      nameSpan.textContent = profile?.first_name || 'Utilisateur';
    }
  }

  document.addEventListener('DOMContentLoaded', displayUserName);
