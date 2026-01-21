
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Class {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
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
        .order("created_at", { ascending: false }); // Newest first

      if (error) throw error;
      if (data) setClasses(data);
    } catch (error) {
      console.error("Error fetching classes:", error);
    } finally {
      setLoading(false);
    }
  };

  return { classes, loading, refetchClasses: fetchClasses };
}
