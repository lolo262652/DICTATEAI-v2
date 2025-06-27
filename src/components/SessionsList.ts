import { DatabaseService } from '../lib/database';
import type { DictationSession } from '../lib/supabase';

export class SessionsList {
  private container: HTMLElement;
  private sessions: DictationSession[] = [];
  private filteredSessions: DictationSession[] = [];
  private onSessionSelect: (session: DictationSession) => void;
  private searchTerm: string = '';
  private deleteModal: HTMLElement | null = null;

  constructor(onSessionSelect: (session: DictationSession) => void) {
    this.onSessionSelect = onSessionSelect;
    this.container = this.createContainer();
    this.createDeleteModal();
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'sessions-list';
    container.innerHTML = `
      <div class="sessions-header">
        <h3>Mes Enregistrements</h3>
        <button id="refreshSessionsBtn" class="action-button" title="Actualiser">
          <i class="fas fa-refresh"></i>
        </button>
      </div>
      <div class="search-container">
        <div class="search-input-wrapper">
          <i class="fas fa-search search-icon"></i>
          <input 
            type="text" 
            id="sessionSearchInput" 
            class="search-input" 
            placeholder="Rechercher dans les notes..."
          />
          <button id="searchClearBtn" class="search-clear">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div id="searchResultsInfo" class="search-results-info" style="display: none;"></div>
      </div>
      <div class="sessions-content" id="sessionsContent">
        <div class="loading">Chargement...</div>
      </div>
    `;

    const refreshBtn = container.querySelector('#refreshSessionsBtn') as HTMLButtonElement;
    const searchInput = container.querySelector('#sessionSearchInput') as HTMLInputElement;
    const searchClearBtn = container.querySelector('#searchClearBtn') as HTMLButtonElement;

    refreshBtn.addEventListener('click', () => this.loadSessions());
    
    // Search functionality
    searchInput.addEventListener('input', (e) => {
      this.searchTerm = (e.target as HTMLInputElement).value.toLowerCase().trim();
      this.filterSessions();
      this.updateSearchUI();
    });

    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      this.searchTerm = '';
      this.filterSessions();
      this.updateSearchUI();
      searchInput.focus();
    });

    return container;
  }

  private createDeleteModal(): void {
    this.deleteModal = document.createElement('div');
    this.deleteModal.className = 'delete-confirmation-modal';
    this.deleteModal.innerHTML = `
      <div class="delete-confirmation-content">
        <div class="delete-confirmation-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3 class="delete-confirmation-title">Supprimer l'enregistrement</h3>
        <p class="delete-confirmation-message" id="deleteMessage">
          Êtes-vous sûr de vouloir supprimer cet enregistrement ? Cette action est irréversible.
        </p>
        <div class="delete-confirmation-actions">
          <button class="delete-confirmation-btn cancel" id="deleteCancelBtn">Annuler</button>
          <button class="delete-confirmation-btn confirm" id="deleteConfirmBtn">Supprimer</button>
        </div>
      </div>
    `;

    // Add to body but keep hidden
    document.body.appendChild(this.deleteModal);

    // Add event listeners once
    const cancelBtn = this.deleteModal.querySelector('#deleteCancelBtn') as HTMLButtonElement;
    const confirmBtn = this.deleteModal.querySelector('#deleteConfirmBtn') as HTMLButtonElement;

    cancelBtn.addEventListener('click', () => this.hideDeleteModal());
    confirmBtn.addEventListener('click', () => this.executeDelete());

    // Close on overlay click
    this.deleteModal.addEventListener('click', (e) => {
      if (e.target === this.deleteModal) {
        this.hideDeleteModal();
      }
    });
  }

  private currentDeleteData: {
    session: DictationSession;
    sessionItem: HTMLElement;
    button: HTMLButtonElement;
  } | null = null;

  private showDeleteModal(session: DictationSession, sessionItem: HTMLElement, button: HTMLButtonElement): void {
    this.currentDeleteData = { session, sessionItem, button };
    
    const message = this.deleteModal!.querySelector('#deleteMessage') as HTMLElement;
    message.textContent = `Êtes-vous sûr de vouloir supprimer "${session.title}" ? Cette action est irréversible.`;
    
    // Reset button states
    const confirmBtn = this.deleteModal!.querySelector('#deleteConfirmBtn') as HTMLButtonElement;
    const cancelBtn = this.deleteModal!.querySelector('#deleteCancelBtn') as HTMLButtonElement;
    
    confirmBtn.innerHTML = 'Supprimer';
    confirmBtn.disabled = false;
    cancelBtn.disabled = false;
    
    // Show modal
    this.deleteModal!.style.display = 'flex';
    setTimeout(() => {
      this.deleteModal!.classList.add('visible');
    }, 10);
  }

  private hideDeleteModal(): void {
    this.deleteModal!.classList.remove('visible');
    setTimeout(() => {
      this.deleteModal!.style.display = 'none';
      this.currentDeleteData = null;
    }, 300);
  }

  private async executeDelete(): Promise<void> {
    if (!this.currentDeleteData) return;

    const { session, sessionItem, button } = this.currentDeleteData;
    const confirmBtn = this.deleteModal!.querySelector('#deleteConfirmBtn') as HTMLButtonElement;
    const cancelBtn = this.deleteModal!.querySelector('#deleteCancelBtn') as HTMLButtonElement;

    // Show loading state
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Suppression...';
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;

    try {
      // Add deleting animation to button
      button.classList.add('deleting');
      
      const success = await DatabaseService.deleteSession(session.id);
      
      if (success) {
        // Add success animation to item
        sessionItem.classList.add('deleting');
        
        // Wait for animation to complete
        setTimeout(() => {
          // Remove the session from local arrays
          this.sessions = this.sessions.filter(s => s.id !== session.id);
          this.filteredSessions = this.filteredSessions.filter(s => s.id !== session.id);
          // Re-render the sessions list
          this.updateSearchUI();
          this.hideDeleteModal();
        }, 600);
      } else {
        throw new Error('Failed to delete session');
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      this.showDeleteError(sessionItem, button);
      this.hideDeleteModal();
    }
  }

  async loadSessions() {
    const content = this.container.querySelector('#sessionsContent') as HTMLElement;
    content.innerHTML = '<div class="loading">Chargement...</div>';

    try {
      this.sessions = await DatabaseService.getUserSessions();
      this.filteredSessions = [...this.sessions];
      this.filterSessions();
      this.renderSessions();
    } catch (error) {
      console.error('Error loading sessions:', error);
      content.innerHTML = '<div class="no-sessions">Erreur lors du chargement des sessions</div>';
    }
  }

  private filterSessions() {
    if (!this.searchTerm) {
      this.filteredSessions = [...this.sessions];
      return;
    }

    this.filteredSessions = this.sessions.filter(session => {
      const searchableText = [
        session.title,
        session.raw_transcription,
        session.summary,
        session.detailed_note
      ].join(' ').toLowerCase();

      return searchableText.includes(this.searchTerm);
    });
  }

  private updateSearchUI() {
    const searchClearBtn = this.container.querySelector('#searchClearBtn') as HTMLElement;
    const searchResultsInfo = this.container.querySelector('#searchResultsInfo') as HTMLElement;

    // Show/hide clear button
    if (this.searchTerm) {
      searchClearBtn.classList.add('visible');
    } else {
      searchClearBtn.classList.remove('visible');
    }

    // Show search results info
    if (this.searchTerm) {
      const totalSessions = this.sessions.length;
      const filteredCount = this.filteredSessions.length;
      searchResultsInfo.textContent = `${filteredCount} sur ${totalSessions} résultats`;
      searchResultsInfo.style.display = 'block';
    } else {
      searchResultsInfo.style.display = 'none';
    }

    this.renderSessions();
  }

  private highlightSearchTerm(text: string): string {
    if (!this.searchTerm || !text) return text;
    
    const regex = new RegExp(`(${this.searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
  }

  private renderSessions() {
    const content = this.container.querySelector('#sessionsContent') as HTMLElement;

    if (this.filteredSessions.length === 0) {
      if (this.searchTerm) {
        content.innerHTML = '<div class="no-sessions">Aucun résultat trouvé pour cette recherche</div>';
      } else {
        content.innerHTML = '<div class="no-sessions">Aucun enregistrement trouvé</div>';
      }
      return;
    }

    content.innerHTML = this.filteredSessions.map(session => {
      const highlightedTitle = this.highlightSearchTerm(session.title);
      
      return `
        <div class="session-item" data-session-id="${session.id}">
          <div class="session-info">
            <h4 class="session-title">${highlightedTitle}</h4>
            <div class="session-meta">
              <span class="session-date">${new Date(session.created_at).toLocaleDateString('fr-FR')}</span>
              <span class="session-duration">${Math.floor(session.recording_duration / 60)}:${(session.recording_duration % 60).toString().padStart(2, '0')}</span>
            </div>
          </div>
          <div class="session-actions">
            <button class="session-action-btn load-btn" data-action="load" title="Charger">
              <i class="fas fa-folder-open"></i>
            </button>
            <button class="session-action-btn delete-btn" data-action="delete" title="Supprimer">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Add event listeners
    content.addEventListener('click', this.handleSessionAction.bind(this));
  }

  private async handleSessionAction(e: Event) {
    const target = e.target as HTMLElement;
    const button = target.closest('.session-action-btn') as HTMLButtonElement;
    
    if (!button) return;

    const sessionItem = button.closest('.session-item') as HTMLElement;
    const sessionId = sessionItem.dataset.sessionId!;
    const action = button.dataset.action;
    const session = this.sessions.find(s => s.id === sessionId);

    if (!session) return;

    try {
      if (action === 'load') {
        this.onSessionSelect(session);
      } else if (action === 'delete') {
        this.showDeleteModal(session, sessionItem, button);
      }
    } catch (error) {
      console.error('Error handling session action:', error);
      if (action === 'delete') {
        this.showDeleteError(sessionItem, button);
      }
    }
  }

  private showDeleteError(sessionItem: HTMLElement, button: HTMLButtonElement) {
    // Remove any existing classes
    button.classList.remove('deleting', 'processing');
    sessionItem.classList.remove('deleting');
    
    // Add error animation
    sessionItem.classList.add('delete-error');
    
    // Reset button
    button.disabled = false;
    button.innerHTML = '<i class="fas fa-trash"></i>';
    
    // Remove error class after animation
    setTimeout(() => {
      sessionItem.classList.remove('delete-error');
    }, 500);
    
    // Show error message
    alert('Erreur lors de la suppression de la session');
  }

  getElement(): HTMLElement {
    return this.container;
  }
}