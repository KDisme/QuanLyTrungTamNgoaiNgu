-- Migration: Add makeup schedule fields to teaching_schedules table
-- Adds columns to support makeup (bù) scheduling functionality
-- Date: 2026-04-28

BEGIN;

-- Add original_schedule_id column (foreign key to the schedule being made up)
ALTER TABLE teaching_schedules 
ADD COLUMN original_schedule_id INTEGER REFERENCES teaching_schedules(id) ON DELETE SET NULL;

-- Add notes column for additional information about makeup schedule
ALTER TABLE teaching_schedules 
ADD COLUMN notes TEXT;

-- Create index on original_schedule_id for faster queries
CREATE INDEX idx_teaching_schedules_original_schedule_id ON teaching_schedules(original_schedule_id);

-- Create index on status to filter MAKEUP schedules efficiently
CREATE INDEX idx_teaching_schedules_status ON teaching_schedules(status);

-- Add comment to clarify the columns
COMMENT ON COLUMN teaching_schedules.original_schedule_id IS 'ID of the original schedule being made up (lịch học gốc được bù)';
COMMENT ON COLUMN teaching_schedules.notes IS 'Additional notes for makeup schedule';

COMMIT;
