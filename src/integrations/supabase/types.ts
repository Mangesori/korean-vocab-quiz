export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      class_members: {
        Row: {
          class_id: string
          id: string
          joined_at: string
          student_id: string
        }
        Insert: {
          class_id: string
          id?: string
          joined_at?: string
          student_id: string
        }
        Update: {
          class_id?: string
          id?: string
          joined_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "class_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["user_id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          invite_code: string
          name: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          invite_code: string
          name: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          name?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          from_user_id: string | null
          id: string
          is_read: boolean
          message: string
          quiz_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          from_user_id?: string | null
          id?: string
          is_read?: boolean
          message: string
          quiz_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          from_user_id?: string | null
          id?: string
          is_read?: boolean
          message?: string
          quiz_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          name: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          name: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          name?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_answers: {
        Row: {
          correct_answer: string
          id: string
          problem_id: string
          quiz_id: string
          word: string
        }
        Insert: {
          correct_answer: string
          id?: string
          problem_id: string
          quiz_id: string
          word: string
        }
        Update: {
          correct_answer?: string
          id?: string
          problem_id?: string
          quiz_id?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_assignments: {
        Row: {
          assigned_at: string
          class_id: string | null
          id: string
          quiz_id: string
          student_id: string | null
        }
        Insert: {
          assigned_at?: string
          class_id?: string | null
          id?: string
          quiz_id: string
          student_id?: string | null
        }
        Update: {
          assigned_at?: string
          class_id?: string | null
          id?: string
          quiz_id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_assignments_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_problems: {
        Row: {
          created_at: string
          hint: string | null
          hint_audio_url: string | null
          id: string
          problem_id: string
          quiz_id: string
          sentence: string
          sentence_audio_url: string | null
          translation: string | null
          word: string
        }
        Insert: {
          created_at?: string
          hint?: string | null
          hint_audio_url?: string | null
          id?: string
          problem_id: string
          quiz_id: string
          sentence: string
          sentence_audio_url?: string | null
          translation?: string | null
          word: string
        }
        Update: {
          created_at?: string
          hint?: string | null
          hint_audio_url?: string | null
          id?: string
          problem_id?: string
          quiz_id?: string
          sentence?: string
          sentence_audio_url?: string | null
          translation?: string | null
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_problems_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_results: {
        Row: {
          anonymous_name: string | null
          answers: Json
          completed_at: string
          id: string
          is_anonymous: boolean
          quiz_id: string
          score: number
          share_token: string | null
          student_id: string
          total_questions: number
        }
        Insert: {
          anonymous_name?: string | null
          answers?: Json
          completed_at?: string
          id?: string
          is_anonymous?: boolean
          quiz_id: string
          score: number
          share_token?: string | null
          student_id: string
          total_questions: number
        }
        Update: {
          anonymous_name?: string | null
          answers?: Json
          completed_at?: string
          id?: string
          is_anonymous?: boolean
          quiz_id?: string
          score?: number
          share_token?: string | null
          student_id?: string
          total_questions?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_results_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_results_share_token_fkey"
            columns: ["share_token"]
            isOneToOne: false
            referencedRelation: "quiz_shares"
            referencedColumns: ["share_token"]
          },
          {
            foreignKeyName: "quiz_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "quiz_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["user_id"]
          },
        ]
      }
      quiz_shares: {
        Row: {
          allow_anonymous: boolean
          completion_count: number
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          max_attempts: number
          quiz_id: string
          share_token: string
          view_count: number
        }
        Insert: {
          allow_anonymous?: boolean
          completion_count?: number
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          max_attempts?: number
          quiz_id: string
          share_token: string
          view_count?: number
        }
        Update: {
          allow_anonymous?: boolean
          completion_count?: number
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          max_attempts?: number
          quiz_id?: string
          share_token?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_shares_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "quiz_shares_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "quiz_shares_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          id: string
          problems: Json
          teacher_id: string
          timer_enabled: boolean
          timer_seconds: number | null
          title: string
          translation_language: Database["public"]["Enums"]["translation_language"]
          updated_at: string
          words: string[]
          words_per_set: number
        }
        Insert: {
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          id?: string
          problems?: Json
          teacher_id: string
          timer_enabled?: boolean
          timer_seconds?: number | null
          title: string
          translation_language?: Database["public"]["Enums"]["translation_language"]
          updated_at?: string
          words: string[]
          words_per_set?: number
        }
        Update: {
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          id?: string
          problems?: Json
          teacher_id?: string
          timer_enabled?: boolean
          timer_seconds?: number | null
          title?: string
          translation_language?: Database["public"]["Enums"]["translation_language"]
          updated_at?: string
          words?: string[]
          words_per_set?: number
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "quizzes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_with_email"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      user_profiles_with_email: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          name: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_invite_code: { Args: never; Returns: string }
      get_class_by_invite_code: {
        Args: { _invite_code: string }
        Returns: {
          description: string
          id: string
          name: string
        }[]
      }
      get_class_with_secure_invite_code: {
        Args: { _class_id: string }
        Returns: {
          created_at: string
          description: string
          id: string
          invite_code: string
          name: string
          teacher_id: string
          updated_at: string
        }[]
      }
      get_quiz_for_student: { Args: { _quiz_id: string }; Returns: Json }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_class_member: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      is_class_teacher: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      is_quiz_assigned_to_student: {
        Args: { _quiz_id: string; _user_id: string }
        Returns: boolean
      }
      is_quiz_owner: {
        Args: { _quiz_id: string; _user_id: string }
        Returns: boolean
      }
      submit_quiz_answers: {
        Args: { _quiz_id: string; _student_answers: Json }
        Returns: Json
      }
    }
    Enums: {
      app_role: "teacher" | "student" | "admin"
      difficulty_level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
      notification_type: "quiz_assigned" | "quiz_completed"
      translation_language:
        | "en"
        | "zh_CN"
        | "zh_TW"
        | "ja"
        | "vi"
        | "th"
        | "id"
        | "es"
        | "fr"
        | "de"
        | "ru"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["teacher", "student", "admin"],
      difficulty_level: ["A1", "A2", "B1", "B2", "C1", "C2"],
      notification_type: ["quiz_assigned", "quiz_completed"],
      translation_language: [
        "en",
        "zh_CN",
        "zh_TW",
        "ja",
        "vi",
        "th",
        "id",
        "es",
        "fr",
        "de",
        "ru",
      ],
    },
  },
} as const
