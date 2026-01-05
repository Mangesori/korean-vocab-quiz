-- Create a secure view for classes that hides invite_code from students
CREATE OR REPLACE VIEW public.classes_view AS
SELECT 
  id,
  name,
  description,
  teacher_id,
  created_at,
  updated_at,
  CASE 
    WHEN teacher_id = auth.uid() THEN invite_code
    WHEN public.has_role(auth.uid(), 'admin') THEN invite_code
    ELSE NULL 
  END AS invite_code
FROM public.classes;

-- Grant access to the view
GRANT SELECT ON public.classes_view TO authenticated;

-- Add comment for documentation
COMMENT ON VIEW public.classes_view IS 'Secure view that hides invite_code from students - only teachers (owners) and admins can see the invite code';