import { supabase } from './supabase';
import type { DictationSession } from './supabase';

export class DatabaseService {
  static async createSession(session: Partial<DictationSession>): Promise<DictationSession | null> {
    try {
      const { data, error } = await supabase
        .from('dictation_sessions')
        .insert([session])
        .select()
        .single();

      if (error) {
        console.error('Error creating session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error creating session:', error);
      return null;
    }
  }

  static async updateSession(id: string, updates: Partial<DictationSession>): Promise<DictationSession | null> {
    try {
      const { data, error } = await supabase
        .from('dictation_sessions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error updating session:', error);
      return null;
    }
  }

  static async getSession(id: string): Promise<DictationSession | null> {
    try {
      const { data, error } = await supabase
        .from('dictation_sessions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching session:', error);
      return null;
    }
  }

  static async getUserSessions(): Promise<DictationSession[]> {
    try {
      const { data, error } = await supabase
        .from('dictation_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user sessions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching user sessions:', error);
      return [];
    }
  }

  static async deleteSession(id: string): Promise<boolean> {
    try {
      // First get the session to get the audio file path
      const session = await this.getSession(id);
      
      // Delete the audio file from storage if it exists
      if (session?.audio_file_path) {
        try {
          const { StorageService } = await import('./storage');
          await StorageService.deleteAudioFile(session.audio_file_path);
        } catch (storageError) {
          console.warn('Error deleting audio file:', storageError);
          // Continue with session deletion even if file deletion fails
        }
      }

      // Delete the session from database
      const { error } = await supabase
        .from('dictation_sessions')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting session:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  }
}