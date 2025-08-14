import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

export type ProfileData = {
  first_name: string;
  last_name: string;
  address: string;
  street: string;
  city: string;
  postal_code: string;
  company: string;
  phone: string;
  activity: string;
  email: string;
};

export class AuthService {
  static async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { data, error };
  }

  static async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  }

  static async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  }

  static async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  static onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user ?? null);
    });
  }

  static async insertProfile(userId: string, profile: ProfileData) {
    const payload = {
      id: userId,
      email: profile.email || '',
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      address: profile.address || '',
      street: profile.street || '',
      city: profile.city || '',
      postal_code: profile.postal_code || '',
      company: profile.company || '',
      phone: profile.phone || '',
      activity: profile.activity || '',
    };

    console.log("Tentative d'insertion Supabase avec:", payload);

    const { data, error } = await supabase
      .from('profiles')
      .insert([payload]);

    if (error) {
      console.error("Erreur d'insertion du profil :", error);
      // Par exemple, gérer une erreur de violation de contrainte unique email ici
      if (error.code === '23505') { // code SQL standard violation unique
        return { error: new Error('Un profil avec cet email existe déjà.') };
      }
    }

    console.log("Résultat de l'insertion:", { data, error });
    return { error };
  }

  static async updateProfile(userId: string, profile: ProfileData) {
    const { data, error } = await supabase
      .from('profiles')
      .update(profile)
      .eq('id', userId)
      .select();

    if (error) console.error('Erreur update profil:', error);
    return { data, error };
  }

  static async resetPassword(email: string) {
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:5173/update-password.html' // à adapter
    });
  }
  static async profileExists(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('email')
    .eq('email', email)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = Not found, normal si pas de profil
    console.error('Erreur recherche profil:', error);
    throw error;
  }

  return !!data;
}

}
