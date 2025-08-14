import { supabase } from '../lib/supabase';

function showGlobalMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const area = document.getElementById('globalMessageArea');
  if (!area) return;

  const msg = document.createElement('div');
  msg.className = `message-area ${type}`;
  msg.style.position = 'fixed';
  msg.style.top = '20px';
  msg.style.right = '20px';
  msg.style.padding = '12px 20px';
  msg.style.backgroundColor = type === 'error' ? 'var(--color-recording)' : (type === 'success' ? 'var(--color-success)' : 'var(--color-success)');
  msg.style.color = 'white';
  msg.style.borderRadius = '4px';
  msg.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
  msg.style.zIndex = 3000;
  msg.textContent = message;

  area.appendChild(msg);

  setTimeout(() => {
    msg.remove();
  }, 5000);
}

async function loadProfile() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    showGlobalMessage("Utilisateur non connecté", "error");
    return;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    showGlobalMessage("Erreur chargement profil : " + error.message, "error");
    return;
  }

  document.getElementById('viewFirstName')!.innerText = profile.first_name || '';
  document.getElementById('viewLastName')!.innerText = profile.last_name || '';
  document.getElementById('viewEmail')!.innerText = user.email || '';
  document.getElementById('viewAddress')!.innerText = profile.address || '';
  document.getElementById('viewStreet')!.innerText = profile.street || '';
  document.getElementById('viewCity')!.innerText = profile.city || '';
  document.getElementById('viewPostalCode')!.innerText = profile.postal_code || '';
  document.getElementById('viewCompany')!.innerText = profile.company || '';
  document.getElementById('viewPhone')!.innerText = profile.phone || '';
  document.getElementById('viewActivity')!.innerText = profile.activity || '';

  (document.getElementById('editFirstName') as HTMLInputElement).value = profile.first_name || '';
  (document.getElementById('editLastName') as HTMLInputElement).value = profile.last_name || '';
  (document.getElementById('editAddress') as HTMLInputElement).value = profile.address || '';
  (document.getElementById('editStreet') as HTMLInputElement).value = profile.street || '';
  (document.getElementById('editCity') as HTMLInputElement).value = profile.city || '';
  (document.getElementById('editPostalCode') as HTMLInputElement).value = profile.postal_code || '';
  (document.getElementById('editCompany') as HTMLInputElement).value = profile.company || '';
  (document.getElementById('editPhone') as HTMLInputElement).value = profile.phone || '';
  (document.getElementById('editActivity') as HTMLInputElement).value = profile.activity || '';
}

document.addEventListener('DOMContentLoaded', () => {
  loadProfile();

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.getAttribute("data-tab")!)!.classList.add("active");
    });
  });

  const editForm = document.getElementById('editForm')!;
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showGlobalMessage("Utilisateur non connecté", "error");
      return;
    }

    const updateData = {
      first_name: (document.getElementById('editFirstName') as HTMLInputElement).value.trim(),
      last_name: (document.getElementById('editLastName') as HTMLInputElement).value.trim(),
      address: (document.getElementById('editAddress') as HTMLInputElement).value.trim(),
      street: (document.getElementById('editStreet') as HTMLInputElement).value.trim(),
      city: (document.getElementById('editCity') as HTMLInputElement).value.trim(),
      postal_code: (document.getElementById('editPostalCode') as HTMLInputElement).value.trim(),
      company: (document.getElementById('editCompany') as HTMLInputElement).value.trim(),
      phone: (document.getElementById('editPhone') as HTMLInputElement).value.trim(),
      activity: (document.getElementById('editActivity') as HTMLInputElement).value.trim(),
    };

    const { error } = await supabase.from('profiles').update(updateData).eq('id', user.id);

    if (error) {
      showGlobalMessage("Erreur lors de la mise à jour : " + error.message, "error");
    } else {
      showGlobalMessage("Profil mis à jour !", "success");
      loadProfile();
    }
  });

  const passwordForm = document.getElementById('passwordForm')!;
  passwordForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = (document.getElementById('newPassword') as HTMLInputElement).value;

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      showGlobalMessage("Erreur changement mot de passe : " + error.message, "error");
    } else {
      showGlobalMessage("Mot de passe mis à jour !", "success");
      passwordForm.reset();
    }
  });
});
