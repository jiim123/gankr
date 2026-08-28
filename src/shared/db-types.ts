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
    PostgrestVersion: "14.17"
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
      announcement_reads: {
        Row: {
          announcement_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          target_region: string | null
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          target_region?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          target_region?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      compliments: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          kind: string
          session_id: string
          to_user_id: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          kind: string
          session_id: string
          to_user_id: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          kind?: string
          session_id?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliments_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliments_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          status: Database["public"]["Enums"]["friendship_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          status?: Database["public"]["Enums"]["friendship_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          status?: Database["public"]["Enums"]["friendship_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          appid: string
          genres: string[]
          header_image: string | null
          name: string
        }
        Insert: {
          appid: string
          genres?: string[]
          header_image?: string | null
          name: string
        }
        Update: {
          appid?: string
          genres?: string[]
          header_image?: string | null
          name?: string
        }
        Relationships: []
      }
      lobbies: {
        Row: {
          appid: string
          closed_at: string | null
          created_at: string
          id: string
          languages: string[]
          locked: boolean
          max_members: number
          mic: Database["public"]["Enums"]["mic_requirement"]
          name: string | null
          owner_id: string
          region: string
          status: Database["public"]["Enums"]["lobby_status"]
          tone: Database["public"]["Enums"]["lobby_tone"]
          visibility: Database["public"]["Enums"]["lobby_visibility"]
        }
        Insert: {
          appid: string
          closed_at?: string | null
          created_at?: string
          id?: string
          languages?: string[]
          locked?: boolean
          max_members: number
          mic?: Database["public"]["Enums"]["mic_requirement"]
          name?: string | null
          owner_id: string
          region: string
          status?: Database["public"]["Enums"]["lobby_status"]
          tone?: Database["public"]["Enums"]["lobby_tone"]
          visibility?: Database["public"]["Enums"]["lobby_visibility"]
        }
        Update: {
          appid?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          languages?: string[]
          locked?: boolean
          max_members?: number
          mic?: Database["public"]["Enums"]["mic_requirement"]
          name?: string | null
          owner_id?: string
          region?: string
          status?: Database["public"]["Enums"]["lobby_status"]
          tone?: Database["public"]["Enums"]["lobby_tone"]
          visibility?: Database["public"]["Enums"]["lobby_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "lobbies_appid_fkey"
            columns: ["appid"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["appid"]
          },
          {
            foreignKeyName: "lobbies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lobby_join_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          id: string
          lobby_id: string
          status: Database["public"]["Enums"]["join_request_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          id?: string
          lobby_id: string
          status?: Database["public"]["Enums"]["join_request_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          id?: string
          lobby_id?: string
          status?: Database["public"]["Enums"]["join_request_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lobby_join_requests_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lobby_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lobby_members: {
        Row: {
          game_started_at: string | null
          joined_at: string
          last_heartbeat: string
          launch_clicked_at: string | null
          left_at: string | null
          lobby_id: string
          member_state: Database["public"]["Enums"]["member_state"]
          user_id: string
        }
        Insert: {
          game_started_at?: string | null
          joined_at?: string
          last_heartbeat?: string
          launch_clicked_at?: string | null
          left_at?: string | null
          lobby_id: string
          member_state?: Database["public"]["Enums"]["member_state"]
          user_id: string
        }
        Update: {
          game_started_at?: string | null
          joined_at?: string
          last_heartbeat?: string
          launch_clicked_at?: string | null
          left_at?: string | null
          lobby_id?: string
          member_state?: Database["public"]["Enums"]["member_state"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lobby_members_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lobby_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lobby_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["message_kind"]
          lobby_id: string
          seq: number
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          lobby_id: string
          seq?: number
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          lobby_id?: string
          seq?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lobby_messages_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lobby_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          lobby_id: string | null
          read_at: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          lobby_id?: string | null
          read_at?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          lobby_id?: string | null
          read_at?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
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
          id: string
          lobby_id: string | null
          message_snapshot: Json
          reason: string
          reported_user_id: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lobby_id?: string | null
          message_snapshot?: Json
          reason: string
          reported_user_id: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lobby_id?: string | null
          message_snapshot?: Json
          reason?: string
          reported_user_id?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
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
      session_history: {
        Row: {
          appid: string
          ended_at: string | null
          id: string
          lobby_id: string
          member_count: number
          started_at: string
        }
        Insert: {
          appid: string
          ended_at?: string | null
          id?: string
          lobby_id: string
          member_count?: number
          started_at: string
        }
        Update: {
          appid?: string
          ended_at?: string | null
          id?: string
          lobby_id?: string
          member_count?: number
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_history_appid_fkey"
            columns: ["appid"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["appid"]
          },
          {
            foreignKeyName: "session_history_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          },
        ]
      }
      session_participants: {
        Row: {
          minutes_in_game: number
          session_id: string
          user_id: string
        }
        Insert: {
          minutes_in_game?: number
          session_id: string
          user_id: string
        }
        Update: {
          minutes_in_game?: number
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      steam_identities: {
        Row: {
          last_synced_at: string | null
          profile_visibility: Database["public"]["Enums"]["profile_visibility"]
          steam_id64: string
          user_id: string
        }
        Insert: {
          last_synced_at?: string | null
          profile_visibility?: Database["public"]["Enums"]["profile_visibility"]
          steam_id64: string
          user_id: string
        }
        Update: {
          last_synced_at?: string | null
          profile_visibility?: Database["public"]["Enums"]["profile_visibility"]
          steam_id64?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "steam_identities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_games: {
        Row: {
          appid: string
          playtime_2weeks_minutes: number
          playtime_forever_minutes: number
          source: Database["public"]["Enums"]["game_source"]
          synced_at: string
          user_id: string
        }
        Insert: {
          appid: string
          playtime_2weeks_minutes?: number
          playtime_forever_minutes?: number
          source?: Database["public"]["Enums"]["game_source"]
          synced_at?: string
          user_id: string
        }
        Update: {
          appid?: string
          playtime_2weeks_minutes?: number
          playtime_forever_minutes?: number
          source?: Database["public"]["Enums"]["game_source"]
          synced_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_games_appid_fkey"
            columns: ["appid"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["appid"]
          },
          {
            foreignKeyName: "user_games_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          languages: string[]
          last_seen_at: string
          notification_preferences: Json
          region: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          languages?: string[]
          last_seen_at?: string
          notification_preferences?: Json
          region?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          languages?: string[]
          last_seen_at?: string
          notification_preferences?: Json
          region?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      game_popularity: {
        Row: {
          appid: string | null
          owner_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_games_appid_fkey"
            columns: ["appid"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["appid"]
          },
        ]
      }
    }
    Functions: {
      sweep_lobbies: { Args: never; Returns: undefined }
    }
    Enums: {
      friendship_status: "pending" | "accepted" | "blocked"
      game_source: "steam" | "manual"
      join_request_status: "pending" | "accepted" | "denied"
      lobby_status: "open" | "playing" | "closed"
      lobby_tone: "casual" | "competitive"
      lobby_visibility: "open" | "private"
      member_state:
        | "in_lobby"
        | "launching"
        | "in_game"
        | "launch_failed"
        | "left"
      message_kind: "user" | "system"
      mic_requirement: "required" | "preferred" | "off"
      notification_type:
        | "friend_request_received"
        | "friend_request_accepted"
        | "lobby_invite"
        | "lobby_full"
        | "all_members_ready"
        | "owner_launched"
        | "friend_online_in_owned_game"
        | "announcement"
      profile_visibility: "public" | "private" | "unknown"
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
      friendship_status: ["pending", "accepted", "blocked"],
      game_source: ["steam", "manual"],
      join_request_status: ["pending", "accepted", "denied"],
      lobby_status: ["open", "playing", "closed"],
      lobby_tone: ["casual", "competitive"],
      lobby_visibility: ["open", "private"],
      member_state: [
        "in_lobby",
        "launching",
        "in_game",
        "launch_failed",
        "left",
      ],
      message_kind: ["user", "system"],
      mic_requirement: ["required", "preferred", "off"],
      notification_type: [
        "friend_request_received",
        "friend_request_accepted",
        "lobby_invite",
        "lobby_full",
        "all_members_ready",
        "owner_launched",
        "friend_online_in_owned_game",
        "announcement",
      ],
      profile_visibility: ["public", "private", "unknown"],
    },
  },
} as const
