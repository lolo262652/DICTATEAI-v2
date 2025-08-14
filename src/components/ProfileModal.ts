import { supabase } from '../lib/supabase';

export function createProfileModal() {
  const oldModal = document.getElementById('profileModal');
  if (oldModal) oldModal.remove();

  const modal = document.createElement('div');
  modal.id = 'profileModal';
  modal.className = 'modal';
  modal.style.display = 'none';

  modal.innerHTML = `
    <style>
      .modal {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }
      .modal-content {
        background: white;
        padding: 2rem 2.5rem;
        border-radius: 10px;
        width: 500px;
        max-width: 95vw;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 6px 15px rgba(0,0,0,0.3);
        position: relative;
      }
      .modal-content h2 {
        margin: 0 0 1rem 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: bold;
      }
      label {
        font-weight: 600;
        display: block;
        margin-top: 0.7rem;
      }
      input[type="text"] {
        padding: 0.6rem 0.9rem;
        font-size: 1rem;
        border: 1.5px solid #ddd;
        border-radius: 6px;
        width: 100%;
        box-sizing: border-box;
      }
      .modal-buttons {
        margin-top: 1.3rem;
        display: flex;
        justify-content: flex-end;
        gap: 1rem;
      }
      button[type="submit"], button[type="button"] {
        padding: 0.7rem 1.4rem;
        font-weight: 600;
        border-radius: 6px;
        cursor: pointer;
        border: none;
        user-select: none;
      }
      button[type="submit"] {
        background-color: #3b82f6;
        color: white;
      }
      button[type="button"] {
        background-color: #f3f4f6;
      }
    </style>

    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="profileTitle">
      <h2 id="profileTitle">Mon Profil 
        <button id="editProfileBtn" aria-label="Modifier le profil" title="Modifier le profil" type="button">
          <i class="fa-solid fa-pen"></i>
        </button>
      </h2>
      <form id="profileForm" novalidate>
        <label for="firstNameInput">Prénom</label>
        <input type="text" id="firstNameInput" readonly />
        <label for="lastNameInput">Nom</label>
        <input type="text" id="lastNameInput" readonly />
        <label for="addressInput">Adresse complète</label>
        <input type="text" id="addressInput" readonly />
        <label for="streetInput">Rue</label>
        <input type="text" id="streetInput" readonly />
        <label for="cityInput">Ville</label>
        <input type="text" id="cityInput" readonly />
        <label for="postalCodeInput">Code Postal</label>
        <input type="text" id="postalCodeInput" readonly />
        <label for="companyInput">Société</label>
        <input type="text" id="companyInput" readonly />
        <label for="phoneInput">Téléphone</label>
        <input type="text" id="phoneInput" readonly />
        <label for="activityInput">Activité</label>
        <input type="text" id="activityInput" readonly />
        <div class="modal-buttons">
          <button type="submit" id="saveProfileBtn" disabled>Enregistrer</button>
          <button type="button" id="closeProfileBtn">Fermer</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('editProfileBtn')?.addEventListener('click', () => setFieldsEditable(true));
  document.getElementById('closeProfileBtn')?.addEventListener('click', closeProfileModal);
  document.getElementById('profileForm')?.addEventListener('submit', saveProfileChanges);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeProfileModal();
  });
}

export async function openProfileModal() {
  const modal = document.getElementById('profileModal');
  if (!modal) return;

  modal.style.display = 'flex';

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert('Utilisateur non connecté');
    return;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') {
      // Si pas de profil, créer vide
      await supabase.from('profiles').insert({ id: user.id });
      return openProfileModal();
    }
    alert('Erreur chargement profil : ' + error.message);
    return;
  }

  if (!data) return;

  const setValue = (id: string, value: string | null) => {
    const el = document.getElementById(id) as HTMLInputElement;
    if (el) el.value = value ?? '';
  };

  setValue('firstNameInput', data.first_name);
  setValue('lastNameInput', data.last_name);
  setValue('addressInput', data.address);
  setValue('streetInput', data.street);
  setValue('cityInput', data.city);
  setValue('postalCodeInput', data.postal_code);
  setValue('companyInput', data.company);
  setValue('phoneInput', data.phone);
  setValue('activityInput', data.activity);

  setFieldsEditable(false);
}

function closeProfileModal() {
  const modal = document.getElementById('profileModal');
  if (modal) modal.style.display = 'none';
}

async function saveProfileChanges(e: Event) {
  e.preventDefault();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert('Utilisateur non connecté');
    return;
  }

  const getVal = (id: string) =>
    (document.getElementById(id) as HTMLInputElement).value.trim();

  const updateData = {
    first_name: getVal('firstNameInput'),
    last_name: getVal('lastNameInput'),
    address: getVal('addressInput'),
    street: getVal('streetInput'),
    city: getVal('cityInput'),
    postal_code: getVal('postalCodeInput'),
    company: getVal('companyInput'),
    phone: getVal('phoneInput'),
    activity: getVal('activityInput'),
  };

  const { error } = await supabase.from('profiles').update(updateData).eq('id', user.id);
  if (error) {
    alert('Erreur lors de la mise à jour du profil : ' + error.message);
    return;
  }

  alert('Profil mis à jour avec succès.');
  setFieldsEditable(false);
}

function setFieldsEditable(editable: boolean) {
  const ids = [
    'firstNameInput', 'lastNameInput', 'addressInput', 'streetInput',
    'cityInput', 'postalCodeInput', 'companyInput', 'phoneInput', 'activityInput'
  ];
  ids.forEach(id => {
    const input = document.getElementById(id) as HTMLInputElement;
    if (input) input.readOnly = !editable;
  });

  const saveBtn = document.getElementById('saveProfileBtn') as HTMLButtonElement;
  saveBtn.disabled = !editable;
}
