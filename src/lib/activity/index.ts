/**
 * Activity Tracking Module
 *
 * Exports all activity tracking utilities for use across the application.
 */

// Session management
export {
  getSession,
  getSessionId,
  initSession,
  saveSession,
  updateActivity,
  getSessionDuration,
  buildSessionEndPayload,
  endSession,
  clearSession,
  handleVisibilityChange,
  isHidden,
  setupUnloadHandler,
  setupVisibilityHandler,
  type SessionData,
  type SessionEndPayload,
} from './sessionManager';

// Types
export type {
  ActivityEventType,
  BaseActivityEvent,
  PageViewEvent,
  ListingViewEvent,
  SearchEvent,
  FilterChangeEvent,
  FavoriteEvent,
  AlertEvent,
  ExternalLinkClickEvent,
  ActivityEvent,
  SearchFilters,
  ActivityBatchPayload,
  ActivityBatchResponse,
  CreateSessionPayload,
  EndSessionPayload,
  SessionPayload,
  UserSession,
  ActivityEventRecord,
} from './types';
