import { supabase } from './supabase';
import type { PdfDocument } from './supabase';

export class PdfService {
  static async uploadPdfFile(file: File, userId: string, sessionId?: string): Promise<string | null> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${userId}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('pdf-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Error uploading PDF file:', error);
        throw new Error(`Erreur lors du téléversement: ${error.message}`);
      }

      return data.path;
    } catch (error) {
      console.error('Error in uploadPdfFile:', error);
      throw error;
    }
  }

  static async getPdfFileUrl(filePath: string): Promise<string | null> {
    try {
      const { data } = await supabase.storage
        .from('pdf-files')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      return data?.signedUrl || null;
    } catch (error) {
      console.error('Error getting PDF file URL:', error);
      return null;
    }
  }

  static async deletePdfFile(filePath: string): Promise<boolean> {
    try {
      const { error } = await supabase.storage
        .from('pdf-files')
        .remove([filePath]);

      if (error) {
        console.error('Error deleting PDF file:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deletePdfFile:', error);
      return false;
    }
  }

  static async createPdfDocument(document: Partial<PdfDocument>): Promise<PdfDocument | null> {
    try {
      const { data, error } = await supabase
        .from('pdf_documents')
        .insert([document])
        .select()
        .single();

      if (error) {
        console.error('Error creating PDF document:', error);
        throw new Error(`Erreur lors de la création du document: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error in createPdfDocument:', error);
      throw error;
    }
  }

  static async updatePdfDocument(id: string, updates: Partial<PdfDocument>): Promise<PdfDocument | null> {
    try {
      const { data, error } = await supabase
        .from('pdf_documents')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating PDF document:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in updatePdfDocument:', error);
      return null;
    }
  }

  static async getPdfDocument(id: string): Promise<PdfDocument | null> {
    try {
      const { data, error } = await supabase
        .from('pdf_documents')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching PDF document:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getPdfDocument:', error);
      return null;
    }
  }

  static async getUserPdfDocuments(): Promise<PdfDocument[]> {
    try {
      const { data, error } = await supabase
        .from('pdf_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user PDF documents:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserPdfDocuments:', error);
      return [];
    }
  }

  static async getSessionPdfDocuments(sessionId: string): Promise<PdfDocument[]> {
    try {
      const { data, error } = await supabase
        .from('pdf_documents')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching session PDF documents:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getSessionPdfDocuments:', error);
      return [];
    }
  }

  static async deletePdfDocument(id: string): Promise<boolean> {
    try {
      // First get the document to get the file path
      const document = await this.getPdfDocument(id);
      if (!document) return false;

      // Delete the file from storage
      await this.deletePdfFile(document.file_path);

      // Delete the database record
      const { error } = await supabase
        .from('pdf_documents')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting PDF document:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deletePdfDocument:', error);
      return false;
    }
  }

  static async extractTextFromPdf(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async function(e) {
        try {
          const typedarray = new Uint8Array(e.target?.result as ArrayBuffer);
          const pdf = await (window as any).pdfjsLib.getDocument(typedarray).promise;
          let fullText = '';

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n\n';
          }

          resolve(fullText.trim());
        } catch (error) {
          console.error('Error extracting text from PDF:', error);
          reject(new Error('Erreur lors de l\'extraction du texte du PDF'));
        }
      };
      reader.onerror = () => reject(new Error('Erreur lors de la lecture du fichier'));
      reader.readAsArrayBuffer(file);
    });
  }
}