-- Remove the overly permissive "Require authentication for profiles" policy
-- Other existing policies already properly restrict access:
-- 1. Users can view their own profile (user_id = auth.uid())
-- 2. Teachers can view student profiles in their classes (via EXISTS check)
-- 3. Admins can view all profiles (via has_role check)

DROP POLICY IF EXISTS "Require authentication for profiles" ON public.profiles;