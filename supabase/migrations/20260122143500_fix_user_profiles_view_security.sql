-- Fix security for user_profiles_with_email
-- Replace insecure view with a SECURITY DEFINER function that only admins can use

-- Step 1: Drop the existing view
DROP VIEW IF EXISTS public.user_profiles_with_email;

-- Step 2: Create a secure function that only returns data for admins
CREATE OR REPLACE FUNCTION public.get_user_profiles_with_email()
RETURNS TABLE (
  user_id uuid,
  name text,
  avatar_url text,
  role app_role,
  created_at timestamptz,
  updated_at timestamptz,
  email varchar(255)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if current user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  ) THEN
    -- Return empty result for non-admins
    RETURN;
  END IF;

  -- Return all user profiles with email for admins
  RETURN QUERY
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
END;
$$;

-- Step 3: Grant execute permission to authenticated users
-- The function itself checks for admin role internally
GRANT EXECUTE ON FUNCTION public.get_user_profiles_with_email() TO authenticated;

-- Step 4: Revoke from anon (anonymous users should never call this)
REVOKE EXECUTE ON FUNCTION public.get_user_profiles_with_email() FROM anon;

-- Step 5: Add documentation
COMMENT ON FUNCTION public.get_user_profiles_with_email() IS
'Secure function to get user profiles with email addresses.
Only returns data when called by an admin user.
Non-admins receive an empty result set.';
