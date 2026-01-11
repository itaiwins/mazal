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
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      colleges: {
        Row: {
          campus_radius_km: number | null
          city: string | null
          country: string | null
          has_chabad: boolean | null
          has_hillel: boolean | null
          id: string
          jewish_population_estimate: number | null
          latitude: number
          longitude: number
          name: string
          short_name: string | null
          state: string | null
        }
        Insert: {
          campus_radius_km?: number | null
          city?: string | null
          country?: string | null
          has_chabad?: boolean | null
          has_hillel?: boolean | null
          id?: string
          jewish_population_estimate?: number | null
          latitude: number
          longitude: number
          name: string
          short_name?: string | null
          state?: string | null
        }
        Update: {
          campus_radius_km?: number | null
          city?: string | null
          country?: string | null
          has_chabad?: boolean | null
          has_hillel?: boolean | null
          id?: string
          jewish_population_estimate?: number | null
          latitude?: number
          longitude?: number
          name?: string
          short_name?: string | null
          state?: string | null
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          last_message_at: string | null
          user1_id: string
          user1_unmatched: boolean | null
          user2_id: string
          user2_unmatched: boolean | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          user1_id: string
          user1_unmatched?: boolean | null
          user2_id: string
          user2_unmatched?: boolean | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          user1_id?: string
          user1_unmatched?: boolean | null
          user2_id?: string
          user2_unmatched?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_read: boolean | null
          match_id: string
          media_url: string | null
          message_type: string | null
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          match_id: string
          media_url?: string | null
          message_type?: string | null
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          match_id?: string
          media_url?: string | null
          message_type?: string | null
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reported_id: string
          reporter_id: string
          status: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reported_id: string
          reporter_id: string
          status?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reported_id?: string
          reporter_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_id_fkey"
            columns: ["reported_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      safta_accounts: {
        Row: {
          auth_id: string | null
          created_at: string
          display_name: string
          email: string
          id: string
          is_active: boolean | null
          relationship: string
        }
        Insert: {
          auth_id?: string | null
          created_at?: string
          display_name: string
          email: string
          id?: string
          is_active?: boolean | null
          relationship: string
        }
        Update: {
          auth_id?: string | null
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          is_active?: boolean | null
          relationship?: string
        }
        Relationships: []
      }
      safta_connections: {
        Row: {
          accepted_at: string | null
          connected_user_id: string
          created_at: string
          id: string
          safta_account_id: string
          status: string | null
        }
        Insert: {
          accepted_at?: string | null
          connected_user_id: string
          created_at?: string
          id?: string
          safta_account_id: string
          status?: string | null
        }
        Update: {
          accepted_at?: string | null
          connected_user_id?: string
          created_at?: string
          id?: string
          safta_account_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safta_connections_connected_user_id_fkey"
            columns: ["connected_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safta_connections_safta_account_id_fkey"
            columns: ["safta_account_id"]
            isOneToOne: false
            referencedRelation: "safta_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      safta_likes: {
        Row: {
          created_at: string
          for_user_id: string
          id: string
          liked_user_id: string
          note: string | null
          safta_account_id: string
          sent_at: string | null
          sent_to_user: boolean | null
        }
        Insert: {
          created_at?: string
          for_user_id: string
          id?: string
          liked_user_id: string
          note?: string | null
          safta_account_id: string
          sent_at?: string | null
          sent_to_user?: boolean | null
        }
        Update: {
          created_at?: string
          for_user_id?: string
          id?: string
          liked_user_id?: string
          note?: string | null
          safta_account_id?: string
          sent_at?: string | null
          sent_to_user?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "safta_likes_for_user_id_fkey"
            columns: ["for_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safta_likes_liked_user_id_fkey"
            columns: ["liked_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safta_likes_safta_account_id_fkey"
            columns: ["safta_account_id"]
            isOneToOne: false
            referencedRelation: "safta_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_locations: {
        Row: {
          college_name: string | null
          created_at: string
          id: string
          latitude: number
          location_type: string | null
          longitude: number
          name: string
          radius_km: number | null
          user_id: string
        }
        Insert: {
          college_name?: string | null
          created_at?: string
          id?: string
          latitude: number
          location_type?: string | null
          longitude: number
          name: string
          radius_km?: number | null
          user_id: string
        }
        Update: {
          college_name?: string | null
          created_at?: string
          id?: string
          latitude?: number
          location_type?: string | null
          longitude?: number
          name?: string
          radius_km?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          plan_type: string
          provider: string
          provider_subscription_id: string | null
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_type: string
          provider: string
          provider_subscription_id?: string | null
          started_at: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_type?: string
          provider?: string
          provider_subscription_id?: string | null
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      swipes: {
        Row: {
          action: string
          created_at: string
          id: string
          swiped_id: string
          swiper_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          swiped_id: string
          swiper_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          swiped_id?: string
          swiper_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "swipes_swiped_id_fkey"
            columns: ["swiped_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swipes_swiper_id_fkey"
            columns: ["swiper_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_type: string
          created_at: string
          id: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          badge_type: string
          created_at?: string
          id?: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          badge_type?: string
          created_at?: string
          id?: string
          user_id?: string
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_colleges: {
        Row: {
          college_id: string
          created_at: string
          graduation_year: number | null
          id: string
          is_visible: boolean | null
          status: string
          user_id: string
        }
        Insert: {
          college_id: string
          created_at?: string
          graduation_year?: number | null
          id?: string
          is_visible?: boolean | null
          status: string
          user_id: string
        }
        Update: {
          college_id?: string
          created_at?: string
          graduation_year?: number | null
          id?: string
          is_visible?: boolean | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_colleges_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_colleges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_photos: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean | null
          is_verified: boolean | null
          photo_order: number
          photo_url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          is_verified?: boolean | null
          photo_order: number
          photo_url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          is_verified?: boolean | null
          photo_order?: number
          photo_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_prompts: {
        Row: {
          answer: string
          created_at: string
          display_order: number
          id: string
          prompt_id: string
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          display_order: number
          id?: string
          prompt_id: string
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          display_order?: number
          id?: string
          prompt_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_prompts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_safta_stats: {
        Row: {
          total_safta_likes: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          total_safta_likes?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          total_safta_likes?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_safta_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_id: string | null
          avg_response_time_hours: number | null
          bio: string | null
          company: string | null
          created_at: string
          current_city: string | null
          current_country: string | null
          current_latitude: number | null
          current_longitude: number | null
          current_state: string | null
          date_of_birth: string
          display_name: string
          education: string | null
          elo_score: number | null
          email: string
          first_name: string
          gender: string
          gender_preference: string[]
          height_cm: number | null
          id: string
          instagram_access_token: string | null
          instagram_user_id: string | null
          is_active: boolean | null
          is_orthodox_only: boolean | null
          is_photo_verified: boolean | null
          is_premium: boolean | null
          is_verified: boolean | null
          jewish_background: string
          jewish_education: string | null
          keeps_kosher: string | null
          keeps_shabbat: string | null
          last_name: string | null
          location_updated_at: string | null
          looking_for: string
          observance_level: string | null
          occupation: string | null
          onboarding_complete: boolean | null
          partner_must_be_jewish: boolean | null
          phone: string | null
          raise_children_jewish: boolean | null
          response_rate: number | null
          school: string | null
          shabbat_mode_enabled: boolean | null
          shabbat_mode_end: string | null
          shabbat_mode_start: string | null
          show_instagram_friends: boolean | null
          synagogue_attendance: string | null
          updated_at: string
          wants_children: string | null
          willing_to_relocate: boolean | null
        }
        Insert: {
          auth_id?: string | null
          avg_response_time_hours?: number | null
          bio?: string | null
          company?: string | null
          created_at?: string
          current_city?: string | null
          current_country?: string | null
          current_latitude?: number | null
          current_longitude?: number | null
          current_state?: string | null
          date_of_birth: string
          display_name: string
          education?: string | null
          elo_score?: number | null
          email: string
          first_name: string
          gender: string
          gender_preference?: string[]
          height_cm?: number | null
          id?: string
          instagram_access_token?: string | null
          instagram_user_id?: string | null
          is_active?: boolean | null
          is_orthodox_only?: boolean | null
          is_photo_verified?: boolean | null
          is_premium?: boolean | null
          is_verified?: boolean | null
          jewish_background: string
          jewish_education?: string | null
          keeps_kosher?: string | null
          keeps_shabbat?: string | null
          last_name?: string | null
          location_updated_at?: string | null
          looking_for: string
          observance_level?: string | null
          occupation?: string | null
          onboarding_complete?: boolean | null
          partner_must_be_jewish?: boolean | null
          phone?: string | null
          raise_children_jewish?: boolean | null
          response_rate?: number | null
          school?: string | null
          shabbat_mode_enabled?: boolean | null
          shabbat_mode_end?: string | null
          shabbat_mode_start?: string | null
          show_instagram_friends?: boolean | null
          synagogue_attendance?: string | null
          updated_at?: string
          wants_children?: string | null
          willing_to_relocate?: boolean | null
        }
        Update: {
          auth_id?: string | null
          avg_response_time_hours?: number | null
          bio?: string | null
          company?: string | null
          created_at?: string
          current_city?: string | null
          current_country?: string | null
          current_latitude?: number | null
          current_longitude?: number | null
          current_state?: string | null
          date_of_birth?: string
          display_name?: string
          education?: string | null
          elo_score?: number | null
          email?: string
          first_name?: string
          gender?: string
          gender_preference?: string[]
          height_cm?: number | null
          id?: string
          instagram_access_token?: string | null
          instagram_user_id?: string | null
          is_active?: boolean | null
          is_orthodox_only?: boolean | null
          is_photo_verified?: boolean | null
          is_premium?: boolean | null
          is_verified?: boolean | null
          jewish_background?: string
          jewish_education?: string | null
          keeps_kosher?: string | null
          keeps_shabbat?: string | null
          last_name?: string | null
          location_updated_at?: string | null
          looking_for?: string
          observance_level?: string | null
          occupation?: string | null
          onboarding_complete?: boolean | null
          partner_must_be_jewish?: boolean | null
          phone?: string | null
          raise_children_jewish?: boolean | null
          response_rate?: number | null
          school?: string | null
          shabbat_mode_enabled?: boolean | null
          shabbat_mode_end?: string | null
          shabbat_mode_start?: string | null
          show_instagram_friends?: boolean | null
          synagogue_attendance?: string | null
          updated_at?: string
          wants_children?: string | null
          willing_to_relocate?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_distance: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
