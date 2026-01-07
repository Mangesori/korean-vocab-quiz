-- Add max_attempts column to quiz_shares table
ALTER TABLE public.quiz_shares
ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3;

-- Add comment for documentation
COMMENT ON COLUMN public.quiz_shares.max_attempts IS 'Maximum number of times this quiz can be attempted via the share link';
