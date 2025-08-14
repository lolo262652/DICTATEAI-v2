import { supabase } from './supabase';

export class StorageService {
  static async uploadAudioFile(file: File, userId: string, sessionId: string): Promise<string | null> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${sessionId}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('audio-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('Error uploading file:', error);
      return null;
    }

    return data.path;
  }

  static async getAudioFileUrl(filePath: string): Promise<string | null> {
    const { data } = await supabase.storage
      .from('audio-files')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    return data?.signedUrl || null;
  }

  static async deleteAudioFile(filePath: string): Promise<boolean> {
    const { error } = await supabase.storage
      .from('audio-files')
      .remove([filePath]);

    if (error) {
      console.error('Error deleting file:', error);
      return false;
    }

    return true;
  }
}