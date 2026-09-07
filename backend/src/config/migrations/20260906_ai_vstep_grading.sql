-- AI-assisted VSTEP Writing/Speaking grading.
-- Safe to run more than once on PostgreSQL 13+.

ALTER TABLE student_exam_attempts
  ADD COLUMN IF NOT EXISTS grading_status VARCHAR(30) NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE mock_exam_students
  ADD COLUMN IF NOT EXISTS grading_status VARCHAR(30) NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS exam_grading_runs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mock_exam_student_id INTEGER NOT NULL REFERENCES mock_exam_students(id) ON DELETE CASCADE,
  attempt_id INTEGER NOT NULL REFERENCES student_exam_attempts(id) ON DELETE CASCADE,
  supersedes_run_id BIGINT REFERENCES exam_grading_runs(id) ON DELETE SET NULL,
  trigger_type VARCHAR(20) NOT NULL DEFAULT 'automatic',
  status VARCHAR(30) NOT NULL DEFAULT 'queued',
  provider VARCHAR(40) NOT NULL DEFAULT 'gemini',
  grading_model VARCHAR(100),
  transcription_model VARCHAR(100),
  prompt_version VARCHAR(40) NOT NULL,
  rubric_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  published_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT exam_grading_runs_status_check CHECK (
    status IN ('queued','processing','ai_graded','reviewed','published','failed')
  ),
  CONSTRAINT exam_grading_runs_trigger_check CHECK (
    trigger_type IN ('automatic','retry','manual')
  )
);

CREATE TABLE IF NOT EXISTS exam_answer_gradings (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  grading_run_id BIGINT NOT NULL REFERENCES exam_grading_runs(id) ON DELETE CASCADE,
  answer_id INTEGER NOT NULL REFERENCES student_exam_answers(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
  skill VARCHAR(20) NOT NULL,
  part VARCHAR(100),
  source VARCHAR(20) NOT NULL DEFAULT 'ai',
  score NUMERIC(5,2) NOT NULL DEFAULT 0,
  criteria_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
  feedback TEXT,
  transcript TEXT,
  analysis_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT exam_answer_gradings_score_check CHECK (score >= 0 AND score <= 10),
  CONSTRAINT exam_answer_gradings_source_check CHECK (source IN ('ai','teacher','admin')),
  UNIQUE (grading_run_id, answer_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_grading_runs_attempt
  ON exam_grading_runs(tenant_id, attempt_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_grading_runs_student
  ON exam_grading_runs(tenant_id, mock_exam_student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_grading_runs_status
  ON exam_grading_runs(tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_exam_answer_gradings_run
  ON exam_answer_gradings(tenant_id, grading_run_id);

-- VSTEP Writing/Speaking tasks are independently reviewed on a 0-10 scale.
UPDATE exam_questions
SET score=10, updated_at=NOW()
WHERE format_code='VSTEP_4_SKILLS' AND skill IN ('Writing','Speaking') AND score<>10;

UPDATE exam_set_questions esq
SET score=10
FROM exam_questions q
WHERE q.id=esq.question_id AND q.format_code='VSTEP_4_SKILLS'
  AND q.skill IN ('Writing','Speaking') AND esq.score<>10;

-- Existing submitted four-skill attempts need AI/manual grading; already graded
-- records are considered reviewed but remain unpublished until explicitly released.
UPDATE student_exam_attempts sea
SET grading_status = CASE
  WHEN sea.status = 'submitted' THEN 'pending_ai'
  WHEN sea.status = 'graded' THEN 'reviewed'
  ELSE sea.grading_status
END
WHERE EXISTS (
  SELECT 1
  FROM student_exam_answers a
  JOIN exam_questions q ON q.id = a.question_id
  WHERE a.attempt_id = sea.id AND q.skill IN ('Writing','Speaking')
);

UPDATE mock_exam_students ms
SET grading_status = CASE
  WHEN ms.status = 'submitted' THEN 'pending_ai'
  WHEN ms.status = 'graded' THEN 'reviewed'
  ELSE ms.grading_status
END
WHERE EXISTS (
  SELECT 1 FROM student_exam_attempts sea
  WHERE sea.mock_exam_student_id = ms.id
    AND sea.grading_status IN ('pending_ai','reviewed')
);
