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
      activity_events: {
        Row: {
          created_at: string
          event_data: Json
          event_type: string
          id: number
          ip_address: string | null
          session_id: string
          user_id: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json
          event_type: string
          id?: number
          ip_address?: string | null
          session_id: string
          user_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: number
          ip_address?: string | null
          session_id?: string
          user_id?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      alert_history: {
        Row: {
          alert_id: string
          email_sent: boolean
          email_sent_at: string | null
          id: string
          listing_id: number | null
          metadata: Json | null
          triggered_at: string
        }
        Insert: {
          alert_id: string
          email_sent?: boolean
          email_sent_at?: string | null
          id?: string
          listing_id?: number | null
          metadata?: Json | null
          triggered_at?: string
        }
        Update: {
          alert_id?: string
          email_sent?: boolean
          email_sent_at?: string | null
          id?: string
          listing_id?: number | null
          metadata?: Json | null
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_history_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "user_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_swords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_tosogu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "sold_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "v_top_listings_by_clicks"
            referencedColumns: ["listing_id"]
          },
        ]
      }
      alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: number
          is_active: boolean
          last_triggered_at: string | null
          listing_id: number | null
          search_criteria: Json | null
          target_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: number
          is_active?: boolean
          last_triggered_at?: string | null
          listing_id?: number | null
          search_criteria?: Json | null
          target_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: number
          is_active?: boolean
          last_triggered_at?: string | null
          listing_id?: number | null
          search_criteria?: Json | null
          target_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_swords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_tosogu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "sold_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "v_top_listings_by_clicks"
            referencedColumns: ["listing_id"]
          },
        ]
      }
      catalog_records: {
        Row: {
          catalog_id: string | null
          collection: Database["public"]["Enums"]["collection_name"]
          created_at: string
          designation_date: string | null
          estimated_year_max: number | null
          estimated_year_min: number | null
          item_number: number
          japanese_txt: string | null
          metadata: Json
          object_uuid: string
          search_vector: unknown
          session_number: number | null
          translation_md: string | null
          updated_at: string
          uuid: string
          volume: number
        }
        Insert: {
          catalog_id?: string | null
          collection: Database["public"]["Enums"]["collection_name"]
          created_at?: string
          designation_date?: string | null
          estimated_year_max?: number | null
          estimated_year_min?: number | null
          item_number: number
          japanese_txt?: string | null
          metadata?: Json
          object_uuid: string
          search_vector?: unknown
          session_number?: number | null
          translation_md?: string | null
          updated_at?: string
          uuid?: string
          volume: number
        }
        Update: {
          catalog_id?: string | null
          collection?: Database["public"]["Enums"]["collection_name"]
          created_at?: string
          designation_date?: string | null
          estimated_year_max?: number | null
          estimated_year_min?: number | null
          item_number?: number
          japanese_txt?: string | null
          metadata?: Json
          object_uuid?: string
          search_vector?: unknown
          session_number?: number | null
          translation_md?: string | null
          updated_at?: string
          uuid?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalog_records_object_uuid_fkey"
            columns: ["object_uuid"]
            isOneToOne: false
            referencedRelation: "physical_objects"
            referencedColumns: ["uuid"]
          },
        ]
      }
      click_conversions: {
        Row: {
          click_id: number
          click_price: number | null
          clicked_at: string
          created_at: string | null
          currency: string | null
          days_to_conversion: number | null
          dealer_id: number
          id: number
          listing_id: number
          sold_at: string
          sold_price: number | null
        }
        Insert: {
          click_id: number
          click_price?: number | null
          clicked_at: string
          created_at?: string | null
          currency?: string | null
          days_to_conversion?: number | null
          dealer_id: number
          id?: number
          listing_id: number
          sold_at: string
          sold_price?: number | null
        }
        Update: {
          click_id?: number
          click_price?: number | null
          clicked_at?: string
          created_at?: string | null
          currency?: string | null
          days_to_conversion?: number | null
          dealer_id?: number
          id?: number
          listing_id?: number
          sold_at?: string
          sold_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "click_conversions_click_id_fkey"
            columns: ["click_id"]
            isOneToOne: false
            referencedRelation: "dealer_clicks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "click_conversions_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "click_conversions_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "inquiry_analytics"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "click_conversions_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "mv_market_by_dealer"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "click_conversions_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "setsumei_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "click_conversions_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "v_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "click_conversions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_swords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "click_conversions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_tosogu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "click_conversions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "click_conversions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "sold_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "click_conversions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "v_top_listings_by_clicks"
            referencedColumns: ["listing_id"]
          },
        ]
      }
      content_change_events: {
        Row: {
          change_severity: string
          change_type: string
          dealer_id: number | null
          detected_at: string | null
          detection_confidence: number | null
          detection_method: string
          id: number
          new_listing_id: number | null
          new_values: Json
          old_listing_id: number | null
          old_values: Json
          processed_at: string | null
          status: string | null
          url: string
        }
        Insert: {
          change_severity: string
          change_type: string
          dealer_id?: number | null
          detected_at?: string | null
          detection_confidence?: number | null
          detection_method: string
          id?: number
          new_listing_id?: number | null
          new_values: Json
          old_listing_id?: number | null
          old_values: Json
          processed_at?: string | null
          status?: string | null
          url: string
        }
        Update: {
          change_severity?: string
          change_type?: string
          dealer_id?: number | null
          detected_at?: string | null
          detection_confidence?: number | null
          detection_method?: string
          id?: number
          new_listing_id?: number | null
          new_values?: Json
          old_listing_id?: number | null
          old_values?: Json
          processed_at?: string | null
          status?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_change_events_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_change_events_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "inquiry_analytics"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "content_change_events_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "mv_market_by_dealer"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "content_change_events_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "setsumei_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "content_change_events_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "v_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "content_change_events_old_listing_id_fkey"
            columns: ["old_listing_id"]
            isOneToOne: false
            referencedRelation: "available_swords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_change_events_old_listing_id_fkey"
            columns: ["old_listing_id"]
            isOneToOne: false
            referencedRelation: "available_tosogu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_change_events_old_listing_id_fkey"
            columns: ["old_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_change_events_old_listing_id_fkey"
            columns: ["old_listing_id"]
            isOneToOne: false
            referencedRelation: "sold_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_change_events_old_listing_id_fkey"
            columns: ["old_listing_id"]
            isOneToOne: false
            referencedRelation: "v_top_listings_by_clicks"
            referencedColumns: ["listing_id"]
          },
        ]
      }
      cross_references: {
        Row: {
          created_at: string
          created_by: string | null
          creator_type: Database["public"]["Enums"]["crossref_creator_type"]
          id: string
          item_a: Json | null
          item_b: Json | null
          notes: string | null
          object_uuid_a: string | null
          object_uuid_b: string | null
          relation_type: string
          status: Database["public"]["Enums"]["crossref_status"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          creator_type?: Database["public"]["Enums"]["crossref_creator_type"]
          id?: string
          item_a?: Json | null
          item_b?: Json | null
          notes?: string | null
          object_uuid_a?: string | null
          object_uuid_b?: string | null
          relation_type?: string
          status?: Database["public"]["Enums"]["crossref_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          creator_type?: Database["public"]["Enums"]["crossref_creator_type"]
          id?: string
          item_a?: Json | null
          item_b?: Json | null
          notes?: string | null
          object_uuid_a?: string | null
          object_uuid_b?: string | null
          relation_type?: string
          status?: Database["public"]["Enums"]["crossref_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cross_references_object_uuid_a_fkey"
            columns: ["object_uuid_a"]
            isOneToOne: false
            referencedRelation: "physical_objects"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "cross_references_object_uuid_b_fkey"
            columns: ["object_uuid_b"]
            isOneToOne: false
            referencedRelation: "physical_objects"
            referencedColumns: ["uuid"]
          },
        ]
      }
      dealer_clicks: {
        Row: {
          created_at: string | null
          currency_at_click: string | null
          dealer_id: number
          id: number
          listing_id: number | null
          price_at_click: number | null
          referrer_path: string | null
          search_query: string | null
          session_id: string | null
          source: string | null
          url: string
          visitor_id: string | null
        }
        Insert: {
          created_at?: string | null
          currency_at_click?: string | null
          dealer_id: number
          id?: number
          listing_id?: number | null
          price_at_click?: number | null
          referrer_path?: string | null
          search_query?: string | null
          session_id?: string | null
          source?: string | null
          url: string
          visitor_id?: string | null
        }
        Update: {
          created_at?: string | null
          currency_at_click?: string | null
          dealer_id?: number
          id?: number
          listing_id?: number | null
          price_at_click?: number | null
          referrer_path?: string | null
          search_query?: string | null
          session_id?: string | null
          source?: string | null
          url?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_clicks_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_clicks_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "inquiry_analytics"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_clicks_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "mv_market_by_dealer"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_clicks_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "setsumei_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_clicks_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "v_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_clicks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_swords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_clicks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_tosogu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_clicks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_clicks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "sold_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_clicks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "v_top_listings_by_clicks"
            referencedColumns: ["listing_id"]
          },
        ]
      }
      dealer_daily_stats: {
        Row: {
          active_listings: number | null
          alerts_created: number | null
          avg_dwell_ms: number | null
          click_throughs: number | null
          clicked_then_sold: number | null
          created_at: string | null
          ctr: number | null
          date: string
          dealer_id: number
          favorites_added: number | null
          id: number
          impressions: number | null
          listing_views: number | null
          listings_sold: number | null
          total_dwell_ms: number | null
          total_value_jpy: number | null
          unique_visitors: number | null
          updated_at: string | null
        }
        Insert: {
          active_listings?: number | null
          alerts_created?: number | null
          avg_dwell_ms?: number | null
          click_throughs?: number | null
          clicked_then_sold?: number | null
          created_at?: string | null
          ctr?: number | null
          date: string
          dealer_id: number
          favorites_added?: number | null
          id?: number
          impressions?: number | null
          listing_views?: number | null
          listings_sold?: number | null
          total_dwell_ms?: number | null
          total_value_jpy?: number | null
          unique_visitors?: number | null
          updated_at?: string | null
        }
        Update: {
          active_listings?: number | null
          alerts_created?: number | null
          avg_dwell_ms?: number | null
          click_throughs?: number | null
          clicked_then_sold?: number | null
          created_at?: string | null
          ctr?: number | null
          date?: string
          dealer_id?: number
          favorites_added?: number | null
          id?: number
          impressions?: number | null
          listing_views?: number | null
          listings_sold?: number | null
          total_dwell_ms?: number | null
          total_value_jpy?: number | null
          unique_visitors?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_daily_stats_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_daily_stats_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "inquiry_analytics"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_daily_stats_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "mv_market_by_dealer"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_daily_stats_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "setsumei_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_daily_stats_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "v_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
        ]
      }
      dealer_rankings: {
        Row: {
          clicks_change_pct: number | null
          clicks_percentile: number | null
          clicks_rank: number | null
          computed_at: string | null
          ctr_rank: number | null
          dealer_id: number
          engagement_rank: number | null
          id: number
          impressions_rank: number | null
          period: string
          total_clicks: number | null
          total_favorites: number | null
          total_impressions: number | null
          total_views: number | null
        }
        Insert: {
          clicks_change_pct?: number | null
          clicks_percentile?: number | null
          clicks_rank?: number | null
          computed_at?: string | null
          ctr_rank?: number | null
          dealer_id: number
          engagement_rank?: number | null
          id?: number
          impressions_rank?: number | null
          period: string
          total_clicks?: number | null
          total_favorites?: number | null
          total_impressions?: number | null
          total_views?: number | null
        }
        Update: {
          clicks_change_pct?: number | null
          clicks_percentile?: number | null
          clicks_rank?: number | null
          computed_at?: string | null
          ctr_rank?: number | null
          dealer_id?: number
          engagement_rank?: number | null
          id?: number
          impressions_rank?: number | null
          period?: string
          total_clicks?: number | null
          total_favorites?: number | null
          total_impressions?: number | null
          total_views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_rankings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_rankings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "inquiry_analytics"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_rankings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "mv_market_by_dealer"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_rankings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "setsumei_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_rankings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "v_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
        ]
      }
      dealers: {
        Row: {
          accepts_credit_card: boolean | null
          accepts_paypal: boolean | null
          accepts_wire_transfer: boolean | null
          catalog_url: string | null
          contact_email: string | null
          contact_page_url: string | null
          created_at: string | null
          deposit_percentage: number | null
          domain: string
          english_support: boolean | null
          id: number
          is_active: boolean | null
          name: string
          requires_deposit: boolean | null
          sales_policy_url: string | null
          ships_international: boolean | null
        }
        Insert: {
          accepts_credit_card?: boolean | null
          accepts_paypal?: boolean | null
          accepts_wire_transfer?: boolean | null
          catalog_url?: string | null
          contact_email?: string | null
          contact_page_url?: string | null
          created_at?: string | null
          deposit_percentage?: number | null
          domain: string
          english_support?: boolean | null
          id?: number
          is_active?: boolean | null
          name: string
          requires_deposit?: boolean | null
          sales_policy_url?: string | null
          ships_international?: boolean | null
        }
        Update: {
          accepts_credit_card?: boolean | null
          accepts_paypal?: boolean | null
          accepts_wire_transfer?: boolean | null
          catalog_url?: string | null
          contact_email?: string | null
          contact_page_url?: string | null
          created_at?: string | null
          deposit_percentage?: number | null
          domain?: string
          english_support?: boolean | null
          id?: number
          is_active?: boolean | null
          name?: string
          requires_deposit?: boolean | null
          sales_policy_url?: string | null
          ships_international?: boolean | null
        }
        Relationships: []
      }
      default_volume_access: {
        Row: {
          collection: Database["public"]["Enums"]["collection_name"]
          enabled: boolean
          id: string
          updated_at: string
          updated_by: string | null
          volume: number
        }
        Insert: {
          collection: Database["public"]["Enums"]["collection_name"]
          enabled?: boolean
          id?: string
          updated_at?: string
          updated_by?: string | null
          volume: number
        }
        Update: {
          collection?: Database["public"]["Enums"]["collection_name"]
          enabled?: boolean
          id?: string
          updated_at?: string
          updated_by?: string | null
          volume?: number
        }
        Relationships: []
      }
      discovered_urls: {
        Row: {
          consecutive_failures: number | null
          dealer_id: number | null
          discovered_at: string | null
          id: number
          is_accessible: boolean | null
          is_scraped: boolean | null
          last_checked_at: string | null
          last_error: string | null
          last_scraped_at: string | null
          needs_rescrape: boolean | null
          rescrape_detected_at: string | null
          rescrape_priority: number | null
          rescrape_reason: string | null
          scrape_priority: number | null
          url: string
        }
        Insert: {
          consecutive_failures?: number | null
          dealer_id?: number | null
          discovered_at?: string | null
          id?: number
          is_accessible?: boolean | null
          is_scraped?: boolean | null
          last_checked_at?: string | null
          last_error?: string | null
          last_scraped_at?: string | null
          needs_rescrape?: boolean | null
          rescrape_detected_at?: string | null
          rescrape_priority?: number | null
          rescrape_reason?: string | null
          scrape_priority?: number | null
          url: string
        }
        Update: {
          consecutive_failures?: number | null
          dealer_id?: number | null
          discovered_at?: string | null
          id?: number
          is_accessible?: boolean | null
          is_scraped?: boolean | null
          last_checked_at?: string | null
          last_error?: string | null
          last_scraped_at?: string | null
          needs_rescrape?: boolean | null
          rescrape_detected_at?: string | null
          rescrape_priority?: number | null
          rescrape_reason?: string | null
          scrape_priority?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovered_urls_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovered_urls_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "inquiry_analytics"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "discovered_urls_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "mv_market_by_dealer"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "discovered_urls_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "setsumei_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "discovered_urls_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "v_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
        ]
      }
      discovery_runs: {
        Row: {
          categories_crawled: number | null
          category_stats: Json | null
          changed_urls: number | null
          completed_at: string | null
          created_at: string | null
          dealer_id: number | null
          error_message: string | null
          id: number
          new_urls: number | null
          pages_crawled: number | null
          run_id: number | null
          started_at: string | null
          status: string | null
          urls_found: number | null
        }
        Insert: {
          categories_crawled?: number | null
          category_stats?: Json | null
          changed_urls?: number | null
          completed_at?: string | null
          created_at?: string | null
          dealer_id?: number | null
          error_message?: string | null
          id?: number
          new_urls?: number | null
          pages_crawled?: number | null
          run_id?: number | null
          started_at?: string | null
          status?: string | null
          urls_found?: number | null
        }
        Update: {
          categories_crawled?: number | null
          category_stats?: Json | null
          changed_urls?: number | null
          completed_at?: string | null
          created_at?: string | null
          dealer_id?: number | null
          error_message?: string | null
          id?: number
          new_urls?: number | null
          pages_crawled?: number | null
          run_id?: number | null
          started_at?: string | null
          status?: string | null
          urls_found?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_runs_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_runs_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "inquiry_analytics"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "discovery_runs_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "mv_market_by_dealer"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "discovery_runs_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "setsumei_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "discovery_runs_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "v_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "discovery_runs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "scrape_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_metrics: {
        Row: {
          certification_confidence: number | null
          completeness_score: number | null
          cover_image_url: string | null
          cover_selection_reason: string | null
          cover_selection_score: number | null
          critical_issues: Json | null
          dealer_id: number | null
          error_count: number | null
          experiment_group: string | null
          experiment_id: string | null
          extracted_at: string | null
          id: number
          info_count: number | null
          listing_id: number | null
          llm_model: string | null
          low_confidence_fields: Json | null
          nagasa_confidence: number | null
          overall_confidence: number | null
          price_confidence: number | null
          prompt_variant: string | null
          prompt_version: string | null
          province_confidence: number | null
          qa_status: string
          quality_score: number | null
          raw_scores: Json | null
          smith_confidence: number | null
          status_confidence: number | null
          title_confidence: number | null
          validation_errors: Json | null
          validation_score: number | null
          warning_count: number | null
        }
        Insert: {
          certification_confidence?: number | null
          completeness_score?: number | null
          cover_image_url?: string | null
          cover_selection_reason?: string | null
          cover_selection_score?: number | null
          critical_issues?: Json | null
          dealer_id?: number | null
          error_count?: number | null
          experiment_group?: string | null
          experiment_id?: string | null
          extracted_at?: string | null
          id?: number
          info_count?: number | null
          listing_id?: number | null
          llm_model?: string | null
          low_confidence_fields?: Json | null
          nagasa_confidence?: number | null
          overall_confidence?: number | null
          price_confidence?: number | null
          prompt_variant?: string | null
          prompt_version?: string | null
          province_confidence?: number | null
          qa_status?: string
          quality_score?: number | null
          raw_scores?: Json | null
          smith_confidence?: number | null
          status_confidence?: number | null
          title_confidence?: number | null
          validation_errors?: Json | null
          validation_score?: number | null
          warning_count?: number | null
        }
        Update: {
          certification_confidence?: number | null
          completeness_score?: number | null
          cover_image_url?: string | null
          cover_selection_reason?: string | null
          cover_selection_score?: number | null
          critical_issues?: Json | null
          dealer_id?: number | null
          error_count?: number | null
          experiment_group?: string | null
          experiment_id?: string | null
          extracted_at?: string | null
          id?: number
          info_count?: number | null
          listing_id?: number | null
          llm_model?: string | null
          low_confidence_fields?: Json | null
          nagasa_confidence?: number | null
          overall_confidence?: number | null
          price_confidence?: number | null
          prompt_variant?: string | null
          prompt_version?: string | null
          province_confidence?: number | null
          qa_status?: string
          quality_score?: number | null
          raw_scores?: Json | null
          smith_confidence?: number | null
          status_confidence?: number | null
          title_confidence?: number | null
          validation_errors?: Json | null
          validation_score?: number | null
          warning_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "extraction_metrics_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_metrics_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "inquiry_analytics"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "extraction_metrics_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "mv_market_by_dealer"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "extraction_metrics_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "setsumei_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "extraction_metrics_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "v_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "extraction_metrics_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_swords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_metrics_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_tosogu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_metrics_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_metrics_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "sold_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_metrics_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "v_top_listings_by_clicks"
            referencedColumns: ["listing_id"]
          },
        ]
      }
      facet_cache: {
        Row: {
          cache_key: string
          collection: string | null
          computed_at: string
          facets: Json
          is_stale: boolean
          item_count: number
          item_type: string | null
          stale_reason: string | null
        }
        Insert: {
          cache_key: string
          collection?: string | null
          computed_at?: string
          facets: Json
          is_stale?: boolean
          item_count: number
          item_type?: string | null
          stale_reason?: string | null
        }
        Update: {
          cache_key?: string
          collection?: string | null
          computed_at?: string
          facets?: Json
          is_stale?: boolean
          item_count?: number
          item_type?: string | null
          stale_reason?: string | null
        }
        Relationships: []
      }
      history_events: {
        Row: {
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          session_id: string | null
          undone: boolean
          undone_at: string | null
          undone_by: string | null
          user_id: string | null
        }
        Insert: {
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          session_id?: string | null
          undone?: boolean
          undone_at?: string | null
          undone_by?: string | null
          user_id?: string | null
        }
        Update: {
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          session_id?: string | null
          undone?: boolean
          undone_at?: string | null
          undone_by?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      inquiry_history: {
        Row: {
          buyer_country: string | null
          created_at: string | null
          dealer_id: number
          id: string
          intent: string
          listing_id: number | null
          user_id: string
        }
        Insert: {
          buyer_country?: string | null
          created_at?: string | null
          dealer_id: number
          id?: string
          intent: string
          listing_id?: number | null
          user_id: string
        }
        Update: {
          buyer_country?: string | null
          created_at?: string | null
          dealer_id?: number
          id?: string
          intent?: string
          listing_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_inquiry_dealer"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_inquiry_dealer"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "inquiry_analytics"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "fk_inquiry_dealer"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "mv_market_by_dealer"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "fk_inquiry_dealer"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "setsumei_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "fk_inquiry_dealer"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "v_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "fk_inquiry_listing"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_swords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_inquiry_listing"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_tosogu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_inquiry_listing"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_inquiry_listing"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "sold_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_inquiry_listing"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "v_top_listings_by_clicks"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "fk_inquiry_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      linked_records: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          image_ids: string[] | null
          object_uuid: string
          parsed: Json | null
          source: Database["public"]["Enums"]["record_source"]
          source_citation: string | null
          type: Database["public"]["Enums"]["linked_record_type"]
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_ids?: string[] | null
          object_uuid: string
          parsed?: Json | null
          source?: Database["public"]["Enums"]["record_source"]
          source_citation?: string | null
          type: Database["public"]["Enums"]["linked_record_type"]
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_ids?: string[] | null
          object_uuid?: string
          parsed?: Json | null
          source?: Database["public"]["Enums"]["record_source"]
          source_citation?: string | null
          type?: Database["public"]["Enums"]["linked_record_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linked_records_object_uuid_fkey"
            columns: ["object_uuid"]
            isOneToOne: false
            referencedRelation: "physical_objects"
            referencedColumns: ["uuid"]
          },
        ]
      }
      listing_history: {
        Row: {
          active_from: string
          active_until: string
          archive_reason: string
          change_event_id: number | null
          created_at: string | null
          id: number
          listing_snapshot: Json
          url: string
          version_number: number
        }
        Insert: {
          active_from: string
          active_until: string
          archive_reason: string
          change_event_id?: number | null
          created_at?: string | null
          id?: number
          listing_snapshot: Json
          url: string
          version_number: number
        }
        Update: {
          active_from?: string
          active_until?: string
          archive_reason?: string
          change_event_id?: number | null
          created_at?: string | null
          id?: number
          listing_snapshot?: Json
          url?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_history_change_event_id_fkey"
            columns: ["change_event_id"]
            isOneToOne: false
            referencedRelation: "content_change_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_history_change_event_id_fkey"
            columns: ["change_event_id"]
            isOneToOne: false
            referencedRelation: "recent_change_events"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_impressions: {
        Row: {
          created_at: string | null
          dealer_id: number
          filters: Json | null
          id: number
          listing_id: number
          page: number | null
          position: number | null
          search_query: string | null
          session_id: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string | null
          dealer_id: number
          filters?: Json | null
          id?: number
          listing_id: number
          page?: number | null
          position?: number | null
          search_query?: string | null
          session_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string | null
          dealer_id?: number
          filters?: Json | null
          id?: number
          listing_id?: number
          page?: number | null
          position?: number | null
          search_query?: string | null
          session_id?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_impressions_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_impressions_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "inquiry_analytics"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "listing_impressions_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "mv_market_by_dealer"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "listing_impressions_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "setsumei_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "listing_impressions_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "v_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "listing_impressions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_swords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_impressions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_tosogu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_impressions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_impressions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "sold_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_impressions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "v_top_listings_by_clicks"
            referencedColumns: ["listing_id"]
          },
        ]
      }
      listings: {
        Row: {
          blade_type: string | null
          cert_organization: string | null
          cert_session: number | null
          cert_type: string | null
          dealer_id: number | null
          description: string | null
          description_en: string | null
          era: string | null
          first_seen_at: string | null
          has_koshirae: boolean | null
          historical_period: string | null
          id: number
          images: Json | null
          images_stored_at: string | null
          images_upload_error: string | null
          images_upload_status: string | null
          is_available: boolean | null
          is_juyo_listing: boolean | null
          is_sold: boolean | null
          item_category: string | null
          item_type: string | null
          kasane_cm: number | null
          last_scraped_at: string | null
          listing_id: string | null
          llm_extracted_at: string | null
          llm_model: string | null
          match_confidence: number | null
          match_consistency_flag: string | null
          match_evidence: Json | null
          match_reasoning: string | null
          match_status: string | null
          match_timestamp: string | null
          match_verification_result: Json | null
          matched_physical_object_uuid: string | null
          mei_type: string | null
          mekugi_ana: number | null
          motohaba_cm: number | null
          nagasa_cm: number | null
          og_generated_at: string | null
          og_generation_error: string | null
          og_generation_status: string | null
          og_image_url: string | null
          page_exists: boolean | null
          price_currency: string | null
          price_jpy: number | null
          price_raw: string | null
          price_value: number | null
          province: string | null
          raw_fields: Json | null
          raw_page_scraped_at: string | null
          raw_page_text: string | null
          sakihaba_cm: number | null
          school: string | null
          scrape_count: number | null
          search_vector: unknown
          setsumei_error: string | null
          setsumei_image_url: string | null
          setsumei_metadata: Json | null
          setsumei_ocr_raw: string | null
          setsumei_pipeline_version: string | null
          setsumei_processed_at: string | null
          setsumei_text_en: string | null
          setsumei_text_ja: string | null
          signature_detail: string | null
          signature_status: string | null
          smith: string | null
          sori_cm: number | null
          status: string | null
          status_changed_at: string | null
          stored_images: Json | null
          sword_period: string | null
          title: string | null
          title_en: string | null
          tosogu_era: string | null
          tosogu_height_cm: number | null
          tosogu_maker: string | null
          tosogu_material: string | null
          tosogu_school: string | null
          tosogu_width_cm: number | null
          url: string
          weight_g: number | null
        }
        Insert: {
          blade_type?: string | null
          cert_organization?: string | null
          cert_session?: number | null
          cert_type?: string | null
          dealer_id?: number | null
          description?: string | null
          description_en?: string | null
          era?: string | null
          first_seen_at?: string | null
          has_koshirae?: boolean | null
          historical_period?: string | null
          id?: number
          images?: Json | null
          images_stored_at?: string | null
          images_upload_error?: string | null
          images_upload_status?: string | null
          is_available?: boolean | null
          is_juyo_listing?: boolean | null
          is_sold?: boolean | null
          item_category?: string | null
          item_type?: string | null
          kasane_cm?: number | null
          last_scraped_at?: string | null
          listing_id?: string | null
          llm_extracted_at?: string | null
          llm_model?: string | null
          match_confidence?: number | null
          match_consistency_flag?: string | null
          match_evidence?: Json | null
          match_reasoning?: string | null
          match_status?: string | null
          match_timestamp?: string | null
          match_verification_result?: Json | null
          matched_physical_object_uuid?: string | null
          mei_type?: string | null
          mekugi_ana?: number | null
          motohaba_cm?: number | null
          nagasa_cm?: number | null
          og_generated_at?: string | null
          og_generation_error?: string | null
          og_generation_status?: string | null
          og_image_url?: string | null
          page_exists?: boolean | null
          price_currency?: string | null
          price_jpy?: number | null
          price_raw?: string | null
          price_value?: number | null
          province?: string | null
          raw_fields?: Json | null
          raw_page_scraped_at?: string | null
          raw_page_text?: string | null
          sakihaba_cm?: number | null
          school?: string | null
          scrape_count?: number | null
          search_vector?: unknown
          setsumei_error?: string | null
          setsumei_image_url?: string | null
          setsumei_metadata?: Json | null
          setsumei_ocr_raw?: string | null
          setsumei_pipeline_version?: string | null
          setsumei_processed_at?: string | null
          setsumei_text_en?: string | null
          setsumei_text_ja?: string | null
          signature_detail?: string | null
          signature_status?: string | null
          smith?: string | null
          sori_cm?: number | null
          status?: string | null
          status_changed_at?: string | null
          stored_images?: Json | null
          sword_period?: string | null
          title?: string | null
          title_en?: string | null
          tosogu_era?: string | null
          tosogu_height_cm?: number | null
          tosogu_maker?: string | null
          tosogu_material?: string | null
          tosogu_school?: string | null
          tosogu_width_cm?: number | null
          url: string
          weight_g?: number | null
        }
        Update: {
          blade_type?: string | null
          cert_organization?: string | null
          cert_session?: number | null
          cert_type?: string | null
          dealer_id?: number | null
          description?: string | null
          description_en?: string | null
          era?: string | null
          first_seen_at?: string | null
          has_koshirae?: boolean | null
          historical_period?: string | null
          id?: number
          images?: Json | null
          images_stored_at?: string | null
          images_upload_error?: string | null
          images_upload_status?: string | null
          is_available?: boolean | null
          is_juyo_listing?: boolean | null
          is_sold?: boolean | null
          item_category?: string | null
          item_type?: string | null
          kasane_cm?: number | null
          last_scraped_at?: string | null
          listing_id?: string | null
          llm_extracted_at?: string | null
          llm_model?: string | null
          match_confidence?: number | null
          match_consistency_flag?: string | null
          match_evidence?: Json | null
          match_reasoning?: string | null
          match_status?: string | null
          match_timestamp?: string | null
          match_verification_result?: Json | null
          matched_physical_object_uuid?: string | null
          mei_type?: string | null
          mekugi_ana?: number | null
          motohaba_cm?: number | null
          nagasa_cm?: number | null
          og_generated_at?: string | null
          og_generation_error?: string | null
          og_generation_status?: string | null
          og_image_url?: string | null
          page_exists?: boolean | null
          price_currency?: string | null
          price_jpy?: number | null
          price_raw?: string | null
          price_value?: number | null
          province?: string | null
          raw_fields?: Json | null
          raw_page_scraped_at?: string | null
          raw_page_text?: string | null
          sakihaba_cm?: number | null
          school?: string | null
          scrape_count?: number | null
          search_vector?: unknown
          setsumei_error?: string | null
          setsumei_image_url?: string | null
          setsumei_metadata?: Json | null
          setsumei_ocr_raw?: string | null
          setsumei_pipeline_version?: string | null
          setsumei_processed_at?: string | null
          setsumei_text_en?: string | null
          setsumei_text_ja?: string | null
          signature_detail?: string | null
          signature_status?: string | null
          smith?: string | null
          sori_cm?: number | null
          status?: string | null
          status_changed_at?: string | null
          stored_images?: Json | null
          sword_period?: string | null
          title?: string | null
          title_en?: string | null
          tosogu_era?: string | null
          tosogu_height_cm?: number | null
          tosogu_maker?: string | null
          tosogu_material?: string | null
          tosogu_school?: string | null
          tosogu_width_cm?: number | null
          url?: string
          weight_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "inquiry_analytics"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "listings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "mv_market_by_dealer"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "listings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "setsumei_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "listings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "v_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
        ]
      }
      market_daily_snapshots: {
        Row: {
          available_listings: number
          avg_price_jpy: number | null
          category_breakdown: Json
          certification_breakdown: Json
          created_at: string | null
          dealer_breakdown: Json
          id: string
          median_price_jpy: number | null
          new_listings_24h: number
          price_changes_24h: number
          price_max_jpy: number | null
          price_min_jpy: number | null
          price_p10_jpy: number | null
          price_p25_jpy: number | null
          price_p75_jpy: number | null
          price_p90_jpy: number | null
          snapshot_date: string
          sold_24h: number
          sold_listings: number
          total_listings: number
          total_market_value_jpy: number
        }
        Insert: {
          available_listings: number
          avg_price_jpy?: number | null
          category_breakdown?: Json
          certification_breakdown?: Json
          created_at?: string | null
          dealer_breakdown?: Json
          id?: string
          median_price_jpy?: number | null
          new_listings_24h?: number
          price_changes_24h?: number
          price_max_jpy?: number | null
          price_min_jpy?: number | null
          price_p10_jpy?: number | null
          price_p25_jpy?: number | null
          price_p75_jpy?: number | null
          price_p90_jpy?: number | null
          snapshot_date: string
          sold_24h?: number
          sold_listings: number
          total_listings: number
          total_market_value_jpy: number
        }
        Update: {
          available_listings?: number
          avg_price_jpy?: number | null
          category_breakdown?: Json
          certification_breakdown?: Json
          created_at?: string | null
          dealer_breakdown?: Json
          id?: string
          median_price_jpy?: number | null
          new_listings_24h?: number
          price_changes_24h?: number
          price_max_jpy?: number | null
          price_min_jpy?: number | null
          price_p10_jpy?: number | null
          price_p25_jpy?: number | null
          price_p75_jpy?: number | null
          price_p90_jpy?: number | null
          snapshot_date?: string
          sold_24h?: number
          sold_listings?: number
          total_listings?: number
          total_market_value_jpy?: number
        }
        Relationships: []
      }
      nihonto_items: {
        Row: {
          created_at: string | null
          id: string
          item_number: number
          oshigata_url: string | null
          pdf_page_oshigata: number | null
          pdf_page_setsumei: number | null
          setsumei_english: string | null
          setsumei_japanese: string | null
          setsumei_url: string | null
          sword_metadata: Json | null
          translated_at: string | null
          volume: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_number: number
          oshigata_url?: string | null
          pdf_page_oshigata?: number | null
          pdf_page_setsumei?: number | null
          setsumei_english?: string | null
          setsumei_japanese?: string | null
          setsumei_url?: string | null
          sword_metadata?: Json | null
          translated_at?: string | null
          volume: number
        }
        Update: {
          created_at?: string | null
          id?: string
          item_number?: number
          oshigata_url?: string | null
          pdf_page_oshigata?: number | null
          pdf_page_setsumei?: number | null
          setsumei_english?: string | null
          setsumei_japanese?: string | null
          setsumei_url?: string | null
          sword_metadata?: Json | null
          translated_at?: string | null
          volume?: number
        }
        Relationships: []
      }
      object_relationships: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          object_uuid_a: string
          object_uuid_b: string
          relation_type: Database["public"]["Enums"]["relation_type"]
          status: Database["public"]["Enums"]["relation_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          object_uuid_a: string
          object_uuid_b: string
          relation_type: Database["public"]["Enums"]["relation_type"]
          status?: Database["public"]["Enums"]["relation_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          object_uuid_a?: string
          object_uuid_b?: string
          relation_type?: Database["public"]["Enums"]["relation_type"]
          status?: Database["public"]["Enums"]["relation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "object_relationships_object_uuid_a_fkey"
            columns: ["object_uuid_a"]
            isOneToOne: false
            referencedRelation: "physical_objects"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "object_relationships_object_uuid_b_fkey"
            columns: ["object_uuid_b"]
            isOneToOne: false
            referencedRelation: "physical_objects"
            referencedColumns: ["uuid"]
          },
        ]
      }
      physical_objects: {
        Row: {
          created_at: string
          created_by: string | null
          highest_designation: string | null
          merge_reason: string | null
          merged_at: string | null
          merged_into: string | null
          object_type: Database["public"]["Enums"]["object_type"]
          primary_name: string | null
          slug: string | null
          smith_name: string | null
          status: Database["public"]["Enums"]["object_status"]
          updated_at: string
          uuid: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          highest_designation?: string | null
          merge_reason?: string | null
          merged_at?: string | null
          merged_into?: string | null
          object_type?: Database["public"]["Enums"]["object_type"]
          primary_name?: string | null
          slug?: string | null
          smith_name?: string | null
          status?: Database["public"]["Enums"]["object_status"]
          updated_at?: string
          uuid?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          highest_designation?: string | null
          merge_reason?: string | null
          merged_at?: string | null
          merged_into?: string | null
          object_type?: Database["public"]["Enums"]["object_type"]
          primary_name?: string | null
          slug?: string | null
          smith_name?: string | null
          status?: Database["public"]["Enums"]["object_status"]
          updated_at?: string
          uuid?: string
        }
        Relationships: [
          {
            foreignKeyName: "physical_objects_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "physical_objects"
            referencedColumns: ["uuid"]
          },
        ]
      }
      price_history: {
        Row: {
          change_type: string | null
          detected_at: string | null
          id: number
          listing_id: number | null
          new_currency: string | null
          new_price: number | null
          old_currency: string | null
          old_price: number | null
        }
        Insert: {
          change_type?: string | null
          detected_at?: string | null
          id?: number
          listing_id?: number | null
          new_currency?: string | null
          new_price?: number | null
          old_currency?: string | null
          old_price?: number | null
        }
        Update: {
          change_type?: string | null
          detected_at?: string | null
          id?: number
          listing_id?: number | null
          new_currency?: string | null
          new_price?: number | null
          old_currency?: string | null
          old_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_swords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_tosogu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "sold_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "v_top_listings_by_clicks"
            referencedColumns: ["listing_id"]
          },
        ]
      }
      price_history_backup_20260121: {
        Row: {
          change_type: string | null
          detected_at: string | null
          id: number | null
          listing_id: number | null
          new_currency: string | null
          new_price: number | null
          old_currency: string | null
          old_price: number | null
        }
        Insert: {
          change_type?: string | null
          detected_at?: string | null
          id?: number | null
          listing_id?: number | null
          new_currency?: string | null
          new_price?: number | null
          old_currency?: string | null
          old_price?: number | null
        }
        Update: {
          change_type?: string | null
          detected_at?: string | null
          id?: number | null
          listing_id?: number | null
          new_currency?: string | null
          new_price?: number | null
          old_currency?: string | null
          old_price?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_admin: boolean | null
          preferences: Json | null
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          is_admin?: boolean | null
          preferences?: Json | null
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_admin?: boolean | null
          preferences?: Json | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_search_notifications: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          matched_listing_ids: number[]
          saved_search_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          matched_listing_ids?: number[]
          saved_search_id: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          matched_listing_ids?: number[]
          saved_search_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_search_notifications_saved_search_id_fkey"
            columns: ["saved_search_id"]
            isOneToOne: false
            referencedRelation: "saved_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_match_count: number | null
          last_notified_at: string | null
          name: string | null
          notification_frequency: string
          search_criteria: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_match_count?: number | null
          last_notified_at?: string | null
          name?: string | null
          notification_frequency?: string
          search_criteria?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_match_count?: number | null
          last_notified_at?: string | null
          name?: string | null
          notification_frequency?: string
          search_criteria?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scrape_runs: {
        Row: {
          completed_at: string | null
          dealer_id: number | null
          error_message: string | null
          errors: number | null
          id: number
          new_listings: number | null
          run_type: string
          started_at: string | null
          status: string | null
          updated_listings: number | null
          urls_processed: number | null
        }
        Insert: {
          completed_at?: string | null
          dealer_id?: number | null
          error_message?: string | null
          errors?: number | null
          id?: number
          new_listings?: number | null
          run_type: string
          started_at?: string | null
          status?: string | null
          updated_listings?: number | null
          urls_processed?: number | null
        }
        Update: {
          completed_at?: string | null
          dealer_id?: number | null
          error_message?: string | null
          errors?: number | null
          id?: number
          new_listings?: number | null
          run_type?: string
          started_at?: string | null
          status?: string | null
          updated_listings?: number | null
          urls_processed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scrape_runs_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scrape_runs_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "inquiry_analytics"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "scrape_runs_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "mv_market_by_dealer"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "scrape_runs_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "setsumei_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "scrape_runs_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "v_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
        ]
      }
      setsumei_extractions: {
        Row: {
          blade_type: string | null
          corrected_ocr_text: string | null
          date_inscription: string | null
          dealer_id: number | null
          designation_classification: string | null
          designation_date: string | null
          designation_session: number | null
          era: string | null
          extracted_at: string | null
          extraction_confidence: number | null
          extraction_errors: Json | null
          extractor_version: string | null
          fields_extracted: string[] | null
          id: number
          item_type: string | null
          kasane_cm: number | null
          listing_id: number | null
          listing_url: string | null
          measurement_format: string | null
          motohaba_cm: number | null
          nagasa_cm: number | null
          nakago_cm: number | null
          period: string | null
          processing_time_ms: number | null
          province: string | null
          raw_ocr_text: string | null
          sakihaba_cm: number | null
          school: string | null
          setsumei_image_url: string
          smith_generation: string | null
          smith_name: string | null
          sori_cm: number | null
          tosogu_measurements: Json | null
          updated_at: string | null
        }
        Insert: {
          blade_type?: string | null
          corrected_ocr_text?: string | null
          date_inscription?: string | null
          dealer_id?: number | null
          designation_classification?: string | null
          designation_date?: string | null
          designation_session?: number | null
          era?: string | null
          extracted_at?: string | null
          extraction_confidence?: number | null
          extraction_errors?: Json | null
          extractor_version?: string | null
          fields_extracted?: string[] | null
          id?: number
          item_type?: string | null
          kasane_cm?: number | null
          listing_id?: number | null
          listing_url?: string | null
          measurement_format?: string | null
          motohaba_cm?: number | null
          nagasa_cm?: number | null
          nakago_cm?: number | null
          period?: string | null
          processing_time_ms?: number | null
          province?: string | null
          raw_ocr_text?: string | null
          sakihaba_cm?: number | null
          school?: string | null
          setsumei_image_url: string
          smith_generation?: string | null
          smith_name?: string | null
          sori_cm?: number | null
          tosogu_measurements?: Json | null
          updated_at?: string | null
        }
        Update: {
          blade_type?: string | null
          corrected_ocr_text?: string | null
          date_inscription?: string | null
          dealer_id?: number | null
          designation_classification?: string | null
          designation_date?: string | null
          designation_session?: number | null
          era?: string | null
          extracted_at?: string | null
          extraction_confidence?: number | null
          extraction_errors?: Json | null
          extractor_version?: string | null
          fields_extracted?: string[] | null
          id?: number
          item_type?: string | null
          kasane_cm?: number | null
          listing_id?: number | null
          listing_url?: string | null
          measurement_format?: string | null
          motohaba_cm?: number | null
          nagasa_cm?: number | null
          nakago_cm?: number | null
          period?: string | null
          processing_time_ms?: number | null
          province?: string | null
          raw_ocr_text?: string | null
          sakihaba_cm?: number | null
          school?: string | null
          setsumei_image_url?: string
          smith_generation?: string | null
          smith_name?: string | null
          sori_cm?: number | null
          tosogu_measurements?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "setsumei_extractions_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setsumei_extractions_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "inquiry_analytics"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "setsumei_extractions_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "mv_market_by_dealer"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "setsumei_extractions_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "setsumei_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "setsumei_extractions_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "v_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "setsumei_extractions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_swords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setsumei_extractions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_tosogu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setsumei_extractions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setsumei_extractions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "sold_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setsumei_extractions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "v_top_listings_by_clicks"
            referencedColumns: ["listing_id"]
          },
        ]
      }
      setsumei_matches: {
        Row: {
          alternative_count: number | null
          era_score: number | null
          extraction_id: number | null
          id: number
          is_ambiguous: boolean | null
          is_best_match: boolean | null
          listing_id: number | null
          match_score: number
          matched_at: string | null
          matched_fields: string[] | null
          motohaba_delta: number | null
          motohaba_score: number | null
          nagasa_delta: number | null
          nagasa_score: number | null
          province_score: number | null
          smith_score: number | null
          sori_delta: number | null
          sori_score: number | null
          updated_at: string | null
          verification_notes: string | null
          verification_status: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          alternative_count?: number | null
          era_score?: number | null
          extraction_id?: number | null
          id?: number
          is_ambiguous?: boolean | null
          is_best_match?: boolean | null
          listing_id?: number | null
          match_score: number
          matched_at?: string | null
          matched_fields?: string[] | null
          motohaba_delta?: number | null
          motohaba_score?: number | null
          nagasa_delta?: number | null
          nagasa_score?: number | null
          province_score?: number | null
          smith_score?: number | null
          sori_delta?: number | null
          sori_score?: number | null
          updated_at?: string | null
          verification_notes?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          alternative_count?: number | null
          era_score?: number | null
          extraction_id?: number | null
          id?: number
          is_ambiguous?: boolean | null
          is_best_match?: boolean | null
          listing_id?: number | null
          match_score?: number
          matched_at?: string | null
          matched_fields?: string[] | null
          motohaba_delta?: number | null
          motohaba_score?: number | null
          nagasa_delta?: number | null
          nagasa_score?: number | null
          province_score?: number | null
          smith_score?: number | null
          sori_delta?: number | null
          sori_score?: number | null
          updated_at?: string | null
          verification_notes?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "setsumei_matches_extraction_id_fkey"
            columns: ["extraction_id"]
            isOneToOne: false
            referencedRelation: "setsumei_extractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setsumei_matches_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_swords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setsumei_matches_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_tosogu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setsumei_matches_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setsumei_matches_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "sold_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setsumei_matches_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "v_top_listings_by_clicks"
            referencedColumns: ["listing_id"]
          },
        ]
      }
      stored_images: {
        Row: {
          catalog_record_uuid: string | null
          created_at: string
          created_by: string | null
          height: number | null
          id: string
          image_type: Database["public"]["Enums"]["image_type"]
          is_current: boolean
          mime_type: string
          object_uuid: string
          original_filename: string | null
          replaces_image_id: string | null
          size_bytes: number
          storage_bucket: string
          storage_path: string
          updated_at: string
          width: number | null
        }
        Insert: {
          catalog_record_uuid?: string | null
          created_at?: string
          created_by?: string | null
          height?: number | null
          id?: string
          image_type: Database["public"]["Enums"]["image_type"]
          is_current?: boolean
          mime_type: string
          object_uuid: string
          original_filename?: string | null
          replaces_image_id?: string | null
          size_bytes: number
          storage_bucket?: string
          storage_path: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          catalog_record_uuid?: string | null
          created_at?: string
          created_by?: string | null
          height?: number | null
          id?: string
          image_type?: Database["public"]["Enums"]["image_type"]
          is_current?: boolean
          mime_type?: string
          object_uuid?: string
          original_filename?: string | null
          replaces_image_id?: string | null
          size_bytes?: number
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stored_images_catalog_record_uuid_fkey"
            columns: ["catalog_record_uuid"]
            isOneToOne: false
            referencedRelation: "catalog_records"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "stored_images_object_uuid_fkey"
            columns: ["object_uuid"]
            isOneToOne: false
            referencedRelation: "physical_objects"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "stored_images_replaces_image_id_fkey"
            columns: ["replaces_image_id"]
            isOneToOne: false
            referencedRelation: "stored_images"
            referencedColumns: ["id"]
          },
        ]
      }
      url_content_signatures: {
        Row: {
          catalog_category: string | null
          catalog_price_text: string | null
          catalog_price_value: number | null
          catalog_thumbnail_hash: string | null
          catalog_title: string | null
          catalog_title_hash: string | null
          catalog_updated_at: string | null
          created_at: string | null
          dealer_id: number | null
          id: number
          identity_hash: string | null
          item_cert_session: number | null
          item_cert_type: string | null
          item_nagasa_cm: number | null
          item_price_value: number | null
          item_school: string | null
          item_smith: string | null
          item_title: string | null
          item_type: string | null
          page_content_hash: string | null
          page_scraped_at: string | null
          url: string
        }
        Insert: {
          catalog_category?: string | null
          catalog_price_text?: string | null
          catalog_price_value?: number | null
          catalog_thumbnail_hash?: string | null
          catalog_title?: string | null
          catalog_title_hash?: string | null
          catalog_updated_at?: string | null
          created_at?: string | null
          dealer_id?: number | null
          id?: number
          identity_hash?: string | null
          item_cert_session?: number | null
          item_cert_type?: string | null
          item_nagasa_cm?: number | null
          item_price_value?: number | null
          item_school?: string | null
          item_smith?: string | null
          item_title?: string | null
          item_type?: string | null
          page_content_hash?: string | null
          page_scraped_at?: string | null
          url: string
        }
        Update: {
          catalog_category?: string | null
          catalog_price_text?: string | null
          catalog_price_value?: number | null
          catalog_thumbnail_hash?: string | null
          catalog_title?: string | null
          catalog_title_hash?: string | null
          catalog_updated_at?: string | null
          created_at?: string | null
          dealer_id?: number | null
          id?: number
          identity_hash?: string | null
          item_cert_session?: number | null
          item_cert_type?: string | null
          item_nagasa_cm?: number | null
          item_price_value?: number | null
          item_school?: string | null
          item_smith?: string | null
          item_title?: string | null
          item_type?: string | null
          page_content_hash?: string | null
          page_scraped_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "url_content_signatures_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "url_content_signatures_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "inquiry_analytics"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "url_content_signatures_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "mv_market_by_dealer"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "url_content_signatures_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "setsumei_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "url_content_signatures_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "v_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
        ]
      }
      user_activity: {
        Row: {
          action_type: string
          created_at: string
          duration_ms: number | null
          duration_seconds: number | null
          id: string
          listing_id: number | null
          metadata: Json | null
          page_path: string | null
          search_query: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          duration_ms?: number | null
          duration_seconds?: number | null
          id?: string
          listing_id?: number | null
          metadata?: Json | null
          page_path?: string | null
          search_query?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          duration_ms?: number | null
          duration_seconds?: number | null
          id?: string
          listing_id?: number | null
          metadata?: Json | null
          page_path?: string | null
          search_query?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_swords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_activity_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_tosogu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_activity_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_activity_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "sold_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_activity_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "v_top_listings_by_clicks"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "user_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          is_active: boolean
          last_triggered_at: string | null
          listing_id: number | null
          search_criteria: Json | null
          target_price: number | null
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          listing_id?: number | null
          search_criteria?: Json | null
          target_price?: number | null
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          listing_id?: number | null
          search_criteria?: Json | null
          target_price?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_alerts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_swords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_alerts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_tosogu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_alerts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_alerts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "sold_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_alerts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "v_top_listings_by_clicks"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "user_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_collection_items: {
        Row: {
          added_at: string
          collection_id: string
          id: string
          saved_item_id: string
        }
        Insert: {
          added_at?: string
          collection_id: string
          id?: string
          saved_item_id: string
        }
        Update: {
          added_at?: string
          collection_id?: string
          id?: string
          saved_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "user_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_collection_items_saved_item_id_fkey"
            columns: ["saved_item_id"]
            isOneToOne: false
            referencedRelation: "user_saved_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_favorites: {
        Row: {
          created_at: string
          id: string
          listing_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_swords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_tosogu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "sold_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "v_top_listings_by_clicks"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "user_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_issues: {
        Row: {
          context: Json | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          item_collection: Database["public"]["Enums"]["collection_name"] | null
          item_number: number | null
          item_volume: number | null
          object_uuid: string | null
          priority: Database["public"]["Enums"]["issue_priority"]
          resolution: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["issue_status"]
          type: Database["public"]["Enums"]["issue_type"]
          updated_at: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          item_collection?:
            | Database["public"]["Enums"]["collection_name"]
            | null
          item_number?: number | null
          item_volume?: number | null
          object_uuid?: string | null
          priority?: Database["public"]["Enums"]["issue_priority"]
          resolution?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          type?: Database["public"]["Enums"]["issue_type"]
          updated_at?: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          item_collection?:
            | Database["public"]["Enums"]["collection_name"]
            | null
          item_number?: number | null
          item_volume?: number | null
          object_uuid?: string | null
          priority?: Database["public"]["Enums"]["issue_priority"]
          resolution?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          type?: Database["public"]["Enums"]["issue_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_issues_object_uuid_fkey"
            columns: ["object_uuid"]
            isOneToOne: false
            referencedRelation: "physical_objects"
            referencedColumns: ["uuid"]
          },
        ]
      }
      user_profiles: {
        Row: {
          bio: string | null
          contributions_count: number
          display_name: string | null
          id: string
          is_admin: boolean
          member_since: string
          membership_tier: Database["public"]["Enums"]["membership_tier"]
          specialty: string[] | null
        }
        Insert: {
          bio?: string | null
          contributions_count?: number
          display_name?: string | null
          id: string
          is_admin?: boolean
          member_since?: string
          membership_tier?: Database["public"]["Enums"]["membership_tier"]
          specialty?: string[] | null
        }
        Update: {
          bio?: string | null
          contributions_count?: number
          display_name?: string | null
          id?: string
          is_admin?: boolean
          member_since?: string
          membership_tier?: Database["public"]["Enums"]["membership_tier"]
          specialty?: string[] | null
        }
        Relationships: []
      }
      user_saved_items: {
        Row: {
          added_at: string
          blade_type: string | null
          collection: string
          id: string
          item_number: number
          notes: string | null
          smith_name: string | null
          updated_at: string
          user_id: string
          volume: number
        }
        Insert: {
          added_at?: string
          blade_type?: string | null
          collection: string
          id?: string
          item_number: number
          notes?: string | null
          smith_name?: string | null
          updated_at?: string
          user_id: string
          volume: number
        }
        Update: {
          added_at?: string
          blade_type?: string | null
          collection?: string
          id?: string
          item_number?: number
          notes?: string | null
          smith_name?: string | null
          updated_at?: string
          user_id?: string
          volume?: number
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          device_info: Json | null
          ended_at: string | null
          id: string
          language: string | null
          last_activity_at: string
          page_views: number
          screen_height: number | null
          screen_width: number | null
          session_id: string
          started_at: string
          timezone: string | null
          total_duration_ms: number | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          ended_at?: string | null
          id?: string
          language?: string | null
          last_activity_at?: string
          page_views?: number
          screen_height?: number | null
          screen_width?: number | null
          session_id: string
          started_at?: string
          timezone?: string | null
          total_duration_ms?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          ended_at?: string | null
          id?: string
          language?: string | null
          last_activity_at?: string
          page_views?: number
          screen_height?: number | null
          screen_width?: number | null
          session_id?: string
          started_at?: string
          timezone?: string | null
          total_duration_ms?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_volume_permissions: {
        Row: {
          collection: Database["public"]["Enums"]["collection_name"]
          granted: boolean
          granted_at: string
          granted_by: string | null
          id: string
          user_id: string
          volume: number
        }
        Insert: {
          collection: Database["public"]["Enums"]["collection_name"]
          granted?: boolean
          granted_at?: string
          granted_by?: string | null
          id?: string
          user_id: string
          volume: number
        }
        Update: {
          collection?: Database["public"]["Enums"]["collection_name"]
          granted?: boolean
          granted_at?: string
          granted_by?: string | null
          id?: string
          user_id?: string
          volume?: number
        }
        Relationships: []
      }
      yuhinkai_enrichments: {
        Row: {
          enriched_at: string | null
          enriched_cert_session: number | null
          enriched_cert_type: string | null
          enriched_form_type: string | null
          enriched_maker: string | null
          enriched_maker_kanji: string | null
          enriched_period: string | null
          enriched_school: string | null
          id: number
          item_category: string
          listing_id: number
          match_confidence: string
          match_score: number
          match_signals: Json | null
          matched_fields: string[] | null
          setsumei_en: string | null
          setsumei_en_format: string | null
          setsumei_ja: string | null
          updated_at: string | null
          verification_notes: string | null
          verification_status: string | null
          verified_at: string | null
          verified_by: string | null
          yuhinkai_collection: string | null
          yuhinkai_item_number: number | null
          yuhinkai_uuid: string
          yuhinkai_volume: number | null
        }
        Insert: {
          enriched_at?: string | null
          enriched_cert_session?: number | null
          enriched_cert_type?: string | null
          enriched_form_type?: string | null
          enriched_maker?: string | null
          enriched_maker_kanji?: string | null
          enriched_period?: string | null
          enriched_school?: string | null
          id?: number
          item_category?: string
          listing_id: number
          match_confidence: string
          match_score: number
          match_signals?: Json | null
          matched_fields?: string[] | null
          setsumei_en?: string | null
          setsumei_en_format?: string | null
          setsumei_ja?: string | null
          updated_at?: string | null
          verification_notes?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
          yuhinkai_collection?: string | null
          yuhinkai_item_number?: number | null
          yuhinkai_uuid: string
          yuhinkai_volume?: number | null
        }
        Update: {
          enriched_at?: string | null
          enriched_cert_session?: number | null
          enriched_cert_type?: string | null
          enriched_form_type?: string | null
          enriched_maker?: string | null
          enriched_maker_kanji?: string | null
          enriched_period?: string | null
          enriched_school?: string | null
          id?: number
          item_category?: string
          listing_id?: number
          match_confidence?: string
          match_score?: number
          match_signals?: Json | null
          matched_fields?: string[] | null
          setsumei_en?: string | null
          setsumei_en_format?: string | null
          setsumei_ja?: string | null
          updated_at?: string | null
          verification_notes?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
          yuhinkai_collection?: string | null
          yuhinkai_item_number?: number | null
          yuhinkai_uuid?: string
          yuhinkai_volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "yuhinkai_enrichments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_swords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yuhinkai_enrichments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_tosogu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yuhinkai_enrichments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yuhinkai_enrichments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "sold_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yuhinkai_enrichments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "v_top_listings_by_clicks"
            referencedColumns: ["listing_id"]
          },
        ]
      }
    }
    Views: {
      available_swords: {
        Row: {
          blade_type: string | null
          cert_organization: string | null
          cert_session: number | null
          cert_type: string | null
          dealer_domain: string | null
          dealer_id: number | null
          dealer_name: string | null
          description: string | null
          description_en: string | null
          era: string | null
          first_seen_at: string | null
          has_koshirae: boolean | null
          id: number | null
          images: Json | null
          is_available: boolean | null
          is_sold: boolean | null
          item_category: string | null
          item_type: string | null
          kasane_cm: number | null
          last_scraped_at: string | null
          listing_id: string | null
          mei_type: string | null
          mekugi_ana: number | null
          motohaba_cm: number | null
          nagasa_cm: number | null
          page_exists: boolean | null
          price_currency: string | null
          price_raw: string | null
          price_value: number | null
          province: string | null
          raw_fields: Json | null
          sakihaba_cm: number | null
          school: string | null
          scrape_count: number | null
          smith: string | null
          sori_cm: number | null
          status: string | null
          status_changed_at: string | null
          title: string | null
          title_en: string | null
          tosogu_era: string | null
          tosogu_height_cm: number | null
          tosogu_maker: string | null
          tosogu_material: string | null
          tosogu_school: string | null
          tosogu_width_cm: number | null
          url: string | null
          weight_g: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "inquiry_analytics"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "listings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "mv_market_by_dealer"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "listings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "setsumei_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "listings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "v_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
        ]
      }
      available_tosogu: {
        Row: {
          blade_type: string | null
          cert_organization: string | null
          cert_session: number | null
          cert_type: string | null
          dealer_domain: string | null
          dealer_id: number | null
          dealer_name: string | null
          description: string | null
          description_en: string | null
          era: string | null
          first_seen_at: string | null
          has_koshirae: boolean | null
          id: number | null
          images: Json | null
          is_available: boolean | null
          is_sold: boolean | null
          item_category: string | null
          item_type: string | null
          kasane_cm: number | null
          last_scraped_at: string | null
          listing_id: string | null
          mei_type: string | null
          mekugi_ana: number | null
          motohaba_cm: number | null
          nagasa_cm: number | null
          page_exists: boolean | null
          price_currency: string | null
          price_raw: string | null
          price_value: number | null
          province: string | null
          raw_fields: Json | null
          sakihaba_cm: number | null
          school: string | null
          scrape_count: number | null
          smith: string | null
          sori_cm: number | null
          status: string | null
          status_changed_at: string | null
          title: string | null
          title_en: string | null
          tosogu_era: string | null
          tosogu_height_cm: number | null
          tosogu_maker: string | null
          tosogu_material: string | null
          tosogu_school: string | null
          tosogu_width_cm: number | null
          url: string | null
          weight_g: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "inquiry_analytics"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "listings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "mv_market_by_dealer"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "listings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "setsumei_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "listings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "v_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
        ]
      }
      change_detection_stats: {
        Row: {
          dealer_name: string | null
          items_replaced: number | null
          last_change_detected: string | null
          metadata_corrections: number | null
          pending: number | null
          price_changes: number | null
          rescraped: number | null
          total_changes: number | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string | null
          id: string | null
          listing_id: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          listing_id?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          listing_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_swords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_tosogu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "sold_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "v_top_listings_by_clicks"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "user_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_analytics: {
        Row: {
          dealer_id: number | null
          dealer_name: string | null
          first_inquiry: string | null
          last_inquiry: string | null
          photo_requests: number | null
          purchase_intents: number | null
          question_intents: number | null
          shipping_inquiries: number | null
          total_inquiries: number | null
          unique_users: number | null
        }
        Relationships: []
      }
      listing_yuhinkai_enrichment: {
        Row: {
          enriched_at: string | null
          enriched_cert_session: number | null
          enriched_cert_type: string | null
          enriched_form_type: string | null
          enriched_maker: string | null
          enriched_maker_kanji: string | null
          enriched_period: string | null
          enriched_school: string | null
          enrichment_id: number | null
          item_category: string | null
          listing_id: number | null
          match_confidence: string | null
          match_score: number | null
          match_signals: Json | null
          matched_fields: string[] | null
          setsumei_en: string | null
          setsumei_en_format: string | null
          setsumei_ja: string | null
          updated_at: string | null
          verification_status: string | null
          yuhinkai_collection: string | null
          yuhinkai_item_number: number | null
          yuhinkai_uuid: string | null
          yuhinkai_volume: number | null
        }
        Relationships: [
          {
            foreignKeyName: "yuhinkai_enrichments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_swords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yuhinkai_enrichments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_tosogu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yuhinkai_enrichments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yuhinkai_enrichments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "sold_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yuhinkai_enrichments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "v_top_listings_by_clicks"
            referencedColumns: ["listing_id"]
          },
        ]
      }
      mv_market_by_certification: {
        Row: {
          available_count: number | null
          avg_price_jpy: number | null
          cert_type: string | null
          median_price_jpy: number | null
          sold_count: number | null
          total_count: number | null
          total_value_jpy: number | null
        }
        Relationships: []
      }
      mv_market_by_dealer: {
        Row: {
          available_count: number | null
          avg_price_jpy: number | null
          dealer_domain: string | null
          dealer_id: number | null
          dealer_name: string | null
          median_price_jpy: number | null
          sold_count: number | null
          total_count: number | null
          total_value_jpy: number | null
        }
        Relationships: []
      }
      mv_market_by_item_type: {
        Row: {
          available_count: number | null
          avg_price_jpy: number | null
          item_type: string | null
          max_price_jpy: number | null
          median_price_jpy: number | null
          min_price_jpy: number | null
          sold_count: number | null
          total_count: number | null
          total_value_jpy: number | null
        }
        Relationships: []
      }
      recent_change_events: {
        Row: {
          change_severity: string | null
          change_type: string | null
          current_price: number | null
          current_title: string | null
          dealer_id: number | null
          dealer_name: string | null
          detected_at: string | null
          detection_confidence: number | null
          detection_method: string | null
          id: number | null
          new_listing_id: number | null
          new_values: Json | null
          old_listing_id: number | null
          old_values: Json | null
          processed_at: string | null
          status: string | null
          url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_change_events_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_change_events_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "inquiry_analytics"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "content_change_events_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "mv_market_by_dealer"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "content_change_events_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "setsumei_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "content_change_events_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "v_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "content_change_events_old_listing_id_fkey"
            columns: ["old_listing_id"]
            isOneToOne: false
            referencedRelation: "available_swords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_change_events_old_listing_id_fkey"
            columns: ["old_listing_id"]
            isOneToOne: false
            referencedRelation: "available_tosogu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_change_events_old_listing_id_fkey"
            columns: ["old_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_change_events_old_listing_id_fkey"
            columns: ["old_listing_id"]
            isOneToOne: false
            referencedRelation: "sold_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_change_events_old_listing_id_fkey"
            columns: ["old_listing_id"]
            isOneToOne: false
            referencedRelation: "v_top_listings_by_clicks"
            referencedColumns: ["listing_id"]
          },
        ]
      }
      recent_price_changes: {
        Row: {
          change_type: string | null
          dealer_name: string | null
          detected_at: string | null
          id: number | null
          listing_id: number | null
          new_currency: string | null
          new_price: number | null
          old_currency: string | null
          old_price: number | null
          title: string | null
          url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_swords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_tosogu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "sold_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "v_top_listings_by_clicks"
            referencedColumns: ["listing_id"]
          },
        ]
      }
      setsumei_best_matches: {
        Row: {
          alternative_count: number | null
          dealer_name: string | null
          designation_session: number | null
          extraction_confidence: number | null
          extraction_id: number | null
          is_ambiguous: boolean | null
          listing_id: number | null
          listing_nagasa: number | null
          listing_smith: string | null
          listing_title: string | null
          match_id: number | null
          match_score: number | null
          matched_fields: string[] | null
          setsumei_nagasa: number | null
          setsumei_smith: string | null
          verification_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "setsumei_matches_extraction_id_fkey"
            columns: ["extraction_id"]
            isOneToOne: false
            referencedRelation: "setsumei_extractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setsumei_matches_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_swords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setsumei_matches_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_tosogu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setsumei_matches_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setsumei_matches_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "sold_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setsumei_matches_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "v_top_listings_by_clicks"
            referencedColumns: ["listing_id"]
          },
        ]
      }
      setsumei_dealer_summary: {
        Row: {
          ambiguous_matches: number | null
          avg_extraction_confidence: number | null
          avg_match_score: number | null
          best_matches: number | null
          confirmed_matches: number | null
          dealer_id: number | null
          dealer_name: string | null
          rejected_matches: number | null
          total_extractions: number | null
          total_matches: number | null
        }
        Relationships: []
      }
      setsumei_review_queue: {
        Row: {
          alternative_count: number | null
          dealer_name: string | null
          designation_classification: string | null
          designation_session: number | null
          extraction_id: number | null
          is_ambiguous: boolean | null
          listing_id: number | null
          listing_title: string | null
          listing_url: string | null
          match_id: number | null
          match_score: number | null
          nagasa_cm: number | null
          review_reason: string | null
          setsumei_image_url: string | null
          smith_name: string | null
          verification_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "setsumei_matches_extraction_id_fkey"
            columns: ["extraction_id"]
            isOneToOne: false
            referencedRelation: "setsumei_extractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setsumei_matches_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_swords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setsumei_matches_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "available_tosogu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setsumei_matches_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setsumei_matches_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "sold_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setsumei_matches_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "v_top_listings_by_clicks"
            referencedColumns: ["listing_id"]
          },
        ]
      }
      sold_items: {
        Row: {
          blade_type: string | null
          cert_organization: string | null
          cert_session: number | null
          cert_type: string | null
          dealer_id: number | null
          dealer_name: string | null
          description: string | null
          era: string | null
          first_seen_at: string | null
          has_koshirae: boolean | null
          id: number | null
          images: Json | null
          is_available: boolean | null
          is_sold: boolean | null
          item_type: string | null
          kasane_cm: number | null
          last_scraped_at: string | null
          listing_id: string | null
          mei_type: string | null
          mekugi_ana: number | null
          motohaba_cm: number | null
          nagasa_cm: number | null
          page_exists: boolean | null
          price_currency: string | null
          price_raw: string | null
          price_value: number | null
          province: string | null
          raw_fields: Json | null
          sakihaba_cm: number | null
          sale_status: string | null
          school: string | null
          scrape_count: number | null
          smith: string | null
          sori_cm: number | null
          status: string | null
          status_changed_at: string | null
          title: string | null
          tosogu_era: string | null
          tosogu_height_cm: number | null
          tosogu_maker: string | null
          tosogu_material: string | null
          tosogu_school: string | null
          tosogu_width_cm: number | null
          url: string | null
          weight_g: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "inquiry_analytics"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "listings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "mv_market_by_dealer"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "listings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "setsumei_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "listings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "v_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
        ]
      }
      urls_needing_rescrape: {
        Row: {
          catalog_title: string | null
          dealer_id: number | null
          dealer_name: string | null
          id: number | null
          item_cert_session: number | null
          item_smith: string | null
          item_title: string | null
          rescrape_detected_at: string | null
          rescrape_priority: number | null
          rescrape_reason: string | null
          url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovered_urls_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovered_urls_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "inquiry_analytics"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "discovered_urls_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "mv_market_by_dealer"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "discovered_urls_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "setsumei_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "discovered_urls_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "v_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
        ]
      }
      urls_to_scrape: {
        Row: {
          dealer_id: number | null
          dealer_name: string | null
          discovered_at: string | null
          id: number | null
          is_scraped: boolean | null
          last_scraped_at: string | null
          scrape_priority: number | null
          url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovered_urls_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovered_urls_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "inquiry_analytics"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "discovered_urls_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "mv_market_by_dealer"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "discovered_urls_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "setsumei_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "discovered_urls_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "v_dealer_summary"
            referencedColumns: ["dealer_id"]
          },
        ]
      }
      v_dealer_summary: {
        Row: {
          ctr_30d: number | null
          current_inventory_value: number | null
          current_listings: number | null
          dealer_id: number | null
          dealer_name: string | null
          domain: string | null
          total_clicks_30d: number | null
          total_favorites_30d: number | null
          total_impressions_30d: number | null
          total_views_30d: number | null
        }
        Relationships: []
      }
      v_top_listings_by_clicks: {
        Row: {
          cert_type: string | null
          click_count: number | null
          dealer_name: string | null
          is_available: boolean | null
          item_type: string | null
          listing_id: number | null
          price_currency: string | null
          price_value: number | null
          title: string | null
          url: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      build_listing_search_vector:
        | {
            Args: {
              p_era: string
              p_province: string
              p_raw_page_text: string
              p_school: string
              p_smith: string
              p_title: string
              p_tosogu_maker: string
              p_tosogu_school: string
            }
            Returns: unknown
          }
        | {
            Args: {
              p_description?: string
              p_description_en?: string
              p_era: string
              p_province: string
              p_raw_page_text: string
              p_school: string
              p_smith: string
              p_title: string
              p_tosogu_maker: string
              p_tosogu_school: string
            }
            Returns: unknown
          }
      build_search_text: { Args: { meta: Json }; Returns: string }
      capture_market_snapshot: { Args: never; Returns: string }
      cleanup_old_activity_data: {
        Args: { p_days_to_keep?: number }
        Returns: {
          events_deleted: number
          sessions_deleted: number
        }[]
      }
      compute_all_facets: {
        Args: { p_collection?: string; p_item_type?: string }
        Returns: Json
      }
      compute_and_cache_facets: {
        Args: { p_collection?: string; p_item_type?: string }
        Returns: Json
      }
      compute_item_year_range: {
        Args: { meta: Json }
        Returns: {
          year_max: number
          year_min: number
        }[]
      }
      count_items_by_artisan: {
        Args: {
          p_collection?: string
          p_item_type?: string
          p_search_term: string
        }
        Returns: number
      }
      count_items_by_denrai: {
        Args: {
          p_collection?: string
          p_exact_match?: boolean
          p_item_type?: string
          p_search_term: string
        }
        Returns: number
      }
      count_items_by_kiwame: {
        Args: {
          p_collection?: string
          p_exact_match?: boolean
          p_item_type?: string
          p_search_term: string
        }
        Returns: number
      }
      count_search_results: {
        Args: {
          p_collection?: string
          p_has_denrai?: boolean
          p_has_kiwame?: boolean
          p_has_meibutsu?: boolean
          p_item_type?: string
          p_mei_status?: string
          p_nagasa_max?: number
          p_nagasa_min?: number
          p_nakago_condition?: string
          p_search_query?: string
          p_sori_max?: number
          p_sori_min?: number
          p_volume_eq?: number
          p_volume_max?: number
          p_volume_min?: number
          p_year_eq?: number
          p_year_max?: number
          p_year_min?: number
        }
        Returns: number
      }
      extract_denrai_text: { Args: { meta: Json }; Returns: string }
      extract_important_text: { Args: { meta: Json }; Returns: string }
      extract_kiwame_text: { Args: { meta: Json }; Returns: string }
      extract_school_text: { Args: { meta: Json }; Returns: string }
      extract_smith_maker_text: { Args: { meta: Json }; Returns: string }
      find_object_by_catalog: {
        Args: {
          p_collection: Database["public"]["Enums"]["collection_name"]
          p_item: number
          p_volume: number
        }
        Returns: string
      }
      get_all_facets: {
        Args: { p_collection?: string; p_item_type?: string; p_limit?: number }
        Returns: Json
      }
      get_blade_type_counts: {
        Args: { p_collection?: string }
        Returns: {
          blade_type: string
          collection: string
          count: number
        }[]
      }
      get_blade_type_counts_filtered: {
        Args: {
          p_blade_type?: string
          p_collection?: string
          p_era?: string
          p_item_type?: string
          p_mei_status?: string
          p_mei_statuses?: string[]
          p_nakago_condition?: string
          p_school?: string
          p_tradition?: string
        }
        Returns: {
          blade_type: string
          collection: string
          count: number
        }[]
      }
      get_blade_type_facet: {
        Args: { p_collection?: string; p_item_type?: string; p_limit?: number }
        Returns: {
          count: number
          value: string
        }[]
      }
      get_cached_facets: {
        Args: { p_collection?: string; p_item_type?: string }
        Returns: Json
      }
      get_category_comparison: {
        Args: { p_item_types?: string[] }
        Returns: {
          available_count: number
          avg_price_jpy: number
          item_type: string
          max_price_jpy: number
          median_price_jpy: number
          min_price_jpy: number
          sold_count: number
          total_count: number
          total_value_jpy: number
        }[]
      }
      get_collection_counts: {
        Args: never
        Returns: {
          collection: Database["public"]["Enums"]["collection_name"]
          count: number
        }[]
      }
      get_confidence_facet: {
        Args: { p_collection?: string; p_item_type?: string; p_limit?: number }
        Returns: {
          count: number
          value: string
        }[]
      }
      get_dealer_rankings: {
        Args: { p_limit?: number; p_order_by?: string }
        Returns: {
          available_count: number
          avg_price_jpy: number
          dealer_country: string
          dealer_domain: string
          dealer_id: number
          dealer_name: string
          median_price_jpy: number
          rank: number
          sold_count: number
          total_count: number
          total_value_jpy: number
        }[]
      }
      get_denrai_facet: {
        Args: { p_collection?: string; p_item_type?: string; p_limit?: number }
        Returns: {
          count: number
          value: string
        }[]
      }
      get_distinct_categories: {
        Args: never
        Returns: {
          item_category: string
        }[]
      }
      get_distinct_cert_types: {
        Args: never
        Returns: {
          cert_type: string
        }[]
      }
      get_distinct_item_types: {
        Args: never
        Returns: {
          item_type: string
        }[]
      }
      get_era_facet: {
        Args: { p_collection?: string; p_item_type?: string; p_limit?: number }
        Returns: {
          count: number
          value: string
        }[]
      }
      get_event_type_counts: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          event_count: number
          event_type: string
        }[]
      }
      get_filter_options: { Args: never; Returns: Json }
      get_filtered_facets: { Args: { p_uuids: string[] }; Returns: Json }
      get_item_type_facet: {
        Args: { p_collection?: string; p_limit?: number }
        Returns: {
          count: number
          value: string
        }[]
      }
      get_kiwame_facet: {
        Args: { p_collection?: string; p_item_type?: string; p_limit?: number }
        Returns: {
          count: number
          value: string
        }[]
      }
      get_listing_facets: {
        Args: {
          p_ask_only?: boolean
          p_certifications?: string[]
          p_dealers?: number[]
          p_item_types?: string[]
          p_query?: string
          p_tab?: string
        }
        Returns: Json
      }
      get_market_overview: {
        Args: never
        Returns: {
          available_listings: number
          avg_price_jpy: number
          max_price_jpy: number
          median_price_jpy: number
          min_price_jpy: number
          new_listings_24h: number
          p10_jpy: number
          p25_jpy: number
          p75_jpy: number
          p90_jpy: number
          price_changes_24h: number
          sold_24h: number
          sold_listings: number
          total_listings: number
          total_market_value_jpy: number
        }[]
      }
      get_market_trend: {
        Args: { p_days?: number; p_end_date?: string }
        Returns: {
          available_listings: number
          median_price_jpy: number
          new_listings_24h: number
          price_changes_24h: number
          snapshot_date: string
          sold_24h: number
          sold_listings: number
          total_listings: number
          total_market_value_jpy: number
        }[]
      }
      get_mei_status_facet: {
        Args: { p_collection?: string; p_item_type?: string; p_limit?: number }
        Returns: {
          count: number
          value: string
        }[]
      }
      get_nakago_facet: {
        Args: { p_collection?: string; p_item_type?: string; p_limit?: number }
        Returns: {
          count: number
          value: string
        }[]
      }
      get_period_year_range: {
        Args: { p_period: string; p_sub_period?: string }
        Returns: {
          year_max: number
          year_min: number
        }[]
      }
      get_price_distribution: {
        Args: {
          p_bucket_count?: number
          p_cert_type?: string
          p_dealer_id?: number
          p_item_type?: string
        }
        Returns: {
          bucket_num: number
          count: number
          range_end: number
          range_start: number
        }[]
      }
      get_school_facet: {
        Args: { p_collection?: string; p_item_type?: string; p_limit?: number }
        Returns: {
          count: number
          value: string
        }[]
      }
      get_search_facets_fast: { Args: { p_uuids: string[] }; Returns: Json }
      get_smith_facet: {
        Args: { p_collection?: string; p_item_type?: string; p_limit?: number }
        Returns: {
          count: number
          value: string
        }[]
      }
      get_submitter_facet: {
        Args: { p_collection?: string; p_item_type?: string; p_limit?: number }
        Returns: {
          count: number
          value: string
        }[]
      }
      get_top_external_clicks: {
        Args: { p_limit?: number; p_start_date?: string }
        Returns: {
          click_count: number
          dealer_name: string
          listing_id: number
        }[]
      }
      get_top_searches: {
        Args: { p_limit?: number; p_start_date?: string }
        Returns: {
          search_count: number
          search_query: string
        }[]
      }
      get_tradition_facet: {
        Args: { p_collection?: string; p_item_type?: string; p_limit?: number }
        Returns: {
          count: number
          value: string
        }[]
      }
      get_user_alert_count: { Args: { p_user_id: string }; Returns: number }
      get_user_favorite_count: { Args: { p_user_id: string }; Returns: number }
      get_user_saved_search_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_user_session_stats: {
        Args: { p_user_id: string }
        Returns: {
          avg_session_duration_minutes: number
          last_session_at: string
          total_duration_hours: number
          total_page_views: number
          total_sessions: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_user: { Args: { p_user_id: string }; Returns: boolean }
      jsonb_to_text: { Args: { data: Json }; Returns: string }
      refresh_market_views: { Args: never; Returns: undefined }
      refresh_price_jpy: {
        Args: { eur_to_jpy?: number; gbp_to_jpy?: number; usd_to_jpy?: number }
        Returns: number
      }
      resolve_object_uuid: { Args: { input_uuid: string }; Returns: string }
      search_catalog: {
        Args: {
          p_collection?: string
          p_has_denrai?: boolean
          p_has_kiwame?: boolean
          p_has_meibutsu?: boolean
          p_item_type?: string
          p_limit?: number
          p_mei_status?: string
          p_mei_statuses?: string[]
          p_nagasa_max?: number
          p_nagasa_min?: number
          p_nakago_condition?: string
          p_offset?: number
          p_search_query?: string
          p_sori_max?: number
          p_sori_min?: number
          p_volume_eq?: number
          p_volume_max?: number
          p_volume_min?: number
          p_year_eq?: number
          p_year_max?: number
          p_year_min?: number
        }
        Returns: {
          catalog_id: string
          collection: string
          item_number: number
          metadata: Json
          object_uuid: string
          physical_objects: Json
          rank: number
          uuid: string
          volume: number
        }[]
      }
      search_items_by_artisan: {
        Args: {
          p_collection?: string
          p_item_type?: string
          p_limit?: number
          p_offset?: number
          p_search_term: string
        }
        Returns: {
          catalog_id: string
          collection: string
          item_number: number
          metadata: Json
          translation_md: string
          uuid: string
          volume: number
        }[]
      }
      search_items_by_denrai: {
        Args: {
          p_collection?: string
          p_exact_match?: boolean
          p_item_type?: string
          p_limit?: number
          p_offset?: number
          p_search_term: string
        }
        Returns: {
          catalog_id: string
          collection: string
          item_number: number
          metadata: Json
          translation_md: string
          uuid: string
          volume: number
        }[]
      }
      search_items_by_kiwame: {
        Args: {
          p_collection?: string
          p_exact_match?: boolean
          p_item_type?: string
          p_limit?: number
          p_offset?: number
          p_search_term: string
        }
        Returns: {
          catalog_id: string
          collection: string
          item_number: number
          metadata: Json
          translation_md: string
          uuid: string
          volume: number
        }[]
      }
      search_listings_instant: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          dealer_id: number
          dealer_name: string
          id: number
          images: Json
          item_type: string
          price_currency: string
          price_value: number
          rank: number
          title: string
          total_count: number
        }[]
      }
      search_listings_ranked: {
        Args: {
          p_ask_only?: boolean
          p_certifications?: string[]
          p_dealers?: number[]
          p_item_types?: string[]
          p_limit?: number
          p_offset?: number
          p_query: string
          p_sort?: string
          p_tab?: string
        }
        Returns: {
          cert_type: string
          dealer_domain: string
          dealer_id: number
          dealer_name: string
          first_seen_at: string
          id: number
          images: Json
          is_available: boolean
          is_sold: boolean
          item_type: string
          last_scraped_at: string
          nagasa_cm: number
          price_currency: string
          price_value: number
          rank: number
          school: string
          smith: string
          status: string
          title: string
          tosogu_maker: string
          tosogu_school: string
          total_count: number
          url: string
        }[]
      }
      tag_juyo_listings: { Args: never; Returns: number }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      collection_name:
        | "Kokuho"
        | "Tokuju"
        | "Juyo"
        | "JuBun"
        | "IMP_Koto"
        | "IMP_Shin"
      crossref_creator_type: "user" | "system" | "import"
      crossref_status: "pending" | "verified" | "rejected" | "needs_review"
      image_type:
        | "oshigata"
        | "setsumei"
        | "sugata"
        | "art"
        | "detail"
        | "other"
      issue_priority: "low" | "normal" | "high" | "critical"
      issue_status:
        | "pending"
        | "in_progress"
        | "resolved"
        | "closed"
        | "wont_fix"
      issue_type:
        | "error"
        | "missing_data"
        | "incorrect_data"
        | "suggestion"
        | "other"
      linked_record_type:
        | "sayagaki"
        | "origami"
        | "provenance"
        | "photo"
        | "note"
      membership_tier: "aspirant" | "member" | "fellow" | "curator" | "founder"
      object_status: "active" | "merged" | "deleted"
      object_type: "blade" | "koshirae" | "tosogu" | "ensemble" | "unknown"
      record_source: "personal" | "publication" | "other"
      relation_status: "pending" | "verified" | "rejected" | "needs_review"
      relation_type:
        | "blade_koshirae_pair"
        | "companion_pair"
        | "related_provenance"
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
      collection_name: [
        "Kokuho",
        "Tokuju",
        "Juyo",
        "JuBun",
        "IMP_Koto",
        "IMP_Shin",
      ],
      crossref_creator_type: ["user", "system", "import"],
      crossref_status: ["pending", "verified", "rejected", "needs_review"],
      image_type: ["oshigata", "setsumei", "sugata", "art", "detail", "other"],
      issue_priority: ["low", "normal", "high", "critical"],
      issue_status: [
        "pending",
        "in_progress",
        "resolved",
        "closed",
        "wont_fix",
      ],
      issue_type: [
        "error",
        "missing_data",
        "incorrect_data",
        "suggestion",
        "other",
      ],
      linked_record_type: [
        "sayagaki",
        "origami",
        "provenance",
        "photo",
        "note",
      ],
      membership_tier: ["aspirant", "member", "fellow", "curator", "founder"],
      object_status: ["active", "merged", "deleted"],
      object_type: ["blade", "koshirae", "tosogu", "ensemble", "unknown"],
      record_source: ["personal", "publication", "other"],
      relation_status: ["pending", "verified", "rejected", "needs_review"],
      relation_type: [
        "blade_koshirae_pair",
        "companion_pair",
        "related_provenance",
      ],
    },
  },
} as const
