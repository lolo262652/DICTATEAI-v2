export class AuthModal {
  private modal: HTMLElement;
  private isSignUp: boolean = false;

  constructor() {
    this.modal = this.createModal();
    document.body.appendChild(this.modal);
  }

  private createModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'auth-modal';
    modal.innerHTML = `
      <div class="auth-modal-content">
        <div class="auth-modal-header">
          <div class="app-logo-container">
            <h1 class="app-logo">DICTATEAI</h1>
            <div class="app-logo-subtitle">Intelligence Artificielle de Dictée</div>
          </div>
          <h2 id="authTitle">Connexion</h2>
          <p id="authSubtitle">Connectez-vous pour accéder à vos enregistrements</p>
        </div>
        <div class="auth-modal-body">
          <form id="authForm">
            <input 
              type="email" 
              id="emailInput" 
              placeholder="Email"
              required
            />
            <input 
              type="password" 
              id="passwordInput" 
              placeholder="Mot de passe"
              required
            />
            <button type="submit" id="authSubmit" class="auth-submit-btn">
              <i class="fas fa-sign-in-alt"></i>
              <span id="authButtonText">Se connecter</span>
            </button>
          </form>
          <div class="auth-toggle">
            <p>
              <span id="authToggleText">Pas de compte ?</span>
              <button type="button" id="authToggleBtn" class="auth-toggle-btn">
                <span id="authToggleBtnText">Créer un compte</span>
              </button>
            </p>
          </div>
          <div id="authError" class="auth-error" style="display: none;"></div>
          <div id="authSuccess" class="auth-success" style="display: none;"></div>
        </div>
      </div>
    `;

    // Add event listeners
    const form = modal.querySelector('#authForm') as HTMLFormElement;
    const toggleBtn = modal.querySelector('#authToggleBtn') as HTMLButtonElement;

    form.addEventListener('submit', this.handleSubmit.bind(this));
    toggleBtn.addEventListener('click', this.toggleMode.bind(this));

    return modal;
  }

  private async handleSubmit(e: Event) {
    e.preventDefault();
    
    const email = (document.getElementById('emailInput') as HTMLInputElement).value;
    const password = (document.getElementById('passwordInput') as HTMLInputElement).value;
    const errorDiv = document.getElementById('authError') as HTMLElement;
    const successDiv = document.getElementById('authSuccess') as HTMLElement;
    const submitBtn = document.getElementById('authSubmit') as HTMLButtonElement;

    // Clear previous messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    // Show loading state
    submitBtn.disabled = true;
    const originalContent = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Chargement...</span>';

    try {
      const { AuthService } = await import('../lib/auth');
      
      let result;
      if (this.isSignUp) {
        result = await AuthService.signUp(email, password);
      } else {
        result = await AuthService.signIn(email, password);
      }

      if (result.error) {
        let errorMessage = result.error.message;
        
        // Provide more user-friendly error messages
        if (result.error.message.includes('Invalid login credentials')) {
          if (this.isSignUp) {
            errorMessage = 'Erreur lors de la création du compte. Vérifiez vos informations.';
          } else {
            errorMessage = 'Email ou mot de passe incorrect. Avez-vous créé un compte ?';
          }
        } else if (result.error.message.includes('User already registered')) {
          errorMessage = 'Un compte existe déjà avec cet email. Essayez de vous connecter.';
        } else if (result.error.message.includes('Password should be at least')) {
          errorMessage = 'Le mot de passe doit contenir au moins 6 caractères.';
        } else if (result.error.message.includes('Invalid email')) {
          errorMessage = 'Format d\'email invalide.';
        }

        errorDiv.textContent = errorMessage;
        errorDiv.style.display = 'block';
      } else {
        if (this.isSignUp) {
          successDiv.textContent = 'Compte créé avec succès ! Vous pouvez maintenant vous connecter.';
          successDiv.style.display = 'block';
          
          // Switch to sign in mode after successful sign up
          setTimeout(() => {
            this.isSignUp = false;
            this.toggleMode();
            successDiv.style.display = 'none';
          }, 2000);
        } else {
          this.hide();
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      errorDiv.textContent = 'Une erreur de connexion est survenue. Vérifiez votre connexion internet.';
      errorDiv.style.display = 'block';
    } finally {
      // Restore button state
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalContent;
    }
  }

  private toggleMode() {
    this.isSignUp = !this.isSignUp;
    
    const title = document.getElementById('authTitle') as HTMLElement;
    const subtitle = document.getElementById('authSubtitle') as HTMLElement;
    const buttonText = document.getElementById('authButtonText') as HTMLElement;
    const toggleText = document.getElementById('authToggleText') as HTMLElement;
    const toggleBtnText = document.getElementById('authToggleBtnText') as HTMLElement;
    const submitBtn = document.getElementById('authSubmit') as HTMLElement;

    if (this.isSignUp) {
      title.textContent = 'Créer un compte';
      subtitle.textContent = 'Créez votre compte pour commencer';
      buttonText.textContent = 'Créer un compte';
      toggleText.textContent = 'Déjà un compte ?';
      toggleBtnText.textContent = 'Se connecter';
      submitBtn.innerHTML = '<i class="fas fa-user-plus"></i><span>Créer un compte</span>';
    } else {
      title.textContent = 'Connexion';
      subtitle.textContent = 'Connectez-vous pour accéder à vos enregistrements';
      buttonText.textContent = 'Se connecter';
      toggleText.textContent = 'Pas de compte ?';
      toggleBtnText.textContent = 'Créer un compte';
      submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i><span>Se connecter</span>';
    }

    // Clear messages
    const errorDiv = document.getElementById('authError') as HTMLElement;
    const successDiv = document.getElementById('authSuccess') as HTMLElement;
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
  }

  show() {
    this.modal.style.display = 'flex';
    setTimeout(() => {
      (document.getElementById('emailInput') as HTMLInputElement).focus();
    }, 100);
  }

  hide() {
    this.modal.style.display = 'none';
  }
}