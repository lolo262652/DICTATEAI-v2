import { supabase } from '../lib/supabase';

let editingContactId = null;

function displayContactMessage(message, type = 'info') {
  const el = document.getElementById('contactMessage');
  if (!el) return;
  el.textContent = message;
  el.className = `message-area ${type}`;
  setTimeout(() => {
    el.textContent = '';
    el.className = 'message-area';
  }, 5000);
}

export async function renderContactModal() {
  const modal = document.getElementById('contactModalContainer');
  if (!modal) return;

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session || !session.user) {
    displayContactMessage('Vous devez être connecté pour gérer vos contacts.', 'error');
    return;
  }

  const currentUserId = session.user.id;

  modal.innerHTML = `
    <div id="contactModalOverlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 9998;"></div>
    <div id="contactModalContent" style="position: fixed; top: 50px; right: 50px; width: 350px; max-height: 90vh; background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); padding: 20px; z-index: 9999; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h2 style="margin: 0; font-size: 1.2rem;">Mes Contacts</h2>
        <button id="closeContactModal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
      </div>
      <input id="contactSearchInput" type="text" placeholder="Rechercher..." style="width: 100%; padding: 8px; margin: 15px 0; border-radius: 8px; border: 1px solid #ccc;">
      <form id="addContactForm" style="display: flex; flex-direction: column; gap: 10px;">
        <input type="text" name="nom" placeholder="Nom" required>
        <input type="text" name="prenom" placeholder="Prénom" required>
        <input type="text" name="societe" placeholder="Société">
        <input type="email" name="email" placeholder="Email" required>
        <input type="url" name="photo_url" placeholder="URL de la photo (optionnel)">
        <button type="submit">Ajouter</button>
      </form>
      <div id="contactMessage" class="message-area"></div>
      <div id="contactList" style="margin-top: 15px;"></div>
    </div>
  `;

  // Fermeture de la modal
  document.getElementById('closeContactModal')?.addEventListener('click', () => modal.style.display = 'none');
  document.getElementById('contactModalOverlay')?.addEventListener('click', () => modal.style.display = 'none');

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
      displayContactMessage('Champs obligatoires manquants.', 'error');
      return;
    }

    if (editingContactId) {
      const { error } = await supabase.from('contacts').update(contact).eq('id', editingContactId);
      if (error) {
        displayContactMessage('Erreur mise à jour : ' + error.message, 'error');
      } else {
        displayContactMessage('Contact mis à jour.', 'success');
        editingContactId = null;
        form.querySelector('button[type="submit"]').textContent = 'Ajouter';
      }
    } else {
      const user_id = session.user.id;
      const { error } = await supabase.from('contacts').insert({ ...contact, user_id });
      if (error) {
        displayContactMessage('Erreur ajout : ' + error.message, 'error');
      } else {
        displayContactMessage('Contact ajouté !', 'success');
      }
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
  if (searchTerm) {
    query = query.or(`nom.ilike.%${searchTerm}%,prenom.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
  }

  const { data, error } = await query;

  if (error || !data) {
    listEl.innerHTML = `<p class="message-area error">Erreur chargement des contacts</p>`;
    return;
  }

  listEl.innerHTML = data.map(c => `
    <div style="padding: 10px; border: 1px solid #ccc; border-radius: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; gap: 10px; align-items: center;">
        <img src="${c.photo_url || 'https://via.placeholder.com/40'}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
        <div>
          <strong>${c.prenom} ${c.nom}</strong><br>
          <small>${c.societe || ''}</small><br>
          <a href="mailto:${c.email}">${c.email}</a>
        </div>
      </div>
      <div>
        <button class="btn-edit-contact" data-id="${c.id}">✏️</button>
        <button class="btn-delete-contact" data-id="${c.id}">🗑️</button>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.btn-edit-contact').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!id) return;

      const { data: contact, error } = await supabase.from('contacts').select('*').eq('id', id).single();
      if (error || !contact) {
        displayContactMessage('Erreur chargement contact.', 'error');
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

  document.querySelectorAll('.btn-delete-contact').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!id) return;

      if (confirm('Supprimer ce contact ?')) {
        const { error } = await supabase.from('contacts').delete().eq('id', id);
        if (error) {
          displayContactMessage('Erreur suppression : ' + error.message, 'error');
        } else {
          displayContactMessage('Contact supprimé.', 'success');
          await loadContacts(userId, document.getElementById('contactSearchInput').value.trim());
        }
      }
    });
  });
}
