-- Drop the view as views cannot have RLS applied directly
-- Instead, we'll handle this at the application level
DROP VIEW IF EXISTS public.classes_view;