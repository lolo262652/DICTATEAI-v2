import { supabase } from '../lib/supabase';

let editingContactId = null;

export async function renderContactModal() {
  const modal = document.getElementById('contactModalContainer');
  if (!modal) return;

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session || !session.user) {
    alert('Vous devez être connecté pour gérer vos contacts.');
    return;
  }

  const currentUserId = session.user.id;

  modal.innerHTML = `
    <div id="contactModalOverlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 9998;"></div>
    <div id="contactModalContent" style="position: fixed; top: 50px; right: 50px; width: 350px; max-height: 90vh; background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); padding: 20px; z-index: 9999; overflow-y: auto; font-family: Arial, sans-serif;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h2 style="margin: 0; font-size: 1.2rem;">Mes Contacts</h2>
        <button id="closeContactModal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
      </div>
      <input id="contactSearchInput" type="text" placeholder="Rechercher..." autocomplete="off" style="width: 100%; padding: 8px; margin: 15px 0; border-radius: 8px; border: 1px solid #ccc;">
      <form id="addContactForm" style="display: flex; flex-direction: column; gap: 10px;">
        <input type="text" name="nom" placeholder="Nom" required autocomplete="family-name" style="padding: 8px; border-radius: 8px; border: 1px solid #ccc;">
        <input type="text" name="prenom" placeholder="Prénom" required autocomplete="given-name" style="padding: 8px; border-radius: 8px; border: 1px solid #ccc;">
        <input type="text" name="societe" placeholder="Société" autocomplete="organization" style="padding: 8px; border-radius: 8px; border: 1px solid #ccc;">
        <input type="email" name="email" placeholder="Email" required autocomplete="email" style="padding: 8px; border-radius: 8px; border: 1px solid #ccc;">
        <input type="url" name="photo_url" placeholder="URL de la photo (optionnel)" style="padding: 8px; border-radius: 8px; border: 1px solid #ccc;">
        <button type="submit" style="padding: 10px; border-radius: 8px; background-color: #007bff; color: white; font-weight: bold; border: none; cursor: pointer;">Ajouter</button>
      </form>
  <div id="contactList" style="margin-top: 15px; padding-bottom: 20px; overflow-y: auto; max-height: 300px;"></div>

    </div>
  `;

  document.getElementById('closeContactModal')?.addEventListener('click', () => modal.style.display = 'none');
  document.getElementById('contactModalOverlay')?.addEventListener('click', () => modal.style.display = 'none');
  document.getElementById('contactModalContent')?.addEventListener('click', e => e.stopPropagation());

  const form = document.getElementById('addContactForm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    const contact = {
      nom: formData.get('nom')?.toString().trim(),
      prenom: formData.get('prenom')?.toString().trim(),
      societe: formData.get('societe')?.toString().trim(),
      email: formData.get('email')?.toString().trim(),
      photo_url: formData.get('photo_url')?.toString().trim()
    };

    if (!contact.nom || !contact.prenom || !contact.email) {
      alert('Tous les champs obligatoires doivent être remplis.');
      return;
    }

    if (editingContactId) {
      const { error } = await supabase.from('contacts').update(contact).eq('id', editingContactId);
      if (error) alert('Erreur mise à jour : ' + error.message);
      else alert('Contact mis à jour.');
      editingContactId = null;
      form.querySelector('button[type="submit"]').textContent = 'Ajouter';
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      const user_id = session?.user?.id;
      const { error } = await supabase.from('contacts').insert({ ...contact, user_id });
      if (error) alert('Erreur ajout : ' + error.message);
      else alert('Contact ajouté !');
    }

    form.reset();
    await loadContacts(currentUserId, document.getElementById('contactSearchInput').value.trim());
  });

  const searchInput = document.getElementById('contactSearchInput');
  searchInput?.addEventListener('input', () => loadContacts(currentUserId, searchInput.value.trim()));

  await loadContacts(currentUserId, '');
  modal.style.display = 'block';
}

async function loadContacts(userId, searchTerm) {
  const listEl = document.getElementById('contactList');
  if (!listEl) return;

  let query = supabase.from('contacts').select('*').eq('user_id', userId);
  if (searchTerm) query = query.or(`nom.ilike.%${searchTerm}%,prenom.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
  const { data, error } = await query;

  if (error || !data) {
    listEl.textContent = 'Erreur chargement des contacts';
    return;
  }

  listEl.innerHTML = data.map(c => `
    <div class="contact-card" style="padding: 10px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 8px; background: #f9f9f9; display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; gap: 10px; align-items: center;">
        <img src="${c.photo_url || 'https://via.placeholder.com/40'}" alt="photo" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
        <div>
          <strong>${c.prenom} ${c.nom}</strong><br>
          <span style="color: #555; font-size: 0.85rem;">${c.societe || ''}</span><br>
          <a href="mailto:${c.email}" style="font-size: 0.85rem;">${c.email}</a>
        </div>
      </div>
      <div style="display: flex; gap: 10px;">
        <button class="btn-edit-contact" data-id="${c.id}" title="Modifier" style="background: none; border: none; font-size: 1.2rem; cursor: pointer;"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-delete-contact" data-id="${c.id}" title="Supprimer" style="background: none; border: none; font-size: 1.2rem; cursor: pointer;"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.btn-edit-contact').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = e.currentTarget.getAttribute('data-id');
      if (!id) return;
      const { data: contact, error } = await supabase.from('contacts').select('*').eq('id', id).single();
      if (error || !contact) {
        alert('Erreur chargement contact.');
        return;
      }

      editingContactId = contact.id;
      const form = document.getElementById('addContactForm');
      form.nom.value = contact.nom;
      form.prenom.value = contact.prenom;
      form.societe.value = contact.societe || '';
      form.email.value = contact.email;
      form.photo_url.value = contact.photo_url || '';
      form.querySelector('button[type="submit"]').textContent = 'Enregistrer';
    });
  });

  document.querySelectorAll('.btn-delete-contact').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = e.currentTarget.getAttribute('data-id');
      if (!id) return;
      if (confirm('Voulez-vous vraiment supprimer ce contact ?')) {
        const { error } = await supabase.from('contacts').delete().eq('id', id);
        if (error) alert('Erreur suppression : ' + error.message);
        else await loadContacts(userId, document.getElementById('contactSearchInput').value.trim());
      }
    });
  });
}