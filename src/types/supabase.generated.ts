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
      community_settings: {
        Row: {
          browsing_allowed: boolean | null
          community: string
          direct_messaging_allowed: boolean | null
          id: string
          parent_approval_required: boolean | null
          photo_moderation_required: boolean | null
          photos_allowed: boolean | null
          photos_required: boolean | null
          shadchan_required: boolean | null
          show_age_by_default: boolean | null
          show_photos_by_default: boolean | null
          typical_dates_before_engagement: string | null
        }
        Insert: {
          browsing_allowed?: boolean | null
          community: string
          direct_messaging_allowed?: boolean | null
          id?: string
          parent_approval_required?: boolean | null
          photo_moderation_required?: boolean | null
          photos_allowed?: boolean | null
          photos_required?: boolean | null
          shadchan_required?: boolean | null
          show_age_by_default?: boolean | null
          show_photos_by_default?: boolean | null
          typical_dates_before_engagement?: string | null
        }
        Update: {
          browsing_allowed?: boolean | null
          community?: string
          direct_messaging_allowed?: boolean | null
          id?: string
          parent_approval_required?: boolean | null
          photo_moderation_required?: boolean | null
          photos_allowed?: boolean | null
          photos_required?: boolean | null
          shadchan_required?: boolean | null
          show_age_by_default?: boolean | null
          show_photos_by_default?: boolean | null
          typical_dates_before_engagement?: string | null
        }
        Relationships: []
      }
      family_connections: {
        Row: {
          approved_at: string | null
          can_respond_to_suggestions: boolean | null
          can_suggest_matches: boolean | null
          can_view_messages: boolean | null
          can_view_suggestions: boolean | null
          created_at: string
          family_user_id: string
          id: string
          receives_notifications: boolean | null
          relationship: string
          single_profile_id: string
          status: string | null
        }
        Insert: {
          approved_at?: string | null
          can_respond_to_suggestions?: boolean | null
          can_suggest_matches?: boolean | null
          can_view_messages?: boolean | null
          can_view_suggestions?: boolean | null
          created_at?: string
          family_user_id: string
          id?: string
          receives_notifications?: boolean | null
          relationship: string
          single_profile_id: string
          status?: string | null
        }
        Update: {
          approved_at?: string | null
          can_respond_to_suggestions?: boolean | null
          can_suggest_matches?: boolean | null
          can_view_messages?: boolean | null
          can_view_suggestions?: boolean | null
          created_at?: string
          family_user_id?: string
          id?: string
          receives_notifications?: boolean | null
          relationship?: string
          single_profile_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_connections_family_user_id_fkey"
            columns: ["family_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_connections_single_profile_id_fkey"
            columns: ["single_profile_id"]
            isOneToOne: false
            referencedRelation: "shidduch_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      notification_preferences: {
        Row: {
          created_at: string | null
          daily_picks: boolean | null
          id: string
          messages: boolean | null
          new_matches: boolean | null
          profile_views: boolean | null
          promotions: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          safta_activity: boolean | null
          super_likes: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          daily_picks?: boolean | null
          id?: string
          messages?: boolean | null
          new_matches?: boolean | null
          profile_views?: boolean | null
          promotions?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          safta_activity?: boolean | null
          super_likes?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          daily_picks?: boolean | null
          id?: string
          messages?: boolean | null
          new_matches?: boolean | null
          profile_views?: boolean | null
          promotions?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          safta_activity?: boolean | null
          super_likes?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          id: string
          sent_at: string | null
          status: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          id?: string
          sent_at?: string | null
          status?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          sent_at?: string | null
          status?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      orthodox_emails: {
        Row: {
          created_at: string | null
          email: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orthodox_emails_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string | null
          device_id: string | null
          id: string
          is_active: boolean | null
          platform: string
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_id?: string | null
          id?: string
          is_active?: boolean | null
          platform: string
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_id?: string | null
          id?: string
          is_active?: boolean | null
          platform?: string
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
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
          subscription_expires_at: string | null
          subscription_plan: string | null
          subscription_status: string | null
          user_id: string | null
        }
        Insert: {
          auth_id?: string | null
          created_at?: string
          display_name: string
          email: string
          id?: string
          is_active?: boolean | null
          relationship: string
          subscription_expires_at?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          user_id?: string | null
        }
        Update: {
          auth_id?: string | null
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          is_active?: boolean | null
          relationship?: string
          subscription_expires_at?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safta_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      safta_daily_usage: {
        Row: {
          created_at: string | null
          id: string
          recommendations_count: number | null
          safta_account_id: string
          updated_at: string | null
          usage_date: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          recommendations_count?: number | null
          safta_account_id: string
          updated_at?: string | null
          usage_date?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          recommendations_count?: number | null
          safta_account_id?: string
          updated_at?: string | null
          usage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "safta_daily_usage_safta_account_id_fkey"
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
      safta_messages: {
        Row: {
          connection_id: string
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          sender_id: string
          sender_type: string
        }
        Insert: {
          connection_id: string
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          sender_id: string
          sender_type: string
        }
        Update: {
          connection_id?: string
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          sender_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "safta_messages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "safta_connections"
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
      shabbat_schedules: {
        Row: {
          city: string | null
          id: string
          include_yom_tov: boolean | null
          is_enabled: boolean | null
          latitude: number | null
          longitude: number | null
          minutes_after_havdalah: number | null
          minutes_before_candles: number | null
          profile_id: string
          timezone: string | null
        }
        Insert: {
          city?: string | null
          id?: string
          include_yom_tov?: boolean | null
          is_enabled?: boolean | null
          latitude?: number | null
          longitude?: number | null
          minutes_after_havdalah?: number | null
          minutes_before_candles?: number | null
          profile_id: string
          timezone?: string | null
        }
        Update: {
          city?: string | null
          id?: string
          include_yom_tov?: boolean | null
          is_enabled?: boolean | null
          latitude?: number | null
          longitude?: number | null
          minutes_after_havdalah?: number | null
          minutes_before_candles?: number | null
          profile_id?: string
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shabbat_schedules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "shidduch_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shadchan_connections: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          id: string
          notes: string | null
          shadchan_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          shadchan_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          shadchan_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shadchan_connections_shadchan_id_fkey"
            columns: ["shadchan_id"]
            isOneToOne: false
            referencedRelation: "shadchanim"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shadchan_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shadchan_notes: {
        Row: {
          created_at: string
          id: string
          last_contacted_at: string | null
          next_followup_at: string | null
          notes: string
          priority: string | null
          profile_id: string
          shadchan_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_contacted_at?: string | null
          next_followup_at?: string | null
          notes: string
          priority?: string | null
          profile_id: string
          shadchan_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_contacted_at?: string | null
          next_followup_at?: string | null
          notes?: string
          priority?: string | null
          profile_id?: string
          shadchan_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shadchan_notes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "shidduch_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shadchan_recommendations: {
        Row: {
          created_at: string | null
          for_user_id: string
          id: string
          is_accepted: boolean | null
          is_viewed: boolean | null
          note: string | null
          recommended_user_id: string
          responded_at: string | null
          shadchan_id: string
          viewed_at: string | null
        }
        Insert: {
          created_at?: string | null
          for_user_id: string
          id?: string
          is_accepted?: boolean | null
          is_viewed?: boolean | null
          note?: string | null
          recommended_user_id: string
          responded_at?: string | null
          shadchan_id: string
          viewed_at?: string | null
        }
        Update: {
          created_at?: string | null
          for_user_id?: string
          id?: string
          is_accepted?: boolean | null
          is_viewed?: boolean | null
          note?: string | null
          recommended_user_id?: string
          responded_at?: string | null
          shadchan_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shadchan_recommendations_for_user_id_fkey"
            columns: ["for_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shadchan_recommendations_recommended_user_id_fkey"
            columns: ["recommended_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shadchan_recommendations_shadchan_id_fkey"
            columns: ["shadchan_id"]
            isOneToOne: false
            referencedRelation: "shadchanim"
            referencedColumns: ["id"]
          },
        ]
      }
      shadchanim: {
        Row: {
          bio: string | null
          created_at: string | null
          display_name: string
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          photo_url: string | null
          successful_matches: number | null
          updated_at: string | null
          user_id: string | null
          years_experience: number | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          photo_url?: string | null
          successful_matches?: number | null
          updated_at?: string | null
          user_id?: string | null
          years_experience?: number | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          photo_url?: string | null
          successful_matches?: number | null
          updated_at?: string | null
          user_id?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shadchanim_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shidduch_daily_activity: {
        Row: {
          date: string
          id: string
          profile_id: string
          profiles_researched: number | null
          suggestions_received: number | null
          suggestions_responded: number | null
          suggestions_viewed: number | null
        }
        Insert: {
          date?: string
          id?: string
          profile_id: string
          profiles_researched?: number | null
          suggestions_received?: number | null
          suggestions_responded?: number | null
          suggestions_viewed?: number | null
        }
        Update: {
          date?: string
          id?: string
          profile_id?: string
          profiles_researched?: number | null
          suggestions_received?: number | null
          suggestions_responded?: number | null
          suggestions_viewed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shidduch_daily_activity_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "shidduch_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shidduch_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          message_type: string | null
          proposed_date: string | null
          proposed_location: string | null
          read_by_a: boolean | null
          read_by_b: boolean | null
          read_by_shadchan: boolean | null
          sender_shadchan_id: string | null
          sender_type: string
          sender_user_id: string | null
          suggestion_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          message_type?: string | null
          proposed_date?: string | null
          proposed_location?: string | null
          read_by_a?: boolean | null
          read_by_b?: boolean | null
          read_by_shadchan?: boolean | null
          sender_shadchan_id?: string | null
          sender_type: string
          sender_user_id?: string | null
          suggestion_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          message_type?: string | null
          proposed_date?: string | null
          proposed_location?: string | null
          read_by_a?: boolean | null
          read_by_b?: boolean | null
          read_by_shadchan?: boolean | null
          sender_shadchan_id?: string | null
          sender_type?: string
          sender_user_id?: string | null
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shidduch_messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shidduch_messages_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "shidduch_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      shidduch_profile_views: {
        Row: {
          id: string
          profile_id: string
          view_duration_seconds: number | null
          view_source: string | null
          viewed_at: string
          viewer_profile_id: string | null
          viewer_user_id: string | null
        }
        Insert: {
          id?: string
          profile_id: string
          view_duration_seconds?: number | null
          view_source?: string | null
          viewed_at?: string
          viewer_profile_id?: string | null
          viewer_user_id?: string | null
        }
        Update: {
          id?: string
          profile_id?: string
          view_duration_seconds?: number | null
          view_source?: string | null
          viewed_at?: string
          viewer_profile_id?: string | null
          viewer_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shidduch_profile_views_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "shidduch_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shidduch_profile_views_viewer_profile_id_fkey"
            columns: ["viewer_profile_id"]
            isOneToOne: false
            referencedRelation: "shidduch_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shidduch_profile_views_viewer_user_id_fkey"
            columns: ["viewer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shidduch_profiles: {
        Row: {
          accepting_suggestions: boolean | null
          age_range_max: number | null
          age_range_min: number | null
          appearance_notes: string | null
          birth_order: number | null
          build: string | null
          chassidus: string | null
          children_plans: string | null
          college_university: string | null
          community: string
          created_at: string
          created_by_type: string | null
          created_by_user_id: string | null
          dealbreakers: string[] | null
          elementary_school: string | null
          eye_color: string | null
          family_minhagim: string | null
          father_name: string | null
          father_occupation: string | null
          father_origin: string | null
          favorite_sefarim: string | null
          genetic_testing_complete: boolean | null
          genetic_testing_id: string | null
          genetic_testing_org: string | null
          grandfather_maternal: string | null
          grandfather_paternal: string | null
          hair_color: string | null
          hashkafa_details: string | null
          health_notes: string | null
          hebrew_name: string | null
          hebrew_name_mother: string | null
          height_display: string | null
          high_school: string | null
          highest_degree: string | null
          hobbies_interests: string[] | null
          husband_learning: string | null
          id: string
          is_verified: boolean | null
          kollel_interest: string | null
          learning_schedule: string | null
          living_situation: string | null
          looking_for_description: string | null
          marriage_timeline: string | null
          minyan_frequency: string | null
          mother_maiden_name: string | null
          mother_name: string | null
          mother_occupation: string | null
          mother_origin: string | null
          must_haves: string[] | null
          nice_to_haves: string[] | null
          notable_rabbanim: string | null
          num_siblings: number | null
          parent_contact_first: boolean | null
          parent_description: string | null
          parents_status: string | null
          personality_description: string | null
          photos_visible_to: string | null
          preferred_background: string | null
          preferred_communities: string[] | null
          preferred_locations: string[] | null
          profile_visible: boolean | null
          seminary_yeshiva: string | null
          seminary_yeshiva_years: number | null
          sibling_details: Json | null
          single_email: string | null
          single_first_name: string | null
          single_last_name: string | null
          single_phone: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
          wife_working: string | null
          willing_to_relocate: boolean | null
        }
        Insert: {
          accepting_suggestions?: boolean | null
          age_range_max?: number | null
          age_range_min?: number | null
          appearance_notes?: string | null
          birth_order?: number | null
          build?: string | null
          chassidus?: string | null
          children_plans?: string | null
          college_university?: string | null
          community: string
          created_at?: string
          created_by_type?: string | null
          created_by_user_id?: string | null
          dealbreakers?: string[] | null
          elementary_school?: string | null
          eye_color?: string | null
          family_minhagim?: string | null
          father_name?: string | null
          father_occupation?: string | null
          father_origin?: string | null
          favorite_sefarim?: string | null
          genetic_testing_complete?: boolean | null
          genetic_testing_id?: string | null
          genetic_testing_org?: string | null
          grandfather_maternal?: string | null
          grandfather_paternal?: string | null
          hair_color?: string | null
          hashkafa_details?: string | null
          health_notes?: string | null
          hebrew_name?: string | null
          hebrew_name_mother?: string | null
          height_display?: string | null
          high_school?: string | null
          highest_degree?: string | null
          hobbies_interests?: string[] | null
          husband_learning?: string | null
          id?: string
          is_verified?: boolean | null
          kollel_interest?: string | null
          learning_schedule?: string | null
          living_situation?: string | null
          looking_for_description?: string | null
          marriage_timeline?: string | null
          minyan_frequency?: string | null
          mother_maiden_name?: string | null
          mother_name?: string | null
          mother_occupation?: string | null
          mother_origin?: string | null
          must_haves?: string[] | null
          nice_to_haves?: string[] | null
          notable_rabbanim?: string | null
          num_siblings?: number | null
          parent_contact_first?: boolean | null
          parent_description?: string | null
          parents_status?: string | null
          personality_description?: string | null
          photos_visible_to?: string | null
          preferred_background?: string | null
          preferred_communities?: string[] | null
          preferred_locations?: string[] | null
          profile_visible?: boolean | null
          seminary_yeshiva?: string | null
          seminary_yeshiva_years?: number | null
          sibling_details?: Json | null
          single_email?: string | null
          single_first_name?: string | null
          single_last_name?: string | null
          single_phone?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
          wife_working?: string | null
          willing_to_relocate?: boolean | null
        }
        Update: {
          accepting_suggestions?: boolean | null
          age_range_max?: number | null
          age_range_min?: number | null
          appearance_notes?: string | null
          birth_order?: number | null
          build?: string | null
          chassidus?: string | null
          children_plans?: string | null
          college_university?: string | null
          community?: string
          created_at?: string
          created_by_type?: string | null
          created_by_user_id?: string | null
          dealbreakers?: string[] | null
          elementary_school?: string | null
          eye_color?: string | null
          family_minhagim?: string | null
          father_name?: string | null
          father_occupation?: string | null
          father_origin?: string | null
          favorite_sefarim?: string | null
          genetic_testing_complete?: boolean | null
          genetic_testing_id?: string | null
          genetic_testing_org?: string | null
          grandfather_maternal?: string | null
          grandfather_paternal?: string | null
          hair_color?: string | null
          hashkafa_details?: string | null
          health_notes?: string | null
          hebrew_name?: string | null
          hebrew_name_mother?: string | null
          height_display?: string | null
          high_school?: string | null
          highest_degree?: string | null
          hobbies_interests?: string[] | null
          husband_learning?: string | null
          id?: string
          is_verified?: boolean | null
          kollel_interest?: string | null
          learning_schedule?: string | null
          living_situation?: string | null
          looking_for_description?: string | null
          marriage_timeline?: string | null
          minyan_frequency?: string | null
          mother_maiden_name?: string | null
          mother_name?: string | null
          mother_occupation?: string | null
          mother_origin?: string | null
          must_haves?: string[] | null
          nice_to_haves?: string[] | null
          notable_rabbanim?: string | null
          num_siblings?: number | null
          parent_contact_first?: boolean | null
          parent_description?: string | null
          parents_status?: string | null
          personality_description?: string | null
          photos_visible_to?: string | null
          preferred_background?: string | null
          preferred_communities?: string[] | null
          preferred_locations?: string[] | null
          profile_visible?: boolean | null
          seminary_yeshiva?: string | null
          seminary_yeshiva_years?: number | null
          sibling_details?: Json | null
          single_email?: string | null
          single_first_name?: string | null
          single_last_name?: string | null
          single_phone?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
          wife_working?: string | null
          willing_to_relocate?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "shidduch_profiles_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shidduch_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shidduch_references: {
        Row: {
          best_contact_method: string | null
          created_at: string
          email: string | null
          id: string
          is_verified: boolean | null
          name: string
          notes: string | null
          phone: string | null
          profile_id: string
          reference_type: string
          relationship: string
          verified_at: string | null
        }
        Insert: {
          best_contact_method?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_verified?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          profile_id: string
          reference_type: string
          relationship: string
          verified_at?: string | null
        }
        Update: {
          best_contact_method?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_verified?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          profile_id?: string
          reference_type?: string
          relationship?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shidduch_references_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "shidduch_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shidduch_suggestions: {
        Row: {
          compatibility_notes: string | null
          compatibility_score: number | null
          contact_shared_at: string | null
          created_at: string
          current_status: string | null
          ended_at: string | null
          ended_reason: string | null
          first_date_at: string | null
          id: string
          is_mutual_interest: boolean | null
          profile_a_decline_reason: string | null
          profile_a_id: string
          profile_a_parent_approved: boolean | null
          profile_a_response_at: string | null
          profile_a_status: string | null
          profile_b_decline_reason: string | null
          profile_b_id: string
          profile_b_parent_approved: boolean | null
          profile_b_response_at: string | null
          profile_b_status: string | null
          score_breakdown: Json | null
          suggested_by_shadchan_id: string | null
          suggested_by_type: string
          suggested_by_user_id: string | null
          suggestion_reason: string | null
          total_dates: number | null
          updated_at: string
        }
        Insert: {
          compatibility_notes?: string | null
          compatibility_score?: number | null
          contact_shared_at?: string | null
          created_at?: string
          current_status?: string | null
          ended_at?: string | null
          ended_reason?: string | null
          first_date_at?: string | null
          id?: string
          is_mutual_interest?: boolean | null
          profile_a_decline_reason?: string | null
          profile_a_id: string
          profile_a_parent_approved?: boolean | null
          profile_a_response_at?: string | null
          profile_a_status?: string | null
          profile_b_decline_reason?: string | null
          profile_b_id: string
          profile_b_parent_approved?: boolean | null
          profile_b_response_at?: string | null
          profile_b_status?: string | null
          score_breakdown?: Json | null
          suggested_by_shadchan_id?: string | null
          suggested_by_type: string
          suggested_by_user_id?: string | null
          suggestion_reason?: string | null
          total_dates?: number | null
          updated_at?: string
        }
        Update: {
          compatibility_notes?: string | null
          compatibility_score?: number | null
          contact_shared_at?: string | null
          created_at?: string
          current_status?: string | null
          ended_at?: string | null
          ended_reason?: string | null
          first_date_at?: string | null
          id?: string
          is_mutual_interest?: boolean | null
          profile_a_decline_reason?: string | null
          profile_a_id?: string
          profile_a_parent_approved?: boolean | null
          profile_a_response_at?: string | null
          profile_a_status?: string | null
          profile_b_decline_reason?: string | null
          profile_b_id?: string
          profile_b_parent_approved?: boolean | null
          profile_b_response_at?: string | null
          profile_b_status?: string | null
          score_breakdown?: Json | null
          suggested_by_shadchan_id?: string | null
          suggested_by_type?: string
          suggested_by_user_id?: string | null
          suggestion_reason?: string | null
          total_dates?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shidduch_suggestions_profile_a_id_fkey"
            columns: ["profile_a_id"]
            isOneToOne: false
            referencedRelation: "shidduch_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shidduch_suggestions_profile_b_id_fkey"
            columns: ["profile_b_id"]
            isOneToOne: false
            referencedRelation: "shidduch_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shidduch_suggestions_suggested_by_user_id_fkey"
            columns: ["suggested_by_user_id"]
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
          display_order: number | null
          id: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          badge_type: string
          created_at?: string
          display_order?: number | null
          id?: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          badge_type?: string
          created_at?: string
          display_order?: number | null
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
          is_orthodox_user: boolean | null
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
          orthodox_subscription_status: string | null
          partner_must_be_jewish: boolean | null
          phone: string | null
          raise_children_jewish: boolean | null
          response_rate: number | null
          school: string | null
          shabbat_mode_enabled: boolean | null
          shabbat_mode_end: string | null
          shabbat_mode_start: string | null
          shabbat_timezone: string | null
          shadchan_id: string | null
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
          is_orthodox_user?: boolean | null
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
          orthodox_subscription_status?: string | null
          partner_must_be_jewish?: boolean | null
          phone?: string | null
          raise_children_jewish?: boolean | null
          response_rate?: number | null
          school?: string | null
          shabbat_mode_enabled?: boolean | null
          shabbat_mode_end?: string | null
          shabbat_mode_start?: string | null
          shabbat_timezone?: string | null
          shadchan_id?: string | null
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
          is_orthodox_user?: boolean | null
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
          orthodox_subscription_status?: string | null
          partner_must_be_jewish?: boolean | null
          phone?: string | null
          raise_children_jewish?: boolean | null
          response_rate?: number | null
          school?: string | null
          shabbat_mode_enabled?: boolean | null
          shabbat_mode_end?: string | null
          shabbat_mode_start?: string | null
          shabbat_timezone?: string | null
          shadchan_id?: string | null
          show_instagram_friends?: boolean | null
          synagogue_attendance?: string | null
          updated_at?: string
          wants_children?: string | null
          willing_to_relocate?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "users_shadchan_id_fkey"
            columns: ["shadchan_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      browse_shidduch_profiles: {
        Args: {
          p_age_max?: number
          p_age_min?: number
          p_city?: string
          p_community?: string
          p_gender?: string
          p_limit?: number
          p_offset?: number
          p_state?: string
          p_viewer_id: string
        }
        Returns: {
          age: number
          city: string
          community: string
          created_at: string
          created_by_type: string
          hashkafa_details: string
          hebrew_name: string
          id: string
          looking_for_description: string
          photos_visible_to: string
          profile_visible: boolean
          single_first_name: string
          state: string
        }[]
      }
      calculate_distance: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      can_safta_add_connection: { Args: { safta_id: string }; Returns: boolean }
      can_safta_recommend: { Args: { safta_id: string }; Returns: boolean }
      get_creator_profile_count: {
        Args: { p_creator_id: string }
        Returns: number
      }
      get_profile_stats: {
        Args: { p_profile_id: string }
        Returns: {
          interested_responses: number
          last_view_at: string
          mutual_matches: number
          profile_views: number
          suggestions_received: number
          unique_viewers: number
        }[]
      }
      get_profiles_by_creator: {
        Args: { p_creator_id: string }
        Returns: {
          accepting_suggestions: boolean
          community: string
          created_at: string
          created_by_type: string
          hebrew_name: string
          id: string
          profile_visible: boolean
          single_first_name: string
          single_last_name: string
          updated_at: string
          user_id: string
        }[]
      }
      get_safta_connection_count: {
        Args: { safta_id: string }
        Returns: number
      }
      get_safta_daily_recommendations: {
        Args: { safta_id: string }
        Returns: number
      }
      get_shidduch_suggestions: {
        Args: { p_user_id: string }
        Returns: {
          out_created_at: string
          out_my_status: string
          out_other_profile: Json
          out_suggested_by: string
          out_suggestion_id: string
          out_suggestion_reason: string
          out_their_status: string
        }[]
      }
      increment_safta_recommendation: {
        Args: { safta_id: string }
        Returns: number
      }
      is_orthodox_email: { Args: { check_email: string }; Returns: boolean }
      register_orthodox_email: {
        Args: { user_email: string; user_uuid: string }
        Returns: undefined
      }
      respond_to_suggestion: {
        Args: {
          p_decline_reason?: string
          p_response: string
          p_suggestion_id: string
          p_user_id: string
        }
        Returns: Json
      }
      send_push_notification: {
        Args: {
          p_body: string
          p_data?: Json
          p_title: string
          p_user_id: string
        }
        Returns: undefined
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
