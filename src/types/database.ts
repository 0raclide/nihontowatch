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
          earliest_listing_at: string | null;
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
          price_jpy: number | null; // Normalized price in JPY for cross-currency sorting
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
          description_en: string | null;
          title_en: string | null;
          // Setsumei (Juyo/Tokuju certification translations)
          setsumei_image_url: string | null;
          setsumei_text_ja: string | null;
          setsumei_text_en: string | null;
          setsumei_metadata: Record<string, unknown> | null;
          setsumei_processed_at: string | null;
          setsumei_error: string | null;
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
          // Subscription fields
          subscription_tier: 'free' | 'enthusiast' | 'collector' | 'inner_circle' | 'dealer';
          subscription_status: 'active' | 'inactive' | 'cancelled' | 'past_due';
          subscription_started_at: string | null;
          subscription_expires_at: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          created_at: string;
          updated_at: string;
          last_visit_at: string | null;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          role?: 'user' | 'admin';
          preferences?: Record<string, unknown> | null;
          subscription_tier?: 'free' | 'enthusiast' | 'collector' | 'inner_circle' | 'dealer';
          subscription_status?: 'active' | 'inactive' | 'cancelled' | 'past_due';
          subscription_started_at?: string | null;
          subscription_expires_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          last_visit_at?: string | null;
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
          visitor_id: string | null;
          event_type: 'page_view' | 'listing_view' | 'search' | 'filter_change' | 'favorite_add' | 'favorite_remove' | 'alert_create' | 'alert_delete' | 'external_link_click' | 'viewport_dwell';
          event_data: Record<string, unknown>;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['activity_events']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['activity_events']['Insert']>;
      };
      // Saved searches for new listing notifications
      saved_searches: {
        Row: {
          id: string;
          user_id: string;
          name: string | null;
          search_criteria: {
            tab?: 'available' | 'sold' | 'all';
            category?: 'all' | 'nihonto' | 'tosogu';
            itemTypes?: string[];
            certifications?: string[];
            dealers?: number[];
            schools?: string[];
            askOnly?: boolean;
            query?: string;
            sort?: string;
            minPrice?: number;
            maxPrice?: number;
          };
          notification_frequency: 'instant' | 'daily' | 'none';
          is_active: boolean;
          last_notified_at: string | null;
          last_match_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          name?: string | null;
          search_criteria: Database['public']['Tables']['saved_searches']['Row']['search_criteria'];
          notification_frequency?: 'instant' | 'daily' | 'none';
          is_active?: boolean;
        };
        Update: Partial<Omit<Database['public']['Tables']['saved_searches']['Row'], 'id' | 'user_id' | 'created_at'>>;
      };
      // Saved search notification queue and history
      saved_search_notifications: {
        Row: {
          id: string;
          saved_search_id: string;
          matched_listing_ids: number[];
          status: 'pending' | 'sent' | 'failed';
          error_message: string | null;
          created_at: string;
          sent_at: string | null;
        };
        Insert: {
          saved_search_id: string;
          matched_listing_ids: number[];
          status?: 'pending' | 'sent' | 'failed';
          error_message?: string | null;
        };
        Update: Partial<Omit<Database['public']['Tables']['saved_search_notifications']['Row'], 'id' | 'created_at'>>;
      };
      // Yuhinkai enrichments (setsumei data from Oshi-v2 catalog)
      yuhinkai_enrichments: {
        Row: {
          id: number;
          listing_id: number | null;
          catalog_id: string | null;
          yuhinkai_uuid: string | null;
          yuhinkai_collection: string | null;
          yuhinkai_volume: number | null;
          yuhinkai_item_number: number | null;
          title: string | null;
          // Setsumei translations
          setsumei_ja: string | null;
          setsumei_en: string | null;
          setsumei_en_format: string | null;
          setsumei_text_ja: string | null;
          setsumei_text_en: string | null;
          setsumei_image_url: string | null;
          // Match metadata
          match_score: number | null;
          match_confidence: string | null;
          match_signals: Record<string, unknown> | null;
          matched_fields: string[] | null;
          // Enriched data from catalog
          enriched_maker: string | null;
          enriched_maker_kanji: string | null;
          enriched_school: string | null;
          enriched_period: string | null;
          enriched_form_type: string | null;
          enriched_cert_type: string | null;
          enriched_cert_session: string | null;
          item_category: string | null;
          // Verification
          verification_status: string | null;
          verified_by: string | null;
          verified_at: string | null;
          connection_source: string | null;
          enriched_at: string | null;
          // Metadata
          metadata: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['yuhinkai_enrichments']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['yuhinkai_enrichments']['Insert']>;
      };
      // Listing to Yuhinkai enrichment mapping
      listing_yuhinkai_enrichment: {
        Row: {
          id: number;
          listing_id: number;
          enrichment_id: number;
          confidence_score: number | null;
          match_method: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['listing_yuhinkai_enrichment']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['listing_yuhinkai_enrichment']['Insert']>;
      };
      // Inquiry history (for AI-generated inquiry emails)
      inquiry_history: {
        Row: {
          id: number;
          user_id: string | null;
          listing_id: number;
          dealer_id: number;
          inquiry_text: string;
          model_used: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['inquiry_history']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['inquiry_history']['Insert']>;
      };
      // Market intelligence daily snapshots
      market_daily_snapshots: {
        Row: {
          id: string;
          snapshot_date: string; // DATE as ISO string
          // Aggregate counts
          total_listings: number;
          available_listings: number;
          sold_listings: number;
          new_listings_24h: number;
          sold_24h: number;
          price_changes_24h: number;
          // Market value (in JPY)
          total_market_value_jpy: number;
          median_price_jpy: number | null;
          avg_price_jpy: number | null;
          // Price percentiles
          price_p10_jpy: number | null;
          price_p25_jpy: number | null;
          price_p75_jpy: number | null;
          price_p90_jpy: number | null;
          price_min_jpy: number | null;
          price_max_jpy: number | null;
          // Breakdowns (JSONB)
          category_breakdown: Record<string, {
            count: number;
            available: number;
            sold: number;
            value_jpy: number;
            median_jpy: number;
            avg_jpy?: number;
            min_jpy?: number;
            max_jpy?: number;
          }>;
          dealer_breakdown: Record<string, {
            dealer_id: number;
            domain?: string;
            country?: string;
            count: number;
            available: number;
            sold?: number;
            value_jpy: number;
            median_jpy: number;
            avg_jpy?: number;
          }>;
          certification_breakdown: Record<string, {
            count: number;
            available: number;
            sold?: number;
            value_jpy: number;
            median_jpy: number;
            avg_jpy?: number;
          }>;
          // Metadata
          created_at: string;
        };
        Insert: {
          snapshot_date: string;
          total_listings: number;
          available_listings: number;
          sold_listings: number;
          new_listings_24h?: number;
          sold_24h?: number;
          price_changes_24h?: number;
          total_market_value_jpy: number;
          median_price_jpy?: number | null;
          avg_price_jpy?: number | null;
          price_p10_jpy?: number | null;
          price_p25_jpy?: number | null;
          price_p75_jpy?: number | null;
          price_p90_jpy?: number | null;
          price_min_jpy?: number | null;
          price_max_jpy?: number | null;
          category_breakdown?: Record<string, unknown>;
          dealer_breakdown?: Record<string, unknown>;
          certification_breakdown?: Record<string, unknown>;
        };
        Update: Partial<Omit<Database['public']['Tables']['market_daily_snapshots']['Row'], 'id' | 'created_at'>>;
      };
      // User collection items (personal collection cataloging)
      user_collection_items: {
        Row: {
          id: string;
          user_id: string;
          source_listing_id: number | null;
          item_type: string | null;
          title: string | null;
          artisan_id: string | null;
          artisan_display_name: string | null;
          cert_type: string | null;
          cert_session: number | null;
          cert_organization: string | null;
          smith: string | null;
          school: string | null;
          province: string | null;
          era: string | null;
          mei_type: string | null;
          nagasa_cm: number | null;
          sori_cm: number | null;
          motohaba_cm: number | null;
          sakihaba_cm: number | null;
          price_paid: number | null;
          price_paid_currency: string | null;
          current_value: number | null;
          current_value_currency: string | null;
          acquired_date: string | null;
          acquired_from: string | null;
          condition: string;
          status: string;
          notes: string | null;
          images: string[];
          catalog_reference: Record<string, unknown> | null;
          is_public: boolean;
          folder_id: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          source_listing_id?: number | null;
          item_type?: string | null;
          title?: string | null;
          artisan_id?: string | null;
          artisan_display_name?: string | null;
          cert_type?: string | null;
          cert_session?: number | null;
          cert_organization?: string | null;
          smith?: string | null;
          school?: string | null;
          province?: string | null;
          era?: string | null;
          mei_type?: string | null;
          nagasa_cm?: number | null;
          sori_cm?: number | null;
          motohaba_cm?: number | null;
          sakihaba_cm?: number | null;
          price_paid?: number | null;
          price_paid_currency?: string | null;
          current_value?: number | null;
          current_value_currency?: string | null;
          acquired_date?: string | null;
          acquired_from?: string | null;
          condition?: string;
          status?: string;
          notes?: string | null;
          images?: string[];
          catalog_reference?: Record<string, unknown> | null;
          is_public?: boolean;
          folder_id?: string | null;
          sort_order?: number;
        };
        Update: Partial<Database['public']['Tables']['user_collection_items']['Insert']>;
      };
      // User collection folders
      user_collection_folders: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          cover_image_url: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          name: string;
          description?: string | null;
          cover_image_url?: string | null;
          sort_order?: number;
        };
        Update: Partial<Omit<Database['public']['Tables']['user_collection_folders']['Row'], 'id' | 'user_id' | 'created_at'>>;
      };
    };
    Views: {
      // Materialized view for market statistics by item type
      mv_market_by_item_type: {
        Row: {
          item_type: string | null;
          total_count: number;
          available_count: number;
          sold_count: number;
          total_value_jpy: number;
          median_price_jpy: number | null;
          avg_price_jpy: number | null;
          min_price_jpy: number | null;
          max_price_jpy: number | null;
        };
      };
      // Materialized view for market statistics by dealer
      mv_market_by_dealer: {
        Row: {
          dealer_id: number;
          dealer_name: string;
          dealer_domain: string;
          dealer_country: string;
          total_count: number;
          available_count: number;
          sold_count: number;
          total_value_jpy: number;
          median_price_jpy: number | null;
          avg_price_jpy: number | null;
        };
      };
      // Materialized view for market statistics by certification
      mv_market_by_certification: {
        Row: {
          cert_type: string;
          total_count: number;
          available_count: number;
          sold_count: number;
          total_value_jpy: number;
          median_price_jpy: number | null;
          avg_price_jpy: number | null;
        };
      };
    };
    Functions: {
      refresh_price_jpy: {
        Args: {
          usd_to_jpy?: number;
          eur_to_jpy?: number;
          gbp_to_jpy?: number;
        };
        Returns: number;
      };
      // Market intelligence functions
      refresh_market_views: {
        Args: Record<string, never>;
        Returns: void;
      };
      capture_market_snapshot: {
        Args: Record<string, never>;
        Returns: string; // UUID
      };
      get_market_overview: {
        Args: Record<string, never>;
        Returns: {
          total_listings: number;
          available_listings: number;
          sold_listings: number;
          total_market_value_jpy: number;
          median_price_jpy: number | null;
          avg_price_jpy: number | null;
          min_price_jpy: number | null;
          max_price_jpy: number | null;
          p10_jpy: number | null;
          p25_jpy: number | null;
          p75_jpy: number | null;
          p90_jpy: number | null;
          new_listings_24h: number;
          sold_24h: number;
          price_changes_24h: number;
        }[];
      };
      get_price_distribution: {
        Args: {
          p_bucket_count?: number;
          p_item_type?: string | null;
          p_cert_type?: string | null;
          p_dealer_id?: number | null;
        };
        Returns: {
          bucket_num: number;
          range_start: number;
          range_end: number;
          count: number;
        }[];
      };
      get_market_trend: {
        Args: {
          p_days?: number;
          p_end_date?: string;
        };
        Returns: {
          snapshot_date: string;
          total_listings: number;
          available_listings: number;
          sold_listings: number;
          total_market_value_jpy: number;
          median_price_jpy: number | null;
          new_listings_24h: number;
          sold_24h: number;
          price_changes_24h: number;
        }[];
      };
      get_category_comparison: {
        Args: {
          p_item_types?: string[] | null;
        };
        Returns: {
          item_type: string | null;
          total_count: number;
          available_count: number;
          sold_count: number;
          total_value_jpy: number;
          median_price_jpy: number | null;
          avg_price_jpy: number | null;
          min_price_jpy: number | null;
          max_price_jpy: number | null;
        }[];
      };
      get_dealer_rankings: {
        Args: {
          p_order_by?: string;
          p_limit?: number;
        };
        Returns: {
          dealer_id: number;
          dealer_name: string;
          dealer_domain: string;
          dealer_country: string;
          total_count: number;
          available_count: number;
          sold_count: number;
          total_value_jpy: number;
          median_price_jpy: number | null;
          avg_price_jpy: number | null;
          rank: number;
        }[];
      };
    };
    Enums: {
      action_type: 'view' | 'search' | 'favorite' | 'alert_create' | 'alert_delete' | 'login' | 'logout';
      alert_type: 'price_drop' | 'new_listing' | 'back_in_stock';
      delivery_status: 'pending' | 'sent' | 'failed';
      activity_event_type: 'page_view' | 'listing_view' | 'search' | 'filter_change' | 'favorite_add' | 'favorite_remove' | 'alert_create' | 'alert_delete' | 'external_link_click';
      notification_frequency: 'instant' | 'daily' | 'none';
      saved_search_notification_status: 'pending' | 'sent' | 'failed';
    };
  };
}
