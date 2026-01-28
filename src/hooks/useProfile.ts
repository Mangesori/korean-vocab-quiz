import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ProfileData {
  user_id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  preferred_language: string | null;
  study_goal: string | null;
  daily_word_count: number | null;
  theme_preference: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdateData {
  name?: string;
  avatar_url?: string | null;
  bio?: string | null;
  preferred_language?: string | null;
  study_goal?: string | null;
  daily_word_count?: number | null;
  theme_preference?: string | null;
}

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data as ProfileData;
    },
    enabled: !!user?.id,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: ProfileUpdateData) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast.success('프로필이 업데이트되었습니다.');
    },
    onError: (error) => {
      console.error('Profile update error:', error);
      toast.error('프로필 업데이트에 실패했습니다.');
    },
  });

  return {
    profile,
    isLoading,
    error,
    updateProfile: updateProfileMutation.mutate,
    isUpdating: updateProfileMutation.isPending,
  };
}
