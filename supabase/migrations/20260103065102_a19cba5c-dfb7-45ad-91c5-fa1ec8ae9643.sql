-- Create a secure function that returns class data with invite_code only for teachers/admins
CREATE OR REPLACE FUNCTION public.get_class_with_secure_invite_code(_class_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  invite_code text,
  teacher_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id,
    c.name,
    c.description,
    CASE 
      WHEN c.teacher_id = auth.uid() THEN c.invite_code
      WHEN public.has_role(auth.uid(), 'admin') THEN c.invite_code
      ELSE NULL 
    END AS invite_code,
    c.teacher_id,
    c.created_at,
    c.updated_at
  FROM public.classes c
  WHERE c.id = _class_id
    AND (
      c.teacher_id = auth.uid() 
      OR public.is_class_member(_class_id, auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    )
  LIMIT 1
$$;