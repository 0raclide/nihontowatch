/**
 * Activity Tracking Types
 *
 * Type definitions for all activity tracking events
 */

// =============================================================================
// Event Types
// =============================================================================

export type ActivityEventType =
  | 'page_view'
  | 'listing_view'
  | 'listing_impression'
  | 'search'
  | 'filter_change'
  | 'favorite_add'
  | 'favorite_remove'
  | 'alert_create'
  | 'alert_delete'
  | 'external_link_click'
  | 'dealer_click'
  | 'viewport_dwell'
  | 'quickview_panel_toggle'
  | 'quickview_open'
  | 'image_pinch_zoom';

// =============================================================================
// Event Payloads
// =============================================================================

export interface BaseActivityEvent {
  type: ActivityEventType;
  timestamp: string; // ISO string
  sessionId: string;
  userId?: string; // Optional - for authenticated users
  visitorId?: string; // Persistent anonymous user ID
}

export interface PageViewEvent extends BaseActivityEvent {
  type: 'page_view';
  path: string;
  referrer?: string;
  searchParams?: Record<string, string>;
}

export interface ListingViewEvent extends BaseActivityEvent {
  type: 'listing_view';
  listingId: number;
  durationMs: number;
  scrollDepth?: number; // 0-100 percentage
  imageViews?: number; // Number of images viewed
}

export interface SearchEvent extends BaseActivityEvent {
  type: 'search';
  query: string;
  resultCount?: number;
  filters?: SearchFilters;
}

export interface FilterChangeEvent extends BaseActivityEvent {
  type: 'filter_change';
  filters: SearchFilters;
  changedFilter: string;
  previousValue?: unknown;
  newValue?: unknown;
}

export interface FavoriteEvent extends BaseActivityEvent {
  type: 'favorite_add' | 'favorite_remove';
  listingId: number;
}

export interface AlertEvent extends BaseActivityEvent {
  type: 'alert_create' | 'alert_delete';
  alertId?: string;
  alertType?: string;
  criteria?: Record<string, unknown>;
}

export interface ExternalLinkClickEvent extends BaseActivityEvent {
  type: 'external_link_click';
  url: string;
  listingId?: number;
  dealerName?: string;
}

/**
 * Enhanced dealer click event with more context for analytics
 */
export interface DealerClickEvent extends BaseActivityEvent {
  type: 'dealer_click';
  url: string;
  listingId: number;
  dealerId: number;
  dealerName: string;
  /** Source of the click */
  source: 'listing_card' | 'quickview' | 'listing_detail' | 'dealer_page';
  /** Price at time of click (for conversion tracking) */
  priceAtClick?: number;
  currencyAtClick?: string;
  /** Search context that led to this click */
  searchQuery?: string;
  /** Position in search results (1-indexed) */
  resultPosition?: number;
}

/**
 * Listing impression - when a listing appears in search results
 */
export interface ListingImpressionEvent extends BaseActivityEvent {
  type: 'listing_impression';
  listingId: number;
  dealerId: number;
  /** Position in search results (1-indexed) */
  position: number;
  /** Current search query */
  searchQuery?: string;
  /** Active filters */
  filters?: SearchFilters;
  /** Page number */
  page?: number;
}

/**
 * Batch impression event for efficiency
 */
export interface BatchImpressionPayload {
  sessionId: string;
  visitorId?: string;
  impressions: Array<{
    listingId: number;
    dealerId: number;
    position: number;
  }>;
  searchQuery?: string;
  filters?: SearchFilters;
  page?: number;
  timestamp: string;
}

export interface ViewportDwellEvent extends BaseActivityEvent {
  type: 'viewport_dwell';
  listingId: number;
  dwellMs: number;
  /** Percentage of element visible when tracked (0-1) */
  intersectionRatio?: number;
  /** Whether this was a re-view (user scrolled back) */
  isRevisit?: boolean;
}

export interface QuickViewPanelToggleEvent extends BaseActivityEvent {
  type: 'quickview_panel_toggle';
  listingId: number;
  /** The action performed: 'collapse' (user wants more image space) or 'expand' */
  action: 'collapse' | 'expand';
  /** Duration the panel was in previous state before toggle (ms) */
  dwellMs?: number;
}

/**
 * QuickView open event - when user opens the QuickView modal from a listing card
 */
export interface QuickViewOpenEvent extends BaseActivityEvent {
  type: 'quickview_open';
  listingId: number;
  dealerName?: string;
  /** Source of the QuickView open */
  source: 'listing_card' | 'search_results' | 'favorites';
}

export interface ImagePinchZoomEvent extends BaseActivityEvent {
  type: 'image_pinch_zoom';
  listingId: number;
  /** Which image in the gallery (0-indexed) */
  imageIndex: number;
  /** Final zoom scale achieved */
  zoomScale?: number;
  /** Duration of the zoom gesture (ms) */
  durationMs?: number;
}

// Union type for all events
export type ActivityEvent =
  | PageViewEvent
  | ListingViewEvent
  | ListingImpressionEvent
  | SearchEvent
  | FilterChangeEvent
  | FavoriteEvent
  | AlertEvent
  | ExternalLinkClickEvent
  | DealerClickEvent
  | ViewportDwellEvent
  | QuickViewPanelToggleEvent
  | QuickViewOpenEvent
  | ImagePinchZoomEvent;

// =============================================================================
// Search Filters
// =============================================================================

export interface SearchFilters {
  query?: string;
  category?: string;
  itemTypes?: string[];
  certifications?: string[];
  schools?: string[];
  dealers?: number[];
  askOnly?: boolean;
  sort?: string;
}

// =============================================================================
// API Payloads
// =============================================================================

export interface ActivityBatchPayload {
  sessionId: string;
  userId?: string;
  visitorId?: string;
  events: ActivityEvent[];
}

export interface ActivityBatchResponse {
  success: boolean;
  eventsReceived: number;
  error?: string;
}

// =============================================================================
// Session Types (for API)
// =============================================================================

export interface CreateSessionPayload {
  action: 'create';
  sessionId: string;
  userId?: string;
  userAgent?: string;
  screenWidth?: number;
  screenHeight?: number;
  timezone?: string;
  language?: string;
}

export interface EndSessionPayload {
  action: 'end';
  sessionId: string;
  startedAt: string;
  endedAt: string;
  totalDurationMs: number;
  pageViews: number;
}

export type SessionPayload = CreateSessionPayload | EndSessionPayload;

// =============================================================================
// Database Tables (for reference)
// =============================================================================

/**
 * user_sessions table structure
 */
export interface UserSession {
  id: string; // session_id
  user_id?: string; // null for anonymous users
  started_at: string;
  ended_at?: string;
  total_duration_ms?: number;
  page_views: number;
  user_agent?: string;
  screen_width?: number;
  screen_height?: number;
  timezone?: string;
  language?: string;
  created_at: string;
}

/**
 * activity_events table structure
 */
export interface ActivityEventRecord {
  id: number;
  session_id: string;
  user_id?: string;
  event_type: ActivityEventType;
  event_data: Record<string, unknown>;
  created_at: string;
}
