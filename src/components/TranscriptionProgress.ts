export class TranscriptionProgress {
  private container: HTMLElement;
  private isVisible: boolean = false;
  private currentStep: number = 0;
  private onCancel?: () => void;

  constructor() {
    this.container = this.createContainer();
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'transcription-progress';
    container.innerHTML = `
      <div class="transcription-progress-icon">
        <i class="fas fa-microphone-alt"></i>
      </div>
      <h3 class="transcription-progress-title">Traitement en cours</h3>
      <p class="transcription-progress-message">
        Veuillez patienter pendant que nous traitons votre enregistrement...
      </p>
      
      <div class="transcription-progress-steps">
        <div class="transcription-step" data-step="0">
          <div class="transcription-step-icon">
            <i class="fas fa-upload"></i>
          </div>
          <span>Téléversement de l'audio</span>
        </div>
        <div class="transcription-step" data-step="1">
          <div class="transcription-step-icon">
            <i class="fas fa-brain"></i>
          </div>
          <span>Transcription par IA</span>
        </div>
        <div class="transcription-step" data-step="2">
          <div class="transcription-step-icon">
            <i class="fas fa-file-alt"></i>
          </div>
          <span>Génération du titre</span>
        </div>
        <div class="transcription-step" data-step="3">
          <div class="transcription-step-icon">
            <i class="fas fa-list"></i>
          </div>
          <span>Création du résumé</span>
        </div>
        <div class="transcription-step" data-step="4">
          <div class="transcription-step-icon">
            <i class="fas fa-edit"></i>
          </div>
          <span>Rédaction de la note détaillée</span>
        </div>
      </div>

      <div class="transcription-progress-bar">
        <div class="transcription-progress-fill"></div>
      </div>

      <button class="transcription-progress-cancel" id="transcriptionCancelBtn">
        Annuler
      </button>
    `;

    // Add event listeners
    const cancelBtn = container.querySelector('#transcriptionCancelBtn') as HTMLButtonElement;
    cancelBtn.addEventListener('click', () => {
      if (this.onCancel) {
        this.onCancel();
      }
      this.hide();
    });

    return container;
  }

  show(onCancel?: () => void): void {
    this.onCancel = onCancel;
    this.currentStep = 0;
    this.updateProgress();
    
    document.body.appendChild(this.container);
    
    // Trigger entrance animation
    setTimeout(() => {
      this.container.classList.add('visible');
      this.isVisible = true;
    }, 10);
  }

  hide(): void {
    if (!this.isVisible) return;
    
    this.container.classList.remove('visible');
    this.isVisible = false;
    
    setTimeout(() => {
      if (this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
    }, 300);
  }

  setStep(step: number, message?: string): void {
    this.currentStep = step;
    this.updateProgress();
    
    if (message) {
      const messageElement = this.container.querySelector('.transcription-progress-message') as HTMLElement;
      messageElement.textContent = message;
    }
  }

  private updateProgress(): void {
    const steps = this.container.querySelectorAll('.transcription-step');
    const progressFill = this.container.querySelector('.transcription-progress-fill') as HTMLElement;
    
    // Update step states
    steps.forEach((step, index) => {
      const stepElement = step as HTMLElement;
      stepElement.classList.remove('active', 'completed');
      
      if (index < this.currentStep) {
        stepElement.classList.add('completed');
      } else if (index === this.currentStep) {
        stepElement.classList.add('active');
      }
    });
    
    // Update progress bar
    const progress = Math.min(100, (this.currentStep / (steps.length - 1)) * 100);
    progressFill.style.width = `${progress}%`;
  }

  updateStepMessage(step: number, message: string): void {
    const stepElement = this.container.querySelector(`[data-step="${step}"] span`) as HTMLElement;
    if (stepElement) {
      stepElement.textContent = message;
    }
  }

  setError(message: string): void {
    const messageElement = this.container.querySelector('.transcription-progress-message') as HTMLElement;
    const icon = this.container.querySelector('.transcription-progress-icon i') as HTMLElement;
    
    messageElement.textContent = message;
    messageElement.style.color = 'var(--color-recording)';
    icon.className = 'fas fa-exclamation-triangle';
    
    // Change cancel button to "Fermer"
    const cancelBtn = this.container.querySelector('#transcriptionCancelBtn') as HTMLButtonElement;
    cancelBtn.textContent = 'Fermer';
  }

  setSuccess(message: string): void {
    const messageElement = this.container.querySelector('.transcription-progress-message') as HTMLElement;
    const icon = this.container.querySelector('.transcription-progress-icon i') as HTMLElement;
    
    messageElement.textContent = message;
    messageElement.style.color = 'var(--color-success)';
    icon.className = 'fas fa-check-circle';
    
    // Auto-hide after success
    setTimeout(() => {
      this.hide();
    }, 2000);
  }
}