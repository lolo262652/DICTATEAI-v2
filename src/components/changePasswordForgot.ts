import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Fonction utilitaire pour afficher un message flottant (erreur ou succès)
function showFloatingMessage(message: string, type: 'error' | 'success', duration = 3500) {
  // Nettoyer les messages précédents
  const existingMsg = document.querySelector('.floating-message');
  if (existingMsg) existingMsg.remove();

  const msg = document.createElement('div');
  msg.className = `floating-message ${type}`;
  msg.textContent = message;

  Object.assign(msg.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: '10000',
    padding: '12px 20px',
    borderRadius: '6px',
    color: 'white',
    fontWeight: '600',
    fontSize: '14px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
    opacity: '0',
    transition: 'opacity 0.4s ease',
    pointerEvents: 'none',
    maxWidth: '320px',
    wordWrap: 'break-word',
  });

  // Couleurs selon le type
  if (type === 'error') {
    msg.style.backgroundColor = '#dc3545'; // rouge
  } else {
    msg.style.backgroundColor = '#28a745'; // vert
  }

  document.body.appendChild(msg);

  // Affichage animé
  requestAnimationFrame(() => {
    msg.style.opacity = '1';
    msg.style.pointerEvents = 'auto';
  });

  // Disparition automatique
  setTimeout(() => {
    msg.style.opacity = '0';
    msg.style.pointerEvents = 'none';
    setTimeout(() => msg.remove(), 400);
  }, duration);
}

document.getElementById('resetPasswordForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const newPassword = (document.getElementById('newPassword') as HTMLInputElement).value;
  const confirmPassword = (document.getElementById('confirmPassword') as HTMLInputElement).value;
  // On ne touche plus au statusEl classique, on utilise les messages flottants
  // const statusEl = document.getElementById('status');

  if (!newPassword || newPassword.length < 6) {
    showFloatingMessage('Le mot de passe doit contenir au moins 6 caractères.', 'error');
    return;
  }

  if (newPassword !== confirmPassword) {
    showFloatingMessage('Les mots de passe ne correspondent pas.', 'error');
    return;
  }

  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;

    showFloatingMessage('Mot de passe réinitialisé avec succès.', 'success');
  } catch (err: any) {
    showFloatingMessage(err.message || 'Une erreur est survenue.', 'error');
  }
});
