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
      feedback: {
        Row: {
          context: string | null
          created_at: string
          email: string | null
          id: string
          message: string
          rating: number | null
          user_id: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message: string
          rating?: number | null
          user_id?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          rating?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      live_participants: {
        Row: {
          display_name: string
          id: string
          is_guest: boolean
          joined_at: string
          left_at: string | null
          session_id: string
          student_id: string | null
        }
        Insert: {
          display_name: string
          id?: string
          is_guest?: boolean
          joined_at?: string
          left_at?: string | null
          session_id: string
          student_id?: string | null
        }
        Update: {
          display_name?: string
          id?: string
          is_guest?: boolean
          joined_at?: string
          left_at?: string | null
          session_id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          class_id: string | null
          created_at: string
          ended_at: string | null
          id: string
          join_code: string
          quiz_id: string
          settings: Json
          stages: string[]
          started_at: string | null
          status: string
          teacher_id: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          join_code: string
          quiz_id: string
          settings?: Json
          stages?: string[]
          started_at?: string | null
          status?: string
          teacher_id: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          join_code?: string
          quiz_id?: string
          settings?: Json
          stages?: string[]
          started_at?: string | null
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      matchup_answers: {
        Row: {
          attempt_number: number
          created_at: string
          id: string
          is_correct: boolean | null
          problem_id: string
          quiz_id: string
          result_id: string | null
          selected_meaning: string | null
          student_id: string | null
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          id?: string
          is_correct?: boolean | null
          problem_id: string
          quiz_id: string
          result_id?: string | null
          selected_meaning?: string | null
          student_id?: string | null
        }
        Update: {
          attempt_number?: number
          created_at?: string
          id?: string
          is_correct?: boolean | null
          problem_id?: string
          quiz_id?: string
          result_id?: string | null
          selected_meaning?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matchup_answers_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_answers_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "quiz_results"
            referencedColumns: ["id"]
          },
        ]
      }
      matchup_problems: {
        Row: {
          created_at: string
          id: string
          korean_text: string
          meaning_text: string
          problem_id: string
          quiz_id: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          korean_text: string
          meaning_text: string
          problem_id: string
          quiz_id: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          korean_text?: string
          meaning_text?: string
          problem_id?: string
          quiz_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matchup_problems_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
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
      plan_limits: {
        Row: {
          period: string
          plan: Database["public"]["Enums"]["plan_tier"]
          quiz_limit: number | null
          updated_at: string
        }
        Insert: {
          period: string
          plan: Database["public"]["Enums"]["plan_tier"]
          quiz_limit?: number | null
          updated_at?: string
        }
        Update: {
          period?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          quiz_limit?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          daily_word_count: number | null
          name: string
          plan: Database["public"]["Enums"]["plan_tier"]
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
          plan?: Database["public"]["Enums"]["plan_tier"]
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
          plan?: Database["public"]["Enums"]["plan_tier"]
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
          fill_blank_score: number | null
          fill_blank_total: number | null
          id: string
          is_anonymous: boolean
          matchup_score: number | null
          matchup_total: number | null
          quiz_id: string
          recording_score: number | null
          recording_total: number | null
          score: number
          sentence_making_score: number | null
          sentence_making_total: number | null
          share_token: string | null
          student_id: string | null
          total_questions: number
          type_answer_score: number | null
          type_answer_total: number | null
          viewed_at: string | null
          word_magnet_score: number | null
          word_magnet_total: number | null
        }
        Insert: {
          anonymous_name?: string | null
          answers?: Json
          completed_at?: string
          fill_blank_score?: number | null
          fill_blank_total?: number | null
          id?: string
          is_anonymous?: boolean
          matchup_score?: number | null
          matchup_total?: number | null
          quiz_id: string
          recording_score?: number | null
          recording_total?: number | null
          score: number
          sentence_making_score?: number | null
          sentence_making_total?: number | null
          share_token?: string | null
          student_id?: string | null
          total_questions: number
          type_answer_score?: number | null
          type_answer_total?: number | null
          viewed_at?: string | null
          word_magnet_score?: number | null
          word_magnet_total?: number | null
        }
        Update: {
          anonymous_name?: string | null
          answers?: Json
          completed_at?: string
          fill_blank_score?: number | null
          fill_blank_total?: number | null
          id?: string
          is_anonymous?: boolean
          matchup_score?: number | null
          matchup_total?: number | null
          quiz_id?: string
          recording_score?: number | null
          recording_total?: number | null
          score?: number
          sentence_making_score?: number | null
          sentence_making_total?: number | null
          share_token?: string | null
          student_id?: string | null
          total_questions?: number
          type_answer_score?: number | null
          type_answer_total?: number | null
          viewed_at?: string | null
          word_magnet_score?: number | null
          word_magnet_total?: number | null
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
          fill_blank_enabled: boolean
          id: string
          kind: string | null
          matchup_enabled: boolean
          problems: Json
          recording_enabled: boolean
          sentence_making_enabled: boolean
          source: string | null
          teacher_id: string
          timer_enabled: boolean
          timer_seconds: number | null
          title: string
          translation_language: Database["public"]["Enums"]["translation_language"]
          type_answer_enabled: boolean
          updated_at: string
          word_magnet_enabled: boolean
          words: string[]
          words_per_set: number
        }
        Insert: {
          api_provider?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          fill_blank_enabled?: boolean
          id?: string
          kind?: string | null
          matchup_enabled?: boolean
          problems?: Json
          recording_enabled?: boolean
          sentence_making_enabled?: boolean
          source?: string | null
          teacher_id: string
          timer_enabled?: boolean
          timer_seconds?: number | null
          title: string
          translation_language?: Database["public"]["Enums"]["translation_language"]
          type_answer_enabled?: boolean
          updated_at?: string
          word_magnet_enabled?: boolean
          words: string[]
          words_per_set?: number
        }
        Update: {
          api_provider?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          fill_blank_enabled?: boolean
          id?: string
          kind?: string | null
          matchup_enabled?: boolean
          problems?: Json
          recording_enabled?: boolean
          sentence_making_enabled?: boolean
          source?: string | null
          teacher_id?: string
          timer_enabled?: boolean
          timer_seconds?: number | null
          title?: string
          translation_language?: Database["public"]["Enums"]["translation_language"]
          type_answer_enabled?: boolean
          updated_at?: string
          word_magnet_enabled?: boolean
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
      recording_answers: {
        Row: {
          accuracy_score: number | null
          attempt_number: number
          completeness_score: number | null
          created_at: string
          fluency_score: number | null
          id: string
          is_passed: boolean | null
          overall_score: number | null
          problem_id: string
          pronunciation_score: number | null
          prosody_score: number | null
          quiz_id: string
          recognized_text: string | null
          recording_duration_seconds: number | null
          recording_url: string
          result_id: string | null
          student_id: string | null
          word_level_feedback: Json | null
        }
        Insert: {
          accuracy_score?: number | null
          attempt_number?: number
          completeness_score?: number | null
          created_at?: string
          fluency_score?: number | null
          id?: string
          is_passed?: boolean | null
          overall_score?: number | null
          problem_id: string
          pronunciation_score?: number | null
          prosody_score?: number | null
          quiz_id: string
          recognized_text?: string | null
          recording_duration_seconds?: number | null
          recording_url: string
          result_id?: string | null
          student_id?: string | null
          word_level_feedback?: Json | null
        }
        Update: {
          accuracy_score?: number | null
          attempt_number?: number
          completeness_score?: number | null
          created_at?: string
          fluency_score?: number | null
          id?: string
          is_passed?: boolean | null
          overall_score?: number | null
          problem_id?: string
          pronunciation_score?: number | null
          prosody_score?: number | null
          quiz_id?: string
          recognized_text?: string | null
          recording_duration_seconds?: number | null
          recording_url?: string
          result_id?: string | null
          student_id?: string | null
          word_level_feedback?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "recording_answers_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recording_answers_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "quiz_results"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_problems: {
        Row: {
          created_at: string
          id: string
          label: string | null
          mode: Database["public"]["Enums"]["recording_mode"]
          problem_id: string
          quiz_id: string
          sentence: string
          sentence_audio_url: string | null
          sort_order: number | null
          source_problem_id: string | null
          source_type: Database["public"]["Enums"]["sentence_source"]
          translation: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          mode?: Database["public"]["Enums"]["recording_mode"]
          problem_id: string
          quiz_id: string
          sentence: string
          sentence_audio_url?: string | null
          sort_order?: number | null
          source_problem_id?: string | null
          source_type?: Database["public"]["Enums"]["sentence_source"]
          translation?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          mode?: Database["public"]["Enums"]["recording_mode"]
          problem_id?: string
          quiz_id?: string
          sentence?: string
          sentence_audio_url?: string | null
          sort_order?: number | null
          source_problem_id?: string | null
          source_type?: Database["public"]["Enums"]["sentence_source"]
          translation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recording_problems_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      sentence_bank: {
        Row: {
          answer: string
          batch_label: string | null
          created_at: string
          created_by: string | null
          hint: string | null
          id: string
          level: string
          meaning: string | null
          sentence: string
          seq: number
          source: string
          translation: string | null
          word: string
        }
        Insert: {
          answer: string
          batch_label?: string | null
          created_at?: string
          created_by?: string | null
          hint?: string | null
          id?: string
          level: string
          meaning?: string | null
          sentence: string
          seq?: number
          source?: string
          translation?: string | null
          word: string
        }
        Update: {
          answer?: string
          batch_label?: string | null
          created_at?: string
          created_by?: string | null
          hint?: string | null
          id?: string
          level?: string
          meaning?: string | null
          sentence?: string
          seq?: number
          source?: string
          translation?: string | null
          word?: string
        }
        Relationships: []
      }
      sentence_making_answers: {
        Row: {
          ai_feedback: string | null
          attempt_number: number
          created_at: string
          errors: Json | null
          grammar_score: number | null
          id: string
          is_passed: boolean | null
          is_skipped: boolean
          model_answer: string | null
          naturalness_score: number | null
          problem_id: string
          quiz_id: string
          result_id: string | null
          student_id: string | null
          student_sentence: string
          total_score: number | null
          word_usage_score: number | null
        }
        Insert: {
          ai_feedback?: string | null
          attempt_number?: number
          created_at?: string
          errors?: Json | null
          grammar_score?: number | null
          id?: string
          is_passed?: boolean | null
          is_skipped?: boolean
          model_answer?: string | null
          naturalness_score?: number | null
          problem_id: string
          quiz_id: string
          result_id?: string | null
          student_id?: string | null
          student_sentence: string
          total_score?: number | null
          word_usage_score?: number | null
        }
        Update: {
          ai_feedback?: string | null
          attempt_number?: number
          created_at?: string
          errors?: Json | null
          grammar_score?: number | null
          id?: string
          is_passed?: boolean | null
          is_skipped?: boolean
          model_answer?: string | null
          naturalness_score?: number | null
          problem_id?: string
          quiz_id?: string
          result_id?: string | null
          student_id?: string | null
          student_sentence?: string
          total_score?: number | null
          word_usage_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sentence_making_answers_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sentence_making_answers_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "quiz_results"
            referencedColumns: ["id"]
          },
        ]
      }
      sentence_making_problems: {
        Row: {
          created_at: string
          grading_criteria: Json | null
          id: string
          model_answer: string
          problem_id: string
          quiz_id: string
          sort_order: number | null
          word: string
          word_meaning: string | null
        }
        Insert: {
          created_at?: string
          grading_criteria?: Json | null
          id?: string
          model_answer: string
          problem_id: string
          quiz_id: string
          sort_order?: number | null
          word: string
          word_meaning?: string | null
        }
        Update: {
          created_at?: string
          grading_criteria?: Json | null
          id?: string
          model_answer?: string
          problem_id?: string
          quiz_id?: string
          sort_order?: number | null
          word?: string
          word_meaning?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sentence_making_problems_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_applications: {
        Row: {
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      type_answer_answers: {
        Row: {
          attempt_number: number
          created_at: string
          id: string
          is_correct: boolean | null
          is_skipped: boolean
          problem_id: string
          quiz_id: string
          result_id: string | null
          student_answer: string | null
          student_id: string | null
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          id?: string
          is_correct?: boolean | null
          is_skipped?: boolean
          problem_id: string
          quiz_id: string
          result_id?: string | null
          student_answer?: string | null
          student_id?: string | null
        }
        Update: {
          attempt_number?: number
          created_at?: string
          id?: string
          is_correct?: boolean | null
          is_skipped?: boolean
          problem_id?: string
          quiz_id?: string
          result_id?: string | null
          student_answer?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "type_answer_answers_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "type_answer_answers_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "quiz_results"
            referencedColumns: ["id"]
          },
        ]
      }
      type_answer_problems: {
        Row: {
          answer: string
          created_at: string
          id: string
          problem_id: string
          prompt: string
          quiz_id: string
          sort_order: number | null
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          problem_id: string
          prompt: string
          quiz_id: string
          sort_order?: number | null
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          problem_id?: string
          prompt?: string
          quiz_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "type_answer_problems_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
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
      word_magnet_answers: {
        Row: {
          attempt_number: number
          created_at: string
          id: string
          is_correct: boolean | null
          is_skipped: boolean
          problem_id: string
          quiz_id: string
          result_id: string | null
          student_id: string | null
          student_sentence: string | null
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          id?: string
          is_correct?: boolean | null
          is_skipped?: boolean
          problem_id: string
          quiz_id: string
          result_id?: string | null
          student_id?: string | null
          student_sentence?: string | null
        }
        Update: {
          attempt_number?: number
          created_at?: string
          id?: string
          is_correct?: boolean | null
          is_skipped?: boolean
          problem_id?: string
          quiz_id?: string
          result_id?: string | null
          student_id?: string | null
          student_sentence?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "word_magnet_answers_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "word_magnet_answers_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "quiz_results"
            referencedColumns: ["id"]
          },
        ]
      }
      word_magnet_problems: {
        Row: {
          base_text: string
          created_at: string
          id: string
          items: Json
          problem_id: string
          quiz_id: string
          sort_order: number | null
          translation: string | null
        }
        Insert: {
          base_text: string
          created_at?: string
          id?: string
          items?: Json
          problem_id: string
          quiz_id: string
          sort_order?: number | null
          translation?: string | null
        }
        Update: {
          base_text?: string
          created_at?: string
          id?: string
          items?: Json
          problem_id?: string
          quiz_id?: string
          sort_order?: number | null
          translation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "word_magnet_problems_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
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
      wrong_answer_progress: {
        Row: {
          correct_streak: number
          due_at: string | null
          last_practiced_at: string
          level: string | null
          mastered_at: string | null
          stage: number
          student_id: string
          word: string
        }
        Insert: {
          correct_streak?: number
          due_at?: string | null
          last_practiced_at?: string
          level?: string | null
          mastered_at?: string | null
          stage?: number
          student_id: string
          word: string
        }
        Update: {
          correct_streak?: number
          due_at?: string | null
          last_practiced_at?: string
          level?: string | null
          mastered_at?: string | null
          stage?: number
          student_id?: string
          word?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _apply_srs_word_result: {
        Args: { _correct: boolean; _uid: string; _word: string }
        Returns: boolean
      }
      ensure_quiz_result: { Args: { _quiz_id: string }; Returns: Json }
      finalize_quiz_result: { Args: { _result_id: string }; Returns: undefined }
      find_live_session_by_code: {
        Args: { p_code: string }
        Returns: {
          allow_guests: boolean
          id: string
          quiz_id: string
          quiz_title: string
          status: string
        }[]
      }
      generate_invite_code: { Args: never; Returns: string }
      generate_live_join_code: { Args: never; Returns: string }
      get_class_by_invite_code: {
        Args: { _invite_code: string }
        Returns: {
          description: string
          id: string
          name: string
        }[]
      }
      get_class_srs_summary: {
        Args: { _class_id: string }
        Returns: {
          due_now_count: number
          stage: number
          student_id: string
          word_count: number
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
      get_class_wrong_answers: {
        Args: { _student_ids: string[] }
        Returns: Json
      }
      get_due_review_items: {
        Args: { _limit?: number }
        Returns: {
          answer: string
          due_at: string
          hint: string
          level: string
          meaning: string
          overdue_days: number
          sentence: string
          sentence_from: string
          slot: number
          stage: number
          translation: string
          word: string
        }[]
      }
      get_due_review_words: {
        Args: { _limit?: number }
        Returns: {
          due_at: string
          overdue_days: number
          stage: number
          word: string
        }[]
      }
      get_quiz_for_live_session: {
        Args: { _participant_id: string; _session_id: string }
        Returns: Json
      }
      get_quiz_for_student: { Args: { _quiz_id: string }; Returns: Json }
      get_sentence_bank_coverage: {
        Args: never
        Returns: {
          level: string
          total_words: number
          words_with_2plus: number
        }[]
      }
      get_student_wrong_answers: {
        Args: { _student_id: string }
        Returns: Json
      }
      get_type_answer_problems_for_student: {
        Args: { _quiz_id: string }
        Returns: Json
      }
      get_type_answer_result_detail: {
        Args: { _result_id: string }
        Returns: Json
      }
      get_upcoming_review_items: {
        Args: { _limit?: number }
        Returns: {
          answer: string
          due_at: string
          hint: string
          level: string
          meaning: string
          overdue_days: number
          sentence: string
          sentence_from: string
          slot: number
          stage: number
          translation: string
          word: string
        }[]
      }
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
      get_word_magnet_problems_for_student: {
        Args: { _quiz_id: string }
        Returns: Json
      }
      get_word_magnet_result_detail: {
        Args: { _result_id: string }
        Returns: Json
      }
      grade_fill_blank: {
        Args: { _answers: Json; _quiz_id: string }
        Returns: Json
      }
      grade_type_answers: {
        Args: { _answers: Json; _quiz_id: string }
        Returns: Json
      }
      grade_word_magnets: {
        Args: { _answers: Json; _quiz_id: string }
        Returns: Json
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
      is_live_participant: { Args: { p_session_id: string }; Returns: boolean }
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
      join_live_session_as_guest: {
        Args: { p_code: string; p_name: string }
        Returns: {
          display_name: string
          id: string
          is_guest: boolean
          joined_at: string
          left_at: string | null
          session_id: string
          student_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "live_participants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      korean_subject_postfix: { Args: { name: string }; Returns: string }
      notify_class_teacher_on_join: {
        Args: { _class_id: string }
        Returns: undefined
      }
      notify_quiz_completion: {
        Args: { _anonymous_name: string; _quiz_id: string }
        Returns: undefined
      }
      quiz_quota_status: { Args: { _teacher_id: string }; Returns: Json }
      seed_review_schedule: { Args: { _result_id: string }; Returns: number }
      seed_review_words: {
        Args: { _per_day?: number; _student_id: string; _words: Json }
        Returns: Json
      }
      submit_quiz_answers:
        | { Args: { _quiz_id: string; _student_answers: Json }; Returns: Json }
        | {
            Args: {
              _problem_order?: string[]
              _quiz_id: string
              _result_id?: string
              _student_answers: Json
            }
            Returns: Json
          }
      update_quiz_progress_notification:
        | {
            Args: { _message: string; _quiz_id: string; _student_id: string }
            Returns: undefined
          }
        | {
            Args: {
              _message: string
              _quiz_id: string
              _stage: string
              _student_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _is_redo?: boolean
              _message: string
              _quiz_id: string
              _stage: string
              _student_id: string
            }
            Returns: undefined
          }
      update_quiz_result_matchup_score: {
        Args: { _result_id: string; _score: number; _total: number }
        Returns: undefined
      }
      update_quiz_result_recording_score: {
        Args: { _result_id: string; _score: number; _total: number }
        Returns: undefined
      }
      update_quiz_result_scores: {
        Args: {
          _fill_blank_score?: number
          _fill_blank_total?: number
          _recording_score?: number
          _recording_total?: number
          _result_id: string
          _sentence_making_score?: number
          _sentence_making_total?: number
        }
        Returns: undefined
      }
      update_quiz_result_sentence_score: {
        Args: { _result_id: string; _score: number; _total: number }
        Returns: undefined
      }
      update_quiz_result_type_answer_score: {
        Args: { _result_id: string; _score: number; _total: number }
        Returns: undefined
      }
      update_quiz_result_word_magnet_score: {
        Args: { _result_id: string; _score: number; _total: number }
        Returns: undefined
      }
      update_wa_progress: { Args: { _items: Json }; Returns: Json }
      upsert_sentence_bank: {
        Args: { _batch_label?: string; _rows: Json; _source?: string }
        Returns: number
      }
      wa_due_after: { Args: { _days: number }; Returns: string }
    }
    Enums: {
      app_role: "teacher" | "student" | "admin"
      difficulty_level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
      notification_type:
        | "quiz_assigned"
        | "quiz_completed"
        | "announcement"
        | "student_joined"
        | "teacher_application"
      plan_tier: "free" | "pro" | "school"
      recording_mode: "read" | "listen"
      sentence_source: "reuse" | "ai_generated" | "teacher_input"
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
      notification_type: [
        "quiz_assigned",
        "quiz_completed",
        "announcement",
        "student_joined",
        "teacher_application",
      ],
      plan_tier: ["free", "pro", "school"],
      recording_mode: ["read", "listen"],
      sentence_source: ["reuse", "ai_generated", "teacher_input"],
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
