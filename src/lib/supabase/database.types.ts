export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      ballot_rankings: {
        Row: {
          nomination_id: string
          rank: number
          round_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          nomination_id: string
          rank: number
          round_id: string
          user_id: string
        }
        Update: {
          nomination_id?: string
          rank?: number
          round_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ballot_rankings_nomination_id_fkey'
            columns: ['nomination_id']
            isOneToOne: false
            referencedRelation: 'nominations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ballot_rankings_nomination_id_fkey'
            columns: ['nomination_id']
            isOneToOne: false
            referencedRelation: 'nominations_public'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ballot_rankings_round_id_user_id_fkey'
            columns: ['round_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'ballots'
            referencedColumns: ['round_id', 'user_id']
          },
        ]
      }
      ballots: {
        Row: {
          first_cast_at: string
          round_id: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          first_cast_at?: string
          round_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          first_cast_at?: string
          round_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ballots_round_id_fkey'
            columns: ['round_id']
            isOneToOne: false
            referencedRelation: 'rounds'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ballots_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      books: {
        Row: {
          authors: string[]
          categories: string[]
          cover_url: string | null
          created_at: string
          description: string | null
          google_books_id: string
          id: string
          isbn13: string | null
          page_count: number | null
          published_date: string | null
          publisher: string | null
          subtitle: string | null
          title: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          authors?: string[]
          categories?: string[]
          cover_url?: string | null
          created_at?: string
          description?: string | null
          google_books_id: string
          id?: string
          isbn13?: string | null
          page_count?: number | null
          published_date?: string | null
          publisher?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          authors?: string[]
          categories?: string[]
          cover_url?: string | null
          created_at?: string
          description?: string | null
          google_books_id?: string
          id?: string
          isbn13?: string | null
          page_count?: number | null
          published_date?: string | null
          publisher?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      club_books: {
        Row: {
          book_id: string
          club_id: string
          discussion_mode: Database['public']['Enums']['discussion_mode']
          finished_at: string | null
          id: string
          number: number
          round_id: string | null
          started_at: string
          status: Database['public']['Enums']['club_book_status']
        }
        ComputedFields: never
        Insert: {
          book_id: string
          club_id: string
          discussion_mode?: Database['public']['Enums']['discussion_mode']
          finished_at?: string | null
          id?: string
          number: number
          round_id?: string | null
          started_at?: string
          status?: Database['public']['Enums']['club_book_status']
        }
        Update: {
          book_id?: string
          club_id?: string
          discussion_mode?: Database['public']['Enums']['discussion_mode']
          finished_at?: string | null
          id?: string
          number?: number
          round_id?: string | null
          started_at?: string
          status?: Database['public']['Enums']['club_book_status']
        }
        Relationships: [
          {
            foreignKeyName: 'club_books_book_id_fkey'
            columns: ['book_id']
            isOneToOne: false
            referencedRelation: 'books'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'club_books_club_id_fkey'
            columns: ['club_id']
            isOneToOne: false
            referencedRelation: 'clubs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'club_books_round_id_fkey'
            columns: ['round_id']
            isOneToOne: true
            referencedRelation: 'rounds'
            referencedColumns: ['id']
          },
        ]
      }
      club_invites: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          revoked_at: string | null
          token: string
          use_count: number
          invite_status: string | null
        }
        ComputedFields: 'invite_status'
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          revoked_at?: string | null
          token: string
          use_count?: number
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          revoked_at?: string | null
          token?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: 'club_invites_club_id_fkey'
            columns: ['club_id']
            isOneToOne: false
            referencedRelation: 'clubs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'club_invites_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      club_members: {
        Row: {
          club_id: string
          joined_at: string
          role: Database['public']['Enums']['club_role']
          user_id: string
        }
        ComputedFields: never
        Insert: {
          club_id: string
          joined_at?: string
          role?: Database['public']['Enums']['club_role']
          user_id: string
        }
        Update: {
          club_id?: string
          joined_at?: string
          role?: Database['public']['Enums']['club_role']
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'club_members_club_id_fkey'
            columns: ['club_id']
            isOneToOne: false
            referencedRelation: 'clubs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'club_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      clubs: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: 'clubs_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      nominations: {
        Row: {
          book_id: string
          created_at: string
          id: string
          nominated_by: string
          pitch: string | null
          round_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          nominated_by: string
          pitch?: string | null
          round_id: string
          updated_at?: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          nominated_by?: string
          pitch?: string | null
          round_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'nominations_book_id_fkey'
            columns: ['book_id']
            isOneToOne: false
            referencedRelation: 'books'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'nominations_nominated_by_fkey'
            columns: ['nominated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'nominations_round_id_fkey'
            columns: ['round_id']
            isOneToOne: false
            referencedRelation: 'rounds'
            referencedColumns: ['id']
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          body: string
          club_book_id: string
          created_at: string
          edited_at: string | null
          id: string
          parent_id: string | null
          section_id: string | null
        }
        ComputedFields: never
        Insert: {
          author_id?: string
          body: string
          club_book_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          parent_id?: string | null
          section_id?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          club_book_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          parent_id?: string | null
          section_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'posts_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'posts_club_book_id_fkey'
            columns: ['club_book_id']
            isOneToOne: false
            referencedRelation: 'club_books'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'posts_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
        }
        ComputedFields: never
        Insert: {
          avatar_path?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
        }
        Update: {
          avatar_path?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          body: string | null
          club_book_id: string
          created_at: string
          goodreads_url: string | null
          id: string
          rating: number
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          body?: string | null
          club_book_id: string
          created_at?: string
          goodreads_url?: string | null
          id?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          club_book_id?: string
          created_at?: string
          goodreads_url?: string | null
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reviews_club_book_id_fkey'
            columns: ['club_book_id']
            isOneToOne: false
            referencedRelation: 'club_books'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reviews_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      round_results: {
        Row: {
          computed_at: string
          round_id: string
          tallies: NonNullable<Json>
          tiebreak_seed: string
        }
        ComputedFields: never
        Insert: {
          computed_at?: string
          round_id: string
          tallies: NonNullable<Json>
          tiebreak_seed: string
        }
        Update: {
          computed_at?: string
          round_id?: string
          tallies?: NonNullable<Json>
          tiebreak_seed?: string
        }
        Relationships: [
          {
            foreignKeyName: 'round_results_round_id_fkey'
            columns: ['round_id']
            isOneToOne: true
            referencedRelation: 'rounds'
            referencedColumns: ['id']
          },
        ]
      }
      rounds: {
        Row: {
          anonymous_nominators: boolean
          close_claimed_at: string | null
          closed_at: string | null
          club_id: string
          created_at: string
          created_by: string | null
          deadline: string
          id: string
          max_nominations_per_member: number
          note: string | null
          number: number
          status: Database['public']['Enums']['round_status']
          timezone: string
          winner_nomination_id: string | null
        }
        ComputedFields: never
        Insert: {
          anonymous_nominators?: boolean
          close_claimed_at?: string | null
          closed_at?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          deadline: string
          id?: string
          max_nominations_per_member?: number
          note?: string | null
          number: number
          status?: Database['public']['Enums']['round_status']
          timezone: string
          winner_nomination_id?: string | null
        }
        Update: {
          anonymous_nominators?: boolean
          close_claimed_at?: string | null
          closed_at?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          deadline?: string
          id?: string
          max_nominations_per_member?: number
          note?: string | null
          number?: number
          status?: Database['public']['Enums']['round_status']
          timezone?: string
          winner_nomination_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'rounds_club_id_fkey'
            columns: ['club_id']
            isOneToOne: false
            referencedRelation: 'clubs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rounds_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rounds_winner_fk'
            columns: ['winner_nomination_id']
            isOneToOne: false
            referencedRelation: 'nominations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rounds_winner_fk'
            columns: ['winner_nomination_id']
            isOneToOne: false
            referencedRelation: 'nominations_public'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      nominations_public: {
        Row: {
          book_id: string | null
          club_id: string | null
          created_at: string | null
          id: string | null
          is_mine: boolean | null
          nominated_by: string | null
          pitch: string | null
          round_id: string | null
          updated_at: string | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: 'nominations_book_id_fkey'
            columns: ['book_id']
            isOneToOne: false
            referencedRelation: 'books'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'nominations_round_id_fkey'
            columns: ['round_id']
            isOneToOne: false
            referencedRelation: 'rounds'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rounds_club_id_fkey'
            columns: ['club_id']
            isOneToOne: false
            referencedRelation: 'clubs'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Functions: {
      accept_invite: {
        Args: { p_token: string }
        Returns: {
          club_id: string
          status: string
        }[]
      }
      can_close_round: { Args: { p_round_id: string }; Returns: boolean }
      can_read_reviews: { Args: { p_club_book_id: string }; Returns: boolean }
      cancel_round: { Args: { p_round_id: string }; Returns: undefined }
      claim_round_close: {
        Args: { p_early?: boolean; p_round_id: string }
        Returns: Json
      }
      club_book_club: { Args: { p_club_book_id: string }; Returns: string }
      club_book_summary: { Args: { p_club_book_id: string }; Returns: Json }
      club_history: {
        Args: { p_club_id: string }
        Returns: {
          authors: string[]
          average: number | null
          count_rounds: number
          cover_url: string
          finished_at: string
          google_books_id: string
          id: string
          nominee_count: number
          number: number
          pick_method: string
          review_count: number | null
          round_id: string
          started_at: string
          status: Database['public']['Enums']['club_book_status']
          title: string
        }[]
      }
      club_role: {
        Args: { p_club_id: string }
        Returns: Database['public']['Enums']['club_role']
      }
      create_club: {
        Args: { p_description?: string; p_name: string }
        Returns: {
          club_id: string
          invite_token: string
        }[]
      }
      create_invite: {
        Args: { p_club_id: string; p_expires_at?: string; p_max_uses?: number }
        Returns: string
      }
      delete_club: { Args: { p_club_id: string }; Returns: undefined }
      finalize_round: {
        Args: { p_result: Json; p_round_id: string }
        Returns: string
      }
      finish_if_all_reviewed: {
        Args: { p_club_id: string }
        Returns: undefined
      }
      invite_preview: { Args: { p_token: string }; Returns: Json }
      invite_status: {
        Args: {
          i: Omit<
            Database['public']['Tables']['club_invites']['Row'],
            Database['public']['Tables']['club_invites']['ComputedFields']
          >
        }
        Returns: string
      }
      is_club_admin: { Args: { p_club_id: string }; Returns: boolean }
      is_club_member: { Args: { p_club_id: string }; Returns: boolean }
      leave_club: { Args: { p_club_id: string }; Returns: undefined }
      needs_you: {
        Args: Record<PropertyKey, never>
        Returns: {
          book_title: string
          club_book_id: string
          club_id: string
          club_name: string
          deadline: string
          finished_count: number
          kind: string
          member_count: number
          round_id: string
          timezone: string
        }[]
      }
      new_invite_token: { Args: Record<PropertyKey, never>; Returns: string }
      nominate: {
        Args: {
          p_book_id: string
          p_pitch?: string
          p_replace_id?: string
          p_round_id: string
        }
        Returns: string
      }
      post_review: {
        Args: {
          p_body?: string
          p_club_book_id: string
          p_goodreads_url?: string
          p_rating: number
        }
        Returns: string
      }
      profile_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          average: number
          books_read: number
          review_count: number
        }[]
      }
      remove_member: {
        Args: { p_club_id: string; p_user_id: string }
        Returns: undefined
      }
      remove_nomination: {
        Args: { p_nomination_id: string }
        Returns: undefined
      }
      request_round_closes: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      revoke_invite: { Args: { p_invite_id: string }; Returns: undefined }
      round_vote_status: {
        Args: { p_round_id: string }
        Returns: {
          has_voted: boolean
          user_id: string
        }[]
      }
      rounds_due_for_close: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      save_ballot: {
        Args: { p_nomination_ids: string[]; p_round_id: string }
        Returns: string
      }
      set_discussion_mode: {
        Args: {
          p_club_book_id: string
          p_mode: Database['public']['Enums']['discussion_mode']
        }
        Returns: undefined
      }
      set_member_role: {
        Args: {
          p_club_id: string
          p_role: Database['public']['Enums']['club_role']
          p_user_id: string
        }
        Returns: undefined
      }
      shares_club_with: { Args: { p_user_id: string }; Returns: boolean }
      start_round: {
        Args: {
          p_anonymous?: boolean
          p_club_id: string
          p_deadline_date: string
          p_max_nominations?: number
          p_note?: string
          p_timezone: string
        }
        Returns: string
      }
      transfer_ownership: {
        Args: { p_club_id: string; p_new_owner: string }
        Returns: undefined
      }
      update_pitch: {
        Args: { p_nomination_id: string; p_pitch: string }
        Returns: undefined
      }
      update_round: {
        Args: {
          p_anonymous?: boolean
          p_deadline_date?: string
          p_max_nominations?: number
          p_round_id: string
          p_timezone?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      club_book_status: 'reading' | 'finished'
      club_role: 'owner' | 'admin' | 'member'
      discussion_mode: 'single' | 'sections'
      round_status: 'open' | 'closing' | 'closed' | 'cancelled'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      club_book_status: ['reading', 'finished'],
      club_role: ['owner', 'admin', 'member'],
      discussion_mode: ['single', 'sections'],
      round_status: ['open', 'closing', 'closed', 'cancelled'],
    },
  },
} as const
