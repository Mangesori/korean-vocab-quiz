
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Class {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
  member_count: number;
}

export function useClasses(userId: string | undefined) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchClasses();
    }
  }, [userId]);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("teacher_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data) return;

      const { data: members } = await supabase
        .from("class_members")
        .select("class_id")
        .in("class_id", data.map((c) => c.id));

      setClasses(
        data.map((c) => ({
          ...c,
          member_count: members?.filter((m) => m.class_id === c.id).length ?? 0,
        }))
      );
    } catch (error) {
      console.error("Error fetching classes:", error);
    } finally {
      setLoading(false);
    }
  };

  return { classes, loading, refetchClasses: fetchClasses };
}
