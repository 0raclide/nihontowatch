export type FeedbackType = 'data_report' | 'bug' | 'feature_request' | 'other';
export type FeedbackTargetType = 'listing' | 'artist';
export type FeedbackStatus = 'open' | 'acknowledged' | 'resolved' | 'dismissed';

export interface UserFeedback {
  id: number;
  user_id: string;
  feedback_type: FeedbackType;
  target_type: FeedbackTargetType | null;
  target_id: string | null;
  target_label: string | null;
  message: string;
  page_url: string | null;
  status: FeedbackStatus;
  admin_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface SubmitFeedbackRequest {
  feedback_type: FeedbackType;
  target_type?: FeedbackTargetType;
  target_id?: string;
  target_label?: string;
  message: string;
  page_url?: string;
}
