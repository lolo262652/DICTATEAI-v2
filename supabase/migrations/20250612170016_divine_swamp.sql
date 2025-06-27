/*
  # Create PDF documents table and storage (safe migration)

  1. New Tables
    - `pdf_documents` (only if it doesn't exist)
      - `id` (uuid, primary key)
      - `session_id` (uuid, optional reference to dictation_sessions)
      - `user_id` (uuid, references auth.users)
      - `title` (text)
      - `file_path` (text, path to PDF file in storage)
      - `file_size` (bigint)
      - `page_count` (integer)
      - `extracted_text` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `pdf_documents` table (safe to run multiple times)
    - Add policies only if they don't exist

  3. Storage
    - Create bucket for PDF files (safe with ON CONFLICT)
    - Set up policies for PDF file access (only if they don't exist)
*/

-- Create pdf_documents table only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'pdf_documents'
  ) THEN
    CREATE TABLE pdf_documents (
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
  END IF;
END $$;

-- Enable RLS (safe to run multiple times)
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'pdf_documents'
  ) THEN
    ALTER TABLE pdf_documents ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policies only if they don't exist
DO $$
BEGIN
  -- Check and create SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pdf_documents' 
    AND policyname = 'Users can view own PDF documents'
  ) THEN
    CREATE POLICY "Users can view own PDF documents"
      ON pdf_documents
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  -- Check and create INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pdf_documents' 
    AND policyname = 'Users can insert own PDF documents'
  ) THEN
    CREATE POLICY "Users can insert own PDF documents"
      ON pdf_documents
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Check and create UPDATE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pdf_documents' 
    AND policyname = 'Users can update own PDF documents'
  ) THEN
    CREATE POLICY "Users can update own PDF documents"
      ON pdf_documents
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Check and create DELETE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pdf_documents' 
    AND policyname = 'Users can delete own PDF documents'
  ) THEN
    CREATE POLICY "Users can delete own PDF documents"
      ON pdf_documents
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
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
    CREATE TRIGGER update_pdf_documents_updated_at
      BEFORE UPDATE ON pdf_documents
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Create storage bucket for PDF files (safe with ON CONFLICT)
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdf-documents', 'pdf-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies only if they don't exist
DO $$
BEGIN
  -- Check and create upload policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Users can upload their own PDF files'
  ) THEN
    CREATE POLICY "Users can upload their own PDF files"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'pdf-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  -- Check and create view policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Users can view their own PDF files'
  ) THEN
    CREATE POLICY "Users can view their own PDF files"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (bucket_id = 'pdf-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  -- Check and create update policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Users can update their own PDF files'
  ) THEN
    CREATE POLICY "Users can update their own PDF files"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'pdf-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  -- Check and create delete policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Users can delete their own PDF files'
  ) THEN
    CREATE POLICY "Users can delete their own PDF files"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'pdf-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;