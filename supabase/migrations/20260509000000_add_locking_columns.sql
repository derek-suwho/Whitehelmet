-- Add locking columns to template_assignments and processed_file_path to submissions.
-- These were defined in the Alembic migration e1f2a3b4c5d6 but not applied to Supabase.

ALTER TABLE template_assignments ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE template_assignments ADD COLUMN IF NOT EXISTS locked_by VARCHAR(36);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS processed_file_path VARCHAR(500);
