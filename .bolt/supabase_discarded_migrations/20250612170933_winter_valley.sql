/*
  # Create PDF documents table and storage

  1. New Tables
    - `pdf_documents`
      - `id` (uuid, primary key)
      - `session_id` (uuid, optional foreign key to dictation_sessions)
      - `user_id` (uuid, foreign key to auth.users)
      - `title` (text)
      - `file_path` (text)
      - `file_size` (bigint)
      - `page_count` (integer)
      - `extracted_text` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `pdf_documents` table
    - Add policies for authenticated users to manage their own documents

  3. Storage
    - Create `pdf-files` storage bucket
    - Add storage policies for user file access
*/

-- Create pdf_documents table if it doesn't exist
CREATE TABLE IF NOT EXISTS pdf_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES dictation_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  file_path text NOT NULL,
  file_size bigint DEFAULT 0 NOT NULL,
  page_count integer DEFAULT 0 NOT NULL,
  extracted_text text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'pdf_documents' 
    AND policyname = 'Users can view own PDF documents'
  ) THEN
    ALTER TABLE pdf_documents ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policies only if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'pdf_documents' 
    AND policyname = 'Users can view own PDF documents'
  ) THEN
    CREATE POLICY "Users can view own PDF documents"
      ON pdf_documents
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'pdf_documents' 
    AND policyname = 'Users can insert own PDF documents'
  ) THEN
    CREATE POLICY "Users can insert own PDF documents"
      ON pdf_documents
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'pdf_documents' 
    AND policyname = 'Users can update own PDF documents'
  ) THEN
    CREATE POLICY "Users can update own PDF documents"
      ON pdf_documents
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'pdf_documents' 
    AND policyname = 'Users can delete own PDF documents'
  ) THEN
    CREATE POLICY "Users can delete own PDF documents"
      ON pdf_documents
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create updated_at trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_pdf_documents_updated_at'
    AND event_object_table = 'pdf_documents'
  ) THEN
    CREATE TRIGGER update_pdf_documents_updated_at
      BEFORE UPDATE ON pdf_documents
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Create storage bucket for PDF files
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdf-files', 'pdf-files', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for PDF files only if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.policies 
    WHERE bucket_id = 'pdf-files' 
    AND name = 'Users can upload their own PDF files'
  ) THEN
    CREATE POLICY "Users can upload their own PDF files"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'pdf-files' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.policies 
    WHERE bucket_id = 'pdf-files' 
    AND name = 'Users can view their own PDF files'
  ) THEN
    CREATE POLICY "Users can view their own PDF files"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (bucket_id = 'pdf-files' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.policies 
    WHERE bucket_id = 'pdf-files' 
    AND name = 'Users can update their own PDF files'
  ) THEN
    CREATE POLICY "Users can update their own PDF files"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'pdf-files' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.policies 
    WHERE bucket_id = 'pdf-files' 
    AND name = 'Users can delete their own PDF files'
  ) THEN
    CREATE POLICY "Users can delete their own PDF files"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'pdf-files' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;