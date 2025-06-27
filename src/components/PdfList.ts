import { PdfService } from '../lib/pdf-service';
import { PdfViewer } from './PdfViewer';
import type { PdfDocument } from '../lib/supabase';

export class PdfList {
  private container: HTMLElement;
  private documents: PdfDocument[] = [];
  private filteredDocuments: PdfDocument[] = [];
  private pdfViewer: PdfViewer;
  private searchTerm: string = '';
  private deleteModal: HTMLElement | null = null;

  constructor() {
    this.pdfViewer = new PdfViewer(() => {
      // Callback when PDF viewer is closed
    });
    this.container = this.createContainer();
    this.createDeleteModal();
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'pdf-list-section';
    container.innerHTML = `
      <div class="pdf-list-header">
        <h4><i class="fas fa-file-pdf"></i> Documents PDF</h4>
        <button id="refreshPdfListBtn" class="action-button" title="Actualiser">
          <i class="fas fa-refresh"></i>
        </button>
      </div>
      <div class="pdf-list-content" id="pdfListContent">
        <div class="loading">Chargement...</div>
      </div>
    `;

    const refreshBtn = container.querySelector('#refreshPdfListBtn') as HTMLButtonElement;
    refreshBtn.addEventListener('click', () => this.loadDocuments());

    return container;
  }

  private createDeleteModal(): void {
    this.deleteModal = document.createElement('div');
    this.deleteModal.className = 'delete-confirmation-modal';
    this.deleteModal.innerHTML = `
      <div class="delete-confirmation-content">
        <div class="delete-confirmation-icon">
          <i class="fas fa-file-pdf"></i>
        </div>
        <h3 class="delete-confirmation-title">Supprimer le document PDF</h3>
        <p class="delete-confirmation-message" id="pdfDeleteMessage">
          Êtes-vous sûr de vouloir supprimer ce document ? Cette action est irréversible.
        </p>
        <div class="delete-confirmation-actions">
          <button class="delete-confirmation-btn cancel" id="pdfDeleteCancelBtn">Annuler</button>
          <button class="delete-confirmation-btn confirm" id="pdfDeleteConfirmBtn">Supprimer</button>
        </div>
      </div>
    `;

    // Add to body but keep hidden
    document.body.appendChild(this.deleteModal);

    // Add event listeners once
    const cancelBtn = this.deleteModal.querySelector('#pdfDeleteCancelBtn') as HTMLButtonElement;
    const confirmBtn = this.deleteModal.querySelector('#pdfDeleteConfirmBtn') as HTMLButtonElement;

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
    document: PdfDocument;
    pdfItem: HTMLElement;
    button: HTMLButtonElement;
  } | null = null;

  private showDeleteModal(document: PdfDocument, pdfItem: HTMLElement, button: HTMLButtonElement): void {
    this.currentDeleteData = { document, pdfItem, button };
    
    const message = this.deleteModal!.querySelector('#pdfDeleteMessage') as HTMLElement;
    message.textContent = `Êtes-vous sûr de vouloir supprimer "${document.title}" ? Cette action est irréversible.`;
    
    // Reset button states
    const confirmBtn = this.deleteModal!.querySelector('#pdfDeleteConfirmBtn') as HTMLButtonElement;
    const cancelBtn = this.deleteModal!.querySelector('#pdfDeleteCancelBtn') as HTMLButtonElement;
    
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

    const { document, pdfItem, button } = this.currentDeleteData;
    const confirmBtn = this.deleteModal!.querySelector('#pdfDeleteConfirmBtn') as HTMLButtonElement;
    const cancelBtn = this.deleteModal!.querySelector('#pdfDeleteCancelBtn') as HTMLButtonElement;

    // Show loading state
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Suppression...';
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;

    try {
      // Add deleting animation to button
      button.classList.add('deleting');
      
      const success = await PdfService.deletePdfDocument(document.id);
      
      if (success) {
        // Add success animation to item
        pdfItem.classList.add('deleting');
        
        // Wait for animation to complete
        setTimeout(() => {
          // Remove the document from local arrays
          this.documents = this.documents.filter(d => d.id !== document.id);
          this.filteredDocuments = this.filteredDocuments.filter(d => d.id !== document.id);
          // Re-render the documents list
          this.renderDocuments();
          this.hideDeleteModal();
        }, 600);
      } else {
        throw new Error('Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      this.showDeleteError(pdfItem, button);
      this.hideDeleteModal();
    }
  }

  async loadDocuments() {
    const content = this.container.querySelector('#pdfListContent') as HTMLElement;
    content.innerHTML = '<div class="loading">Chargement...</div>';

    this.documents = await PdfService.getUserPdfDocuments();
    this.filteredDocuments = [...this.documents];
    this.renderDocuments();
  }

  // Method to filter documents based on search term from parent component
  filterDocuments(searchTerm: string) {
    this.searchTerm = searchTerm.toLowerCase().trim();
    
    if (!this.searchTerm) {
      this.filteredDocuments = [...this.documents];
    } else {
      this.filteredDocuments = this.documents.filter(doc => {
        const searchableText = [
          doc.title,
          doc.extracted_text
        ].join(' ').toLowerCase();

        return searchableText.includes(this.searchTerm);
      });
    }
    
    this.renderDocuments();
  }

  private highlightSearchTerm(text: string): string {
    if (!this.searchTerm || !text) return text;
    
    const regex = new RegExp(`(${this.searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
  }

  private renderDocuments() {
    const content = this.container.querySelector('#pdfListContent') as HTMLElement;

    if (this.filteredDocuments.length === 0) {
      if (this.searchTerm) {
        content.innerHTML = '<div class="no-documents">Aucun document PDF trouvé pour cette recherche</div>';
      } else {
        content.innerHTML = '<div class="no-documents">Aucun document PDF trouvé</div>';
      }
      return;
    }

    content.innerHTML = this.filteredDocuments.map(doc => {
      const highlightedTitle = this.highlightSearchTerm(doc.title);
      
      return `
        <div class="pdf-item" data-pdf-id="${doc.id}">
          <div class="pdf-item-icon">
            <i class="fas fa-file-pdf"></i>
          </div>
          <div class="pdf-item-info" data-action="preview">
            <h5 class="pdf-item-title">${highlightedTitle}</h5>
            <div class="pdf-item-meta">
              <span class="pdf-item-date">${new Date(doc.created_at).toLocaleDateString('fr-FR')}</span>
              <span class="pdf-item-size">${this.formatFileSize(doc.file_size)}</span>
              <span class="pdf-item-pages">${doc.page_count} pages</span>
            </div>
          </div>
          <div class="pdf-item-actions">
            <button class="pdf-action-btn view-btn" data-action="view" title="Voir en plein écran">
              <i class="fas fa-expand"></i>
            </button>
            <button class="pdf-action-btn download-btn" data-action="download" title="Télécharger">
              <i class="fas fa-download"></i>
            </button>
            <button class="pdf-action-btn delete-btn" data-action="delete" title="Supprimer">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Add event listeners
    content.addEventListener('click', this.handleDocumentAction.bind(this));
  }

  private async handleDocumentAction(e: Event) {
    const target = e.target as HTMLElement;
    const button = target.closest('.pdf-action-btn') as HTMLButtonElement;
    const infoArea = target.closest('.pdf-item-info') as HTMLElement;
    
    const pdfItem = (button || infoArea)?.closest('.pdf-item') as HTMLElement;
    if (!pdfItem) return;

    const pdfId = pdfItem.dataset.pdfId!;
    const document = this.documents.find(d => d.id === pdfId);
    if (!document) return;

    let action: string;
    
    if (button) {
      action = button.dataset.action!;
    } else if (infoArea) {
      action = 'preview';
    } else {
      return;
    }

    switch (action) {
      case 'view':
        await this.pdfViewer.show(document);
        break;
      case 'preview':
        await this.showQuickPreview(document, pdfItem);
        break;
      case 'download':
        await this.downloadPdf(document);
        break;
      case 'delete':
        this.showDeleteModal(document, pdfItem, button);
        break;
    }
  }

  private async showQuickPreview(document: PdfDocument, pdfItem: HTMLElement) {
    // Check if preview is already shown
    const existingPreview = pdfItem.querySelector('.pdf-quick-preview');
    if (existingPreview) {
      existingPreview.remove();
      return;
    }

    // Create preview container
    const previewContainer = document.createElement('div');
    previewContainer.className = 'pdf-quick-preview';
    previewContainer.innerHTML = `
      <div class="pdf-quick-preview-header">
        <span class="pdf-quick-preview-title">Aperçu - ${document.title}</span>
        <button class="pdf-quick-preview-close" title="Fermer">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="pdf-quick-preview-content">
        <div class="pdf-quick-preview-loading">
          <i class="fas fa-spinner fa-spin"></i>
          <span>Chargement de l'aperçu...</span>
        </div>
      </div>
      <div class="pdf-quick-preview-actions">
        <button class="pdf-quick-preview-btn" data-action="fullscreen">
          <i class="fas fa-expand"></i>
          Plein écran
        </button>
        <button class="pdf-quick-preview-btn" data-action="download">
          <i class="fas fa-download"></i>
          Télécharger
        </button>
      </div>
    `;

    // Insert after the pdf item
    pdfItem.insertAdjacentElement('afterend', previewContainer);

    // Add event listeners
    const closeBtn = previewContainer.querySelector('.pdf-quick-preview-close') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => previewContainer.remove());

    const actionBtns = previewContainer.querySelectorAll('.pdf-quick-preview-btn');
    actionBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action;
        if (action === 'fullscreen') {
          await this.pdfViewer.show(document);
          previewContainer.remove();
        } else if (action === 'download') {
          await this.downloadPdf(document);
        }
      });
    });

    // Load PDF preview
    try {
      const pdfUrl = await PdfService.getPdfFileUrl(document.file_path);
      if (pdfUrl) {
        const content = previewContainer.querySelector('.pdf-quick-preview-content') as HTMLElement;
        content.innerHTML = `
          <iframe 
            src="${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0" 
            class="pdf-quick-preview-frame"
            frameborder="0">
          </iframe>
        `;
      } else {
        throw new Error('Impossible de charger le PDF');
      }
    } catch (error) {
      console.error('Error loading PDF preview:', error);
      const content = previewContainer.querySelector('.pdf-quick-preview-content') as HTMLElement;
      content.innerHTML = `
        <div class="pdf-quick-preview-error">
          <i class="fas fa-exclamation-triangle"></i>
          <span>Erreur lors du chargement de l'aperçu</span>
        </div>
      `;
    }

    // Animate in
    setTimeout(() => {
      previewContainer.classList.add('visible');
    }, 10);
  }

  private async downloadPdf(document: PdfDocument) {
    try {
      const pdfUrl = await PdfService.getPdfFileUrl(document.file_path);
      if (pdfUrl) {
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.download = document.title;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Erreur lors du téléchargement du PDF');
    }
  }

  private showDeleteError(pdfItem: HTMLElement, button: HTMLButtonElement) {
    // Remove any existing classes
    button.classList.remove('deleting', 'processing');
    pdfItem.classList.remove('deleting');
    
    // Add error animation
    pdfItem.classList.add('delete-error');
    
    // Reset button
    button.disabled = false;
    button.innerHTML = '<i class="fas fa-trash"></i>';
    
    // Remove error class after animation
    setTimeout(() => {
      pdfItem.classList.remove('delete-error');
    }, 500);
    
    // Show error message
    alert('Erreur lors de la suppression du document');
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Public method to show PDF viewer (used by main app)
  async showPdfViewer(document: PdfDocument) {
    await this.pdfViewer.show(document);
  }

  getElement(): HTMLElement {
    return this.container;
  }
}