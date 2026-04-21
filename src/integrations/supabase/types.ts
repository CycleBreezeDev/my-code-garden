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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      dm_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "dm_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_messages: {
        Row: {
          body: string | null
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          image_path: string | null
          kind: string
          metadata: Json
          reply_to_id: string | null
          sender_id: string
          thread_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          image_path?: string | null
          kind?: string
          metadata?: Json
          reply_to_id?: string | null
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          image_path?: string | null
          kind?: string
          metadata?: Json
          reply_to_id?: string | null
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "dm_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "dm_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_thread_reads: {
        Row: {
          last_read_at: string
          thread_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          thread_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_thread_reads_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "dm_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_threads: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          last_message_preview: string | null
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      dm_typing: {
        Row: {
          thread_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          thread_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          thread_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_typing_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "dm_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      draw_results: {
        Row: {
          bonus_numbers: number[] | null
          draw_id: string
          id: string
          jackpot_won: number | null
          published_at: string
          total_winners: number
          winning_numbers: number[]
        }
        Insert: {
          bonus_numbers?: number[] | null
          draw_id: string
          id?: string
          jackpot_won?: number | null
          published_at?: string
          total_winners?: number
          winning_numbers: number[]
        }
        Update: {
          bonus_numbers?: number[] | null
          draw_id?: string
          id?: string
          jackpot_won?: number | null
          published_at?: string
          total_winners?: number
          winning_numbers?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "draw_results_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: true
            referencedRelation: "lottery_draws"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      feed_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          body: string | null
          comments_count: number
          created_at: string
          id: string
          kind: string
          likes_count: number
          metadata: Json
          user_id: string
        }
        Insert: {
          body?: string | null
          comments_count?: number
          created_at?: string
          id?: string
          kind: string
          likes_count?: number
          metadata?: Json
          user_id: string
        }
        Update: {
          body?: string | null
          comments_count?: number
          created_at?: string
          id?: string
          kind?: string
          likes_count?: number
          metadata?: Json
          user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      fx_pairs: {
        Row: {
          base_currency: string
          created_at: string
          enabled: boolean
          id: string
          markup_percent: number
          quote_currency: string
          updated_at: string
        }
        Insert: {
          base_currency: string
          created_at?: string
          enabled?: boolean
          id?: string
          markup_percent?: number
          quote_currency: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          enabled?: boolean
          id?: string
          markup_percent?: number
          quote_currency?: string
          updated_at?: string
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          base_currency: string
          fetched_at: string
          id: string
          quote_currency: string
          rate: number
          source: string
        }
        Insert: {
          base_currency: string
          fetched_at?: string
          id?: string
          quote_currency: string
          rate: number
          source?: string
        }
        Update: {
          base_currency?: string
          fetched_at?: string
          id?: string
          quote_currency?: string
          rate?: number
          source?: string
        }
        Relationships: []
      }
      kyc_checks: {
        Row: {
          created_at: string
          id: string
          initiated_by: string | null
          job_type: string
          provider: string
          request_payload: Json
          response_payload: Json
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          initiated_by?: string | null
          job_type: string
          provider?: string
          request_payload?: Json
          response_payload?: Json
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          initiated_by?: string | null
          job_type?: string
          provider?: string
          request_payload?: Json
          response_payload?: Json
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      kyc_documents: {
        Row: {
          created_at: string
          doc_type: string
          id: string
          mime_type: string | null
          notes: string | null
          ocr_payload: Json
          status: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          ocr_payload?: Json
          status?: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          ocr_payload?: Json
          status?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      kyc_profiles: {
        Row: {
          country: string | null
          created_at: string
          dob: string | null
          full_name: string | null
          id: string
          id_number: string | null
          id_type: string | null
          last_provider: string | null
          last_provider_payload: Json
          por_verified_at: string | null
          rejection_reason: string | null
          selfie_verified_at: string | null
          status: string
          tier: number
          updated_at: string
          user_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          dob?: string | null
          full_name?: string | null
          id?: string
          id_number?: string | null
          id_type?: string | null
          last_provider?: string | null
          last_provider_payload?: Json
          por_verified_at?: string | null
          rejection_reason?: string | null
          selfie_verified_at?: string | null
          status?: string
          tier?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          dob?: string | null
          full_name?: string | null
          id?: string
          id_number?: string | null
          id_type?: string | null
          last_provider?: string | null
          last_provider_payload?: Json
          por_verified_at?: string | null
          rejection_reason?: string | null
          selfie_verified_at?: string | null
          status?: string
          tier?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_profiles_tier_fkey"
            columns: ["tier"]
            isOneToOne: false
            referencedRelation: "kyc_tiers"
            referencedColumns: ["tier"]
          },
        ]
      }
      kyc_tiers: {
        Row: {
          created_at: string
          daily_limit_usd: number
          description: string | null
          id: string
          monthly_limit_usd: number
          name: string
          requires_id: boolean
          requires_por: boolean
          requires_selfie: boolean
          tier: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_limit_usd?: number
          description?: string | null
          id?: string
          monthly_limit_usd?: number
          name: string
          requires_id?: boolean
          requires_por?: boolean
          requires_selfie?: boolean
          tier: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_limit_usd?: number
          description?: string | null
          id?: string
          monthly_limit_usd?: number
          name?: string
          requires_id?: boolean
          requires_por?: boolean
          requires_selfie?: boolean
          tier?: number
          updated_at?: string
        }
        Relationships: []
      }
      lotteries: {
        Row: {
          color: string | null
          country: string | null
          created_at: string
          description: string | null
          draw_days: string | null
          icon: string | null
          id: string
          is_active: boolean
          logo_key: string | null
          logo_url: string | null
          name: string
          number_format: Json
          slug: string
        }
        Insert: {
          color?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          draw_days?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          logo_key?: string | null
          logo_url?: string | null
          name: string
          number_format?: Json
          slug: string
        }
        Update: {
          color?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          draw_days?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          logo_key?: string | null
          logo_url?: string | null
          name?: string
          number_format?: Json
          slug?: string
        }
        Relationships: []
      }
      lottery_draws: {
        Row: {
          created_at: string
          currency: string
          draw_date: string
          id: string
          jackpot_amount: number
          lottery_id: string
          status: string
        }
        Insert: {
          created_at?: string
          currency?: string
          draw_date: string
          id?: string
          jackpot_amount?: number
          lottery_id: string
          status?: string
        }
        Update: {
          created_at?: string
          currency?: string
          draw_date?: string
          id?: string
          jackpot_amount?: number
          lottery_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lottery_draws_lottery_id_fkey"
            columns: ["lottery_id"]
            isOneToOne: false
            referencedRelation: "lotteries"
            referencedColumns: ["id"]
          },
        ]
      }
      lottery_feeds: {
        Row: {
          country: string
          created_at: string
          currency: string
          display_order: number
          draw_schedule: string | null
          estimated_jackpot: number | null
          id: string
          jackpot_display: string | null
          last_error: string | null
          last_refreshed_at: string | null
          name: string
          next_draw_at: string | null
          slug: string
          source_url: string
          updated_at: string
        }
        Insert: {
          country: string
          created_at?: string
          currency: string
          display_order?: number
          draw_schedule?: string | null
          estimated_jackpot?: number | null
          id?: string
          jackpot_display?: string | null
          last_error?: string | null
          last_refreshed_at?: string | null
          name: string
          next_draw_at?: string | null
          slug: string
          source_url: string
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          currency?: string
          display_order?: number
          draw_schedule?: string | null
          estimated_jackpot?: number | null
          id?: string
          jackpot_display?: string | null
          last_error?: string | null
          last_refreshed_at?: string | null
          name?: string
          next_draw_at?: string | null
          slug?: string
          source_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      lottery_jackpot_history: {
        Row: {
          amount: number
          captured_at: string
          currency: string
          feed_id: string
          id: string
          jackpot_display: string | null
          slug: string
        }
        Insert: {
          amount: number
          captured_at?: string
          currency: string
          feed_id: string
          id?: string
          jackpot_display?: string | null
          slug: string
        }
        Update: {
          amount?: number
          captured_at?: string
          currency?: string
          feed_id?: string
          id?: string
          jackpot_display?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "lottery_jackpot_history_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "lottery_feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "syndicate_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          kind: string
          metadata: Json
          read_at: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind: string
          metadata?: Json
          read_at?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind?: string
          metadata?: Json
          read_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payout_recipients: {
        Row: {
          created_at: string
          destination: Json
          destination_type: string
          id: string
          label: string
          provider: string | null
          provider_recipient_code: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          destination?: Json
          destination_type: string
          id?: string
          label: string
          provider?: string | null
          provider_recipient_code?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          destination?: Json
          destination_type?: string
          id?: string
          label?: string
          provider?: string | null
          provider_recipient_code?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          created_at: string
          draw_id: string
          gross_prize: number
          id: string
          membership_id: string
          net_amount: number
          platform_fee: number
          shares: number
          syndicate_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          draw_id: string
          gross_prize: number
          id?: string
          membership_id: string
          net_amount: number
          platform_fee: number
          shares: number
          syndicate_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          draw_id?: string
          gross_prize?: number
          id?: string
          membership_id?: string
          net_amount?: number
          platform_fee?: number
          shares?: number
          syndicate_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: false
            referencedRelation: "lottery_draws"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "syndicate_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_syndicate_id_fkey"
            columns: ["syndicate_id"]
            isOneToOne: false
            referencedRelation: "syndicate_picks_summary"
            referencedColumns: ["syndicate_id"]
          },
          {
            foreignKeyName: "payouts_syndicate_id_fkey"
            columns: ["syndicate_id"]
            isOneToOne: false
            referencedRelation: "syndicates"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      syndicate_memberships: {
        Row: {
          amount_paid: number
          created_at: string
          id: string
          payment_reference: string | null
          shares: number
          syndicate_id: string
          user_id: string
        }
        Insert: {
          amount_paid: number
          created_at?: string
          id?: string
          payment_reference?: string | null
          shares: number
          syndicate_id: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          id?: string
          payment_reference?: string | null
          shares?: number
          syndicate_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "syndicate_memberships_syndicate_id_fkey"
            columns: ["syndicate_id"]
            isOneToOne: false
            referencedRelation: "syndicate_picks_summary"
            referencedColumns: ["syndicate_id"]
          },
          {
            foreignKeyName: "syndicate_memberships_syndicate_id_fkey"
            columns: ["syndicate_id"]
            isOneToOne: false
            referencedRelation: "syndicates"
            referencedColumns: ["id"]
          },
        ]
      }
      syndicate_messages: {
        Row: {
          body: string | null
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          image_path: string | null
          kind: string
          metadata: Json
          reply_to_id: string | null
          syndicate_id: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          image_path?: string | null
          kind?: string
          metadata?: Json
          reply_to_id?: string | null
          syndicate_id: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          image_path?: string | null
          kind?: string
          metadata?: Json
          reply_to_id?: string | null
          syndicate_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "syndicate_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "syndicate_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      syndicate_picks: {
        Row: {
          bonus_match_count: number | null
          bonus_numbers: number[]
          created_at: string
          id: string
          main_match_count: number | null
          main_numbers: number[]
          matched_at: string | null
          membership_id: string
          share_index: number
          status: string
          syndicate_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bonus_match_count?: number | null
          bonus_numbers?: number[]
          created_at?: string
          id?: string
          main_match_count?: number | null
          main_numbers?: number[]
          matched_at?: string | null
          membership_id: string
          share_index: number
          status?: string
          syndicate_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bonus_match_count?: number | null
          bonus_numbers?: number[]
          created_at?: string
          id?: string
          main_match_count?: number | null
          main_numbers?: number[]
          matched_at?: string | null
          membership_id?: string
          share_index?: number
          status?: string
          syndicate_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      syndicates: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          draw_id: string
          id: string
          name: string
          picks_lock_offset_minutes: number
          price_per_share: number
          slug: string
          sold_shares: number
          status: string
          total_shares: number
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          draw_id: string
          id?: string
          name: string
          picks_lock_offset_minutes?: number
          price_per_share: number
          slug: string
          sold_shares?: number
          status?: string
          total_shares: number
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          draw_id?: string
          id?: string
          name?: string
          picks_lock_offset_minutes?: number
          price_per_share?: number
          slug?: string
          sold_shares?: number
          status?: string
          total_shares?: number
        }
        Relationships: [
          {
            foreignKeyName: "syndicates_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: false
            referencedRelation: "lottery_draws"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_images: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          storage_path: string
          syndicate_id: string
          uploaded_by: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          storage_path: string
          syndicate_id: string
          uploaded_by: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          storage_path?: string
          syndicate_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_images_syndicate_id_fkey"
            columns: ["syndicate_id"]
            isOneToOne: false
            referencedRelation: "syndicate_picks_summary"
            referencedColumns: ["syndicate_id"]
          },
          {
            foreignKeyName: "ticket_images_syndicate_id_fkey"
            columns: ["syndicate_id"]
            isOneToOne: false
            referencedRelation: "syndicates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      user_profiles_public: {
        Row: {
          bio: string | null
          country_code: string | null
          created_at: string
          email_digest_enabled: boolean
          followers_count: number
          following_count: number
          is_public: boolean
          syndicates_count: number
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          bio?: string | null
          country_code?: string | null
          created_at?: string
          email_digest_enabled?: boolean
          followers_count?: number
          following_count?: number
          is_public?: boolean
          syndicates_count?: number
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          bio?: string | null
          country_code?: string | null
          created_at?: string
          email_digest_enabled?: boolean
          followers_count?: number
          following_count?: number
          is_public?: boolean
          syndicates_count?: number
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string
          currency: string
          id: string
          kind: string
          metadata: Json
          provider: string | null
          provider_ref: string | null
          reference: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string
          currency: string
          id?: string
          kind: string
          metadata?: Json
          provider?: string | null
          provider_ref?: string | null
          reference?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          metadata?: Json
          provider?: string | null
          provider_ref?: string | null
          reference?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          available_balance: number
          created_at: string
          currency: string
          id: string
          lifetime_deposit: number
          lifetime_withdrawn: number
          pending_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          currency: string
          id?: string
          lifetime_deposit?: number
          lifetime_withdrawn?: number
          pending_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          currency?: string
          id?: string
          lifetime_deposit?: number
          lifetime_withdrawn?: number
          pending_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_configs: {
        Row: {
          created_at: string
          currency: string
          daily_limit: number | null
          destination_type: string
          enabled: boolean
          eta_label: string | null
          fee_flat: number
          fee_percent: number
          id: string
          max_amount: number | null
          min_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency: string
          daily_limit?: number | null
          destination_type: string
          enabled?: boolean
          eta_label?: string | null
          fee_flat?: number
          fee_percent?: number
          id?: string
          max_amount?: number | null
          min_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          daily_limit?: number | null
          destination_type?: string
          enabled?: boolean
          eta_label?: string | null
          fee_flat?: number
          fee_percent?: number
          id?: string
          max_amount?: number | null
          min_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          amount: number
          created_at: string
          currency: string
          destination: Json
          destination_type: string
          failure_reason: string | null
          fee: number
          fx_markup_percent: number | null
          fx_rate: number | null
          id: string
          net_amount: number
          processed_at: string | null
          processed_by: string | null
          provider: string
          provider_ref: string | null
          source_amount: number | null
          source_currency: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          destination?: Json
          destination_type: string
          failure_reason?: string | null
          fee?: number
          fx_markup_percent?: number | null
          fx_rate?: number | null
          id?: string
          net_amount: number
          processed_at?: string | null
          processed_by?: string | null
          provider: string
          provider_ref?: string | null
          source_amount?: number | null
          source_currency?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          destination?: Json
          destination_type?: string
          failure_reason?: string | null
          fee?: number
          fx_markup_percent?: number | null
          fx_rate?: number | null
          id?: string
          net_amount?: number
          processed_at?: string | null
          processed_by?: string | null
          provider?: string
          provider_ref?: string | null
          source_amount?: number | null
          source_currency?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      syndicate_picks_summary: {
        Row: {
          included_picks: number | null
          pending_picks: number | null
          quick_picked: number | null
          syndicate_id: string | null
          syndicate_name: string | null
          syndicate_slug: string | null
          total_picks: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_dm: { Args: { _a: string; _b: string }; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      dm_mark_read: { Args: { _thread_id: string }; Returns: undefined }
      dm_unread_total: { Args: never; Returns: number }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_or_create_dm_thread: { Args: { _other: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_dm_participant: {
        Args: { _thread_id: string; _user: string }
        Returns: boolean
      }
      is_syndicate_member: { Args: { _syndicate_id: string }; Returns: boolean }
      is_syndicate_member_uid: {
        Args: { _syndicate_id: string; _user_id: string }
        Returns: boolean
      }
      join_syndicate:
        | { Args: { _shares: number; _syndicate_id: string }; Returns: string }
        | {
            Args: {
              _reference?: string
              _shares: number
              _syndicate_id: string
            }
            Returns: string
          }
      join_syndicate_for_user: {
        Args: {
          _reference: string
          _shares: number
          _syndicate_id: string
          _user_id: string
        }
        Returns: string
      }
      kyc_bump_tier: {
        Args: { _reason?: string; _tier: number; _user_id: string }
        Returns: undefined
      }
      kyc_can_transact: {
        Args: { _amount_usd: number; _kind: string; _user_id: string }
        Returns: Json
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      publish_draw_results: {
        Args: {
          _bonus_numbers: number[]
          _draw_id: string
          _prizes: Json
          _winning_numbers: number[]
        }
        Returns: string
      }
      quick_pick_for_lottery: { Args: { _lottery_id: string }; Returns: Json }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      score_picks_for_draw: { Args: { _draw_id: string }; Returns: number }
      suggested_follows: {
        Args: { _limit?: number }
        Returns: {
          bio: string
          country_code: string
          followers_count: number
          mutual_syndicates: number
          user_id: string
          username: string
        }[]
      }
      unread_notification_count: { Args: never; Returns: number }
      upsert_syndicate_picks: {
        Args: { _membership_id: string; _picks: Json }
        Returns: number
      }
      user_feed: {
        Args: { _before?: string; _limit?: number }
        Returns: {
          avatar_url: string
          body: string
          comments_count: number
          created_at: string
          full_name: string
          id: string
          kind: string
          liked_by_me: boolean
          likes_count: number
          metadata: Json
          user_id: string
          username: string
        }[]
      }
      wallet_credit: {
        Args: {
          _amount: number
          _currency: string
          _kind: string
          _metadata?: Json
          _provider?: string
          _provider_ref?: string
          _reference?: string
          _user_id: string
        }
        Returns: string
      }
      wallet_debit_for_withdrawal: {
        Args: {
          _amount: number
          _currency: string
          _destination: Json
          _destination_type: string
          _fee: number
          _provider: string
          _user_id: string
        }
        Returns: string
      }
      wallet_finalize_withdrawal: {
        Args: {
          _failure_reason?: string
          _provider_ref?: string
          _status: string
          _withdrawal_id: string
        }
        Returns: undefined
      }
      wallet_join_syndicate: {
        Args: { _shares: number; _syndicate_id: string }
        Returns: string
      }
      wallet_join_syndicate_fx: {
        Args: {
          _markup_percent: number
          _quoted_rate: number
          _shares: number
          _source_currency: string
          _syndicate_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
