/*
  # PDF Documents Schema Migration

  1. New Tables
    - `pdf_documents`
      - `id` (uuid, primary key)
      - `session_id` (uuid, optional foreign key to dictation_sessions)
      - `user_id` (uuid, foreign key to auth.users)
      - `title` (text, document title)
      - `file_path` (text, storage path)
      - `file_size` (bigint, file size in bytes)
      - `page_count` (integer, number of pages)
      - `extracted_text` (text, extracted text content)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `pdf_documents` table
    - Add policies for authenticated users to manage their own documents
    - Create storage bucket and policies for PDF files

  3. Storage
    - Create `pdf-files` storage bucket
    - Add storage policies for user file isolation
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

-- Enable RLS only if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'pdf_documents' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE pdf_documents ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policies for pdf_documents table only if they don't exist
DO $$
BEGIN
  -- Check and create SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'pdf_documents' 
    AND policyname = 'Users can view own PDF documents'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view own PDF documents"
      ON pdf_documents
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id)';
  END IF;

  -- Check and create INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'pdf_documents' 
    AND policyname = 'Users can insert own PDF documents'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can insert own PDF documents"
      ON pdf_documents
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id)';
  END IF;

  -- Check and create UPDATE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'pdf_documents' 
    AND policyname = 'Users can update own PDF documents'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update own PDF documents"
      ON pdf_documents
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id)';
  END IF;

  -- Check and create DELETE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'pdf_documents' 
    AND policyname = 'Users can delete own PDF documents'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can delete own PDF documents"
      ON pdf_documents
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id)';
  END IF;
END $$;

-- Create updated_at trigger only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_pdf_documents_updated_at'
    AND event_object_table = 'pdf_documents'
  ) THEN
    EXECUTE 'CREATE TRIGGER update_pdf_documents_updated_at
      BEFORE UPDATE ON pdf_documents
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()';
  END IF;
END $$;

-- Create storage bucket for PDF files (will be ignored if exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdf-files', 'pdf-files', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for PDF files with existence checks
DO $$
BEGIN
  -- Upload policy
  BEGIN
    EXECUTE 'CREATE POLICY "Users can upload their own PDF files"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = ''pdf-files'' AND auth.uid()::text = (storage.foldername(name))[1])';
  EXCEPTION
    WHEN duplicate_object THEN
      NULL; -- Policy already exists, ignore
  END;

  -- Select policy
  BEGIN
    EXECUTE 'CREATE POLICY "Users can view their own PDF files"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (bucket_id = ''pdf-files'' AND auth.uid()::text = (storage.foldername(name))[1])';
  EXCEPTION
    WHEN duplicate_object THEN
      NULL; -- Policy already exists, ignore
  END;

  -- Update policy
  BEGIN
    EXECUTE 'CREATE POLICY "Users can update their own PDF files"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = ''pdf-files'' AND auth.uid()::text = (storage.foldername(name))[1])';
  EXCEPTION
    WHEN duplicate_object THEN
      NULL; -- Policy already exists, ignore
  END;

  -- Delete policy
  BEGIN
    EXECUTE 'CREATE POLICY "Users can delete their own PDF files"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = ''pdf-files'' AND auth.uid()::text = (storage.foldername(name))[1])';
  EXCEPTION
    WHEN duplicate_object THEN
      NULL; -- Policy already exists, ignore
  END;
END $$;