/**
 * User Account System Type Definitions
 *
 * Types for user profiles, favorites, alerts, activity tracking,
 * sessions, and alert history.
 */

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export type UserRole = 'user' | 'admin';

export type AlertType = 'price_drop' | 'new_listing' | 'back_in_stock';

export type ActionType =
  | 'page_view'
  | 'listing_view'
  | 'search'
  | 'filter_change'
  | 'favorite_add'
  | 'favorite_remove'
  | 'alert_create'
  | 'alert_delete'
  | 'session_start'
  | 'session_end'
  | 'external_link_click';

export type ThemePreference = 'light' | 'dark' | 'system';

export type CurrencyPreference = 'JPY' | 'USD' | 'EUR';

// =============================================================================
// USER PREFERENCES
// =============================================================================

export interface NotificationPreferences {
  emailAlerts: boolean;
  priceDrops: boolean;
  newListings: boolean;
  backInStock: boolean;
  weeklyDigest: boolean;
}

export interface UserPreferences {
  currency: CurrencyPreference;
  theme: ThemePreference;
  notifications: NotificationPreferences;
  defaultSort?: string;
  itemsPerPage?: number;
  /** When true, bypasses the ¥100K minimum price floor (useful for tosogu collectors) */
  showAllPrices?: boolean;
}

// =============================================================================
// PROFILES TABLE
// =============================================================================

import type { SubscriptionTier, SubscriptionStatus } from './subscription';

export interface Profile {
  id: string; // UUID
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  preferences: UserPreferences | null;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  // Subscription fields
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export interface ProfileInsert {
  id: string; // UUID - must match auth.users.id
  email?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  role?: UserRole;
  preferences?: UserPreferences | null;
}

export interface ProfileUpdate {
  email?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  role?: UserRole;
  preferences?: UserPreferences | null;
  // Subscription updates (admin only typically)
  subscription_tier?: SubscriptionTier;
  subscription_status?: SubscriptionStatus;
  subscription_started_at?: string | null;
  subscription_expires_at?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
}

// =============================================================================
// USER FAVORITES TABLE
// =============================================================================

export interface UserFavorite {
  id: string; // UUID
  user_id: string; // UUID
  listing_id: number;
  created_at: string; // ISO timestamp
}

export interface UserFavoriteInsert {
  user_id: string; // UUID
  listing_id: number;
}

export interface UserFavoriteWithListing extends UserFavorite {
  listing?: {
    id: number;
    title: string | null;
    price_value: number | null;
    price_currency: string;
    images: string[];
    item_type: string | null;
    dealer?: {
      id: number;
      name: string;
    };
  };
}

// =============================================================================
// USER ALERTS TABLE
// =============================================================================

export interface AlertSearchCriteria {
  type?: string[];
  dealer?: string[];
  certification?: string[];
  school?: string[];
  province?: string[];
  era?: string[];
  minPrice?: number;
  maxPrice?: number;
  keywords?: string;
}

export interface UserAlert {
  id: string; // UUID
  user_id: string; // UUID
  alert_type: AlertType;
  listing_id: number | null;
  target_price: number | null;
  search_criteria: AlertSearchCriteria | null;
  is_active: boolean;
  last_triggered_at: string | null; // ISO timestamp
  created_at: string; // ISO timestamp
}

export interface UserAlertInsert {
  user_id: string; // UUID
  alert_type: AlertType;
  listing_id?: number | null;
  target_price?: number | null;
  search_criteria?: AlertSearchCriteria | null;
  is_active?: boolean;
}

export interface UserAlertUpdate {
  alert_type?: AlertType;
  listing_id?: number | null;
  target_price?: number | null;
  search_criteria?: AlertSearchCriteria | null;
  is_active?: boolean;
  last_triggered_at?: string | null;
}

export interface UserAlertWithListing extends UserAlert {
  listing?: {
    id: number;
    title: string | null;
    price_value: number | null;
    price_currency: string;
    images: string[];
    item_type: string | null;
    is_available: boolean | null;
    dealer?: {
      id: number;
      name: string;
    };
  };
}

// =============================================================================
// USER ACTIVITY TABLE
// =============================================================================

export interface ActivityMetadata {
  // Search-related
  query?: string;
  resultsCount?: number;

  // Filter-related
  filters?: Record<string, unknown>;
  previousFilters?: Record<string, unknown>;

  // Navigation-related
  referrer?: string;
  destination?: string;

  // External link click
  externalUrl?: string;
  dealerName?: string;

  // Generic
  [key: string]: unknown;
}

export interface UserActivity {
  id: string; // UUID
  user_id: string; // UUID
  session_id: string;
  action_type: ActionType;
  page_path: string | null;
  listing_id: number | null;
  metadata: ActivityMetadata | null;
  duration_ms: number | null;
  created_at: string; // ISO timestamp
}

export interface UserActivityInsert {
  user_id: string; // UUID
  session_id: string;
  action_type: ActionType;
  page_path?: string | null;
  listing_id?: number | null;
  metadata?: ActivityMetadata | null;
  duration_ms?: number | null;
}

// =============================================================================
// USER SESSIONS TABLE
// =============================================================================

export interface DeviceInfo {
  userAgent?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  device?: 'desktop' | 'tablet' | 'mobile' | 'unknown';
  screen?: {
    width: number;
    height: number;
  };
}

export interface UserSession {
  id: string; // UUID
  user_id: string; // UUID
  session_id: string;
  started_at: string; // ISO timestamp
  ended_at: string | null; // ISO timestamp
  last_activity_at: string; // ISO timestamp
  total_duration_ms: number | null;
  page_views: number;
  device_info: DeviceInfo | null;
}

export interface UserSessionInsert {
  user_id: string; // UUID
  session_id: string;
  device_info?: DeviceInfo | null;
}

export interface UserSessionUpdate {
  ended_at?: string | null;
  last_activity_at?: string;
  total_duration_ms?: number | null;
  page_views?: number;
}

// =============================================================================
// ALERT HISTORY TABLE
// =============================================================================

export interface AlertHistoryMetadata {
  // Price drop alert
  old_price?: number;
  new_price?: number;
  price_change_pct?: number;
  currency?: string;

  // New listing alert
  matched_criteria?: AlertSearchCriteria;

  // Back in stock alert
  was_sold?: boolean;
  was_unavailable?: boolean;

  // Email details
  email_template?: string;
  email_subject?: string;

  // Generic
  [key: string]: unknown;
}

export interface AlertHistory {
  id: string; // UUID
  alert_id: string; // UUID
  listing_id: number | null;
  triggered_at: string; // ISO timestamp
  email_sent: boolean;
  email_sent_at: string | null; // ISO timestamp
  metadata: AlertHistoryMetadata | null;
}

export interface AlertHistoryInsert {
  alert_id: string; // UUID
  listing_id?: number | null;
  email_sent?: boolean;
  email_sent_at?: string | null;
  metadata?: AlertHistoryMetadata | null;
}

export interface AlertHistoryWithDetails extends AlertHistory {
  alert?: UserAlert;
  listing?: {
    id: number;
    title: string | null;
    price_value: number | null;
    price_currency: string;
    images: string[];
  };
}

// =============================================================================
// DATABASE TYPES EXTENSION
// =============================================================================

/**
 * Extends the Database type from database.ts to include user tables
 */
export interface UserTables {
  profiles: {
    Row: Profile;
    Insert: ProfileInsert;
    Update: ProfileUpdate;
  };
  user_favorites: {
    Row: UserFavorite;
    Insert: UserFavoriteInsert;
    Update: never; // Favorites are only inserted or deleted
  };
  user_alerts: {
    Row: UserAlert;
    Insert: UserAlertInsert;
    Update: UserAlertUpdate;
  };
  user_activity: {
    Row: UserActivity;
    Insert: UserActivityInsert;
    Update: never; // Activity records are immutable
  };
  user_sessions: {
    Row: UserSession;
    Insert: UserSessionInsert;
    Update: UserSessionUpdate;
  };
  alert_history: {
    Row: AlertHistory;
    Insert: AlertHistoryInsert;
    Update: never; // History records are immutable
  };
}

// =============================================================================
// API TYPES
// =============================================================================

/**
 * Response type for user profile with stats
 */
export interface UserProfileResponse {
  profile: Profile;
  stats: {
    favoriteCount: number;
    activeAlertCount: number;
    totalAlertCount: number;
  };
}

/**
 * Request type for creating a price alert
 */
export interface CreatePriceAlertRequest {
  listing_id: number;
  target_price?: number;
}

/**
 * Request type for creating a new listing alert
 */
export interface CreateNewListingAlertRequest {
  search_criteria: AlertSearchCriteria;
}

/**
 * Request type for creating a back in stock alert
 */
export interface CreateBackInStockAlertRequest {
  listing_id: number;
}

/**
 * Response type for paginated favorites
 */
export interface FavoritesResponse {
  favorites: UserFavoriteWithListing[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Response type for paginated alerts
 */
export interface AlertsResponse {
  alerts: UserAlertWithListing[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Response type for user activity analytics
 */
export interface UserAnalytics {
  totalPageViews: number;
  totalListingViews: number;
  totalSearches: number;
  favoriteCount: number;
  alertCount: number;
  sessionsCount: number;
  avgSessionDuration: number;
  mostViewedListings: Array<{
    listing_id: number;
    view_count: number;
    title: string | null;
  }>;
  recentActivity: UserActivity[];
}
