import { PdfService } from '../lib/pdf-service';
import type { PdfDocument } from '../lib/supabase';

export class PdfViewer {
  private container: HTMLElement;
  private currentDocument: PdfDocument | null = null;
  private onClose: () => void;

  constructor(onClose: () => void) {
    this.onClose = onClose;
    this.container = this.createContainer();
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'pdf-viewer-modal';
    container.innerHTML = `
      <div class="pdf-viewer-overlay" id="pdfViewerOverlay"></div>
      <div class="pdf-viewer-content">
        <div class="pdf-viewer-header">
          <h3 id="pdfViewerTitle">Document PDF</h3>
          <div class="pdf-viewer-controls">
            <button id="downloadPdfBtn" class="action-button" title="Télécharger">
              <i class="fas fa-download"></i>
            </button>
            <button id="closePdfViewerBtn" class="action-button" title="Fermer">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
        <div class="pdf-viewer-body">
          <div class="pdf-preview-container">
            <iframe id="pdfPreviewFrame" class="pdf-preview-frame"></iframe>
          </div>
          <div class="pdf-text-container">
            <h4>Texte extrait</h4>
            <div id="pdfExtractedText" class="pdf-extracted-text"></div>
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    const overlay = container.querySelector('#pdfViewerOverlay') as HTMLElement;
    const closeBtn = container.querySelector('#closePdfViewerBtn') as HTMLButtonElement;
    const downloadBtn = container.querySelector('#downloadPdfBtn') as HTMLButtonElement;

    overlay.addEventListener('click', this.close.bind(this));
    closeBtn.addEventListener('click', this.close.bind(this));
    downloadBtn.addEventListener('click', this.downloadCurrentPdf.bind(this));

    return container;
  }

  async show(document: PdfDocument) {
    this.currentDocument = document;
    
    // Update title
    const title = this.container.querySelector('#pdfViewerTitle') as HTMLElement;
    title.textContent = document.title;

    // Load PDF preview
    try {
      const pdfUrl = await PdfService.getPdfFileUrl(document.file_path);
      if (pdfUrl) {
        const iframe = this.container.querySelector('#pdfPreviewFrame') as HTMLIFrameElement;
        iframe.src = pdfUrl;
      }
    } catch (error) {
      console.error('Error loading PDF preview:', error);
    }

    // Show extracted text
    const textContainer = this.container.querySelector('#pdfExtractedText') as HTMLElement;
    textContainer.textContent = document.extracted_text || 'Aucun texte extrait disponible';

    // Show modal
    document.body.appendChild(this.container);
    this.container.style.display = 'flex';
    
    // Add entrance animation
    setTimeout(() => {
      this.container.classList.add('pdf-viewer-visible');
    }, 10);
  }

  close() {
    this.container.classList.remove('pdf-viewer-visible');
    setTimeout(() => {
      if (this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
    }, 300);
    this.onClose();
  }

  private async downloadCurrentPdf() {
    if (!this.currentDocument) return;

    try {
      const pdfUrl = await PdfService.getPdfFileUrl(this.currentDocument.file_path);
      if (pdfUrl) {
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.download = this.currentDocument.title;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Erreur lors du téléchargement du PDF');
    }
  }
}