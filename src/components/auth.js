import { AuthModal } from './AuthModal.js';
import { supabase } from './supabase.js';

export const AuthService = {
  async signIn(email, password) {
    return await supabase.auth.signInWithPassword({ email, password });
  },

  async signUp(email, password) {
    return await supabase.auth.signUp({ email, password });
  },

  async insertProfile(userId, profile) {
    return await supabase.from('profiles').insert({ ...profile, user_id: userId });
  }
};
document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.getElementById('openAuthModal');
  const authModal = new AuthModal();

  openBtn.addEventListener('click', () => {
    authModal.show();
  });
});
