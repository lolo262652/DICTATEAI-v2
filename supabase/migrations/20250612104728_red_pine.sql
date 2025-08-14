/*
  # Ajouter le support des documents PDF

  1. Nouvelles Tables
    - `pdf_documents`
      - `id` (uuid, primary key)
      - `session_id` (uuid, references dictation_sessions)
      - `user_id` (uuid, references auth.users)
      - `title` (text)
      - `file_path` (text, chemin vers le fichier PDF dans le storage)
      - `file_size` (bigint, taille du fichier en bytes)
      - `page_count` (integer, nombre de pages)
      - `extracted_text` (text, texte extrait du PDF)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Sécurité
    - Activer RLS sur la table `pdf_documents`
    - Ajouter des politiques pour que les utilisateurs authentifiés puissent gérer leurs propres documents

  3. Storage
    - Créer un bucket pour les fichiers PDF
    - Configurer les politiques d'accès aux fichiers PDF
*/

-- Créer la table pdf_documents
CREATE TABLE IF NOT EXISTS pdf_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES dictation_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  page_count integer NOT NULL DEFAULT 0,
  extracted_text text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Activer RLS
ALTER TABLE pdf_documents ENABLE ROW LEVEL SECURITY;

-- Créer les politiques
CREATE POLICY "Users can view own PDF documents"
  ON pdf_documents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own PDF documents"
  ON pdf_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own PDF documents"
  ON pdf_documents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own PDF documents"
  ON pdf_documents
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Créer le trigger updated_at
CREATE TRIGGER update_pdf_documents_updated_at
  BEFORE UPDATE ON pdf_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Créer le bucket de stockage pour les fichiers PDF
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdf-documents', 'pdf-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Créer les politiques de stockage
CREATE POLICY "Users can upload their own PDF files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'pdf-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own PDF files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'pdf-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own PDF files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'pdf-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own PDF files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'pdf-documents' AND auth.uid()::text = (storage.foldername(name))[1]);