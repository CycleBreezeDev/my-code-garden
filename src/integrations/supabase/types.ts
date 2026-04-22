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
          price_per_line: number
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
          price_per_line?: number
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
          price_per_line?: number
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
            referencedRelation: "syndicates"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "syndicates"
            referencedColumns: ["id"]
          },
        ]
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
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_syndicate_member: { Args: { _syndicate_id: string }; Returns: boolean }
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
      publish_draw_results: {
        Args: {
          _bonus_numbers: number[]
          _draw_id: string
          _prizes: Json
          _winning_numbers: number[]
        }
        Returns: string
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
