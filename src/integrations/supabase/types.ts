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
      lotteries: {
        Row: {
          country: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_key: string | null
          name: string
          slug: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_key?: string | null
          name: string
          slug: string
        }
        Update: {
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_key?: string | null
          name?: string
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
