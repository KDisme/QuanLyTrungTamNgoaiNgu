-- New grading runs use Gemini; old OpenAI history remains unchanged.
ALTER TABLE exam_grading_runs
  ALTER COLUMN provider SET DEFAULT 'gemini';
