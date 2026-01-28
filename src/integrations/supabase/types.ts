Initialising login role...
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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          class_id: string
          content: string
          created_at: string | null
          id: string
          is_pinned: boolean | null
          priority: string | null
          teacher_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          class_id: string
          content: string
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          priority?: string | null
          teacher_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          class_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          priority?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
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
        ]
      }
      notifications: {
        Row: {
          announcement_id: string | null
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
          announcement_id?: string | null
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
          announcement_id?: string | null
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
            foreignKeyName: "notifications_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          daily_word_count: number | null
          name: string
          preferred_language:
            | Database["public"]["Enums"]["translation_language"]
            | null
          role: Database["public"]["Enums"]["app_role"]
          study_goal: string | null
          theme_preference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          daily_word_count?: number | null
          name: string
          preferred_language?:
            | Database["public"]["Enums"]["translation_language"]
            | null
          role: Database["public"]["Enums"]["app_role"]
          study_goal?: string | null
          theme_preference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          daily_word_count?: number | null
          name?: string
          preferred_language?:
            | Database["public"]["Enums"]["translation_language"]
            | null
          role?: Database["public"]["Enums"]["app_role"]
          study_goal?: string | null
          theme_preference?: string | null
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
          student_id: string | null
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
          student_id?: string | null
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
          student_id?: string | null
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
          api_provider: string | null
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
          api_provider?: string | null
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
          api_provider?: string | null
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
        ]
      }
      vocabulary_lists: {
        Row: {
          created_at: string | null
          example_sentence: string | null
          id: string
          is_favorite: boolean | null
          mastery_level: number | null
          meaning: string | null
          notes: string | null
          source_quiz_id: string | null
          student_id: string
          updated_at: string | null
          word: string
        }
        Insert: {
          created_at?: string | null
          example_sentence?: string | null
          id?: string
          is_favorite?: boolean | null
          mastery_level?: number | null
          meaning?: string | null
          notes?: string | null
          source_quiz_id?: string | null
          student_id: string
          updated_at?: string | null
          word: string
        }
        Update: {
          created_at?: string | null
          example_sentence?: string | null
          id?: string
          is_favorite?: boolean | null
          mastery_level?: number | null
          meaning?: string | null
          notes?: string | null
          source_quiz_id?: string | null
          student_id?: string
          updated_at?: string | null
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocabulary_lists_source_quiz_id_fkey"
            columns: ["source_quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vocabulary_lists_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wrong_answer_notebook: {
        Row: {
          correct_answer: string
          created_at: string | null
          id: string
          is_mastered: boolean | null
          last_reviewed_at: string | null
          problem_id: string
          quiz_result_id: string
          review_count: number | null
          sentence: string
          student_id: string
          translation: string | null
          user_answer: string
          word: string
        }
        Insert: {
          correct_answer: string
          created_at?: string | null
          id?: string
          is_mastered?: boolean | null
          last_reviewed_at?: string | null
          problem_id: string
          quiz_result_id: string
          review_count?: number | null
          sentence: string
          student_id: string
          translation?: string | null
          user_answer: string
          word: string
        }
        Update: {
          correct_answer?: string
          created_at?: string | null
          id?: string
          is_mastered?: boolean | null
          last_reviewed_at?: string | null
          problem_id?: string
          quiz_result_id?: string
          review_count?: number | null
          sentence?: string
          student_id?: string
          translation?: string | null
          user_answer?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "wrong_answer_notebook_quiz_result_id_fkey"
            columns: ["quiz_result_id"]
            isOneToOne: false
            referencedRelation: "quiz_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wrong_answer_notebook_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
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
      get_user_profiles_with_email: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          email: string
          name: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }[]
      }
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
      is_admin: { Args: never; Returns: boolean }
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
      is_teacher: { Args: never; Returns: boolean }
      is_teacher_or_admin:
        | { Args: never; Returns: boolean }
        | { Args: { user_id: string }; Returns: boolean }
      notify_quiz_completion: {
        Args: { _anonymous_name: string; _quiz_id: string }
        Returns: undefined
      }
      submit_quiz_answers: {
        Args: { _quiz_id: string; _student_answers: Json }
        Returns: Json
      }
    }
    Enums: {
      app_role: "teacher" | "student" | "admin"
      difficulty_level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
      notification_type: "quiz_assigned" | "quiz_completed" | "announcement"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["teacher", "student", "admin"],
      difficulty_level: ["A1", "A2", "B1", "B2", "C1", "C2"],
      notification_type: ["quiz_assigned", "quiz_completed", "announcement"],
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
A new version of Supabase CLI is available: v2.72.7 (currently installed v2.70.5)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
