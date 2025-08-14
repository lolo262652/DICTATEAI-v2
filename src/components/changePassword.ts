import { supabase } from '../lib/supabase'; // instanciation Supabase

const passwordForm = document.getElementById('passwordForm');

  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value.trim();
    const newPassword = document.getElementById('newPassword').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();

    //  Vérifications de base
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert("Tous les champs sont obligatoires.");
      return;
    }

    if (newPassword.length < 6) {
      alert("Le nouveau mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Le mot de passe de confirmation ne correspond pas.");
      return;
    }

    if (currentPassword === newPassword) {
      alert("Le nouveau mot de passe doit être différent de l'ancien.");
      return;
    }

    try {
      //  Récupérer l'email de l'utilisateur
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const email = userData?.user?.email;

      if (!email) {
        alert("Utilisateur non connecté.");
        return;
      }

      //  Vérifier l'ancien mot de passe via re-login
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword
      });

      if (signInError) {
        alert("Mot de passe actuel incorrect.");
        return;
      }

      //  Mise à jour du mot de passe
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        if (updateError.message === "New password should be different from the old password.") {
          alert("Le nouveau mot de passe est identique à l'ancien. Aucun changement effectué.");
          return;
        }

        alert("Erreur lors du changement de mot de passe : " + updateError.message);
        return;
      }

      //  Succès
      alert("Mot de passe mis à jour avec succès !");
      passwordForm.reset();

    } catch (err) {
      console.error("Erreur inattendue :", err);
      alert("Une erreur inattendue s'est produite.");
    }
  });