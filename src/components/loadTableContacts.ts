import { supabase } from '../lib/supabase.js';

let editingContactId = null;

function showContactMessage(message, type = 'info') {
  const existing = document.getElementById('messagePopup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'messagePopup';
  popup.style.position = 'fixed';
  popup.style.top = '20px';
  popup.style.right = '20px';
  popup.style.padding = '12px 20px';
  popup.style.backgroundColor = type === 'error' ? 'red' : 'green';
  popup.style.color = 'white';
  popup.style.borderRadius = '4px';
  popup.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
  popup.style.zIndex = 3000;
  popup.textContent = message;
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 3000);
}

document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });

  document.querySelector('input[name="photo"]')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const preview = document.getElementById('photoPreview');
      preview.src = URL.createObjectURL(file);
      preview.style.display = 'block';
    }
  });

  loadContacts();
});

async function uploadPhoto(file, userId) {
  const ext = file.name.split('.').pop();
  const filePath = `${userId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase
    .storage
    .from('photo-contact')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    throw new Error('Erreur upload image : ' + uploadError.message);
  }

  const { data: publicData } = supabase.storage
    .from('photo-contact')
    .getPublicUrl(filePath);

  return publicData.publicUrl;
}

document.getElementById('addContactForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  const prenom = formData.get('prenom')?.toString().trim();
  const nom = formData.get('nom')?.toString().trim();
  const societe = formData.get('societe')?.toString().trim();
  const email = formData.get('email')?.toString().trim();
  const photoFile = formData.get('photo');

  if (!prenom || !nom || !email) {
    showContactMessage('Champs obligatoires manquants.', 'error');
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  const userId = session.user.id;

  let photo_url = '';
  if (photoFile && photoFile instanceof File && photoFile.size > 0) {
    try {
      photo_url = await uploadPhoto(photoFile, userId);
    } catch (err) {
      showContactMessage(err.message, 'error');
      return;
    }
  }

  const contact = {
    nom,
    prenom,
    societe,
    email,
    user_id: userId,
    ...(photo_url && { photo_url })  // inclure seulement si défini
  };

  if (editingContactId) {
    const { error } = await supabase
      .from('contacts')
      .update(contact)
      .eq('id', editingContactId);

    if (error) showContactMessage('Erreur mise à jour : ' + error.message, 'error');
    else showContactMessage('Contact mis à jour.', 'success');

    editingContactId = null;
    form.querySelector('button').textContent = 'Ajouter';
  } else {
    const { error } = await supabase
      .from('contacts')
      .insert(contact);

    if (error) showContactMessage('Erreur ajout : ' + error.message, 'error');
    else showContactMessage('Contact ajouté.', 'success');
  }

  form.reset();
  document.getElementById('photoPreview').style.display = 'none';
  loadContacts();
});

async function loadContacts() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', session.user.id);

  const tbody = document.getElementById('contactTableBody');
  if (!tbody) return;

  if (error || !contacts) {
    tbody.innerHTML = '<tr><td colspan="6">Erreur chargement des contacts</td></tr>';
    return;
  }

  if (contacts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">Aucun contact trouvé.</td></tr>';
    return;
  }

  tbody.innerHTML = contacts.map(c => `
    <tr>
      <td><img class="photo" src="${c.photo_url || 'https://via.placeholder.com/40'}" alt="photo" width="40" height="40" /></td>
      <td>${c.prenom}</td>
      <td>${c.nom}</td>
      <td>${c.societe || ''}</td>
      <td><a href="mailto:${c.email}">${c.email}</a></td>
      <td class="actions">
        <button class="btn-edit" data-id="${c.id}" title="Modifier"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-delete" data-id="${c.id}" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const { data: contact } = await supabase.from('contacts').select('*').eq('id', id).single();
      if (!contact) {
        showContactMessage('Erreur chargement contact.', 'error');
        return;
      }

      const form = document.getElementById('addContactForm');
      form.prenom.value = contact.prenom;
      form.nom.value = contact.nom;
      form.societe.value = contact.societe || '';
      form.email.value = contact.email;
      editingContactId = contact.id;
      form.querySelector('button').textContent = 'Enregistrer';

      const preview = document.getElementById('photoPreview');
      preview.src = contact.photo_url || '';
      preview.style.display = contact.photo_url ? 'block' : 'none';

      document.querySelector('.tab[data-tab="add"]').click();
    });
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      

      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) showContactMessage('Erreur suppression : ' + error.message, 'error');
      else {
        showContactMessage('Contact supprimé avec succès.', 'success');
        loadContacts();
      }
    });
  });
}
