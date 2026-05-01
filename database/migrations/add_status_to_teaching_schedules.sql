-- Migration: Add status column to teaching_schedules table
-- Adds status field to track teaching schedule states: SCHEDULED, CANCELLED, MAKEUP
-- Date: 2026-04-28

BEGIN;

-- Add status column with default value 'SCHEDULED'
ALTER TABLE teaching_schedules 
ADD COLUMN status VARCHAR(50) DEFAULT 'SCHEDULED';

-- Add constraint to ensure status is one of the allowed values
ALTER TABLE teaching_schedules 
ADD CONSTRAINT teaching_schedules_status_check 
CHECK (status IN ('SCHEDULED', 'CANCELLED', 'MAKEUP'));

-- Add index on status for faster queries filtering by status
CREATE INDEX idx_teaching_schedules_status ON teaching_schedules(status);

COMMIT;
