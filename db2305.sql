-- =========================================================
-- CREATE DATABASE SCHEMA - QuanLyTrungTamNgoaiNgu
-- PostgreSQL
-- Luu y: File nay chi tao bang/schema, khong co lenh xoa bang.
-- Chay tren database rong de tranh loi "relation already exists".
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================
-- FUNCTIONS
-- =========================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_collection_code(p_tenant_id integer)
RETURNS character varying
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
  v_code VARCHAR;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count FROM fee_collections WHERE tenant_id = p_tenant_id;
  v_code := 'HP-' || EXTRACT(YEAR FROM NOW())::TEXT
    || LPAD(EXTRACT(MONTH FROM NOW())::TEXT, 2, '0')
    || LPAD(v_count::TEXT, 4, '0');
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_bill_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count FROM fee_transactions WHERE tenant_id = NEW.tenant_id;
  NEW.bill_number := '#BL-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(v_count::TEXT, 6, '0');
  IF NEW.paid_date IS NULL THEN
    NEW.paid_date := CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$;

-- =========================
-- CORE / TENANT / USER
-- =========================
CREATE TABLE IF NOT EXISTS public.tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    logo_url TEXT,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    gender VARCHAR(10),
    date_of_birth DATE,
    address TEXT,
    avatar_url TEXT,
    password_hash VARCHAR(255),
    google_id VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT users_gender_check CHECK (gender IN ('male','female','other')),
    CONSTRAINT users_tenant_id_email_key UNIQUE (tenant_id, email),
    CONSTRAINT users_tenant_id_phone_key UNIQUE (tenant_id, phone)
);

CREATE TABLE IF NOT EXISTS public.roles (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT roles_role_type_check CHECK (role_type IN ('admin','teacher','student','staff')),
    CONSTRAINT roles_tenant_id_user_id_role_type_key UNIQUE (tenant_id, user_id, role_type)
);

-- =========================
-- BRANCH / ROOM
-- =========================
CREATE TABLE IF NOT EXISTS public.branches (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(20),
    address TEXT,
    phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT branches_status_check CHECK (status IN ('active','inactive','maintenance'))
);

CREATE TABLE IF NOT EXISTS public.rooms (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20),
    capacity INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT rooms_status_check CHECK (status IN ('active','maintenance','inactive'))
);

-- =========================
-- USER PROFILES
-- =========================
CREATE TABLE IF NOT EXISTS public.teacher_profiles (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    teacher_code VARCHAR(20) NOT NULL,
    specialization TEXT,
    qualifications TEXT,
    start_date DATE,
    bank_account VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT teacher_profiles_tenant_id_teacher_code_key UNIQUE (tenant_id, teacher_code)
);

CREATE TABLE IF NOT EXISTS public.student_profiles (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    student_code VARCHAR(20) NOT NULL,
    enrollment_date DATE,
    study_status VARCHAR(20) DEFAULT 'active' NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT student_profiles_study_status_check CHECK (study_status IN ('active','completed','suspended','dropped')),
    CONSTRAINT student_profiles_tenant_id_student_code_key UNIQUE (tenant_id, student_code)
);

CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    staff_code VARCHAR(20) NOT NULL,
    position VARCHAR(100),
    branch_id INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
    start_date DATE,
    bank_account VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT staff_profiles_tenant_id_staff_code_key UNIQUE (tenant_id, staff_code)
);

-- =========================
-- CLASS / SCHEDULE / ATTENDANCE
-- =========================
CREATE TABLE IF NOT EXISTS public.classes (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(20),
    class_type VARCHAR(20) DEFAULT 'fixed' NOT NULL,
    max_students INTEGER DEFAULT 20,
    expected_fee NUMERIC(12,2) DEFAULT 0,
    start_date DATE,
    end_date DATE,
    expected_sessions INTEGER,
    status VARCHAR(20) DEFAULT 'upcoming' NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT classes_class_type_check CHECK (class_type IN ('fixed','open')),
    CONSTRAINT classes_status_check CHECK (status IN ('upcoming','active','completed','cancelled'))
);

CREATE TABLE IF NOT EXISTS public.class_teachers (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT TRUE NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT class_teachers_class_id_teacher_id_key UNIQUE (class_id, teacher_id)
);

CREATE TABLE IF NOT EXISTS public.class_students (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    joined_at DATE DEFAULT CURRENT_DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    CONSTRAINT class_students_status_check CHECK (status IN ('active','dropped','completed')),
    CONSTRAINT class_students_class_id_student_id_key UNIQUE (class_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.class_weekly_schedules (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    weekday INTEGER NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room_id INTEGER REFERENCES public.rooms(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT class_weekly_schedules_weekday_check CHECK (weekday >= 0 AND weekday <= 6),
    CONSTRAINT class_weekly_schedules_class_id_weekday_key UNIQUE (class_id, weekday)
);

CREATE TABLE IF NOT EXISTS public.schedules (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    room_id INTEGER REFERENCES public.rooms(id) ON DELETE SET NULL,
    teacher_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    session_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    session_number INTEGER,
    status VARCHAR(20) DEFAULT 'scheduled' NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT schedules_status_check CHECK (status IN ('scheduled','completed','cancelled','postponed'))
);

CREATE TABLE IF NOT EXISTS public.schedule_changes (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    schedule_id INTEGER NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
    change_type VARCHAR(30) NOT NULL,
    reason TEXT,
    old_session_date DATE,
    new_session_date DATE,
    old_start_time TIME,
    new_start_time TIME,
    old_end_time TIME,
    new_end_time TIME,
    old_room_id INTEGER REFERENCES public.rooms(id) ON DELETE SET NULL,
    new_room_id INTEGER REFERENCES public.rooms(id) ON DELETE SET NULL,
    old_teacher_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    new_teacher_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    changed_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT schedule_changes_change_type_check CHECK (change_type IN ('reschedule','teacher_change','room_change','status_change'))
);

CREATE TABLE IF NOT EXISTS public.attendance (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    schedule_id INTEGER NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'present' NOT NULL,
    note TEXT,
    recorded_by INTEGER REFERENCES public.users(id),
    recorded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT attendance_status_check CHECK (status IN ('present','absent','late','excused')),
    CONSTRAINT attendance_schedule_id_student_id_key UNIQUE (schedule_id, student_id)
);

-- =========================
-- TUITION / FEE / EXPENSE
-- =========================
CREATE TABLE IF NOT EXISTS public.fee_templates (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    amount NUMERIC(12,2) DEFAULT 0 NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fee_collections (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    class_id INTEGER REFERENCES public.classes(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    due_date DATE,
    total_amount NUMERIC(12,2) DEFAULT 0 NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    collection_code VARCHAR(50),
    fee_template_id INTEGER REFERENCES public.fee_templates(id) ON DELETE SET NULL,
    cycle_type VARCHAR(20) DEFAULT 'monthly',
    start_date DATE,
    end_date DATE,
    grace_days INTEGER DEFAULT 7,
    scope_type VARCHAR(20) DEFAULT 'class',
    cancelled_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    CONSTRAINT fee_collections_status_check CHECK (status IN ('draft','active','closed','cancelled'))
);

CREATE TABLE IF NOT EXISTS public.fee_collection_classes (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    collection_id INTEGER NOT NULL REFERENCES public.fee_collections(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT fee_collection_classes_collection_id_class_id_key UNIQUE (collection_id, class_id)
);

CREATE TABLE IF NOT EXISTS public.fee_collection_items (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    collection_id INTEGER NOT NULL REFERENCES public.fee_collections(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount_due NUMERIC(12,2) DEFAULT 0 NOT NULL,
    amount_paid NUMERIC(12,2) DEFAULT 0 NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT fee_collection_items_status_check CHECK (status IN ('pending','partial','paid','cancelled')),
    CONSTRAINT fee_collection_items_collection_id_student_id_key UNIQUE (collection_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.fee_transactions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES public.fee_collection_items(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    payment_method VARCHAR(30) DEFAULT 'cash' NOT NULL,
    paid_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    collected_by INTEGER REFERENCES public.users(id),
    note TEXT,
    is_cancelled BOOLEAN DEFAULT FALSE NOT NULL,
    cancelled_at TIMESTAMPTZ,
    cancelled_by INTEGER REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    bill_number VARCHAR(50),
    paid_date DATE,
    CONSTRAINT fee_transactions_payment_method_check CHECK (payment_method IN ('cash','transfer','momo','zalopay','vnpay','card','other'))
);

CREATE TABLE IF NOT EXISTS public.expenses (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    category VARCHAR(50) DEFAULT 'other' NOT NULL,
    description TEXT,
    payment_method VARCHAR(30) DEFAULT 'cash' NOT NULL,
    expense_date DATE DEFAULT CURRENT_DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_by INTEGER REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =========================
-- EXAM / QUESTION BANK / MOCK EXAM
-- Bo sung theo backend/src/services/exam.service.js
-- =========================
CREATE TABLE IF NOT EXISTS public.exam_question_groups (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    format_code VARCHAR(50) NOT NULL,
    exam_type VARCHAR(50) NOT NULL,
    skill VARCHAR(50),
    part VARCHAR(100),
    title VARCHAR(255),
    group_key VARCHAR(255) NOT NULL,
    content TEXT,
    passages JSONB DEFAULT '[]'::jsonb NOT NULL,
    media JSONB DEFAULT '{}'::jsonb NOT NULL,
    display_config JSONB DEFAULT '{}'::jsonb NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    order_number INTEGER,
    created_by INTEGER REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT exam_question_groups_tenant_group_key UNIQUE (tenant_id, group_key)
);

CREATE TABLE IF NOT EXISTS public.exam_questions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    exam_type VARCHAR(50) NOT NULL,
    format_code VARCHAR(50) NOT NULL,
    skill VARCHAR(50) NOT NULL,
    part VARCHAR(100) NOT NULL,
    question_type VARCHAR(50) DEFAULT 'single_choice' NOT NULL,
    group_key VARCHAR(255),
    sequence_no INTEGER,
    question_group TEXT,
    question_text TEXT,
    image_url TEXT,
    audio_url TEXT,
    media JSONB DEFAULT '{}'::jsonb NOT NULL,
    display_config JSONB DEFAULT '{}'::jsonb NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    prep_seconds INTEGER,
    response_seconds INTEGER,
    section_seconds INTEGER,
    min_words INTEGER,
    max_words INTEGER,
    difficulty VARCHAR(20) DEFAULT 'medium' NOT NULL,
    topic VARCHAR(255),
    explanation TEXT,
    score NUMERIC(8,2) DEFAULT 1 NOT NULL,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    created_by INTEGER REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT exam_questions_difficulty_check CHECK (difficulty IN ('easy','medium','hard')),
    CONSTRAINT exam_questions_status_check CHECK (status IN ('active','inactive','draft','archived'))
);

CREATE TABLE IF NOT EXISTS public.exam_question_options (
    id SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
    option_label VARCHAR(10) NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT exam_question_options_question_label_key UNIQUE (question_id, option_label)
);

CREATE TABLE IF NOT EXISTS public.exam_sets (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    exam_type VARCHAR(50) NOT NULL,
    format_code VARCHAR(50) NOT NULL,
    description TEXT,
    duration_minutes INTEGER DEFAULT 120 NOT NULL,
    total_score NUMERIC(8,2) DEFAULT 100 NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' NOT NULL,
    blueprint JSONB DEFAULT '[]'::jsonb NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_by INTEGER REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT exam_sets_status_check CHECK (status IN ('draft','active','inactive','archived'))
);

CREATE TABLE IF NOT EXISTS public.exam_set_questions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    exam_set_id INTEGER NOT NULL REFERENCES public.exam_sets(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
    order_number INTEGER NOT NULL,
    score NUMERIC(8,2) DEFAULT 1 NOT NULL,
    section VARCHAR(50),
    part VARCHAR(100),
    group_key VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT exam_set_questions_set_question_key UNIQUE (exam_set_id, question_id),
    CONSTRAINT exam_set_questions_set_order_key UNIQUE (exam_set_id, order_number)
);

CREATE TABLE IF NOT EXISTS public.mock_exams (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    exam_set_id INTEGER NOT NULL REFERENCES public.exam_sets(id) ON DELETE CASCADE,
    class_id INTEGER REFERENCES public.classes(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 120 NOT NULL,
    attempt_limit INTEGER DEFAULT 1 NOT NULL,
    show_result BOOLEAN DEFAULT TRUE NOT NULL,
    status VARCHAR(20) DEFAULT 'upcoming' NOT NULL,
    note TEXT,
    created_by INTEGER REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT mock_exams_status_check CHECK (status IN ('upcoming','active','closed','cancelled'))
);

CREATE TABLE IF NOT EXISTS public.mock_exam_students (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    mock_exam_id INTEGER NOT NULL REFERENCES public.mock_exams(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'assigned' NOT NULL,
    started_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    objective_score NUMERIC(8,2) DEFAULT 0 NOT NULL,
    manual_score NUMERIC(8,2) DEFAULT 0 NOT NULL,
    total_score NUMERIC(8,2) DEFAULT 0 NOT NULL,
    overall_score NUMERIC(8,2),
    skill_score_breakdown JSONB DEFAULT '{}'::jsonb NOT NULL,
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT mock_exam_students_status_check CHECK (status IN ('assigned','in_progress','submitted','graded','absent')),
    CONSTRAINT mock_exam_students_exam_student_key UNIQUE (mock_exam_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.student_exam_attempts (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    mock_exam_student_id INTEGER NOT NULL REFERENCES public.mock_exam_students(id) ON DELETE CASCADE,
    attempt_no INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'in_progress' NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    objective_score NUMERIC(8,2) DEFAULT 0 NOT NULL,
    manual_score NUMERIC(8,2) DEFAULT 0 NOT NULL,
    total_score NUMERIC(8,2) DEFAULT 0 NOT NULL,
    overall_score NUMERIC(8,2),
    skill_score_breakdown JSONB DEFAULT '{}'::jsonb NOT NULL,
    feedback TEXT,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT student_exam_attempts_status_check CHECK (status IN ('in_progress','submitted','graded','expired','cancelled')),
    CONSTRAINT student_exam_attempts_student_attempt_key UNIQUE (mock_exam_student_id, attempt_no)
);

CREATE TABLE IF NOT EXISTS public.student_exam_answers (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    attempt_id INTEGER NOT NULL REFERENCES public.student_exam_attempts(id) ON DELETE CASCADE,
    mock_exam_student_id INTEGER NOT NULL REFERENCES public.mock_exam_students(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
    selected_option_id INTEGER REFERENCES public.exam_question_options(id) ON DELETE SET NULL,
    answer_text TEXT,
    is_correct BOOLEAN,
    score NUMERIC(8,2) DEFAULT 0 NOT NULL,
    recording_url TEXT,
    duration_seconds INTEGER,
    word_count INTEGER,
    char_count INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    graded_by INTEGER REFERENCES public.users(id),
    graded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT student_exam_answers_attempt_question_key UNIQUE (attempt_id, question_id)
);

-- =========================
-- INDEXES
-- =========================
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON public.users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_roles_user ON public.roles (user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_classes_tenant ON public.classes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_classes_branch ON public.classes (branch_id);
CREATE INDEX IF NOT EXISTS idx_class_weekly_class ON public.class_weekly_schedules (class_id);
CREATE INDEX IF NOT EXISTS idx_schedules_class ON public.schedules (class_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON public.schedules (session_date);
CREATE INDEX IF NOT EXISTS idx_schedules_room_date ON public.schedules (room_id, session_date);
CREATE INDEX IF NOT EXISTS idx_schedules_teacher_date ON public.schedules (teacher_id, session_date);
CREATE INDEX IF NOT EXISTS idx_schedule_changes_schedule ON public.schedule_changes (schedule_id);
CREATE INDEX IF NOT EXISTS idx_attendance_schedule ON public.attendance (schedule_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance (student_id);
CREATE INDEX IF NOT EXISTS idx_fee_collections_tenant ON public.fee_collections (tenant_id);
CREATE INDEX IF NOT EXISTS idx_fee_coll_classes ON public.fee_collection_classes (collection_id);
CREATE INDEX IF NOT EXISTS idx_fee_collection_items_tenant ON public.fee_collection_items (tenant_id);
CREATE INDEX IF NOT EXISTS idx_fee_items_collection ON public.fee_collection_items (collection_id);
CREATE INDEX IF NOT EXISTS idx_fee_transactions_tenant ON public.fee_transactions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_fee_transactions_item ON public.fee_transactions (item_id);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON public.expenses (tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses (expense_date);

CREATE INDEX IF NOT EXISTS idx_exam_question_groups_tenant ON public.exam_question_groups (tenant_id);
CREATE INDEX IF NOT EXISTS idx_exam_question_groups_format_skill_part ON public.exam_question_groups (format_code, skill, part);
CREATE INDEX IF NOT EXISTS idx_exam_questions_tenant ON public.exam_questions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_format_skill_part ON public.exam_questions (format_code, skill, part);
CREATE INDEX IF NOT EXISTS idx_exam_questions_group_key ON public.exam_questions (tenant_id, group_key);
CREATE INDEX IF NOT EXISTS idx_exam_question_options_question ON public.exam_question_options (question_id);
CREATE INDEX IF NOT EXISTS idx_exam_sets_tenant ON public.exam_sets (tenant_id);
CREATE INDEX IF NOT EXISTS idx_exam_set_questions_set ON public.exam_set_questions (exam_set_id);
CREATE INDEX IF NOT EXISTS idx_mock_exams_tenant ON public.mock_exams (tenant_id);
CREATE INDEX IF NOT EXISTS idx_mock_exam_students_mock ON public.mock_exam_students (mock_exam_id);
CREATE INDEX IF NOT EXISTS idx_student_exam_attempts_student ON public.student_exam_attempts (mock_exam_student_id);
CREATE INDEX IF NOT EXISTS idx_student_exam_answers_student ON public.student_exam_answers (mock_exam_student_id);
CREATE INDEX IF NOT EXISTS idx_student_exam_answers_attempt ON public.student_exam_answers (attempt_id);

-- =========================
-- TRIGGERS
-- =========================
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_teacher_profiles_updated_at BEFORE UPDATE ON public.teacher_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_student_profiles_updated_at BEFORE UPDATE ON public.student_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_staff_profiles_updated_at BEFORE UPDATE ON public.staff_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_class_weekly_schedules_updated_at BEFORE UPDATE ON public.class_weekly_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fee_templates_updated_at BEFORE UPDATE ON public.fee_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fee_collections_updated_at BEFORE UPDATE ON public.fee_collections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fee_collection_items_updated_at BEFORE UPDATE ON public.fee_collection_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_exam_question_groups_updated_at BEFORE UPDATE ON public.exam_question_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_exam_questions_updated_at BEFORE UPDATE ON public.exam_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_exam_sets_updated_at BEFORE UPDATE ON public.exam_sets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_mock_exams_updated_at BEFORE UPDATE ON public.mock_exams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_mock_exam_students_updated_at BEFORE UPDATE ON public.mock_exam_students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_student_exam_attempts_updated_at BEFORE UPDATE ON public.student_exam_attempts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_student_exam_answers_updated_at BEFORE UPDATE ON public.student_exam_answers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bill_number BEFORE INSERT ON public.fee_transactions FOR EACH ROW EXECUTE FUNCTION public.generate_bill_number();

-- =========================
-- DEMO ACCOUNT SEED DATA
-- Tai khoan demo: demo@gmail.com / demo@123
-- Tenant slug: demo
-- =========================
WITH demo_tenant AS (
    INSERT INTO public.tenants (name, slug, email, phone, address, description, is_active)
    VALUES (
        'Demo English Center',
        'demo',
        'demo@gmail.com',
        '0900000000',
        'Demo Address',
        'Tenant demo dùng để đăng nhập và trải nghiệm hệ thống',
        TRUE
    )
    ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address,
        description = EXCLUDED.description,
        is_active = TRUE,
        updated_at = NOW()
    RETURNING id
), demo_user AS (
    INSERT INTO public.users (tenant_id, full_name, email, phone, gender, password_hash, is_active)
    SELECT
        id,
        'Demo Admin',
        'demo@gmail.com',
        '0900000001',
        'other',
        '$2a$10$pKwNwa713HbWBdAMq5oaseVjPwV9z2BPqpLVuC8CtKLn5JNF/FvMy',
        TRUE
    FROM demo_tenant
    ON CONFLICT (tenant_id, email) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        gender = EXCLUDED.gender,
        password_hash = EXCLUDED.password_hash,
        is_active = TRUE,
        updated_at = NOW()
    RETURNING id, tenant_id
)
INSERT INTO public.roles (tenant_id, user_id, role_type)
SELECT tenant_id, id, 'admin'
FROM demo_user
ON CONFLICT (tenant_id, user_id, role_type) DO NOTHING;

-- =========================
-- FULL DEMO DATA + EXAM QUESTION BANK SEED
-- Generated for TOEIC 2 kỹ năng, TOEIC 4 kỹ năng, VSTEP 4 kỹ năng.
-- Audio/Image dùng placeholder; cập nhật file thật sau tại image_url/audio_url/media.
-- Safe to re-run: old exam seed data is deleted first by metadata/settings seed marker.
-- =========================

BEGIN;

-- Xóa dữ liệu seed cũ để tránh trùng câu hỏi/bộ đề khi chạy lại.
DELETE FROM public.mock_exams WHERE note LIKE '%full_exam_seed_v1%';
DELETE FROM public.exam_sets WHERE settings ->> 'seed' = 'full_exam_seed_v1';
DELETE FROM public.exam_questions WHERE metadata ->> 'seed' = 'full_exam_seed_v1';
DELETE FROM public.exam_question_groups WHERE metadata ->> 'seed' = 'full_exam_seed_v1';

-- Helper tạo câu hỏi + đáp án.
CREATE OR REPLACE FUNCTION public.__seed_exam_question(
    p_tenant_id INTEGER,
    p_created_by INTEGER,
    p_format_code VARCHAR,
    p_exam_type VARCHAR,
    p_skill VARCHAR,
    p_part VARCHAR,
    p_question_type VARCHAR,
    p_group_key VARCHAR,
    p_sequence_no INTEGER,
    p_question_text TEXT,
    p_image_url TEXT,
    p_audio_url TEXT,
    p_display_config JSONB,
    p_metadata JSONB,
    p_prep_seconds INTEGER,
    p_response_seconds INTEGER,
    p_section_seconds INTEGER,
    p_min_words INTEGER,
    p_score NUMERIC,
    p_options TEXT[],
    p_correct_label TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_question_id INTEGER;
    v_label TEXT;
    v_idx INTEGER := 1;
BEGIN
    INSERT INTO public.exam_questions (
        tenant_id, exam_type, format_code, skill, part, question_type, group_key, sequence_no,
        question_group, question_text, image_url, audio_url, media, display_config, metadata,
        prep_seconds, response_seconds, section_seconds, min_words, max_words, difficulty, topic,
        explanation, score, status, created_by
    ) VALUES (
        p_tenant_id, p_exam_type, p_format_code, p_skill, p_part, p_question_type, p_group_key, p_sequence_no,
        p_group_key, p_question_text, p_image_url, p_audio_url,
        jsonb_build_object('image', p_image_url, 'audio', p_audio_url),
        COALESCE(p_display_config, '{}'::jsonb),
        COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('seed', 'full_exam_seed_v1'),
        p_prep_seconds, p_response_seconds, p_section_seconds, p_min_words, NULL,
        CASE WHEN p_sequence_no % 5 = 0 THEN 'hard' WHEN p_sequence_no % 3 = 0 THEN 'easy' ELSE 'medium' END,
        p_skill || ' - ' || p_part,
        'Đây là đáp án mẫu để demo. Giáo viên có thể chỉnh sửa giải thích sau.',
        COALESCE(p_score, 1), 'active', p_created_by
    ) RETURNING id INTO v_question_id;

    IF p_options IS NOT NULL AND array_length(p_options, 1) IS NOT NULL THEN
        FOREACH v_label IN ARRAY p_options LOOP
            INSERT INTO public.exam_question_options (question_id, option_label, option_text, is_correct)
            VALUES (
                v_question_id,
                v_label,
                CASE
                    WHEN p_part = 'Part 1' THEN 'Statement ' || v_label || ' cho hình ảnh số ' || p_sequence_no
                    WHEN p_part = 'Part 2' THEN 'Response ' || v_label || ' cho câu nghe số ' || p_sequence_no
                    ELSE 'Đáp án ' || v_label || ' cho câu ' || p_sequence_no
                END,
                v_label = p_correct_label
            );
            v_idx := v_idx + 1;
        END LOOP;
    END IF;
    RETURN v_question_id;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    v_tenant_id INTEGER;
    v_admin_id INTEGER;
    v_staff_id INTEGER;
    v_teacher_id INTEGER;
    v_student_1 INTEGER;
    v_student_2 INTEGER;
    v_student_3 INTEGER;
    v_student_4 INTEGER;
    v_branch_id INTEGER;
    v_room_1 INTEGER;
    v_room_2 INTEGER;
    v_class_toeic INTEGER;
    v_class_vstep INTEGER;
    v_set_toeic_lr INTEGER;
    v_set_toeic4 INTEGER;
    v_set_vstep INTEGER;
    v_mock_toeic INTEGER;
    v_mock_vstep INTEGER;
    v_qid INTEGER;
    v_group_key TEXT;
    v_group_index INTEGER;
    v_i INTEGER;
    v_j INTEGER;
    v_seq INTEGER;
    v_order INTEGER;
    v_count INTEGER;
    v_correct TEXT;
    v_email TEXT;
    v_uid INTEGER;
    v_labels4 TEXT[] := ARRAY['A','B','C','D'];
    v_labels3 TEXT[] := ARRAY['A','B','C'];
    v_hash TEXT := '$2a$10$pKwNwa713HbWBdAMq5oaseVjPwV9z2BPqpLVuC8CtKLn5JNF/FvMy'; -- demo@123
BEGIN
    SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'demo';
    IF v_tenant_id IS NULL THEN
        INSERT INTO public.tenants (name, slug, email, phone, address, description, is_active)
        VALUES ('Demo English Center', 'demo', 'demo@gmail.com', '0900000000', 'Demo Address', 'Tenant demo', TRUE)
        RETURNING id INTO v_tenant_id;
    END IF;

    SELECT id INTO v_admin_id FROM public.users WHERE tenant_id = v_tenant_id AND email = 'demo@gmail.com';

    -- Tài khoản mẫu: mật khẩu tất cả là demo@123
    -- Staff
    INSERT INTO public.users (tenant_id, full_name, email, phone, gender, password_hash, is_active)
    VALUES (v_tenant_id, 'Nhân viên Học vụ Demo', 'staff.demo@gmail.com', '0911000001', 'female', v_hash, TRUE)
    ON CONFLICT (tenant_id, email) DO UPDATE SET full_name=EXCLUDED.full_name, phone=EXCLUDED.phone, password_hash=EXCLUDED.password_hash, is_active=TRUE, updated_at=NOW()
    RETURNING id INTO v_staff_id;
    INSERT INTO public.roles (tenant_id, user_id, role_type) VALUES (v_tenant_id, v_staff_id, 'staff') ON CONFLICT DO NOTHING;

    -- Teacher
    INSERT INTO public.users (tenant_id, full_name, email, phone, gender, password_hash, is_active)
    VALUES (v_tenant_id, 'Giáo viên TOEIC/VSTEP Demo', 'teacher.demo@gmail.com', '0911000002', 'male', v_hash, TRUE)
    ON CONFLICT (tenant_id, email) DO UPDATE SET full_name=EXCLUDED.full_name, phone=EXCLUDED.phone, password_hash=EXCLUDED.password_hash, is_active=TRUE, updated_at=NOW()
    RETURNING id INTO v_teacher_id;
    INSERT INTO public.roles (tenant_id, user_id, role_type) VALUES (v_tenant_id, v_teacher_id, 'teacher') ON CONFLICT DO NOTHING;

    -- Students
    FOR v_i IN 1..4 LOOP
        v_email := 'student' || v_i || '.demo@gmail.com';
        INSERT INTO public.users (tenant_id, full_name, email, phone, gender, password_hash, is_active)
        VALUES (v_tenant_id, 'Học viên Demo ' || v_i, v_email, '091100001' || v_i, CASE WHEN v_i % 2 = 0 THEN 'female' ELSE 'male' END, v_hash, TRUE)
        ON CONFLICT (tenant_id, email) DO UPDATE SET full_name=EXCLUDED.full_name, phone=EXCLUDED.phone, password_hash=EXCLUDED.password_hash, is_active=TRUE, updated_at=NOW()
        RETURNING id INTO v_uid;
        INSERT INTO public.roles (tenant_id, user_id, role_type) VALUES (v_tenant_id, v_uid, 'student') ON CONFLICT DO NOTHING;
        INSERT INTO public.student_profiles (tenant_id, user_id, student_code, enrollment_date, study_status, notes)
        VALUES (v_tenant_id, v_uid, 'HV-DEMO-' || LPAD(v_i::TEXT, 3, '0'), CURRENT_DATE - 30, 'active', 'Học viên demo cho dữ liệu thi thử')
        ON CONFLICT (tenant_id, student_code) DO UPDATE SET user_id=EXCLUDED.user_id, study_status='active', updated_at=NOW();
        IF v_i = 1 THEN v_student_1 := v_uid; END IF;
        IF v_i = 2 THEN v_student_2 := v_uid; END IF;
        IF v_i = 3 THEN v_student_3 := v_uid; END IF;
        IF v_i = 4 THEN v_student_4 := v_uid; END IF;
    END LOOP;

    INSERT INTO public.teacher_profiles (tenant_id, user_id, teacher_code, specialization, qualifications, start_date, notes)
    VALUES (v_tenant_id, v_teacher_id, 'GV-DEMO-001', 'TOEIC, VSTEP', 'Cử nhân Ngôn ngữ Anh; 5 năm kinh nghiệm luyện thi', CURRENT_DATE - 365, 'Giáo viên demo')
    ON CONFLICT (tenant_id, teacher_code) DO UPDATE SET user_id=EXCLUDED.user_id, specialization=EXCLUDED.specialization, updated_at=NOW();

    -- Branch, rooms, classes
    SELECT id INTO v_branch_id FROM public.branches WHERE tenant_id=v_tenant_id AND code='CS-DEMO-01' LIMIT 1;
    IF v_branch_id IS NULL THEN
        INSERT INTO public.branches (tenant_id, name, code, address, phone, status)
        VALUES (v_tenant_id, 'Cơ sở Demo Quận 1', 'CS-DEMO-01', '123 Đường Demo, TP.HCM', '0280000000', 'active') RETURNING id INTO v_branch_id;
    END IF;

    SELECT id INTO v_room_1 FROM public.rooms WHERE tenant_id=v_tenant_id AND code='P101' LIMIT 1;
    IF v_room_1 IS NULL THEN
        INSERT INTO public.rooms (tenant_id, branch_id, name, code, capacity, status) VALUES (v_tenant_id, v_branch_id, 'Phòng 101', 'P101', 30, 'active') RETURNING id INTO v_room_1;
    END IF;
    SELECT id INTO v_room_2 FROM public.rooms WHERE tenant_id=v_tenant_id AND code='P102' LIMIT 1;
    IF v_room_2 IS NULL THEN
        INSERT INTO public.rooms (tenant_id, branch_id, name, code, capacity, status) VALUES (v_tenant_id, v_branch_id, 'Phòng 102', 'P102', 25, 'active') RETURNING id INTO v_room_2;
    END IF;

    SELECT id INTO v_class_toeic FROM public.classes WHERE tenant_id=v_tenant_id AND code='TOEIC-DEMO-01' LIMIT 1;
    IF v_class_toeic IS NULL THEN
        INSERT INTO public.classes (tenant_id, branch_id, name, code, class_type, max_students, expected_fee, start_date, end_date, expected_sessions, status, description)
        VALUES (v_tenant_id, v_branch_id, 'Lớp TOEIC Demo 650+', 'TOEIC-DEMO-01', 'fixed', 25, 3500000, CURRENT_DATE - 14, CURRENT_DATE + 90, 36, 'active', 'Lớp demo để kiểm tra thi thử TOEIC') RETURNING id INTO v_class_toeic;
    END IF;
    SELECT id INTO v_class_vstep FROM public.classes WHERE tenant_id=v_tenant_id AND code='VSTEP-DEMO-01' LIMIT 1;
    IF v_class_vstep IS NULL THEN
        INSERT INTO public.classes (tenant_id, branch_id, name, code, class_type, max_students, expected_fee, start_date, end_date, expected_sessions, status, description)
        VALUES (v_tenant_id, v_branch_id, 'Lớp VSTEP Demo B1-B2', 'VSTEP-DEMO-01', 'fixed', 20, 4200000, CURRENT_DATE - 7, CURRENT_DATE + 100, 40, 'active', 'Lớp demo để kiểm tra thi thử VSTEP') RETURNING id INTO v_class_vstep;
    END IF;

    INSERT INTO public.class_teachers (tenant_id, class_id, teacher_id, is_primary) VALUES (v_tenant_id, v_class_toeic, v_teacher_id, TRUE) ON CONFLICT DO NOTHING;
    INSERT INTO public.class_teachers (tenant_id, class_id, teacher_id, is_primary) VALUES (v_tenant_id, v_class_vstep, v_teacher_id, TRUE) ON CONFLICT DO NOTHING;

    INSERT INTO public.class_students (tenant_id, class_id, student_id, status) VALUES (v_tenant_id, v_class_toeic, v_student_1, 'active') ON CONFLICT DO NOTHING;
    INSERT INTO public.class_students (tenant_id, class_id, student_id, status) VALUES (v_tenant_id, v_class_toeic, v_student_2, 'active') ON CONFLICT DO NOTHING;
    INSERT INTO public.class_students (tenant_id, class_id, student_id, status) VALUES (v_tenant_id, v_class_vstep, v_student_3, 'active') ON CONFLICT DO NOTHING;
    INSERT INTO public.class_students (tenant_id, class_id, student_id, status) VALUES (v_tenant_id, v_class_vstep, v_student_4, 'active') ON CONFLICT DO NOTHING;

    INSERT INTO public.class_weekly_schedules (tenant_id, class_id, weekday, start_time, end_time, room_id)
    VALUES (v_tenant_id, v_class_toeic, 2, '18:00', '20:00', v_room_1) ON CONFLICT DO NOTHING;
    INSERT INTO public.class_weekly_schedules (tenant_id, class_id, weekday, start_time, end_time, room_id)
    VALUES (v_tenant_id, v_class_vstep, 4, '18:00', '20:00', v_room_2) ON CONFLICT DO NOTHING;

    -- Lịch học cụ thể demo để học viên/giảng viên/nhân viên thấy dữ liệu ngay sau khi chạy db2305.sql.
    FOR v_i IN 0..3 LOOP
        INSERT INTO public.schedules (tenant_id, class_id, room_id, teacher_id, session_date, start_time, end_time, session_number, status, note)
        SELECT v_tenant_id, v_class_toeic, v_room_1, v_teacher_id, CURRENT_DATE + (v_i * 7), '18:00', '20:00', v_i + 1, 'scheduled', 'Buổi học TOEIC demo'
        WHERE NOT EXISTS (
            SELECT 1 FROM public.schedules
            WHERE tenant_id = v_tenant_id AND class_id = v_class_toeic AND session_date = CURRENT_DATE + (v_i * 7) AND start_time = '18:00'
        );

        INSERT INTO public.schedules (tenant_id, class_id, room_id, teacher_id, session_date, start_time, end_time, session_number, status, note)
        SELECT v_tenant_id, v_class_vstep, v_room_2, v_teacher_id, CURRENT_DATE + 2 + (v_i * 7), '18:00', '20:00', v_i + 1, 'scheduled', 'Buổi học VSTEP demo'
        WHERE NOT EXISTS (
            SELECT 1 FROM public.schedules
            WHERE tenant_id = v_tenant_id AND class_id = v_class_vstep AND session_date = CURRENT_DATE + 2 + (v_i * 7) AND start_time = '18:00'
        );
    END LOOP;

    -- =========================
    -- TOEIC 2 kỹ năng: 200 câu
    -- =========================
    -- Part 1: 6 câu
    FOR v_i IN 1..6 LOOP
        v_correct := (v_labels4[((v_i - 1) % 4) + 1]);
        v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 1', 'single_choice', NULL, v_i,
            'Listen and choose the statement that best describes the picture. Question ' || v_i,
            '/uploads/exams/toeic/lr/part1/picture_' || LPAD(v_i::TEXT, 2, '0') || '.jpg',
            '/uploads/exams/toeic/lr/part1/audio_' || LPAD(v_i::TEXT, 2, '0') || '.mp3',
            '{"showQuestionText":false,"showOptionText":false,"requiresImage":true,"requiresAudio":true,"transitionSeconds":2}'::jsonb,
            jsonb_build_object('placeholderMedia', true, 'toeicPart', 1), NULL, NULL, NULL, NULL, 1, v_labels4, v_correct);
    END LOOP;

    -- Part 2: 25 câu
    FOR v_i IN 1..25 LOOP
        v_correct := (v_labels3[((v_i - 1) % 3) + 1]);
        v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, v_i,
            'Listen to a question or statement and choose the best response. Question ' || v_i,
            NULL, '/uploads/exams/toeic/lr/part2/audio_' || LPAD(v_i::TEXT, 2, '0') || '.mp3',
            '{"showQuestionText":false,"showOptionText":false,"requiresAudio":true,"transitionSeconds":5}'::jsonb,
            jsonb_build_object('placeholderMedia', true, 'toeicPart', 2), NULL, NULL, NULL, NULL, 1, v_labels3, v_correct);
    END LOOP;

    -- Part 3: 13 đoạn, mỗi đoạn 3 câu = 39
    v_seq := 1;
    FOR v_group_index IN 1..13 LOOP
        v_group_key := 'SEED_TOEIC_LR_P3_G' || LPAD(v_group_index::TEXT, 2, '0');
        INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, media, display_config, metadata, order_number, created_by)
        VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'TOEIC Part 3 Conversation ' || v_group_index, v_group_key,
            'Short conversation transcript placeholder ' || v_group_index,
            jsonb_build_object('audio','/uploads/exams/toeic/lr/part3/conversation_' || LPAD(v_group_index::TEXT,2,'0') || '.mp3'),
            '{"questionsPerGroup":3,"requiresAudio":true,"transitionSeconds":8}'::jsonb,
            '{"seed":"full_exam_seed_v1","placeholderMedia":true}'::jsonb, v_group_index, v_admin_id)
        ON CONFLICT (tenant_id, group_key) DO UPDATE SET content=EXCLUDED.content, media=EXCLUDED.media, metadata=EXCLUDED.metadata, updated_at=NOW();
        FOR v_j IN 1..3 LOOP
            v_correct := (v_labels4[((v_seq - 1) % 4) + 1]);
            v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', v_group_key, v_seq,
                'According to the conversation, choose the best answer. Question ' || v_seq,
                NULL, '/uploads/exams/toeic/lr/part3/conversation_' || LPAD(v_group_index::TEXT,2,'0') || '.mp3',
                '{"showQuestionText":true,"showOptionText":true,"requiresAudio":true,"transitionSeconds":8}'::jsonb,
                jsonb_build_object('placeholderMedia', true, 'toeicPart', 3, 'groupNo', v_group_index), NULL, NULL, NULL, NULL, 1, v_labels4, v_correct);
            v_seq := v_seq + 1;
        END LOOP;
    END LOOP;

    -- Part 4: 10 bài, mỗi bài 3 câu = 30
    v_seq := 1;
    FOR v_group_index IN 1..10 LOOP
        v_group_key := 'SEED_TOEIC_LR_P4_G' || LPAD(v_group_index::TEXT, 2, '0');
        INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, media, display_config, metadata, order_number, created_by)
        VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'TOEIC Part 4 Talk ' || v_group_index, v_group_key,
            'Short talk transcript placeholder ' || v_group_index,
            jsonb_build_object('audio','/uploads/exams/toeic/lr/part4/talk_' || LPAD(v_group_index::TEXT,2,'0') || '.mp3'),
            '{"questionsPerGroup":3,"requiresAudio":true,"transitionSeconds":8}'::jsonb,
            '{"seed":"full_exam_seed_v1","placeholderMedia":true}'::jsonb, v_group_index, v_admin_id)
        ON CONFLICT (tenant_id, group_key) DO UPDATE SET content=EXCLUDED.content, media=EXCLUDED.media, metadata=EXCLUDED.metadata, updated_at=NOW();
        FOR v_j IN 1..3 LOOP
            v_correct := (v_labels4[((v_seq - 1) % 4) + 1]);
            v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', v_group_key, v_seq,
                'According to the talk, choose the best answer. Question ' || v_seq,
                NULL, '/uploads/exams/toeic/lr/part4/talk_' || LPAD(v_group_index::TEXT,2,'0') || '.mp3',
                '{"showQuestionText":true,"showOptionText":true,"requiresAudio":true,"transitionSeconds":8}'::jsonb,
                jsonb_build_object('placeholderMedia', true, 'toeicPart', 4, 'groupNo', v_group_index), NULL, NULL, NULL, NULL, 1, v_labels4, v_correct);
            v_seq := v_seq + 1;
        END LOOP;
    END LOOP;

    -- Reading Part 5: 30 câu
    FOR v_i IN 1..30 LOOP
        v_correct := (v_labels4[((v_i - 1) % 4) + 1]);
        v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, v_i,
            'The manager asked the team to submit the report ____ Friday. Question ' || v_i,
            NULL, NULL, '{"showQuestionText":true,"showOptionText":true}'::jsonb,
            jsonb_build_object('toeicPart', 5), NULL, NULL, NULL, NULL, 1, v_labels4, v_correct);
    END LOOP;

    -- Reading Part 6: 4 đoạn x 4 câu = 16
    v_seq := 1;
    FOR v_group_index IN 1..4 LOOP
        v_group_key := 'SEED_TOEIC_LR_P6_G' || LPAD(v_group_index::TEXT, 2, '0');
        INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, display_config, metadata, order_number, created_by)
        VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'TOEIC Part 6 Text ' || v_group_index, v_group_key,
            'Email/article passage placeholder with four blanks for TOEIC Part 6 text ' || v_group_index,
            jsonb_build_array(jsonb_build_object('title','Part 6 Passage ' || v_group_index, 'content','This is a placeholder passage. [Blank 1] [Blank 2] [Blank 3] [Blank 4].')),
            '{"questionsPerGroup":4,"richTextGroup":true}'::jsonb,
            '{"seed":"full_exam_seed_v1"}'::jsonb, v_group_index, v_admin_id)
        ON CONFLICT (tenant_id, group_key) DO UPDATE SET content=EXCLUDED.content, passages=EXCLUDED.passages, metadata=EXCLUDED.metadata, updated_at=NOW();
        FOR v_j IN 1..4 LOOP
            v_correct := (v_labels4[((v_seq - 1) % 4) + 1]);
            v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'group_choice', v_group_key, v_seq,
                'Choose the best word, phrase, or sentence for blank ' || v_j || '. Question ' || v_seq,
                NULL, NULL, '{"showQuestionText":true,"showOptionText":true,"richTextGroup":true}'::jsonb,
                jsonb_build_object('toeicPart', 6, 'groupNo', v_group_index), NULL, NULL, NULL, NULL, 1, v_labels4, v_correct);
            v_seq := v_seq + 1;
        END LOOP;
    END LOOP;

    -- Reading Part 7: 10 đoạn đơn = 29 câu, 5 nhóm đa = 25 câu
    v_seq := 1;
    FOR v_group_index IN 1..10 LOOP
        v_count := CASE WHEN v_group_index <= 9 THEN 3 ELSE 2 END;
        v_group_key := 'SEED_TOEIC_LR_P7_SINGLE_G' || LPAD(v_group_index::TEXT, 2, '0');
        INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, display_config, metadata, order_number, created_by)
        VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'TOEIC Part 7 Single Passage ' || v_group_index, v_group_key,
            'Single passage placeholder ' || v_group_index,
            jsonb_build_array(jsonb_build_object('type','single','title','Notice/Email/Article ' || v_group_index, 'content','This is a single passage placeholder for TOEIC Part 7.')),
            jsonb_build_object('splitScreen', true, 'passageType', 'single', 'questionsInGroup', v_count),
            '{"seed":"full_exam_seed_v1","part7Type":"single"}'::jsonb, v_group_index, v_admin_id)
        ON CONFLICT (tenant_id, group_key) DO UPDATE SET passages=EXCLUDED.passages, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();
        FOR v_j IN 1..v_count LOOP
            v_correct := (v_labels4[((v_seq - 1) % 4) + 1]);
            v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', v_group_key, v_seq,
                'Choose the best answer based on the single passage. Question ' || v_seq,
                NULL, NULL, '{"showQuestionText":true,"showOptionText":true,"splitScreen":true}'::jsonb,
                jsonb_build_object('toeicPart', 7, 'part7Type', 'single', 'groupNo', v_group_index), NULL, NULL, NULL, NULL, 1, v_labels4, v_correct);
            v_seq := v_seq + 1;
        END LOOP;
    END LOOP;
    FOR v_group_index IN 1..5 LOOP
        v_group_key := 'SEED_TOEIC_LR_P7_MULTI_G' || LPAD(v_group_index::TEXT, 2, '0');
        INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, display_config, metadata, order_number, created_by)
        VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'TOEIC Part 7 Multiple Passage ' || v_group_index, v_group_key,
            'Double/triple passage placeholder ' || v_group_index,
            jsonb_build_array(
                jsonb_build_object('type','email','title','Source A ' || v_group_index, 'content','First source placeholder.'),
                jsonb_build_object('type','notice','title','Source B ' || v_group_index, 'content','Second source placeholder.'),
                jsonb_build_object('type','message','title','Source C ' || v_group_index, 'content','Optional third source placeholder.')
            ),
            jsonb_build_object('splitScreen', true, 'passageType', 'multiple', 'questionsInGroup', 5),
            '{"seed":"full_exam_seed_v1","part7Type":"multiple"}'::jsonb, 20 + v_group_index, v_admin_id)
        ON CONFLICT (tenant_id, group_key) DO UPDATE SET passages=EXCLUDED.passages, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();
        FOR v_j IN 1..5 LOOP
            v_correct := (v_labels4[((v_seq - 1) % 4) + 1]);
            v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', v_group_key, v_seq,
                'Choose the best answer based on the multiple passages. Question ' || v_seq,
                NULL, NULL, '{"showQuestionText":true,"showOptionText":true,"splitScreen":true}'::jsonb,
                jsonb_build_object('toeicPart', 7, 'part7Type', 'multiple', 'groupNo', v_group_index), NULL, NULL, NULL, NULL, 1, v_labels4, v_correct);
            v_seq := v_seq + 1;
        END LOOP;
    END LOOP;

    -- =========================
    -- TOEIC 4 kỹ năng: duplicate LR question bank under TOEIC_4_SKILLS + Speaking/Writing.
    -- =========================
    -- Tạo 200 câu LR cho TOEIC_4_SKILLS bằng cách nhân bản nội dung từ TOEIC_LR.
    INSERT INTO public.exam_questions (
        tenant_id, exam_type, format_code, skill, part, question_type, group_key, sequence_no, question_group, question_text,
        image_url, audio_url, media, display_config, metadata, prep_seconds, response_seconds, section_seconds, min_words,
        max_words, difficulty, topic, explanation, score, status, created_by
    )
    SELECT tenant_id, exam_type, 'TOEIC_4_SKILLS', skill, part, question_type,
           CASE WHEN group_key IS NULL THEN NULL ELSE replace(group_key, 'SEED_TOEIC_LR', 'SEED_TOEIC4') END,
           sequence_no, CASE WHEN question_group IS NULL THEN NULL ELSE replace(question_group, 'SEED_TOEIC_LR', 'SEED_TOEIC4') END,
           question_text || ' (TOEIC 4 Skills LR section)', image_url, audio_url, media, display_config,
           metadata || jsonb_build_object('seed','full_exam_seed_v1','sourceFormat','TOEIC_LR'), prep_seconds, response_seconds, section_seconds, min_words,
           max_words, difficulty, topic, explanation, score, status, created_by
    FROM public.exam_questions
    WHERE tenant_id = v_tenant_id AND format_code='TOEIC_LR' AND metadata ->> 'seed' = 'full_exam_seed_v1';

    INSERT INTO public.exam_question_options (question_id, option_label, option_text, is_correct)
    SELECT q4.id, o.option_label, o.option_text, o.is_correct
    FROM public.exam_questions q2
    JOIN public.exam_questions q4 ON q4.tenant_id=q2.tenant_id AND q4.format_code='TOEIC_4_SKILLS' AND q4.skill=q2.skill AND q4.part=q2.part AND q4.sequence_no=q2.sequence_no AND q4.metadata ->> 'sourceFormat' = 'TOEIC_LR'
    JOIN public.exam_question_options o ON o.question_id=q2.id
    WHERE q2.tenant_id=v_tenant_id AND q2.format_code='TOEIC_LR' AND q2.metadata ->> 'seed'='full_exam_seed_v1';

    -- Nhân bản groups LR cho TOEIC_4_SKILLS
    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    SELECT tenant_id, 'TOEIC_4_SKILLS', exam_type, skill, part, title || ' (TOEIC 4 Skills)', replace(group_key, 'SEED_TOEIC_LR', 'SEED_TOEIC4'), content, passages, media, display_config,
           metadata || jsonb_build_object('seed','full_exam_seed_v1','sourceFormat','TOEIC_LR'), order_number, created_by
    FROM public.exam_question_groups
    WHERE tenant_id=v_tenant_id AND format_code='TOEIC_LR' AND metadata ->> 'seed'='full_exam_seed_v1'
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();

    -- TOEIC Speaking 11 câu
    FOR v_i IN 1..2 LOOP
        v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Speaking', 'Question 1-2', 'speaking_read_aloud', NULL, v_i,
            'Read the following text aloud. Sample passage for question ' || v_i || '.', NULL, NULL,
            '{"inputMode":"text","recording":true}'::jsonb, jsonb_build_object('toeicSpeakingQuestion', v_i), 45, 45, NULL, NULL, 1, ARRAY[]::TEXT[], NULL);
    END LOOP;
    FOR v_i IN 1..2 LOOP
        v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Speaking', 'Question 3-4', 'speaking_describe_picture', NULL, v_i,
            'Describe the picture in as much detail as possible. Question ' || (v_i+2),
            '/uploads/exams/toeic/4skills/speaking/picture_' || LPAD(v_i::TEXT,2,'0') || '.jpg', NULL,
            '{"inputMode":"image","recording":true,"requiresImage":true}'::jsonb, jsonb_build_object('toeicSpeakingQuestion', v_i+2, 'placeholderMedia', true), 45, 30, NULL, NULL, 1, ARRAY[]::TEXT[], NULL);
    END LOOP;
    FOR v_i IN 1..2 LOOP
        v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Speaking', 'Question 5-6', 'speaking_answer_question', NULL, v_i,
            'Answer the question after listening. Question ' || (v_i+4), NULL,
            '/uploads/exams/toeic/4skills/speaking/q' || (v_i+4) || '.mp3',
            '{"inputMode":"text_audio","recording":true,"requiresAudio":true}'::jsonb, jsonb_build_object('toeicSpeakingQuestion', v_i+4, 'placeholderMedia', true), 3, 15, NULL, NULL, 1, ARRAY[]::TEXT[], NULL);
    END LOOP;
    v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Speaking', 'Question 7', 'speaking_answer_question', NULL, 1,
        'Answer the question after listening. Question 7', NULL, '/uploads/exams/toeic/4skills/speaking/q07.mp3',
        '{"inputMode":"text_audio","recording":true,"requiresAudio":true}'::jsonb, '{"toeicSpeakingQuestion":7,"placeholderMedia":true}'::jsonb, 3, 30, NULL, NULL, 1, ARRAY[]::TEXT[], NULL);

    v_group_key := 'SEED_TOEIC4_SPEAKING_Q8_10_INFO';
    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Speaking', 'Question 8-10', 'TOEIC Speaking Questions 8-10 Information', v_group_key,
        'Schedule/table information placeholder for Questions 8-10.',
        jsonb_build_array(jsonb_build_object('title','Conference Schedule','content','9:00 Opening, 10:00 Workshop, 13:00 Meeting, 15:00 Closing.')),
        '{}'::jsonb, '{"groupPreviewSeconds":45,"inputMode":"group_audio"}'::jsonb, '{"seed":"full_exam_seed_v1"}'::jsonb, 1, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET content=EXCLUDED.content, passages=EXCLUDED.passages, updated_at=NOW();
    FOR v_i IN 1..2 LOOP
        v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Speaking', 'Question 8-9', 'speaking_info_question', v_group_key, v_i,
            'Answer the question based on the provided information. Question ' || (v_i+7), NULL, NULL,
            '{"inputMode":"group_audio","recording":true,"groupPreviewSeconds":45}'::jsonb, jsonb_build_object('toeicSpeakingQuestion', v_i+7), 3, 15, NULL, NULL, 1, ARRAY[]::TEXT[], NULL);
    END LOOP;
    v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Speaking', 'Question 10', 'speaking_info_question', v_group_key, 1,
        'Answer the question based on the provided information. Question 10', NULL, NULL,
        '{"inputMode":"group_audio","recording":true,"groupPreviewSeconds":45}'::jsonb, '{"toeicSpeakingQuestion":10}'::jsonb, 3, 30, NULL, NULL, 1, ARRAY[]::TEXT[], NULL);
    v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Speaking', 'Question 11', 'speaking_opinion', NULL, 1,
        'Some people prefer working from home, while others prefer working in an office. Which do you prefer and why?', NULL, NULL,
        '{"inputMode":"text","recording":true}'::jsonb, '{"toeicSpeakingQuestion":11}'::jsonb, 30, 60, NULL, NULL, 1, ARRAY[]::TEXT[], NULL);

    -- TOEIC Writing 8 câu
    FOR v_i IN 1..5 LOOP
        v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Writing', 'Question 1-5', 'writing_picture_sentence', NULL, v_i,
            'Write one sentence about the picture using the two words: "meeting" and "presentation". Question ' || v_i,
            '/uploads/exams/toeic/4skills/writing/picture_sentence_' || LPAD(v_i::TEXT,2,'0') || '.jpg', NULL,
            '{"inputMode":"picture_keywords","requiresImage":true,"requiredKeywords":2}'::jsonb, jsonb_build_object('toeicWritingQuestion', v_i, 'placeholderMedia', true), NULL, NULL, 480, NULL, 1, ARRAY[]::TEXT[], NULL);
    END LOOP;
    FOR v_i IN 1..2 LOOP
        v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Writing', 'Question 6-7', 'writing_email_response', NULL, v_i,
            'Respond to the email. Include all requested information. Email task ' || v_i || ': You received a request about changing a meeting schedule.', NULL, NULL,
            '{"inputMode":"email","sectionSeconds":1200}'::jsonb, jsonb_build_object('toeicWritingQuestion', v_i+5), NULL, NULL, 1200, NULL, 1, ARRAY[]::TEXT[], NULL);
    END LOOP;
    v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Writing', 'Question 8', 'writing_essay', NULL, 1,
        'Write an essay of at least 300 words: Do you agree or disagree that online meetings are as effective as in-person meetings?', NULL, NULL,
        '{"inputMode":"essay","sectionSeconds":1800,"minWords":300}'::jsonb, '{"toeicWritingQuestion":8}'::jsonb, NULL, NULL, 1800, 300, 1, ARRAY[]::TEXT[], NULL);

    -- =========================
    -- VSTEP 4 kỹ năng
    -- =========================
    -- Listening Part 1: 8 audio, 1 câu/audio
    FOR v_i IN 1..8 LOOP
        v_group_key := 'SEED_VSTEP_L1_G' || LPAD(v_i::TEXT, 2, '0');
        INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, media, display_config, metadata, order_number, created_by)
        VALUES (v_tenant_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 1', 'VSTEP Listening Part 1 Audio ' || v_i, v_group_key,
            'Short announcement/instruction transcript placeholder ' || v_i,
            jsonb_build_object('audio','/uploads/exams/vstep/listening/part1/audio_' || LPAD(v_i::TEXT,2,'0') || '.mp3'),
            '{"questionsPerGroup":1,"requiresAudio":true}'::jsonb, '{"seed":"full_exam_seed_v1","placeholderMedia":true}'::jsonb, v_i, v_admin_id)
        ON CONFLICT (tenant_id, group_key) DO UPDATE SET content=EXCLUDED.content, media=EXCLUDED.media, metadata=EXCLUDED.metadata, updated_at=NOW();
        v_correct := (v_labels4[((v_i - 1) % 4) + 1]);
        v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 1', 'group_choice', v_group_key, v_i,
            'What is the main purpose of the announcement? Question ' || v_i, NULL, '/uploads/exams/vstep/listening/part1/audio_' || LPAD(v_i::TEXT,2,'0') || '.mp3',
            '{"showQuestionText":true,"showOptionText":true,"requiresAudio":true}'::jsonb, jsonb_build_object('vstepPart', 'L1', 'placeholderMedia', true), NULL, NULL, 2400, NULL, 1, v_labels4, v_correct);
    END LOOP;

    -- Listening Part 2: 3 audio x 4 câu = 12
    v_seq := 1;
    FOR v_group_index IN 1..3 LOOP
        v_group_key := 'SEED_VSTEP_L2_G' || LPAD(v_group_index::TEXT, 2, '0');
        INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, media, display_config, metadata, order_number, created_by)
        VALUES (v_tenant_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 2', 'VSTEP Listening Part 2 Conversation ' || v_group_index, v_group_key,
            'Conversation transcript placeholder ' || v_group_index,
            jsonb_build_object('audio','/uploads/exams/vstep/listening/part2/conversation_' || LPAD(v_group_index::TEXT,2,'0') || '.mp3'),
            '{"questionsPerGroup":4,"requiresAudio":true}'::jsonb, '{"seed":"full_exam_seed_v1","placeholderMedia":true}'::jsonb, v_group_index, v_admin_id)
        ON CONFLICT (tenant_id, group_key) DO UPDATE SET content=EXCLUDED.content, media=EXCLUDED.media, metadata=EXCLUDED.metadata, updated_at=NOW();
        FOR v_j IN 1..4 LOOP
            v_correct := (v_labels4[((v_seq - 1) % 4) + 1]);
            v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 2', 'group_choice', v_group_key, v_seq,
                'Choose the correct answer based on the conversation. Question ' || v_seq, NULL, '/uploads/exams/vstep/listening/part2/conversation_' || LPAD(v_group_index::TEXT,2,'0') || '.mp3',
                '{"showQuestionText":true,"showOptionText":true,"requiresAudio":true}'::jsonb, jsonb_build_object('vstepPart', 'L2', 'groupNo', v_group_index, 'placeholderMedia', true), NULL, NULL, 2400, NULL, 1, v_labels4, v_correct);
            v_seq := v_seq + 1;
        END LOOP;
    END LOOP;

    -- Listening Part 3: 3 audio x 5 câu = 15
    v_seq := 1;
    FOR v_group_index IN 1..3 LOOP
        v_group_key := 'SEED_VSTEP_L3_G' || LPAD(v_group_index::TEXT, 2, '0');
        INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, media, display_config, metadata, order_number, created_by)
        VALUES (v_tenant_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 3', 'VSTEP Listening Part 3 Lecture ' || v_group_index, v_group_key,
            'Lecture/presentation transcript placeholder ' || v_group_index,
            jsonb_build_object('audio','/uploads/exams/vstep/listening/part3/lecture_' || LPAD(v_group_index::TEXT,2,'0') || '.mp3'),
            '{"questionsPerGroup":5,"requiresAudio":true}'::jsonb, '{"seed":"full_exam_seed_v1","placeholderMedia":true}'::jsonb, v_group_index, v_admin_id)
        ON CONFLICT (tenant_id, group_key) DO UPDATE SET content=EXCLUDED.content, media=EXCLUDED.media, metadata=EXCLUDED.metadata, updated_at=NOW();
        FOR v_j IN 1..5 LOOP
            v_correct := (v_labels4[((v_seq - 1) % 4) + 1]);
            v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 3', 'group_choice', v_group_key, v_seq,
                'Choose the correct answer based on the lecture. Question ' || v_seq, NULL, '/uploads/exams/vstep/listening/part3/lecture_' || LPAD(v_group_index::TEXT,2,'0') || '.mp3',
                '{"showQuestionText":true,"showOptionText":true,"requiresAudio":true}'::jsonb, jsonb_build_object('vstepPart', 'L3', 'groupNo', v_group_index, 'placeholderMedia', true), NULL, NULL, 2400, NULL, 1, v_labels4, v_correct);
            v_seq := v_seq + 1;
        END LOOP;
    END LOOP;

    -- Reading VSTEP: 4 passages x 10 = 40
    v_seq := 1;
    FOR v_group_index IN 1..4 LOOP
        v_group_key := 'SEED_VSTEP_R_G' || LPAD(v_group_index::TEXT, 2, '0');
        INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, display_config, metadata, order_number, created_by)
        VALUES (v_tenant_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Passage', 'VSTEP Reading Passage ' || v_group_index, v_group_key,
            'Academic/social passage placeholder ' || v_group_index,
            jsonb_build_array(jsonb_build_object('title','Reading Passage ' || v_group_index, 'content','This is a 500-word placeholder passage for VSTEP reading. Replace with real passage content later.')),
            '{"questionsPerGroup":10,"splitScreen":true,"richTextGroup":true}'::jsonb, '{"seed":"full_exam_seed_v1"}'::jsonb, v_group_index, v_admin_id)
        ON CONFLICT (tenant_id, group_key) DO UPDATE SET content=EXCLUDED.content, passages=EXCLUDED.passages, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();
        FOR v_j IN 1..10 LOOP
            v_correct := (v_labels4[((v_seq - 1) % 4) + 1]);
            v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Passage', 'group_choice', v_group_key, v_seq,
                'Choose the correct answer according to the passage. Question ' || v_seq, NULL, NULL,
                '{"showQuestionText":true,"showOptionText":true,"splitScreen":true}'::jsonb, jsonb_build_object('vstepPart', 'Reading', 'groupNo', v_group_index), NULL, NULL, 3600, NULL, 1, v_labels4, v_correct);
            v_seq := v_seq + 1;
        END LOOP;
    END LOOP;

    -- VSTEP Writing 2 tasks
    v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Writing', 'Writing Task 1', 'writing_email_letter', NULL, 1,
        'You received an email from a friend asking about your English course. Write a reply of at least 120 words.', NULL, NULL,
        '{"inputMode":"email_letter","sectionSeconds":1200,"minWords":120}'::jsonb, '{"vstepWritingTask":1,"scoreWeight":0.3333}'::jsonb, NULL, NULL, 1200, 120, 1, ARRAY[]::TEXT[], NULL);
    v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Writing', 'Writing Task 2', 'writing_essay', NULL, 1,
        'Write an essay of at least 250 words about the advantages and disadvantages of online learning.', NULL, NULL,
        '{"inputMode":"academic_social_essay","sectionSeconds":2400,"minWords":250}'::jsonb, '{"vstepWritingTask":2,"scoreWeight":0.6667}'::jsonb, NULL, NULL, 2400, 250, 1, ARRAY[]::TEXT[], NULL);

    -- VSTEP Speaking: Part 1 6 questions, Part 2, Part 3
    FOR v_i IN 1..6 LOOP
        v_group_key := CASE WHEN v_i <= 3 THEN 'SEED_VSTEP_S1_TOPIC_01' ELSE 'SEED_VSTEP_S1_TOPIC_02' END;
        INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, display_config, metadata, order_number, created_by)
        VALUES (v_tenant_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Speaking', 'Speaking Part 1', CASE WHEN v_i <= 3 THEN 'Topic 1: Study' ELSE 'Topic 2: Hobbies' END, v_group_key,
            CASE WHEN v_i <= 3 THEN 'Social interaction topic about study.' ELSE 'Social interaction topic about hobbies.' END,
            '{"questionsPerTopic":3,"responseMode":"continuous_recording"}'::jsonb, '{"seed":"full_exam_seed_v1"}'::jsonb, CASE WHEN v_i <= 3 THEN 1 ELSE 2 END, v_admin_id)
        ON CONFLICT (tenant_id, group_key) DO UPDATE SET content=EXCLUDED.content, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();
        v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Speaking', 'Speaking Part 1', 'speaking_social_interaction', v_group_key, v_i,
            'Answer this social interaction question. Question ' || v_i, NULL, NULL,
            '{"inputMode":"text_audio","responseMode":"continuous_recording"}'::jsonb, jsonb_build_object('vstepSpeakingPart', 1), NULL, NULL, 180, NULL, 1, ARRAY[]::TEXT[], NULL);
    END LOOP;
    v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Speaking', 'Speaking Part 2', 'speaking_solution_discussion', NULL, 1,
        'You need to choose one of three solutions for improving your English. Explain your choice.', NULL, NULL,
        '{"inputMode":"situation_solutions","prepSeconds":60,"responseSeconds":180}'::jsonb, '{"vstepSpeakingPart":2}'::jsonb, 60, 180, NULL, NULL, 1, ARRAY[]::TEXT[], NULL);
    v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Speaking', 'Speaking Part 3', 'speaking_topic_development', NULL, 1,
        'Develop the topic: The role of technology in education. Answer follow-up questions after your talk.', '/uploads/exams/vstep/speaking/part3/mindmap_01.jpg', NULL,
        '{"inputMode":"mindmap_followup","requiresImage":true,"prepSeconds":60,"responseSeconds":180,"followUpQuestionsMin":3,"followUpQuestionsMax":4}'::jsonb,
        '{"vstepSpeakingPart":3,"placeholderMedia":true}'::jsonb, 60, 180, NULL, NULL, 1, ARRAY[]::TEXT[], NULL);

    -- =========================
    -- Exam sets + questions mapping
    -- =========================
    INSERT INTO public.exam_sets (tenant_id, title, exam_type, format_code, description, duration_minutes, total_score, status, blueprint, settings, created_by)
    VALUES (v_tenant_id, 'Bộ đề TOEIC 2 kỹ năng Demo - Full 200 câu', 'TOEIC', 'TOEIC_LR', 'Bộ đề demo đủ Listening 100 + Reading 100. Audio/image dùng placeholder.', 120, 990, 'active', '[{"skill": "Listening", "part": "Part 1", "questionType": "single_choice", "count": 6, "options": ["A", "B", "C", "D"], "showQuestionText": false, "showOptionText": false, "requiresImage": true, "requiresAudio": true, "transitionSeconds": 2}, {"skill": "Listening", "part": "Part 2", "questionType": "audio_choice", "count": 25, "options": ["A", "B", "C"], "showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}, {"skill": "Listening", "part": "Part 3", "questionType": "group_choice", "count": 39, "questionsPerGroup": 3, "options": ["A", "B", "C", "D"], "showQuestionText": true, "showOptionText": true, "requiresAudio": true, "optionalImage": true, "transitionSeconds": 8}, {"skill": "Listening", "part": "Part 4", "questionType": "group_choice", "count": 30, "questionsPerGroup": 3, "options": ["A", "B", "C", "D"], "showQuestionText": true, "showOptionText": true, "requiresAudio": true, "optionalImage": true, "transitionSeconds": 8}, {"skill": "Reading", "part": "Part 5", "questionType": "single_choice", "count": 30, "options": ["A", "B", "C", "D"], "showQuestionText": true, "showOptionText": true}, {"skill": "Reading", "part": "Part 6", "questionType": "group_choice", "count": 16, "questionsPerGroup": 4, "options": ["A", "B", "C", "D"], "showQuestionText": true, "showOptionText": true, "richTextGroup": true}, {"skill": "Reading", "part": "Part 7", "questionType": "group_choice", "count": 54, "minQuestionsPerGroup": 2, "maxQuestionsPerGroup": 5, "options": ["A", "B", "C", "D"], "showQuestionText": true, "showOptionText": true, "splitScreen": true, "passagesMin": 1, "passagesMax": 3}]'::jsonb, '{"seed":"full_exam_seed_v1","placeholderMedia":true}'::jsonb, v_admin_id)
    RETURNING id INTO v_set_toeic_lr;
    v_order := 1;
    FOR v_qid IN SELECT id FROM public.exam_questions WHERE tenant_id=v_tenant_id AND format_code='TOEIC_LR' AND metadata ->> 'seed'='full_exam_seed_v1' ORDER BY CASE skill WHEN 'Listening' THEN 1 WHEN 'Reading' THEN 2 ELSE 3 END, part, sequence_no LOOP
        INSERT INTO public.exam_set_questions (tenant_id, exam_set_id, question_id, order_number, score, section, part, group_key)
        SELECT v_tenant_id, v_set_toeic_lr, id, v_order, score, skill, part, group_key FROM public.exam_questions WHERE id=v_qid;
        v_order := v_order + 1;
    END LOOP;

    INSERT INTO public.exam_sets (tenant_id, title, exam_type, format_code, description, duration_minutes, total_score, status, blueprint, settings, created_by)
    VALUES (v_tenant_id, 'Bộ đề TOEIC 4 kỹ năng Demo - Full 219 câu/task', 'TOEIC', 'TOEIC_4_SKILLS', 'Bộ đề demo đủ TOEIC LR + Speaking 11 + Writing 8. Audio/image dùng placeholder.', 200, 990, 'active', '[{"skill": "Listening", "part": "Part 1", "questionType": "single_choice", "count": 6, "options": ["A", "B", "C", "D"], "showQuestionText": false, "showOptionText": false, "requiresImage": true, "requiresAudio": true, "transitionSeconds": 2}, {"skill": "Listening", "part": "Part 2", "questionType": "audio_choice", "count": 25, "options": ["A", "B", "C"], "showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}, {"skill": "Listening", "part": "Part 3", "questionType": "group_choice", "count": 39, "questionsPerGroup": 3, "options": ["A", "B", "C", "D"], "showQuestionText": true, "showOptionText": true, "requiresAudio": true, "optionalImage": true, "transitionSeconds": 8}, {"skill": "Listening", "part": "Part 4", "questionType": "group_choice", "count": 30, "questionsPerGroup": 3, "options": ["A", "B", "C", "D"], "showQuestionText": true, "showOptionText": true, "requiresAudio": true, "optionalImage": true, "transitionSeconds": 8}, {"skill": "Reading", "part": "Part 5", "questionType": "single_choice", "count": 30, "options": ["A", "B", "C", "D"], "showQuestionText": true, "showOptionText": true}, {"skill": "Reading", "part": "Part 6", "questionType": "group_choice", "count": 16, "questionsPerGroup": 4, "options": ["A", "B", "C", "D"], "showQuestionText": true, "showOptionText": true, "richTextGroup": true}, {"skill": "Reading", "part": "Part 7", "questionType": "group_choice", "count": 54, "minQuestionsPerGroup": 2, "maxQuestionsPerGroup": 5, "options": ["A", "B", "C", "D"], "showQuestionText": true, "showOptionText": true, "splitScreen": true, "passagesMin": 1, "passagesMax": 3}, {"skill": "Speaking", "part": "Question 1-2", "questionType": "speaking_read_aloud", "count": 2, "prepSeconds": 45, "responseSeconds": 45, "inputMode": "text"}, {"skill": "Speaking", "part": "Question 3-4", "questionType": "speaking_describe_picture", "count": 2, "prepSeconds": 45, "responseSeconds": 30, "inputMode": "image"}, {"skill": "Speaking", "part": "Question 5-6", "questionType": "speaking_answer_question", "count": 2, "prepSeconds": 3, "responseSeconds": 15, "inputMode": "text_audio"}, {"skill": "Speaking", "part": "Question 7", "questionType": "speaking_answer_question", "count": 1, "prepSeconds": 3, "responseSeconds": 30, "inputMode": "text_audio"}, {"skill": "Speaking", "part": "Question 8-9", "questionType": "speaking_info_question", "count": 2, "prepSeconds": 3, "responseSeconds": 15, "groupPreviewSeconds": 45, "inputMode": "group_audio"}, {"skill": "Speaking", "part": "Question 10", "questionType": "speaking_info_question", "count": 1, "prepSeconds": 3, "responseSeconds": 30, "groupPreviewSeconds": 45, "inputMode": "group_audio"}, {"skill": "Speaking", "part": "Question 11", "questionType": "speaking_opinion", "count": 1, "prepSeconds": 30, "responseSeconds": 60, "inputMode": "text"}, {"skill": "Writing", "part": "Question 1-5", "questionType": "writing_picture_sentence", "count": 5, "sectionSeconds": 480, "inputMode": "picture_keywords", "requiresImage": true, "requiredKeywords": 2, "minSentences": 1, "score": 1}, {"skill": "Writing", "part": "Question 6-7", "questionType": "writing_email_response", "count": 2, "sectionSeconds": 1200, "inputMode": "email", "score": 1}, {"skill": "Writing", "part": "Question 8", "questionType": "writing_essay", "count": 1, "sectionSeconds": 1800, "minWords": 300, "inputMode": "essay", "score": 1}]'::jsonb, '{"seed":"full_exam_seed_v1","placeholderMedia":true}'::jsonb, v_admin_id)
    RETURNING id INTO v_set_toeic4;
    v_order := 1;
    FOR v_qid IN SELECT id FROM public.exam_questions WHERE tenant_id=v_tenant_id AND format_code='TOEIC_4_SKILLS' AND metadata ->> 'seed'='full_exam_seed_v1' ORDER BY CASE skill WHEN 'Listening' THEN 1 WHEN 'Reading' THEN 2 WHEN 'Speaking' THEN 3 WHEN 'Writing' THEN 4 ELSE 5 END, part, sequence_no LOOP
        INSERT INTO public.exam_set_questions (tenant_id, exam_set_id, question_id, order_number, score, section, part, group_key)
        SELECT v_tenant_id, v_set_toeic4, id, v_order, score, skill, part, group_key FROM public.exam_questions WHERE id=v_qid;
        v_order := v_order + 1;
    END LOOP;

    INSERT INTO public.exam_sets (tenant_id, title, exam_type, format_code, description, duration_minutes, total_score, status, blueprint, settings, created_by)
    VALUES (v_tenant_id, 'Bộ đề VSTEP 4 kỹ năng Demo', 'VSTEP', 'VSTEP_4_SKILLS', 'Bộ đề demo đủ VSTEP Listening 35, Reading 40, Writing 2, Speaking 8 task/câu. Audio/image dùng placeholder.', 172, 10, 'active', '[{"skill": "Listening", "part": "Listening Part 1", "questionType": "group_choice", "count": 8, "questionsPerGroup": 1, "options": ["A", "B", "C", "D"], "showQuestionText": true, "showOptionText": true, "requiresAudio": true, "groupAudio": true, "audioDurationHint": "15-20s", "sectionSeconds": 2400}, {"skill": "Listening", "part": "Listening Part 2", "questionType": "group_choice", "count": 12, "questionsPerGroup": 4, "options": ["A", "B", "C", "D"], "showQuestionText": true, "showOptionText": true, "requiresAudio": true, "groupAudio": true, "audioDurationHint": "1-3 phút", "sectionSeconds": 2400}, {"skill": "Listening", "part": "Listening Part 3", "questionType": "group_choice", "count": 15, "questionsPerGroup": 5, "options": ["A", "B", "C", "D"], "showQuestionText": true, "showOptionText": true, "requiresAudio": true, "groupAudio": true, "audioDurationHint": "khoảng 3 phút", "sectionSeconds": 2400}, {"skill": "Reading", "part": "Reading Passage", "questionType": "group_choice", "count": 40, "questionsPerGroup": 10, "options": ["A", "B", "C", "D"], "showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true, "passagesMin": 1, "passagesMax": 1, "passageWordsHint": 500, "sectionSeconds": 3600}, {"skill": "Writing", "part": "Writing Task 1", "questionType": "writing_email_letter", "count": 1, "sectionSeconds": 1200, "minWords": 120, "inputMode": "email_letter", "scoreWeight": 0.3333333333333333}, {"skill": "Writing", "part": "Writing Task 2", "questionType": "writing_essay", "count": 1, "sectionSeconds": 2400, "minWords": 250, "inputMode": "academic_social_essay", "scoreWeight": 0.6666666666666666}, {"skill": "Speaking", "part": "Speaking Part 1", "questionType": "speaking_social_interaction", "count": 6, "topics": 2, "questionsPerTopic": 3, "inputMode": "text_audio", "responseMode": "continuous_recording", "sectionSeconds": 180}, {"skill": "Speaking", "part": "Speaking Part 2", "questionType": "speaking_solution_discussion", "count": 1, "prepSeconds": 60, "responseSeconds": 180, "inputMode": "situation_solutions"}, {"skill": "Speaking", "part": "Speaking Part 3", "questionType": "speaking_topic_development", "count": 1, "prepSeconds": 60, "responseSeconds": 180, "inputMode": "mindmap_followup", "requiresImage": true, "followUpQuestionsMin": 3, "followUpQuestionsMax": 4}]'::jsonb, '{"seed":"full_exam_seed_v1","placeholderMedia":true,"oneWayNavigation":true}'::jsonb, v_admin_id)
    RETURNING id INTO v_set_vstep;
    v_order := 1;
    FOR v_qid IN SELECT id FROM public.exam_questions WHERE tenant_id=v_tenant_id AND format_code='VSTEP_4_SKILLS' AND metadata ->> 'seed'='full_exam_seed_v1' ORDER BY CASE skill WHEN 'Listening' THEN 1 WHEN 'Reading' THEN 2 WHEN 'Writing' THEN 3 WHEN 'Speaking' THEN 4 ELSE 5 END, part, sequence_no LOOP
        INSERT INTO public.exam_set_questions (tenant_id, exam_set_id, question_id, order_number, score, section, part, group_key)
        SELECT v_tenant_id, v_set_vstep, id, v_order, score, skill, part, group_key FROM public.exam_questions WHERE id=v_qid;
        v_order := v_order + 1;
    END LOOP;

    -- Mock exams active để học viên test giao diện làm bài
    INSERT INTO public.mock_exams (tenant_id, exam_set_id, class_id, title, start_time, end_time, duration_minutes, attempt_limit, show_result, status, note, created_by)
    VALUES (v_tenant_id, v_set_toeic_lr, v_class_toeic, 'Kỳ thi thử TOEIC 2 kỹ năng Demo', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '14 days', 120, 1, TRUE, 'active', 'full_exam_seed_v1 - kỳ thi demo TOEIC LR', v_admin_id)
    RETURNING id INTO v_mock_toeic;
    INSERT INTO public.mock_exam_students (tenant_id, mock_exam_id, student_id, status)
    VALUES (v_tenant_id, v_mock_toeic, v_student_1, 'assigned'), (v_tenant_id, v_mock_toeic, v_student_2, 'assigned')
    ON CONFLICT DO NOTHING;

    INSERT INTO public.mock_exams (tenant_id, exam_set_id, class_id, title, start_time, end_time, duration_minutes, attempt_limit, show_result, status, note, created_by)
    VALUES (v_tenant_id, v_set_vstep, v_class_vstep, 'Kỳ thi thử VSTEP 4 kỹ năng Demo', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '14 days', 172, 1, TRUE, 'active', 'full_exam_seed_v1 - kỳ thi demo VSTEP', v_admin_id)
    RETURNING id INTO v_mock_vstep;
    INSERT INTO public.mock_exam_students (tenant_id, mock_exam_id, student_id, status)
    VALUES (v_tenant_id, v_mock_vstep, v_student_3, 'assigned'), (v_tenant_id, v_mock_vstep, v_student_4, 'assigned')
    ON CONFLICT DO NOTHING;
END $$;

DROP FUNCTION IF EXISTS public.__seed_exam_question(
    INTEGER, INTEGER, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, INTEGER, TEXT, TEXT, TEXT, JSONB, JSONB, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC, TEXT[], TEXT
);

COMMIT;
