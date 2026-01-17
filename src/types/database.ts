/**
 * Database type definitions
 *
 * This file should be generated from Supabase schema:
 * npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
 *
 * For now, we define a minimal structure that matches the Oshi-scrapper schema.
 */

export interface Database {
  public: {
    Tables: {
      dealers: {
        Row: {
          id: number;
          name: string;
          domain: string;
          catalog_url: string | null;
          country: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['dealers']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['dealers']['Insert']>;
      };
      listings: {
        Row: {
          id: number;
          url: string;
          dealer_id: number;
          status: string;
          is_available: boolean | null;
          is_sold: boolean | null;
          page_exists: boolean;
          title: string | null;
          description: string | null;
          item_type: string | null;
          item_category: string | null;
          price_value: number | null;
          price_currency: string;
          price_raw: string | null;
          nagasa_cm: number | null;
          sori_cm: number | null;
          motohaba_cm: number | null;
          sakihaba_cm: number | null;
          kasane_cm: number | null;
          weight_g: number | null;
          nakago_cm: number | null;
          tosogu_maker: string | null;
          tosogu_school: string | null;
          material: string | null;
          height_cm: number | null;
          width_cm: number | null;
          thickness_mm: number | null;
          smith: string | null;
          school: string | null;
          province: string | null;
          era: string | null;
          mei_type: string | null;
          cert_type: string | null;
          cert_session: number | null;
          cert_organization: string | null;
          images: string[];
          raw_page_text: string | null;
          first_seen_at: string;
          last_scraped_at: string;
          scrape_count: number;
        };
        Insert: Omit<Database['public']['Tables']['listings']['Row'], 'id' | 'first_seen_at' | 'last_scraped_at' | 'scrape_count'>;
        Update: Partial<Database['public']['Tables']['listings']['Insert']>;
      };
      price_history: {
        Row: {
          id: number;
          listing_id: number;
          old_price: number | null;
          new_price: number | null;
          old_currency: string | null;
          new_currency: string | null;
          change_type: string;
          detected_at: string;
        };
        Insert: Omit<Database['public']['Tables']['price_history']['Row'], 'id' | 'detected_at'>;
        Update: Partial<Database['public']['Tables']['price_history']['Insert']>;
      };
      discovered_urls: {
        Row: {
          id: number;
          url: string;
          dealer_id: number;
          discovered_at: string;
          last_scraped_at: string | null;
          is_scraped: boolean;
          scrape_priority: number;
        };
        Insert: Omit<Database['public']['Tables']['discovered_urls']['Row'], 'id' | 'discovered_at'>;
        Update: Partial<Database['public']['Tables']['discovered_urls']['Insert']>;
      };
      scrape_runs: {
        Row: {
          id: number;
          run_type: string;
          dealer_id: number | null;
          started_at: string;
          completed_at: string | null;
          urls_processed: number;
          new_listings: number;
          updated_listings: number;
          errors: number;
          status: string;
        };
        Insert: Omit<Database['public']['Tables']['scrape_runs']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['scrape_runs']['Insert']>;
      };
      user_favorites: {
        Row: {
          id: string;
          user_id: string;
          listing_id: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_favorites']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['user_favorites']['Insert']>;
      };
      alerts: {
        Row: {
          id: number;
          user_id: string;
          alert_type: 'price_drop' | 'new_listing' | 'back_in_stock';
          listing_id: number | null;
          target_price: number | null;
          search_criteria: {
            item_type?: string;
            dealer_id?: number;
            min_price?: number;
            max_price?: number;
            cert_type?: string;
          } | null;
          is_active: boolean;
          last_triggered_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['alerts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['alerts']['Insert']>;
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          role: 'user' | 'admin';
          preferences: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          role?: 'user' | 'admin';
          preferences?: Record<string, unknown> | null;
        };
        Update: Partial<Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at'>>;
      };
      // User activity tracking for admin dashboard
      user_activity: {
        Row: {
          id: number;
          user_id: string;
          action_type: 'view' | 'search' | 'favorite' | 'alert_create' | 'alert_delete' | 'login' | 'logout';
          page_path: string | null;
          listing_id: number | null;
          search_query: string | null;
          duration_seconds: number | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_activity']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['user_activity']['Insert']>;
      };
      // Alert delivery history
      alert_history: {
        Row: {
          id: number;
          alert_id: number;
          triggered_at: string;
          delivery_status: 'pending' | 'sent' | 'failed';
          delivery_method: 'email' | 'push';
          error_message: string | null;
        };
        Insert: Omit<Database['public']['Tables']['alert_history']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['alert_history']['Insert']>;
      };
      // User sessions for activity tracking
      user_sessions: {
        Row: {
          id: string;
          user_id: string | null;
          started_at: string;
          ended_at: string | null;
          total_duration_ms: number | null;
          page_views: number;
          user_agent: string | null;
          screen_width: number | null;
          screen_height: number | null;
          timezone: string | null;
          language: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_sessions']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['user_sessions']['Insert']>;
      };
      // Activity events for detailed tracking
      activity_events: {
        Row: {
          id: number;
          session_id: string;
          user_id: string | null;
          event_type: 'page_view' | 'listing_view' | 'search' | 'filter_change' | 'favorite_add' | 'favorite_remove' | 'alert_create' | 'alert_delete' | 'external_link_click';
          event_data: Record<string, unknown>;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['activity_events']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['activity_events']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      action_type: 'view' | 'search' | 'favorite' | 'alert_create' | 'alert_delete' | 'login' | 'logout';
      alert_type: 'price_drop' | 'new_listing' | 'back_in_stock';
      delivery_status: 'pending' | 'sent' | 'failed';
      activity_event_type: 'page_view' | 'listing_view' | 'search' | 'filter_change' | 'favorite_add' | 'favorite_remove' | 'alert_create' | 'alert_delete' | 'external_link_click';
    };
  };
}
