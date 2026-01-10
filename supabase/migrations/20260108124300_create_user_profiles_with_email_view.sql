-- Create a secure view that joins profiles with auth.users to expose email
-- This view is only accessible to admins for user management purposes
CREATE OR REPLACE VIEW public.user_profiles_with_email AS
SELECT 
  p.user_id,
  p.name,
  p.avatar_url,
  p.role,
  p.created_at,
  p.updated_at,
  au.email
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.user_id;

-- Enable RLS on the view
ALTER VIEW public.user_profiles_with_email SET (security_invoker = true);

-- Grant access to authenticated users
GRANT SELECT ON public.user_profiles_with_email TO authenticated;

-- Create RLS policy: Only admins can view this data
CREATE POLICY "Only admins can view user profiles with email"
  ON public.user_profiles_with_email
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );
