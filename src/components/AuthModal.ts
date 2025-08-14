import { AuthService } from '../lib/auth';

export class AuthModal {
  private modal: HTMLElement;
  private isSignUp: boolean = false;
  private messageTimeoutId: number | null = null;

  constructor() {
    this.modal = this.createModal();
    document.body.appendChild(this.modal);
  }

  private createModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'auth-modal';
    modal.style.display = 'none';

    modal.innerHTML = `
      <style>
        .dark .auth-modal-content,
        .light .auth-modal-content {
          max-height: 85vh;
          overflow-y: auto;
          width: 700px;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          gap: 25px;
          background-color: var(--modal-bg, #f9f9f9);
          color: var(--modal-color, #555);
        }
        .dark .auth-modal-content {
          background-color: #121212;
          color: #f0f0f0;
        }
        .auth-modal-header {
          text-align: center;
          margin-bottom: 20px;
        }
        .signup-fields-container {
          display: flex;
          flex-wrap: wrap;
        }
        .signup-column {
          flex: 1 1 300px;
          display: flex;
          flex-direction: column;
          gap: 15px;
          padding: 10px;
        }
        textarea.form-field {
          resize: vertical;
          min-height: 70px;
        }
        input.form-field, textarea.form-field {
          padding: 12px;
          border: 1px solid #ccc;
          border-radius: 6px;
          font-size: 15px;
          box-sizing: border-box;
          width: 100%;
          background-color: var(--input-bg, white);
          color: var(--input-color, black);
        }
        .auth-submit-btn {
          width: 100%;
          padding: 14px;
          font-size: 17px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background-color 0.3s ease;
        }
        .auth-submit-btn:disabled {
          background-color: #6c757d;
          cursor: not-allowed;
        }
        .auth-toggle {
          text-align: center;
          margin-top: 15px;
        }
        .auth-toggle-btn {
          background: none;
          border: none;
          color: #007bff;
          font-weight: bold;
          cursor: pointer;
          font-size: 16px;
        }
        #forgotPasswordLink, #backToLoginLink {
          color: #007bff;
          font-size: 14px;
          cursor: pointer;
          text-decoration: underline;
          user-select: none;
        }
        /* Positionnement du lien Mot de passe oublié */
        .auth-modal-body form {
          display: flex;
          flex-direction: column;
        }
        #forgotPasswordWrapper {
          margin-top: 10px;
          align-self: flex-end;
        }
        /* Spinner animation */
        .fa-spinner {
          animation: fa-spin 1s linear infinite;
        }
        @keyframes fa-spin {
          0% { transform: rotate(0deg);}
          100% { transform: rotate(360deg);}
        }
        /* Messages flottants en haut à droite */
        .floating-message {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          padding: 12px 20px;
          border-radius: 6px;
          color: white;
          font-weight: 600;
          font-size: 14px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
          opacity: 0;
          transition: opacity 0.4s ease;
          pointer-events: none;
          max-width: 320px;
          word-wrap: break-word;
        }
        .floating-message.show {
          opacity: 1;
          pointer-events: auto;
        }
        .floating-message.error {
          background-color: #dc3545; /* rouge */
        }
        .floating-message.success {
          background-color: #28a745; /* vert */
        }
      </style>

      <div class="auth-modal-content" role="dialog" aria-modal="true">
        <div class="auth-modal-header">
          <h1 class="app-logo">DICTATEAI</h1>
          <h2 id="authTitle">Connexion</h2>
          <p id="authSubtitle">Connectez-vous pour accéder à vos enregistrements</p>
        </div>

        <div class="auth-modal-body" id="loginSection">
          <form id="authForm" novalidate>
            <div class="signup-fields-container">
              <div class="signup-column">
                <input type="text" id="signupFirstNameInput" placeholder="Prénom" class="form-field signup-field hidden" required />
                <input type="text" id="signupLastNameInput" placeholder="Nom" class="form-field signup-field hidden" required />
                <textarea id="signupAddressInput" placeholder="Adresse complète" class="form-field signup-field hidden" required></textarea>
                <input type="text" id="signupStreetInput" placeholder="Rue" class="form-field signup-field hidden" required />
              </div>
              <div class="signup-column">
                <input type="text" id="signupCityInput" placeholder="Ville" class="form-field signup-field hidden" required />
                <input type="text" id="signupPostalCodeInput" placeholder="Code Postal" class="form-field signup-field hidden" required />
                <input type="text" id="signupCompanyInput" placeholder="Société" class="form-field signup-field hidden" required />
                <input type="text" id="signupPhoneInput" placeholder="Téléphone" class="form-field signup-field hidden" required />
                <input type="text" id="signupActivityInput" placeholder="Activité" class="form-field signup-field hidden" required />
              </div>
            </div>

            <input type="email" id="emailInput" placeholder="Email" required class="form-field" autocomplete="email" />
            <input type="password" id="passwordInput" placeholder="Mot de passe" required class="form-field" autocomplete="current-password" />

            <button type="submit" id="authSubmit" class="auth-submit-btn">
                <i id="authSpinner" class="fas fa-spinner fa-spin" style="display:none;"></i>
                <span id="authButtonText"> Se connecter</span>
            </button>
            <div id="forgotPasswordWrapper">
              <a href="#" id="forgotPasswordLink">Mot de passe oublié ?</a>
            </div>
          </form>

          <div class="auth-toggle">
            <p>
              <span id="authToggleText">Pas de compte ?</span>
              <button type="button" id="authToggleBtn" class="auth-toggle-btn">
                <span id="authToggleBtnText">Créer un compte</span>
              </button>
            </p>
          </div>

          <!-- Les messages ne sont plus affichés ici, ils seront flottants -->
        </div>

        <div id="resetPasswordSection" class="auth-modal-body" style="display:none;">
          <h3 style="text-align:center;">Réinitialiser le mot de passe</h3>
          <p style="text-align:center;">Entrez votre adresse email pour recevoir un lien de réinitialisation.</p>
          <input type="email" id="resetEmailInput" placeholder="Email" required class="form-field" autocomplete="email" />
          <button type="button" id="sendResetEmailBtn" class="auth-submit-btn">Envoyer le lien</button>
          <p style="text-align:center;margin-top:10px;">
            <a href="#" id="backToLoginLink">← Retour à la connexion</a>
          </p>
          <div id="resetPasswordMsg" style="display:none;margin-top:10px;"></div>
        </div>
      </div>
    `;

    // Attach events
    const form = modal.querySelector('#authForm') as HTMLFormElement;
    const toggleBtn = modal.querySelector('#authToggleBtn') as HTMLButtonElement;
    const forgotLink = modal.querySelector('#forgotPasswordLink') as HTMLAnchorElement;
    const backToLoginLink = modal.querySelector('#backToLoginLink') as HTMLAnchorElement;
    const sendResetBtn = modal.querySelector('#sendResetEmailBtn') as HTMLButtonElement;

    form.addEventListener('submit', this.handleSubmit.bind(this));
    toggleBtn.addEventListener('click', this.toggleMode.bind(this));
    forgotLink.addEventListener('click', e => {
      e.preventDefault();
      this.toggleResetPassword(true);
    });
    backToLoginLink.addEventListener('click', e => {
      e.preventDefault();
      this.toggleResetPassword(false);
    });
    sendResetBtn.addEventListener('click', this.handlePasswordReset.bind(this));

    return modal;
  }

  private toggleResetPassword(show: boolean) {
    (this.modal.querySelector('#loginSection') as HTMLElement).style.display = show ? 'none' : 'block';
    (this.modal.querySelector('#resetPasswordSection') as HTMLElement).style.display = show ? 'block' : 'none';
    this.clearMessages();
  }

  private clearMessages() {
    // Ici on ne fait rien car messages flottants disparaissent seuls
  }

  private showFloatingMessage(message: string, type: 'error' | 'success', duration = 3500) {
    if (this.messageTimeoutId) {
      clearTimeout(this.messageTimeoutId);
      this.messageTimeoutId = null;
    }

    const msg = document.createElement('div');
    msg.className = `floating-message ${type}`;
    msg.textContent = message;
    document.body.appendChild(msg);

    // Affichage animé
    requestAnimationFrame(() => {
      msg.classList.add('show');
    });

    this.messageTimeoutId = window.setTimeout(() => {
      msg.classList.remove('show');
      setTimeout(() => msg.remove(), 400);
      this.messageTimeoutId = null;
    }, duration);
  }

  private showErrorMessage(message: string) {
    this.showFloatingMessage(message, 'error');
  }

  private showSuccessMessage(message: string) {
    this.showFloatingMessage(message, 'success');
  }

  private async handlePasswordReset() {
    const emailInput = this.modal.querySelector('#resetEmailInput') as HTMLInputElement;
    const email = emailInput.value.trim();

    if (!email) {
      this.showErrorMessage('Veuillez saisir un email.');
      return;
    }

    try {
      const { error } = await AuthService.resetPassword(email);
      if (error) {
        this.showErrorMessage('Erreur : ' + error.message);
      } else {
        this.showSuccessMessage('Lien envoyé ! Vérifiez votre email.');
      }
    } catch {
      this.showErrorMessage('Erreur inattendue.');
    }
  }

  private async handleSubmit(e: Event) {
    e.preventDefault();

    const emailInput = this.modal.querySelector('#emailInput') as HTMLInputElement;
    const passwordInput = this.modal.querySelector('#passwordInput') as HTMLInputElement;
    const submitBtn = this.modal.querySelector('#authSubmit') as HTMLButtonElement;
    const spinner = this.modal.querySelector('#authSpinner') as HTMLElement;
    const buttonText = this.modal.querySelector('#authButtonText') as HTMLElement;

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    // Clear messages no longer needed here because floating

    if (!email || !password) {
      this.showErrorMessage('Merci de renseigner email et mot de passe.');
      return;
    }

    try {
      submitBtn.disabled = true;
      spinner.style.display = 'inline-block';
      buttonText.textContent = this.isSignUp ? 'Création...' : 'Connexion...';

      if (this.isSignUp) {
        const exists = await AuthService.profileExists(email);
        if (exists) {
          this.showErrorMessage('Un compte avec cet email existe déjà.');
          return;
        }

        const result = await AuthService.signUp(email, password);
        if (result.error) {
          this.showErrorMessage(this.getFriendlyError(result.error.message));
          return;
        }

        this.showSuccessMessage('Compte créé avec succès !');
        setTimeout(() => {
          this.isSignUp = false;
          this.toggleMode();
        }, 2000);

      } else {
        const result = await AuthService.signIn(email, password);
        if (result.error) {
          this.showErrorMessage(this.getFriendlyError(result.error.message));
          return;
        }
        this.hide();
      }
    } catch (err) {
      this.showErrorMessage('Une erreur est survenue. Vérifiez votre connexion.');
      console.error(err);
    } finally {
      submitBtn.disabled = false;
      spinner.style.display = 'none';
      this.updateButtonText();
    }
  }

  private toggleMode() {
    this.isSignUp = !this.isSignUp;

    this.modal.querySelectorAll('.signup-field').forEach(el => el.classList.toggle('hidden', !this.isSignUp));

    const authTitle = this.modal.querySelector('#authTitle')!;
    const authSubtitle = this.modal.querySelector('#authSubtitle')!;
    const authButtonText = this.modal.querySelector('#authButtonText')!;
    const authToggleText = this.modal.querySelector('#authToggleText')!;
    const authToggleBtnText = this.modal.querySelector('#authToggleBtnText')!;
    const forgotPasswordLink = this.modal.querySelector('#forgotPasswordLink')!;

    if (this.isSignUp) {
      authTitle.textContent = 'Créer un compte';
      authSubtitle.textContent = 'Créez votre compte pour commencer';
      authButtonText.textContent = 'Créer un compte';
      authToggleText.textContent = 'Déjà un compte ?';
      authToggleBtnText.textContent = 'Se connecter';
      forgotPasswordLink.style.display = 'none';
    } else {
      authTitle.textContent = 'Connexion';
      authSubtitle.textContent = 'Connectez-vous pour accéder à vos enregistrements';
      authButtonText.textContent = 'Se connecter';
      authToggleText.textContent = 'Pas de compte ?';
      authToggleBtnText.textContent = 'Créer un compte';
      forgotPasswordLink.style.display = 'block';
    }
  }

  private updateButtonText() {
    const authButtonText = this.modal.querySelector('#authButtonText')!;
    authButtonText.textContent = this.isSignUp ? 'Créer un compte' : 'Se connecter';
  }

  private getFriendlyError(message: string): string {
    if (!message) return 'Erreur inconnue.';
    if (message.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.';
    if (message.includes('User already registered')) return 'Un compte existe déjà avec cet email.';
    if (message.includes('Password should be at least')) return 'Le mot de passe doit contenir au moins 6 caractères.';
    if (message.includes('Invalid email')) return "Format d'email invalide.";
    return message;
  }

  show() {
    this.modal.style.display = 'flex';
    setTimeout(() => {
      const emailInput = this.modal.querySelector('#emailInput') as HTMLInputElement | null;
      if (emailInput) emailInput.focus();
    }, 100);
  }

  hide() {
    this.modal.style.display = 'none';
  }
}
