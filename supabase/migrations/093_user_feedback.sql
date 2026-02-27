-- User Feedback & Reporting System
-- Stores data reports (listing/artist issues) and general feedback (bugs, feature requests)

CREATE TABLE public.user_feedback (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What kind of feedback
  feedback_type TEXT NOT NULL,          -- 'data_report' | 'bug' | 'feature_request' | 'other'

  -- Target (NULL for general feedback)
  target_type   TEXT,                   -- 'listing' | 'artist' | NULL
  target_id     TEXT,                   -- listing.id or artisan code | NULL
  target_label  TEXT,                   -- snapshot: listing title or artisan name (for admin readability)

  -- Content
  message       TEXT NOT NULL,          -- free-form user text
  page_url      TEXT,                   -- URL where feedback was submitted (auto-captured)

  -- Admin triage
  status        TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'acknowledged' | 'resolved' | 'dismissed'
  admin_notes   TEXT,
  resolved_by   UUID REFERENCES auth.users(id),
  resolved_at   TIMESTAMPTZ,

  -- Timestamps
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_user_feedback_status ON public.user_feedback (status, created_at DESC);
CREATE INDEX idx_user_feedback_user ON public.user_feedback (user_id);
CREATE INDEX idx_user_feedback_target ON public.user_feedback (target_type, target_id) WHERE target_id IS NOT NULL;

-- RLS
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "users_insert_own" ON public.user_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read their own feedback
CREATE POLICY "users_read_own" ON public.user_feedback
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can do everything (admin API uses service client)
