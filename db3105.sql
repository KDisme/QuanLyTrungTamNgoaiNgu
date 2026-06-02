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
    -- VSTEP Listening: mỗi Part dùng 1 audio chung, không chia audio theo từng câu/nhóm nhỏ
    -- Listening Part 1: 1 audio chung + 8 câu
    v_group_key := 'SEED_VSTEP_L1_PART_AUDIO';
    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 1', 'VSTEP Listening Part 1 - Part Audio', v_group_key,
        'Part 1 transcript placeholder. Replace with one full audio transcript for the whole part.',
        jsonb_build_object('audio','/uploads/exams/vstep/listening/part1/part_01_full.mp3'),
        '{"questionsPerPart":8,"audioScope":"part","requiresAudio":true}'::jsonb, '{"seed":"full_exam_seed_v1","placeholderMedia":true,"audioScope":"part"}'::jsonb, 1, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET content=EXCLUDED.content, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();
    FOR v_i IN 1..8 LOOP
        v_correct := (v_labels4[((v_i - 1) % 4) + 1]);
        v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 1', 'group_choice', v_group_key, v_i,
            'What is the main purpose of the announcement? Question ' || v_i, NULL, '/uploads/exams/vstep/listening/part1/part_01_full.mp3',
            '{"showQuestionText":true,"showOptionText":true,"requiresAudio":true,"audioScope":"part"}'::jsonb, jsonb_build_object('vstepPart', 'L1', 'placeholderMedia', true, 'audioScope', 'part'), NULL, NULL, 2400, NULL, 1, v_labels4, v_correct);
    END LOOP;

    -- Listening Part 2: 1 audio chung + 12 câu
    v_group_key := 'SEED_VSTEP_L2_PART_AUDIO';
    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 2', 'VSTEP Listening Part 2 - Part Audio', v_group_key,
        'Part 2 conversation transcript placeholder. Replace with one full audio transcript for the whole part.',
        jsonb_build_object('audio','/uploads/exams/vstep/listening/part2/part_02_full.mp3'),
        '{"questionsPerPart":12,"audioScope":"part","requiresAudio":true}'::jsonb, '{"seed":"full_exam_seed_v1","placeholderMedia":true,"audioScope":"part"}'::jsonb, 2, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET content=EXCLUDED.content, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();
    FOR v_i IN 1..12 LOOP
        v_correct := (v_labels4[((v_i - 1) % 4) + 1]);
        v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 2', 'group_choice', v_group_key, v_i,
            'Choose the correct answer based on Listening Part 2. Question ' || v_i, NULL, '/uploads/exams/vstep/listening/part2/part_02_full.mp3',
            '{"showQuestionText":true,"showOptionText":true,"requiresAudio":true,"audioScope":"part"}'::jsonb, jsonb_build_object('vstepPart', 'L2', 'placeholderMedia', true, 'audioScope', 'part'), NULL, NULL, 2400, NULL, 1, v_labels4, v_correct);
    END LOOP;

    -- Listening Part 3: 1 audio chung + 15 câu
    v_group_key := 'SEED_VSTEP_L3_PART_AUDIO';
    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 3', 'VSTEP Listening Part 3 - Part Audio', v_group_key,
        'Part 3 lecture/presentation transcript placeholder. Replace with one full audio transcript for the whole part.',
        jsonb_build_object('audio','/uploads/exams/vstep/listening/part3/part_03_full.mp3'),
        '{"questionsPerPart":15,"audioScope":"part","requiresAudio":true}'::jsonb, '{"seed":"full_exam_seed_v1","placeholderMedia":true,"audioScope":"part"}'::jsonb, 3, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET content=EXCLUDED.content, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();
    FOR v_i IN 1..15 LOOP
        v_correct := (v_labels4[((v_i - 1) % 4) + 1]);
        v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 3', 'group_choice', v_group_key, v_i,
            'Choose the correct answer based on Listening Part 3. Question ' || v_i, NULL, '/uploads/exams/vstep/listening/part3/part_03_full.mp3',
            '{"showQuestionText":true,"showOptionText":true,"requiresAudio":true,"audioScope":"part"}'::jsonb, jsonb_build_object('vstepPart', 'L3', 'placeholderMedia', true, 'audioScope', 'part'), NULL, NULL, 2400, NULL, 1, v_labels4, v_correct);
    END LOOP;

    -- Reading VSTEP: 4 passages x 10 = 40
    v_seq := 1;
    FOR v_group_index IN 1..4 LOOP
        v_group_key := 'SEED_VSTEP_R_G' || LPAD(v_group_index::TEXT, 2, '0');
        INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, display_config, metadata, order_number, created_by)
        VALUES (v_tenant_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part ' || v_group_index, 'VSTEP Reading Part ' || v_group_index, v_group_key,
            'Academic/social passage placeholder ' || v_group_index,
            jsonb_build_array(jsonb_build_object('title','Reading Part ' || v_group_index, 'content','This is a 500-word placeholder passage for VSTEP reading. Replace with real passage content later.')),
            '{"questionsPerGroup":10,"splitScreen":true,"richTextGroup":true}'::jsonb, '{"seed":"full_exam_seed_v1"}'::jsonb, v_group_index, v_admin_id)
        ON CONFLICT (tenant_id, group_key) DO UPDATE SET content=EXCLUDED.content, passages=EXCLUDED.passages, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();
        FOR v_j IN 1..10 LOOP
            v_correct := (v_labels4[((v_seq - 1) % 4) + 1]);
            v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part ' || v_group_index, 'group_choice', v_group_key, v_seq,
                'Choose the correct answer according to the passage. Question ' || v_seq, NULL, NULL,
                '{"showQuestionText":true,"showOptionText":true,"splitScreen":true}'::jsonb, jsonb_build_object('vstepPart', 'Reading', 'readingPart', v_group_index, 'groupNo', v_group_index), NULL, NULL, 3600, NULL, 1, v_labels4, v_correct);
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

    -- VSTEP Speaking: 3 task chính. Part 1 là 1 task ghi âm liên tục, nội dung chứa 2 chủ đề x 3 câu.
    v_group_key := 'SEED_VSTEP_SPEAKING_PART_1';
    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Speaking', 'Speaking Part 1', 'Part 1 - Social Interaction', v_group_key,
        'Topic 1: Study
1. What subject do you like most?
2. How do you usually study English?
3. Do you prefer studying alone or with friends?

Topic 2: Hobbies
1. What do you often do in your free time?
2. Why do you enjoy that activity?
3. Would you like to try a new hobby in the future?',
        '{"topics":2,"questionsPerTopic":3,"responseMode":"continuous_recording","sectionSeconds":180}'::jsonb,
        '{"seed":"full_exam_seed_v1"}'::jsonb, 1, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET content=EXCLUDED.content, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();
    v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Speaking', 'Speaking Part 1', 'speaking_social_interaction', v_group_key, 1,
        'Answer all questions in the two topics. You have 3 minutes.', NULL, NULL,
        '{"inputMode":"text_audio","responseMode":"continuous_recording","sectionSeconds":180}'::jsonb, jsonb_build_object('vstepSpeakingPart', 1), NULL, NULL, 180, NULL, 1, ARRAY[]::TEXT[], NULL);

    v_group_key := 'SEED_VSTEP_SPEAKING_PART_2';
    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Speaking', 'Speaking Part 2', 'Part 2 - Solution Discussion', v_group_key,
        'Situation: You want to improve your English. Choose the best solution and explain your choice.
Option 1: Join an English club.
Option 2: Take an online course.
Option 3: Study with a private tutor.',
        '{"inputMode":"situation_solutions","prepSeconds":60,"responseSeconds":180,"totalSeconds":240}'::jsonb,
        '{"seed":"full_exam_seed_v1"}'::jsonb, 2, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET content=EXCLUDED.content, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();
    v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Speaking', 'Speaking Part 2', 'speaking_solution_discussion', v_group_key, 1,
        'Choose one solution and explain why it is the best.', NULL, NULL,
        '{"inputMode":"situation_solutions","prepSeconds":60,"responseSeconds":180,"totalSeconds":240}'::jsonb, '{"vstepSpeakingPart":2}'::jsonb, 60, 180, NULL, NULL, 1, ARRAY[]::TEXT[], NULL);

    v_group_key := 'SEED_VSTEP_SPEAKING_PART_3';
    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Speaking', 'Speaking Part 3', 'Part 3 - Topic Development', v_group_key,
        'Topic: The role of technology in education.
Idea 1: flexible learning
Idea 2: access to information
Idea 3: communication

Follow-up questions:
1. How has technology changed the way students learn?
2. What are the disadvantages of using technology too much?
3. Should schools invest more in educational technology?',
        '{"inputMode":"mindmap_followup","requiresImage":true,"prepSeconds":60,"responseSeconds":240,"totalSeconds":300,"followUpQuestionsMin":3,"followUpQuestionsMax":4}'::jsonb,
        '{"seed":"full_exam_seed_v1","placeholderMedia":true}'::jsonb, 3, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET content=EXCLUDED.content, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();
    v_qid := public.__seed_exam_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Speaking', 'Speaking Part 3', 'speaking_topic_development', v_group_key, 1,
        'Develop the topic and answer the follow-up questions.', '/uploads/exams/vstep/speaking/part3/mindmap_01.jpg', NULL,
        '{"inputMode":"mindmap_followup","requiresImage":true,"prepSeconds":60,"responseSeconds":240,"totalSeconds":300,"followUpQuestionsMin":3,"followUpQuestionsMax":4}'::jsonb,
        '{"vstepSpeakingPart":3,"placeholderMedia":true}'::jsonb, 60, 240, NULL, NULL, 1, ARRAY[]::TEXT[], NULL);

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
    VALUES (v_tenant_id, 'Bộ đề VSTEP 4 kỹ năng Demo', 'VSTEP', 'VSTEP_4_SKILLS', 'Bộ đề demo đủ VSTEP Listening 35, Reading 40, Writing 2, Speaking 3 task. Audio/image dùng placeholder.', 179, 10, 'active', '[{"skill": "Listening", "part": "Listening Part 1", "questionType": "group_choice", "count": 8, "questionsPerPart": 8, "audioScope": "part", "options": ["A", "B", "C", "D"], "showQuestionText": true, "showOptionText": true, "requiresAudio": true, "partAudio": true, "audioDurationHint": "một audio chung cho cả Part 1", "sectionSeconds": 2400}, {"skill": "Listening", "part": "Listening Part 2", "questionType": "group_choice", "count": 12, "questionsPerPart": 12, "audioScope": "part", "options": ["A", "B", "C", "D"], "showQuestionText": true, "showOptionText": true, "requiresAudio": true, "partAudio": true, "audioDurationHint": "một audio chung cho cả Part 2", "sectionSeconds": 2400}, {"skill": "Listening", "part": "Listening Part 3", "questionType": "group_choice", "count": 15, "questionsPerPart": 15, "audioScope": "part", "options": ["A", "B", "C", "D"], "showQuestionText": true, "showOptionText": true, "requiresAudio": true, "partAudio": true, "audioDurationHint": "một audio chung cho cả Part 3", "sectionSeconds": 2400}, {"skill": "Reading", "part": "Reading Part 1", "questionType": "group_choice", "count": 10, "questionsPerGroup": 10, "readingScope": "part", "options": ["A", "B", "C", "D"], "showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true, "passagesMin": 1, "passagesMax": 1, "passageWordsHint": 500, "sectionSeconds": 3600}, {"skill": "Reading", "part": "Reading Part 2", "questionType": "group_choice", "count": 10, "questionsPerGroup": 10, "readingScope": "part", "options": ["A", "B", "C", "D"], "showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true, "passagesMin": 1, "passagesMax": 1, "passageWordsHint": 500, "sectionSeconds": 3600}, {"skill": "Reading", "part": "Reading Part 3", "questionType": "group_choice", "count": 10, "questionsPerGroup": 10, "readingScope": "part", "options": ["A", "B", "C", "D"], "showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true, "passagesMin": 1, "passagesMax": 1, "passageWordsHint": 500, "sectionSeconds": 3600}, {"skill": "Reading", "part": "Reading Part 4", "questionType": "group_choice", "count": 10, "questionsPerGroup": 10, "readingScope": "part", "options": ["A", "B", "C", "D"], "showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true, "passagesMin": 1, "passagesMax": 1, "passageWordsHint": 500, "sectionSeconds": 3600}, {"skill": "Writing", "part": "Writing Task 1", "questionType": "writing_email_letter", "count": 1, "sectionSeconds": 1200, "minWords": 120, "inputMode": "email_letter", "scoreWeight": 0.3333333333333333}, {"skill": "Writing", "part": "Writing Task 2", "questionType": "writing_essay", "count": 1, "sectionSeconds": 2400, "minWords": 250, "inputMode": "academic_social_essay", "scoreWeight": 0.6666666666666666}, {"skill": "Speaking", "part": "Speaking Part 1", "questionType": "speaking_social_interaction", "count": 1, "topics": 2, "questionsPerTopic": 3, "inputMode": "text_audio", "responseMode": "continuous_recording", "sectionSeconds": 180}, {"skill": "Speaking", "part": "Speaking Part 2", "questionType": "speaking_solution_discussion", "count": 1, "prepSeconds": 60, "responseSeconds": 180, "totalSeconds": 240, "inputMode": "situation_solutions"}, {"skill": "Speaking", "part": "Speaking Part 3", "questionType": "speaking_topic_development", "count": 1, "prepSeconds": 60, "responseSeconds": 240, "totalSeconds": 300, "inputMode": "mindmap_followup", "requiresImage": true, "followUpQuestionsMin": 3, "followUpQuestionsMax": 4}]'::jsonb, '{"seed":"full_exam_seed_v1","placeholderMedia":true,"oneWayNavigation":true}'::jsonb, v_admin_id)
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
    VALUES (v_tenant_id, v_set_vstep, v_class_vstep, 'Kỳ thi thử VSTEP 4 kỹ năng Demo', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '14 days', 179, 1, TRUE, 'active', 'full_exam_seed_v1 - kỳ thi demo VSTEP', v_admin_id)
    RETURNING id INTO v_mock_vstep;
    INSERT INTO public.mock_exam_students (tenant_id, mock_exam_id, student_id, status)
    VALUES (v_tenant_id, v_mock_vstep, v_student_3, 'assigned'), (v_tenant_id, v_mock_vstep, v_student_4, 'assigned')
    ON CONFLICT DO NOTHING;
END $$;

DROP FUNCTION IF EXISTS public.__seed_exam_question(
    INTEGER, INTEGER, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, INTEGER, TEXT, TEXT, TEXT, JSONB, JSONB, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC, TEXT[], TEXT
);

COMMIT;


-- =========================================================
-- REALISTIC EXAM QUESTION BANK SEED - TOEIC / VSTEP
-- Generated for db3105 schema
-- Lưu ý: Đây là câu hỏi luyện thi tự biên soạn, mô phỏng format TOEIC/VSTEP, không chép nguyên văn đề thi có bản quyền.
-- Audio và hình ảnh dùng đường dẫn placeholder; bạn import file thật sau.
-- Safe to re-run: xóa seed demo cũ full_exam_seed_v1 và seed mới real_question_seed_v2 trước khi insert.
-- =========================================================

BEGIN;

DELETE FROM public.mock_exams WHERE note LIKE '%full_exam_seed_v1%' OR note LIKE '%real_question_seed_v2%';
DELETE FROM public.exam_sets WHERE settings ->> 'seed' IN ('full_exam_seed_v1','real_question_seed_v2');
DELETE FROM public.exam_questions WHERE metadata ->> 'seed' IN ('full_exam_seed_v1','real_question_seed_v2');
DELETE FROM public.exam_question_groups WHERE metadata ->> 'seed' IN ('full_exam_seed_v1','real_question_seed_v2');

CREATE OR REPLACE FUNCTION public.__seed_real_question(
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
    p_max_words INTEGER,
    p_score NUMERIC,
    p_topic TEXT,
    p_explanation TEXT,
    p_options JSONB,
    p_correct_label TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_question_id INTEGER;
    v_opt JSONB;
BEGIN
    INSERT INTO public.exam_questions (
        tenant_id, exam_type, format_code, skill, part, question_type, group_key, sequence_no,
        question_group, question_text, image_url, audio_url, media, display_config, metadata,
        prep_seconds, response_seconds, section_seconds, min_words, max_words, difficulty, topic,
        explanation, score, status, created_by
    ) VALUES (
        p_tenant_id, p_exam_type, p_format_code, p_skill, p_part, p_question_type, p_group_key, p_sequence_no,
        p_group_key, p_question_text, p_image_url, p_audio_url,
        jsonb_strip_nulls(jsonb_build_object('image', p_image_url, 'audio', p_audio_url)),
        COALESCE(p_display_config, '{}'::jsonb),
        COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('seed', 'real_question_seed_v2', 'originalPracticeItem', true),
        p_prep_seconds, p_response_seconds, p_section_seconds, p_min_words, p_max_words,
        CASE WHEN p_sequence_no % 5 = 0 THEN 'hard' WHEN p_sequence_no % 3 = 0 THEN 'easy' ELSE 'medium' END,
        p_topic,
        p_explanation,
        COALESCE(p_score, 1), 'active', p_created_by
    ) RETURNING id INTO v_question_id;

    IF p_options IS NOT NULL AND jsonb_typeof(p_options) = 'array' AND jsonb_array_length(p_options) > 0 THEN
        FOR v_opt IN SELECT * FROM jsonb_array_elements(p_options) LOOP
            INSERT INTO public.exam_question_options (question_id, option_label, option_text, is_correct)
            VALUES (v_question_id, v_opt ->> 'label', v_opt ->> 'text', (v_opt ->> 'label') = p_correct_label);
        END LOOP;
    END IF;
    RETURN v_question_id;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    v_tenant_id INTEGER;
    v_admin_id INTEGER;
    v_class_toeic INTEGER;
    v_class_vstep INTEGER;
    v_set_toeic_lr INTEGER;
    v_set_toeic4 INTEGER;
    v_set_vstep INTEGER;
    v_mock_toeic INTEGER;
    v_mock_vstep INTEGER;
    v_qid INTEGER;
    v_order INTEGER;
    v_student_1 INTEGER;
    v_student_2 INTEGER;
    v_student_3 INTEGER;
    v_student_4 INTEGER;
BEGIN
    SELECT id INTO v_tenant_id FROM public.tenants ORDER BY id LIMIT 1;
    IF v_tenant_id IS NULL THEN
        INSERT INTO public.tenants(name, slug, email, phone, address, description)
        VALUES ('Trung tâm Ngoại ngữ Demo', 'demo-center', 'demo@center.local', '0900000000', 'Demo address', 'Seed tenant')
        RETURNING id INTO v_tenant_id;
    END IF;

    SELECT u.id INTO v_admin_id
    FROM public.users u JOIN public.roles r ON r.user_id=u.id AND r.tenant_id=u.tenant_id
    WHERE u.tenant_id=v_tenant_id AND r.role_type='admin'
    ORDER BY u.id LIMIT 1;
    IF v_admin_id IS NULL THEN
        INSERT INTO public.users(tenant_id, full_name, email, password_hash, is_active)
        VALUES (v_tenant_id, 'Admin Demo', 'admin.demo.local@example.com', '$2b$10$demo', TRUE)
        RETURNING id INTO v_admin_id;
        INSERT INTO public.roles(tenant_id, user_id, role_type) VALUES (v_tenant_id, v_admin_id, 'admin') ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO v_class_toeic FROM public.classes WHERE tenant_id=v_tenant_id ORDER BY id LIMIT 1;
    SELECT id INTO v_class_vstep FROM public.classes WHERE tenant_id=v_tenant_id ORDER BY id DESC LIMIT 1;
    SELECT u.id INTO v_student_1 FROM public.users u JOIN public.roles r ON r.user_id=u.id AND r.tenant_id=u.tenant_id WHERE u.tenant_id=v_tenant_id AND r.role_type='student' ORDER BY u.id LIMIT 1;
    SELECT u.id INTO v_student_2 FROM public.users u JOIN public.roles r ON r.user_id=u.id AND r.tenant_id=u.tenant_id WHERE u.tenant_id=v_tenant_id AND r.role_type='student' ORDER BY u.id OFFSET 1 LIMIT 1;
    SELECT u.id INTO v_student_3 FROM public.users u JOIN public.roles r ON r.user_id=u.id AND r.tenant_id=u.tenant_id WHERE u.tenant_id=v_tenant_id AND r.role_type='student' ORDER BY u.id OFFSET 2 LIMIT 1;
    SELECT u.id INTO v_student_4 FROM public.users u JOIN public.roles r ON r.user_id=u.id AND r.tenant_id=u.tenant_id WHERE u.tenant_id=v_tenant_id AND r.role_type='student' ORDER BY u.id OFFSET 3 LIMIT 1;


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 1', 'single_choice', NULL, 1,
        'Listen and choose the statement that best describes the picture.', '/uploads/exams/toeic/lr/part1/picture_01.jpg', '/uploads/exams/toeic/lr/part1/audio_01.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresImage": true, "requiresAudio": true, "transitionSeconds": 2}'::jsonb, '{"toeicPart": 1, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 1', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A man is adjusting a projector in a meeting room."}, {"label": "B", "text": "A woman is watering plants by a window."}, {"label": "C", "text": "Several people are boarding a bus."}, {"label": "D", "text": "Boxes are being stacked in a warehouse."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 1', 'single_choice', NULL, 2,
        'Listen and choose the statement that best describes the picture.', '/uploads/exams/toeic/lr/part1/picture_02.jpg', '/uploads/exams/toeic/lr/part1/audio_02.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresImage": true, "requiresAudio": true, "transitionSeconds": 2}'::jsonb, '{"toeicPart": 1, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 1', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The table is being cleaned."}, {"label": "B", "text": "Some chairs have been arranged around a conference table."}, {"label": "C", "text": "A meal is being served outdoors."}, {"label": "D", "text": "The curtains are being replaced."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 1', 'single_choice', NULL, 3,
        'Listen and choose the statement that best describes the picture.', '/uploads/exams/toeic/lr/part1/picture_03.jpg', '/uploads/exams/toeic/lr/part1/audio_03.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresImage": true, "requiresAudio": true, "transitionSeconds": 2}'::jsonb, '{"toeicPart": 1, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 1', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A woman is placing documents into a folder."}, {"label": "B", "text": "A woman is painting a wall."}, {"label": "C", "text": "People are crossing a bridge."}, {"label": "D", "text": "The folder is lying on the floor."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 1', 'single_choice', NULL, 4,
        'Listen and choose the statement that best describes the picture.', '/uploads/exams/toeic/lr/part1/picture_04.jpg', '/uploads/exams/toeic/lr/part1/audio_04.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresImage": true, "requiresAudio": true, "transitionSeconds": 2}'::jsonb, '{"toeicPart": 1, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 1', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The packages are being opened."}, {"label": "B", "text": "A delivery worker is pushing a cart loaded with packages."}, {"label": "C", "text": "A customer is signing a contract."}, {"label": "D", "text": "The cart has been left empty."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 1', 'single_choice', NULL, 5,
        'Listen and choose the statement that best describes the picture.', '/uploads/exams/toeic/lr/part1/picture_05.jpg', '/uploads/exams/toeic/lr/part1/audio_05.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresImage": true, "requiresAudio": true, "transitionSeconds": 2}'::jsonb, '{"toeicPart": 1, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 1', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Two people are reviewing information on a laptop."}, {"label": "B", "text": "Two people are fixing a bicycle."}, {"label": "C", "text": "A laptop is being packed into a suitcase."}, {"label": "D", "text": "A screen has been turned off."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 1', 'single_choice', NULL, 6,
        'Listen and choose the statement that best describes the picture.', '/uploads/exams/toeic/lr/part1/picture_06.jpg', '/uploads/exams/toeic/lr/part1/audio_06.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresImage": true, "requiresAudio": true, "transitionSeconds": 2}'::jsonb, '{"toeicPart": 1, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 1', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The shelf is being moved across the room."}, {"label": "B", "text": "A display shelf is filled with office supplies."}, {"label": "C", "text": "The supplies are scattered on the ground."}, {"label": "D", "text": "A customer is paying at the counter."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 1,
        'When will the budget meeting begin?', NULL, '/uploads/exams/toeic/lr/part2/audio_01.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "In the main conference room."}, {"label": "B", "text": "At half past nine."}, {"label": "C", "text": "Yes, it was approved yesterday."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 2,
        'Who is responsible for ordering the new laptops?', NULL, '/uploads/exams/toeic/lr/part2/audio_02.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Maria from purchasing."}, {"label": "B", "text": "They were delivered this morning."}, {"label": "C", "text": "No, I have not read it yet."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 3,
        'Could you send me the revised contract?', NULL, '/uploads/exams/toeic/lr/part2/audio_03.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The client signed it last week."}, {"label": "B", "text": "Sure, I will email it after lunch."}, {"label": "C", "text": "It is near the elevator."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 4,
        'Why was the training session postponed?', NULL, '/uploads/exams/toeic/lr/part2/audio_04.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Because the trainer had a flight delay."}, {"label": "B", "text": "For about two hours."}, {"label": "C", "text": "In the employee handbook."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 5,
        'Have you finished preparing the sales report?', NULL, '/uploads/exams/toeic/lr/part2/audio_05.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "It increased by 12 percent."}, {"label": "B", "text": "Almost. I just need to check the figures."}, {"label": "C", "text": "The printer is in the hallway."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 6,
        'Where should visitors pick up their badges?', NULL, '/uploads/exams/toeic/lr/part2/audio_06.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "At the reception desk."}, {"label": "B", "text": "They arrived by taxi."}, {"label": "C", "text": "Yes, the badges are blue."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 7,
        'How often do you update the inventory list?', NULL, '/uploads/exams/toeic/lr/part2/audio_07.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Every Friday afternoon."}, {"label": "B", "text": "The list is on the server."}, {"label": "C", "text": "About fifty items are missing."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 8,
        'Would you like me to reserve a table for lunch?', NULL, '/uploads/exams/toeic/lr/part2/audio_08.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The table is made of glass."}, {"label": "B", "text": "Yes, for four people, please."}, {"label": "C", "text": "Lunch was delicious."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 9,
        'Is the customer survey available online?', NULL, '/uploads/exams/toeic/lr/part2/audio_09.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Yes, there is a link on our website."}, {"label": "B", "text": "About customer satisfaction."}, {"label": "C", "text": "The survey took ten minutes."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 10,
        'Which entrance should contractors use?', NULL, '/uploads/exams/toeic/lr/part2/audio_10.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "They signed a six-month contract."}, {"label": "B", "text": "Use the east entrance near the loading area."}, {"label": "C", "text": "The entrance fee is included."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 11,
        'Do you know if the shipment has arrived?', NULL, '/uploads/exams/toeic/lr/part2/audio_11.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "It should arrive by three o’clock."}, {"label": "B", "text": "The ship is at the harbor."}, {"label": "C", "text": "No, the meeting has not started."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 12,
        'Can I borrow your charger for a few minutes?', NULL, '/uploads/exams/toeic/lr/part2/audio_12.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The battery lasts eight hours."}, {"label": "B", "text": "Of course, it is in my bag."}, {"label": "C", "text": "I charged the client already."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 13,
        'What did the manager say about overtime?', NULL, '/uploads/exams/toeic/lr/part2/audio_13.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "She said it must be approved in advance."}, {"label": "B", "text": "The office closes at six."}, {"label": "C", "text": "Over time, sales improved."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 14,
        'How many copies of the agenda do we need?', NULL, '/uploads/exams/toeic/lr/part2/audio_14.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The copier is being repaired."}, {"label": "B", "text": "Twenty-five should be enough."}, {"label": "C", "text": "It is on the first page."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 15,
        'Why don’t we test the new software today?', NULL, '/uploads/exams/toeic/lr/part2/audio_15.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Good idea; the test server is available."}, {"label": "B", "text": "Because software is expensive."}, {"label": "C", "text": "The new office is downtown."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 16,
        'Who approved the marketing budget?', NULL, '/uploads/exams/toeic/lr/part2/audio_16.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The finance director did."}, {"label": "B", "text": "It was a successful campaign."}, {"label": "C", "text": "The budget is due tomorrow."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 17,
        'Could you show me how to access the shared folder?', NULL, '/uploads/exams/toeic/lr/part2/audio_17.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "It is shared with all staff."}, {"label": "B", "text": "Sure, log in and click this icon."}, {"label": "C", "text": "The folder is blue."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 18,
        'When are the quarterly results usually published?', NULL, '/uploads/exams/toeic/lr/part2/audio_18.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "At the end of each quarter."}, {"label": "B", "text": "The results were excellent."}, {"label": "C", "text": "By the accounting team."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 19,
        'Do we need to print the handouts?', NULL, '/uploads/exams/toeic/lr/part2/audio_19.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "No, participants can download them."}, {"label": "B", "text": "The printer uses color ink."}, {"label": "C", "text": "There are three handouts on the table."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 20,
        'Where can I find the maintenance request form?', NULL, '/uploads/exams/toeic/lr/part2/audio_20.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Repairs take two days."}, {"label": "B", "text": "It is on the company intranet."}, {"label": "C", "text": "The maintenance team is busy."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 21,
        'How long does the product demonstration take?', NULL, '/uploads/exams/toeic/lr/part2/audio_21.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "About fifteen minutes."}, {"label": "B", "text": "The product is on sale."}, {"label": "C", "text": "Take the elevator to the second floor."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 22,
        'Should I confirm the hotel reservation today?', NULL, '/uploads/exams/toeic/lr/part2/audio_22.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Yes, before the rate changes."}, {"label": "B", "text": "The hotel is near the station."}, {"label": "C", "text": "I stayed there last year."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 23,
        'Who will greet the guests at the airport?', NULL, '/uploads/exams/toeic/lr/part2/audio_23.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The guests are from Singapore."}, {"label": "B", "text": "Daniel from our sales team."}, {"label": "C", "text": "Their flight leaves tonight."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 24,
        'Can the deadline be extended?', NULL, '/uploads/exams/toeic/lr/part2/audio_24.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Only until next Wednesday."}, {"label": "B", "text": "It is a long document."}, {"label": "C", "text": "The line was very busy."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 2', 'audio_choice', NULL, 25,
        'Would you prefer the morning or afternoon workshop?', NULL, '/uploads/exams/toeic/lr/part2/audio_25.mp3', '{"showQuestionText": false, "showOptionText": false, "requiresAudio": true, "transitionSeconds": 5}'::jsonb, '{"toeicPart": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 2', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The workshop was useful."}, {"label": "B", "text": "Morning would be better for me."}, {"label": "C", "text": "It is held in Room 402."}]'::jsonb, 'B');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'TOEIC Part 3 Conversation 1', 'REAL_TOEIC_LR_P3_G01', 'A short workplace conversation about rescheduling a client visit. Replace this transcript with the imported audio transcript if needed.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part3/conversation_01.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 1, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G01', 1,
        'What are the speakers mainly discussing?', NULL, '/uploads/exams/toeic/lr/part3/conversation_01.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 1, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "They are discussing rescheduling a client visit."}, {"label": "B", "text": "They are comparing vacation packages."}, {"label": "C", "text": "They are training a new receptionist."}, {"label": "D", "text": "They are reading a newspaper article."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G01', 2,
        'What problem is mentioned?', NULL, '/uploads/exams/toeic/lr/part3/conversation_01.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 1, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A document contains several spelling errors."}, {"label": "B", "text": "A schedule or detail needs to be changed."}, {"label": "C", "text": "The office will close permanently."}, {"label": "D", "text": "A customer refuses to pay in cash."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G01', 3,
        'What will one speaker probably do next?', NULL, '/uploads/exams/toeic/lr/part3/conversation_01.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 1, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Cancel all future meetings."}, {"label": "B", "text": "Call a supplier immediately."}, {"label": "C", "text": "Confirm the updated information by email."}, {"label": "D", "text": "Move to another department."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'TOEIC Part 3 Conversation 2', 'REAL_TOEIC_LR_P3_G02', 'A short workplace conversation about choosing a venue for a staff workshop. Replace this transcript with the imported audio transcript if needed.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part3/conversation_02.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 2, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G02', 4,
        'What are the speakers mainly discussing?', NULL, '/uploads/exams/toeic/lr/part3/conversation_02.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "They are discussing choosing a venue for a staff workshop."}, {"label": "B", "text": "They are comparing vacation packages."}, {"label": "C", "text": "They are training a new receptionist."}, {"label": "D", "text": "They are reading a newspaper article."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G02', 5,
        'What problem is mentioned?', NULL, '/uploads/exams/toeic/lr/part3/conversation_02.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A document contains several spelling errors."}, {"label": "B", "text": "A schedule or detail needs to be changed."}, {"label": "C", "text": "The office will close permanently."}, {"label": "D", "text": "A customer refuses to pay in cash."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G02', 6,
        'What will one speaker probably do next?', NULL, '/uploads/exams/toeic/lr/part3/conversation_02.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Cancel all future meetings."}, {"label": "B", "text": "Call a supplier immediately."}, {"label": "C", "text": "Confirm the updated information by email."}, {"label": "D", "text": "Move to another department."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'TOEIC Part 3 Conversation 3', 'REAL_TOEIC_LR_P3_G03', 'A short workplace conversation about fixing a problem with an online order. Replace this transcript with the imported audio transcript if needed.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part3/conversation_03.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 3, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G03', 7,
        'What are the speakers mainly discussing?', NULL, '/uploads/exams/toeic/lr/part3/conversation_03.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 3, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "They are discussing fixing a problem with an online order."}, {"label": "B", "text": "They are comparing vacation packages."}, {"label": "C", "text": "They are training a new receptionist."}, {"label": "D", "text": "They are reading a newspaper article."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G03', 8,
        'What problem is mentioned?', NULL, '/uploads/exams/toeic/lr/part3/conversation_03.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 3, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A document contains several spelling errors."}, {"label": "B", "text": "A schedule or detail needs to be changed."}, {"label": "C", "text": "The office will close permanently."}, {"label": "D", "text": "A customer refuses to pay in cash."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G03', 9,
        'What will one speaker probably do next?', NULL, '/uploads/exams/toeic/lr/part3/conversation_03.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 3, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Cancel all future meetings."}, {"label": "B", "text": "Call a supplier immediately."}, {"label": "C", "text": "Confirm the updated information by email."}, {"label": "D", "text": "Move to another department."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'TOEIC Part 3 Conversation 4', 'REAL_TOEIC_LR_P3_G04', 'A short workplace conversation about planning a product launch. Replace this transcript with the imported audio transcript if needed.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part3/conversation_04.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 4, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G04', 10,
        'What are the speakers mainly discussing?', NULL, '/uploads/exams/toeic/lr/part3/conversation_04.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 4, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "They are discussing planning a product launch."}, {"label": "B", "text": "They are comparing vacation packages."}, {"label": "C", "text": "They are training a new receptionist."}, {"label": "D", "text": "They are reading a newspaper article."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G04', 11,
        'What problem is mentioned?', NULL, '/uploads/exams/toeic/lr/part3/conversation_04.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 4, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A document contains several spelling errors."}, {"label": "B", "text": "A schedule or detail needs to be changed."}, {"label": "C", "text": "The office will close permanently."}, {"label": "D", "text": "A customer refuses to pay in cash."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G04', 12,
        'What will one speaker probably do next?', NULL, '/uploads/exams/toeic/lr/part3/conversation_04.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 4, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Cancel all future meetings."}, {"label": "B", "text": "Call a supplier immediately."}, {"label": "C", "text": "Confirm the updated information by email."}, {"label": "D", "text": "Move to another department."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'TOEIC Part 3 Conversation 5', 'REAL_TOEIC_LR_P3_G05', 'A short workplace conversation about asking about a delayed invoice. Replace this transcript with the imported audio transcript if needed.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part3/conversation_05.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 5, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G05', 13,
        'What are the speakers mainly discussing?', NULL, '/uploads/exams/toeic/lr/part3/conversation_05.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 5, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "They are discussing asking about a delayed invoice."}, {"label": "B", "text": "They are comparing vacation packages."}, {"label": "C", "text": "They are training a new receptionist."}, {"label": "D", "text": "They are reading a newspaper article."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G05', 14,
        'What problem is mentioned?', NULL, '/uploads/exams/toeic/lr/part3/conversation_05.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 5, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A document contains several spelling errors."}, {"label": "B", "text": "A schedule or detail needs to be changed."}, {"label": "C", "text": "The office will close permanently."}, {"label": "D", "text": "A customer refuses to pay in cash."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G05', 15,
        'What will one speaker probably do next?', NULL, '/uploads/exams/toeic/lr/part3/conversation_05.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 5, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Cancel all future meetings."}, {"label": "B", "text": "Call a supplier immediately."}, {"label": "C", "text": "Confirm the updated information by email."}, {"label": "D", "text": "Move to another department."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'TOEIC Part 3 Conversation 6', 'REAL_TOEIC_LR_P3_G06', 'A short workplace conversation about discussing a train schedule. Replace this transcript with the imported audio transcript if needed.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part3/conversation_06.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 6, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G06', 16,
        'What are the speakers mainly discussing?', NULL, '/uploads/exams/toeic/lr/part3/conversation_06.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 6, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "They are discussing discussing a train schedule."}, {"label": "B", "text": "They are comparing vacation packages."}, {"label": "C", "text": "They are training a new receptionist."}, {"label": "D", "text": "They are reading a newspaper article."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G06', 17,
        'What problem is mentioned?', NULL, '/uploads/exams/toeic/lr/part3/conversation_06.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 6, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A document contains several spelling errors."}, {"label": "B", "text": "A schedule or detail needs to be changed."}, {"label": "C", "text": "The office will close permanently."}, {"label": "D", "text": "A customer refuses to pay in cash."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G06', 18,
        'What will one speaker probably do next?', NULL, '/uploads/exams/toeic/lr/part3/conversation_06.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 6, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Cancel all future meetings."}, {"label": "B", "text": "Call a supplier immediately."}, {"label": "C", "text": "Confirm the updated information by email."}, {"label": "D", "text": "Move to another department."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'TOEIC Part 3 Conversation 7', 'REAL_TOEIC_LR_P3_G07', 'A short workplace conversation about preparing for a job interview. Replace this transcript with the imported audio transcript if needed.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part3/conversation_07.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 7, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G07', 19,
        'What are the speakers mainly discussing?', NULL, '/uploads/exams/toeic/lr/part3/conversation_07.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 7, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "They are discussing preparing for a job interview."}, {"label": "B", "text": "They are comparing vacation packages."}, {"label": "C", "text": "They are training a new receptionist."}, {"label": "D", "text": "They are reading a newspaper article."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G07', 20,
        'What problem is mentioned?', NULL, '/uploads/exams/toeic/lr/part3/conversation_07.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 7, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A document contains several spelling errors."}, {"label": "B", "text": "A schedule or detail needs to be changed."}, {"label": "C", "text": "The office will close permanently."}, {"label": "D", "text": "A customer refuses to pay in cash."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G07', 21,
        'What will one speaker probably do next?', NULL, '/uploads/exams/toeic/lr/part3/conversation_07.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 7, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Cancel all future meetings."}, {"label": "B", "text": "Call a supplier immediately."}, {"label": "C", "text": "Confirm the updated information by email."}, {"label": "D", "text": "Move to another department."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'TOEIC Part 3 Conversation 8', 'REAL_TOEIC_LR_P3_G08', 'A short workplace conversation about reviewing customer feedback. Replace this transcript with the imported audio transcript if needed.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part3/conversation_08.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 8, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G08', 22,
        'What are the speakers mainly discussing?', NULL, '/uploads/exams/toeic/lr/part3/conversation_08.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 8, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "They are discussing reviewing customer feedback."}, {"label": "B", "text": "They are comparing vacation packages."}, {"label": "C", "text": "They are training a new receptionist."}, {"label": "D", "text": "They are reading a newspaper article."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G08', 23,
        'What problem is mentioned?', NULL, '/uploads/exams/toeic/lr/part3/conversation_08.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 8, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A document contains several spelling errors."}, {"label": "B", "text": "A schedule or detail needs to be changed."}, {"label": "C", "text": "The office will close permanently."}, {"label": "D", "text": "A customer refuses to pay in cash."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G08', 24,
        'What will one speaker probably do next?', NULL, '/uploads/exams/toeic/lr/part3/conversation_08.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 8, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Cancel all future meetings."}, {"label": "B", "text": "Call a supplier immediately."}, {"label": "C", "text": "Confirm the updated information by email."}, {"label": "D", "text": "Move to another department."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'TOEIC Part 3 Conversation 9', 'REAL_TOEIC_LR_P3_G09', 'A short workplace conversation about arranging office renovations. Replace this transcript with the imported audio transcript if needed.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part3/conversation_09.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 9, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G09', 25,
        'What are the speakers mainly discussing?', NULL, '/uploads/exams/toeic/lr/part3/conversation_09.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 9, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "They are discussing arranging office renovations."}, {"label": "B", "text": "They are comparing vacation packages."}, {"label": "C", "text": "They are training a new receptionist."}, {"label": "D", "text": "They are reading a newspaper article."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G09', 26,
        'What problem is mentioned?', NULL, '/uploads/exams/toeic/lr/part3/conversation_09.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 9, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A document contains several spelling errors."}, {"label": "B", "text": "A schedule or detail needs to be changed."}, {"label": "C", "text": "The office will close permanently."}, {"label": "D", "text": "A customer refuses to pay in cash."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G09', 27,
        'What will one speaker probably do next?', NULL, '/uploads/exams/toeic/lr/part3/conversation_09.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 9, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Cancel all future meetings."}, {"label": "B", "text": "Call a supplier immediately."}, {"label": "C", "text": "Confirm the updated information by email."}, {"label": "D", "text": "Move to another department."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'TOEIC Part 3 Conversation 10', 'REAL_TOEIC_LR_P3_G10', 'A short workplace conversation about selecting a catering company. Replace this transcript with the imported audio transcript if needed.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part3/conversation_10.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 10, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G10', 28,
        'What are the speakers mainly discussing?', NULL, '/uploads/exams/toeic/lr/part3/conversation_10.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 10, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "They are discussing selecting a catering company."}, {"label": "B", "text": "They are comparing vacation packages."}, {"label": "C", "text": "They are training a new receptionist."}, {"label": "D", "text": "They are reading a newspaper article."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G10', 29,
        'What problem is mentioned?', NULL, '/uploads/exams/toeic/lr/part3/conversation_10.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 10, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A document contains several spelling errors."}, {"label": "B", "text": "A schedule or detail needs to be changed."}, {"label": "C", "text": "The office will close permanently."}, {"label": "D", "text": "A customer refuses to pay in cash."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G10', 30,
        'What will one speaker probably do next?', NULL, '/uploads/exams/toeic/lr/part3/conversation_10.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 10, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Cancel all future meetings."}, {"label": "B", "text": "Call a supplier immediately."}, {"label": "C", "text": "Confirm the updated information by email."}, {"label": "D", "text": "Move to another department."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'TOEIC Part 3 Conversation 11', 'REAL_TOEIC_LR_P3_G11', 'A short workplace conversation about checking a conference registration. Replace this transcript with the imported audio transcript if needed.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part3/conversation_11.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 11, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G11', 31,
        'What are the speakers mainly discussing?', NULL, '/uploads/exams/toeic/lr/part3/conversation_11.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 11, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "They are discussing checking a conference registration."}, {"label": "B", "text": "They are comparing vacation packages."}, {"label": "C", "text": "They are training a new receptionist."}, {"label": "D", "text": "They are reading a newspaper article."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G11', 32,
        'What problem is mentioned?', NULL, '/uploads/exams/toeic/lr/part3/conversation_11.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 11, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A document contains several spelling errors."}, {"label": "B", "text": "A schedule or detail needs to be changed."}, {"label": "C", "text": "The office will close permanently."}, {"label": "D", "text": "A customer refuses to pay in cash."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G11', 33,
        'What will one speaker probably do next?', NULL, '/uploads/exams/toeic/lr/part3/conversation_11.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 11, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Cancel all future meetings."}, {"label": "B", "text": "Call a supplier immediately."}, {"label": "C", "text": "Confirm the updated information by email."}, {"label": "D", "text": "Move to another department."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'TOEIC Part 3 Conversation 12', 'REAL_TOEIC_LR_P3_G12', 'A short workplace conversation about updating a project timeline. Replace this transcript with the imported audio transcript if needed.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part3/conversation_12.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 12, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G12', 34,
        'What are the speakers mainly discussing?', NULL, '/uploads/exams/toeic/lr/part3/conversation_12.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 12, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "They are discussing updating a project timeline."}, {"label": "B", "text": "They are comparing vacation packages."}, {"label": "C", "text": "They are training a new receptionist."}, {"label": "D", "text": "They are reading a newspaper article."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G12', 35,
        'What problem is mentioned?', NULL, '/uploads/exams/toeic/lr/part3/conversation_12.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 12, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A document contains several spelling errors."}, {"label": "B", "text": "A schedule or detail needs to be changed."}, {"label": "C", "text": "The office will close permanently."}, {"label": "D", "text": "A customer refuses to pay in cash."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G12', 36,
        'What will one speaker probably do next?', NULL, '/uploads/exams/toeic/lr/part3/conversation_12.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 12, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Cancel all future meetings."}, {"label": "B", "text": "Call a supplier immediately."}, {"label": "C", "text": "Confirm the updated information by email."}, {"label": "D", "text": "Move to another department."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'TOEIC Part 3 Conversation 13', 'REAL_TOEIC_LR_P3_G13', 'A short workplace conversation about discussing a returned item. Replace this transcript with the imported audio transcript if needed.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part3/conversation_13.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 13, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G13', 37,
        'What are the speakers mainly discussing?', NULL, '/uploads/exams/toeic/lr/part3/conversation_13.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 13, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "They are discussing discussing a returned item."}, {"label": "B", "text": "They are comparing vacation packages."}, {"label": "C", "text": "They are training a new receptionist."}, {"label": "D", "text": "They are reading a newspaper article."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G13', 38,
        'What problem is mentioned?', NULL, '/uploads/exams/toeic/lr/part3/conversation_13.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 13, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A document contains several spelling errors."}, {"label": "B", "text": "A schedule or detail needs to be changed."}, {"label": "C", "text": "The office will close permanently."}, {"label": "D", "text": "A customer refuses to pay in cash."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 3', 'group_choice', 'REAL_TOEIC_LR_P3_G13', 39,
        'What will one speaker probably do next?', NULL, '/uploads/exams/toeic/lr/part3/conversation_13.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 3, "groupNo": 13, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 3', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Cancel all future meetings."}, {"label": "B", "text": "Call a supplier immediately."}, {"label": "C", "text": "Confirm the updated information by email."}, {"label": "D", "text": "Move to another department."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'TOEIC Part 4 Talk 1', 'REAL_TOEIC_LR_P4_G01', 'A short announcement about a museum membership program.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part4/talk_01.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 1, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G01', 1,
        'What is the purpose of the announcement?', NULL, '/uploads/exams/toeic/lr/part4/talk_01.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 1, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To give information about a museum membership program."}, {"label": "B", "text": "To introduce a new employee."}, {"label": "C", "text": "To apologize for a billing error."}, {"label": "D", "text": "To describe a historical building."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G01', 2,
        'Who is the intended audience?', NULL, '/uploads/exams/toeic/lr/part4/talk_01.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 1, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "People who recently bought a house."}, {"label": "B", "text": "Customers, employees, or visitors affected by the announcement."}, {"label": "C", "text": "Students applying for scholarships."}, {"label": "D", "text": "Tourists taking a guided walk."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G01', 3,
        'What are listeners asked to do?', NULL, '/uploads/exams/toeic/lr/part4/talk_01.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 1, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignore all previous messages."}, {"label": "B", "text": "Pay an additional registration fee immediately."}, {"label": "C", "text": "Follow the instructions or check for further details."}, {"label": "D", "text": "Bring their own office equipment."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'TOEIC Part 4 Talk 2', 'REAL_TOEIC_LR_P4_G02', 'A short announcement about a change to company parking rules.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part4/talk_02.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 2, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G02', 4,
        'What is the purpose of the announcement?', NULL, '/uploads/exams/toeic/lr/part4/talk_02.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To give information about a change to company parking rules."}, {"label": "B", "text": "To introduce a new employee."}, {"label": "C", "text": "To apologize for a billing error."}, {"label": "D", "text": "To describe a historical building."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G02', 5,
        'Who is the intended audience?', NULL, '/uploads/exams/toeic/lr/part4/talk_02.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "People who recently bought a house."}, {"label": "B", "text": "Customers, employees, or visitors affected by the announcement."}, {"label": "C", "text": "Students applying for scholarships."}, {"label": "D", "text": "Tourists taking a guided walk."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G02', 6,
        'What are listeners asked to do?', NULL, '/uploads/exams/toeic/lr/part4/talk_02.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignore all previous messages."}, {"label": "B", "text": "Pay an additional registration fee immediately."}, {"label": "C", "text": "Follow the instructions or check for further details."}, {"label": "D", "text": "Bring their own office equipment."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'TOEIC Part 4 Talk 3', 'REAL_TOEIC_LR_P4_G03', 'A short announcement about a local business award ceremony.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part4/talk_03.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 3, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G03', 7,
        'What is the purpose of the announcement?', NULL, '/uploads/exams/toeic/lr/part4/talk_03.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 3, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To give information about a local business award ceremony."}, {"label": "B", "text": "To introduce a new employee."}, {"label": "C", "text": "To apologize for a billing error."}, {"label": "D", "text": "To describe a historical building."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G03', 8,
        'Who is the intended audience?', NULL, '/uploads/exams/toeic/lr/part4/talk_03.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 3, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "People who recently bought a house."}, {"label": "B", "text": "Customers, employees, or visitors affected by the announcement."}, {"label": "C", "text": "Students applying for scholarships."}, {"label": "D", "text": "Tourists taking a guided walk."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G03', 9,
        'What are listeners asked to do?', NULL, '/uploads/exams/toeic/lr/part4/talk_03.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 3, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignore all previous messages."}, {"label": "B", "text": "Pay an additional registration fee immediately."}, {"label": "C", "text": "Follow the instructions or check for further details."}, {"label": "D", "text": "Bring their own office equipment."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'TOEIC Part 4 Talk 4', 'REAL_TOEIC_LR_P4_G04', 'A short announcement about instructions for using a new copier.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part4/talk_04.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 4, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G04', 10,
        'What is the purpose of the announcement?', NULL, '/uploads/exams/toeic/lr/part4/talk_04.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 4, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To give information about instructions for using a new copier."}, {"label": "B", "text": "To introduce a new employee."}, {"label": "C", "text": "To apologize for a billing error."}, {"label": "D", "text": "To describe a historical building."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G04', 11,
        'Who is the intended audience?', NULL, '/uploads/exams/toeic/lr/part4/talk_04.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 4, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "People who recently bought a house."}, {"label": "B", "text": "Customers, employees, or visitors affected by the announcement."}, {"label": "C", "text": "Students applying for scholarships."}, {"label": "D", "text": "Tourists taking a guided walk."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G04', 12,
        'What are listeners asked to do?', NULL, '/uploads/exams/toeic/lr/part4/talk_04.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 4, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignore all previous messages."}, {"label": "B", "text": "Pay an additional registration fee immediately."}, {"label": "C", "text": "Follow the instructions or check for further details."}, {"label": "D", "text": "Bring their own office equipment."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'TOEIC Part 4 Talk 5', 'REAL_TOEIC_LR_P4_G05', 'A short announcement about a hotel renovation notice.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part4/talk_05.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 5, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G05', 13,
        'What is the purpose of the announcement?', NULL, '/uploads/exams/toeic/lr/part4/talk_05.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 5, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To give information about a hotel renovation notice."}, {"label": "B", "text": "To introduce a new employee."}, {"label": "C", "text": "To apologize for a billing error."}, {"label": "D", "text": "To describe a historical building."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G05', 14,
        'Who is the intended audience?', NULL, '/uploads/exams/toeic/lr/part4/talk_05.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 5, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "People who recently bought a house."}, {"label": "B", "text": "Customers, employees, or visitors affected by the announcement."}, {"label": "C", "text": "Students applying for scholarships."}, {"label": "D", "text": "Tourists taking a guided walk."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G05', 15,
        'What are listeners asked to do?', NULL, '/uploads/exams/toeic/lr/part4/talk_05.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 5, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignore all previous messages."}, {"label": "B", "text": "Pay an additional registration fee immediately."}, {"label": "C", "text": "Follow the instructions or check for further details."}, {"label": "D", "text": "Bring their own office equipment."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'TOEIC Part 4 Talk 6', 'REAL_TOEIC_LR_P4_G06', 'A short announcement about a weather-related travel update.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part4/talk_06.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 6, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G06', 16,
        'What is the purpose of the announcement?', NULL, '/uploads/exams/toeic/lr/part4/talk_06.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 6, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To give information about a weather-related travel update."}, {"label": "B", "text": "To introduce a new employee."}, {"label": "C", "text": "To apologize for a billing error."}, {"label": "D", "text": "To describe a historical building."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G06', 17,
        'Who is the intended audience?', NULL, '/uploads/exams/toeic/lr/part4/talk_06.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 6, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "People who recently bought a house."}, {"label": "B", "text": "Customers, employees, or visitors affected by the announcement."}, {"label": "C", "text": "Students applying for scholarships."}, {"label": "D", "text": "Tourists taking a guided walk."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G06', 18,
        'What are listeners asked to do?', NULL, '/uploads/exams/toeic/lr/part4/talk_06.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 6, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignore all previous messages."}, {"label": "B", "text": "Pay an additional registration fee immediately."}, {"label": "C", "text": "Follow the instructions or check for further details."}, {"label": "D", "text": "Bring their own office equipment."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'TOEIC Part 4 Talk 7', 'REAL_TOEIC_LR_P4_G07', 'A short announcement about an employee benefits seminar.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part4/talk_07.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 7, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G07', 19,
        'What is the purpose of the announcement?', NULL, '/uploads/exams/toeic/lr/part4/talk_07.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 7, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To give information about an employee benefits seminar."}, {"label": "B", "text": "To introduce a new employee."}, {"label": "C", "text": "To apologize for a billing error."}, {"label": "D", "text": "To describe a historical building."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G07', 20,
        'Who is the intended audience?', NULL, '/uploads/exams/toeic/lr/part4/talk_07.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 7, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "People who recently bought a house."}, {"label": "B", "text": "Customers, employees, or visitors affected by the announcement."}, {"label": "C", "text": "Students applying for scholarships."}, {"label": "D", "text": "Tourists taking a guided walk."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G07', 21,
        'What are listeners asked to do?', NULL, '/uploads/exams/toeic/lr/part4/talk_07.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 7, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignore all previous messages."}, {"label": "B", "text": "Pay an additional registration fee immediately."}, {"label": "C", "text": "Follow the instructions or check for further details."}, {"label": "D", "text": "Bring their own office equipment."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'TOEIC Part 4 Talk 8', 'REAL_TOEIC_LR_P4_G08', 'A short announcement about a store anniversary sale.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part4/talk_08.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 8, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G08', 22,
        'What is the purpose of the announcement?', NULL, '/uploads/exams/toeic/lr/part4/talk_08.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 8, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To give information about a store anniversary sale."}, {"label": "B", "text": "To introduce a new employee."}, {"label": "C", "text": "To apologize for a billing error."}, {"label": "D", "text": "To describe a historical building."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G08', 23,
        'Who is the intended audience?', NULL, '/uploads/exams/toeic/lr/part4/talk_08.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 8, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "People who recently bought a house."}, {"label": "B", "text": "Customers, employees, or visitors affected by the announcement."}, {"label": "C", "text": "Students applying for scholarships."}, {"label": "D", "text": "Tourists taking a guided walk."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G08', 24,
        'What are listeners asked to do?', NULL, '/uploads/exams/toeic/lr/part4/talk_08.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 8, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignore all previous messages."}, {"label": "B", "text": "Pay an additional registration fee immediately."}, {"label": "C", "text": "Follow the instructions or check for further details."}, {"label": "D", "text": "Bring their own office equipment."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'TOEIC Part 4 Talk 9', 'REAL_TOEIC_LR_P4_G09', 'A short announcement about a community recycling campaign.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part4/talk_09.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 9, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G09', 25,
        'What is the purpose of the announcement?', NULL, '/uploads/exams/toeic/lr/part4/talk_09.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 9, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To give information about a community recycling campaign."}, {"label": "B", "text": "To introduce a new employee."}, {"label": "C", "text": "To apologize for a billing error."}, {"label": "D", "text": "To describe a historical building."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G09', 26,
        'Who is the intended audience?', NULL, '/uploads/exams/toeic/lr/part4/talk_09.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 9, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "People who recently bought a house."}, {"label": "B", "text": "Customers, employees, or visitors affected by the announcement."}, {"label": "C", "text": "Students applying for scholarships."}, {"label": "D", "text": "Tourists taking a guided walk."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G09', 27,
        'What are listeners asked to do?', NULL, '/uploads/exams/toeic/lr/part4/talk_09.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 9, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignore all previous messages."}, {"label": "B", "text": "Pay an additional registration fee immediately."}, {"label": "C", "text": "Follow the instructions or check for further details."}, {"label": "D", "text": "Bring their own office equipment."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'TOEIC Part 4 Talk 10', 'REAL_TOEIC_LR_P4_G10', 'A short announcement about a software maintenance announcement.', '[]'::jsonb, '{"audio": "/uploads/exams/toeic/lr/part4/talk_10.mp3"}'::jsonb, '{"questionsPerGroup": 3, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "placeholderMedia": true, "seed": "real_question_seed_v2"}'::jsonb, 10, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G10', 28,
        'What is the purpose of the announcement?', NULL, '/uploads/exams/toeic/lr/part4/talk_10.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 10, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To give information about a software maintenance announcement."}, {"label": "B", "text": "To introduce a new employee."}, {"label": "C", "text": "To apologize for a billing error."}, {"label": "D", "text": "To describe a historical building."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G10', 29,
        'Who is the intended audience?', NULL, '/uploads/exams/toeic/lr/part4/talk_10.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 10, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "People who recently bought a house."}, {"label": "B", "text": "Customers, employees, or visitors affected by the announcement."}, {"label": "C", "text": "Students applying for scholarships."}, {"label": "D", "text": "Tourists taking a guided walk."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Listening', 'Part 4', 'group_choice', 'REAL_TOEIC_LR_P4_G10', 30,
        'What are listeners asked to do?', NULL, '/uploads/exams/toeic/lr/part4/talk_10.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "transitionSeconds": 8}'::jsonb, '{"toeicPart": 4, "groupNo": 10, "placeholderMedia": true}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Listening - Part 4', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignore all previous messages."}, {"label": "B", "text": "Pay an additional registration fee immediately."}, {"label": "C", "text": "Follow the instructions or check for further details."}, {"label": "D", "text": "Bring their own office equipment."}]'::jsonb, 'C');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 1,
        'All employees must submit their travel receipts ____ five business days.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "within"}, {"label": "B", "text": "during"}, {"label": "C", "text": "among"}, {"label": "D", "text": "onto"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 2,
        'The new printer is faster and ____ reliable than the previous model.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "most"}, {"label": "B", "text": "more"}, {"label": "C", "text": "much"}, {"label": "D", "text": "many"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 3,
        'Ms. Lee will contact the supplier ____ the missing parts arrive.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "as soon as"}, {"label": "B", "text": "although"}, {"label": "C", "text": "unless"}, {"label": "D", "text": "despite"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 4,
        'The safety guidelines are reviewed ____ to ensure compliance.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "regular"}, {"label": "B", "text": "regularly"}, {"label": "C", "text": "regularity"}, {"label": "D", "text": "regulate"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 5,
        'Please make sure that the conference room ____ before the guests arrive.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "prepare"}, {"label": "B", "text": "preparing"}, {"label": "C", "text": "is prepared"}, {"label": "D", "text": "prepared"}]'::jsonb, 'C');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 6,
        'The marketing team has developed a ____ strategy for the new product.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "comprehend"}, {"label": "B", "text": "comprehensive"}, {"label": "C", "text": "comprehensively"}, {"label": "D", "text": "comprehension"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 7,
        'We cannot process your refund ____ we receive the original receipt.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "until"}, {"label": "B", "text": "so that"}, {"label": "C", "text": "whereas"}, {"label": "D", "text": "even"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 8,
        'The technician explained the procedure in a very ____ manner.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "clear"}, {"label": "B", "text": "clearly"}, {"label": "C", "text": "clarity"}, {"label": "D", "text": "clearing"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 9,
        'The company plans to ____ its customer service department next year.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "expand"}, {"label": "B", "text": "expansion"}, {"label": "C", "text": "expansive"}, {"label": "D", "text": "expanded"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 10,
        'The report was delayed because several figures needed to be ____.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "verify"}, {"label": "B", "text": "verifies"}, {"label": "C", "text": "verified"}, {"label": "D", "text": "verification"}]'::jsonb, 'C');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 11,
        'The hotel offers free transportation to guests ____ stay for more than two nights.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "who"}, {"label": "B", "text": "which"}, {"label": "C", "text": "whose"}, {"label": "D", "text": "where"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 12,
        'The instructions are simple enough for new users to follow ____.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "ease"}, {"label": "B", "text": "easy"}, {"label": "C", "text": "easily"}, {"label": "D", "text": "easier"}]'::jsonb, 'C');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 13,
        'The manager asked everyone to arrive ____ at 8:30 a.m.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "prompt"}, {"label": "B", "text": "promptly"}, {"label": "C", "text": "promptness"}, {"label": "D", "text": "prompted"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 14,
        'Several applicants were invited for a second interview because their resumes were ____.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "impress"}, {"label": "B", "text": "impressive"}, {"label": "C", "text": "impressively"}, {"label": "D", "text": "impression"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 15,
        'The warehouse will be closed tomorrow ____ scheduled maintenance.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "due to"}, {"label": "B", "text": "instead of"}, {"label": "C", "text": "even if"}, {"label": "D", "text": "as long as"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 16,
        'Mr. Patel has been appointed ____ director of operations.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "as"}, {"label": "B", "text": "for"}, {"label": "C", "text": "to"}, {"label": "D", "text": "with"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 17,
        'The software update should be installed ____ possible.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "as soon as"}, {"label": "B", "text": "as well as"}, {"label": "C", "text": "as far as"}, {"label": "D", "text": "as much as"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 18,
        'The restaurant is popular because it serves meals at ____ prices.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "reason"}, {"label": "B", "text": "reasonable"}, {"label": "C", "text": "reasonably"}, {"label": "D", "text": "reasoning"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 19,
        'Our records show that your subscription ____ next month.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "expire"}, {"label": "B", "text": "expires"}, {"label": "C", "text": "expiring"}, {"label": "D", "text": "expiration"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 20,
        'The package was sent to the wrong address, ____ caused a two-day delay.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "which"}, {"label": "B", "text": "who"}, {"label": "C", "text": "what"}, {"label": "D", "text": "where"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 21,
        'The training materials are available ____ English and Vietnamese.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "both"}, {"label": "B", "text": "either"}, {"label": "C", "text": "between"}, {"label": "D", "text": "among"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 22,
        'The sales figures were ____ higher than expected.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "significant"}, {"label": "B", "text": "significance"}, {"label": "C", "text": "significantly"}, {"label": "D", "text": "signify"}]'::jsonb, 'C');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 23,
        'The board will review the proposal before making ____ decision.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "it"}, {"label": "B", "text": "its"}, {"label": "C", "text": "itself"}, {"label": "D", "text": "them"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 24,
        'Employees are encouraged to make suggestions for improving office ____.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "efficient"}, {"label": "B", "text": "efficiency"}, {"label": "C", "text": "efficiently"}, {"label": "D", "text": "effect"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 25,
        'The product manual contains ____ instructions for installation.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "detail"}, {"label": "B", "text": "detailed"}, {"label": "C", "text": "detailing"}, {"label": "D", "text": "details"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 26,
        'The customer service line is open every day ____ Sunday.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "except"}, {"label": "B", "text": "beside"}, {"label": "C", "text": "without"}, {"label": "D", "text": "against"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 27,
        'The accounting department is responsible for ____ monthly invoices.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "issue"}, {"label": "B", "text": "issued"}, {"label": "C", "text": "issuing"}, {"label": "D", "text": "issues"}]'::jsonb, 'C');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 28,
        'Please contact Human Resources if you have ____ questions about benefits.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "any"}, {"label": "B", "text": "some"}, {"label": "C", "text": "each"}, {"label": "D", "text": "another"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 29,
        'The company hopes to attract new clients by ____ its online presence.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "strengthen"}, {"label": "B", "text": "strengthened"}, {"label": "C", "text": "strengthening"}, {"label": "D", "text": "strength"}]'::jsonb, 'C');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 5', 'single_choice', NULL, 30,
        'A copy of the contract should be kept for future ____.', NULL, NULL, '{"showQuestionText": true, "showOptionText": true}'::jsonb, '{"toeicPart": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 5', 'Chọn đáp án đúng về ngữ pháp/từ vựng trong câu TOEIC Part 5.', '[{"label": "A", "text": "refer"}, {"label": "B", "text": "reference"}, {"label": "C", "text": "referred"}, {"label": "D", "text": "referable"}]'::jsonb, 'B');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'Email: Office Move', 'REAL_TOEIC_LR_P6_G01', 'Dear team, Our department will move to the third floor next Friday. Please pack personal items before Thursday afternoon. Boxes will be provided near the elevator. [1] you need help moving heavy equipment, contact Facilities. The new workspace has more natural light and several small meeting rooms. [2], the phone extensions will remain the same. We expect the move to be completed by 5 p.m. [3] you have any questions, please speak with your supervisor. Thank you for your [4].', '[{"type": "text", "title": "Email: Office Move", "content": "Dear team, Our department will move to the third floor next Friday. Please pack personal items before Thursday afternoon. Boxes will be provided near the elevator. [1] you need help moving heavy equipment, contact Facilities. The new workspace has more natural light and several small meeting rooms. [2], the phone extensions will remain the same. We expect the move to be completed by 5 p.m. [3] you have any questions, please speak with your supervisor. Thank you for your [4]."}]'::jsonb, '{}'::jsonb, '{"questionsPerGroup": 4, "richTextGroup": true}'::jsonb, '{"toeicPart": 6, "seed": "real_question_seed_v2"}'::jsonb, 1, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'group_choice', 'REAL_TOEIC_LR_P6_G01', 1,
        'Choose the best answer for blank [1].', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true}'::jsonb, '{"toeicPart": 6, "blankNo": 1}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 6', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "If"}, {"label": "B", "text": "Because"}, {"label": "C", "text": "Although"}, {"label": "D", "text": "Before"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'group_choice', 'REAL_TOEIC_LR_P6_G01', 2,
        'Choose the best answer for blank [2].', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true}'::jsonb, '{"toeicPart": 6, "blankNo": 2}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 6', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "However"}, {"label": "B", "text": "In addition"}, {"label": "C", "text": "For example"}, {"label": "D", "text": "Otherwise"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'group_choice', 'REAL_TOEIC_LR_P6_G01', 3,
        'Choose the best answer for blank [3].', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true}'::jsonb, '{"toeicPart": 6, "blankNo": 3}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 6', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Should"}, {"label": "B", "text": "Unless"}, {"label": "C", "text": "Despite"}, {"label": "D", "text": "During"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'group_choice', 'REAL_TOEIC_LR_P6_G01', 4,
        'Choose the best answer for blank [4].', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true}'::jsonb, '{"toeicPart": 6, "blankNo": 4}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 6', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "cooperate"}, {"label": "B", "text": "cooperation"}, {"label": "C", "text": "cooperative"}, {"label": "D", "text": "cooperatively"}]'::jsonb, 'B');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'Notice: Training Registration', 'REAL_TOEIC_LR_P6_G02', 'Registration for the customer service training is now open. The session will focus on handling complaints, writing polite responses, and using the new ticket system. Employees who joined after January are strongly [1] to attend. Seats are limited, so please register early. [2] the room is full, another session will be scheduled. Participants will receive a certificate after [3] the final activity. Please bring your laptop and arrive [4].', '[{"type": "text", "title": "Notice: Training Registration", "content": "Registration for the customer service training is now open. The session will focus on handling complaints, writing polite responses, and using the new ticket system. Employees who joined after January are strongly [1] to attend. Seats are limited, so please register early. [2] the room is full, another session will be scheduled. Participants will receive a certificate after [3] the final activity. Please bring your laptop and arrive [4]."}]'::jsonb, '{}'::jsonb, '{"questionsPerGroup": 4, "richTextGroup": true}'::jsonb, '{"toeicPart": 6, "seed": "real_question_seed_v2"}'::jsonb, 2, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'group_choice', 'REAL_TOEIC_LR_P6_G02', 5,
        'Choose the best answer for blank [1].', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true}'::jsonb, '{"toeicPart": 6, "blankNo": 1}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 6', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "encouraged"}, {"label": "B", "text": "encouraging"}, {"label": "C", "text": "encourage"}, {"label": "D", "text": "encouragement"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'group_choice', 'REAL_TOEIC_LR_P6_G02', 6,
        'Choose the best answer for blank [2].', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true}'::jsonb, '{"toeicPart": 6, "blankNo": 2}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 6', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "If"}, {"label": "B", "text": "Until"}, {"label": "C", "text": "Because of"}, {"label": "D", "text": "During"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'group_choice', 'REAL_TOEIC_LR_P6_G02', 7,
        'Choose the best answer for blank [3].', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true}'::jsonb, '{"toeicPart": 6, "blankNo": 3}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 6', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "complete"}, {"label": "B", "text": "completed"}, {"label": "C", "text": "completing"}, {"label": "D", "text": "completion"}]'::jsonb, 'C');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'group_choice', 'REAL_TOEIC_LR_P6_G02', 8,
        'Choose the best answer for blank [4].', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true}'::jsonb, '{"toeicPart": 6, "blankNo": 4}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 6', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "on time"}, {"label": "B", "text": "by time"}, {"label": "C", "text": "at times"}, {"label": "D", "text": "over time"}]'::jsonb, 'A');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'Memo: New Cafeteria Hours', 'REAL_TOEIC_LR_P6_G03', 'Starting June 10, the cafeteria will open at 7:30 a.m. instead of 8:00 a.m. This change was made after many employees requested earlier breakfast service. The lunch menu will also include two vegetarian options each day. Prices will remain [1] for the summer. To reduce waiting time, customers are encouraged to pay by card. [2] cash payments will still be accepted. We appreciate your patience while the staff [3] to the new schedule. Please send comments to cafeteria@company.com by [4].', '[{"type": "text", "title": "Memo: New Cafeteria Hours", "content": "Starting June 10, the cafeteria will open at 7:30 a.m. instead of 8:00 a.m. This change was made after many employees requested earlier breakfast service. The lunch menu will also include two vegetarian options each day. Prices will remain [1] for the summer. To reduce waiting time, customers are encouraged to pay by card. [2] cash payments will still be accepted. We appreciate your patience while the staff [3] to the new schedule. Please send comments to cafeteria@company.com by [4]."}]'::jsonb, '{}'::jsonb, '{"questionsPerGroup": 4, "richTextGroup": true}'::jsonb, '{"toeicPart": 6, "seed": "real_question_seed_v2"}'::jsonb, 3, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'group_choice', 'REAL_TOEIC_LR_P6_G03', 9,
        'Choose the best answer for blank [1].', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true}'::jsonb, '{"toeicPart": 6, "blankNo": 1}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 6', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "stable"}, {"label": "B", "text": "stably"}, {"label": "C", "text": "stability"}, {"label": "D", "text": "stabilize"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'group_choice', 'REAL_TOEIC_LR_P6_G03', 10,
        'Choose the best answer for blank [2].', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true}'::jsonb, '{"toeicPart": 6, "blankNo": 2}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 6', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Therefore"}, {"label": "B", "text": "However"}, {"label": "C", "text": "For instance"}, {"label": "D", "text": "Similarly"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'group_choice', 'REAL_TOEIC_LR_P6_G03', 11,
        'Choose the best answer for blank [3].', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true}'::jsonb, '{"toeicPart": 6, "blankNo": 3}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 6', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "adjust"}, {"label": "B", "text": "adjustment"}, {"label": "C", "text": "adjustable"}, {"label": "D", "text": "adjusted"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'group_choice', 'REAL_TOEIC_LR_P6_G03', 12,
        'Choose the best answer for blank [4].', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true}'::jsonb, '{"toeicPart": 6, "blankNo": 4}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 6', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Friday"}, {"label": "B", "text": "location"}, {"label": "C", "text": "policy"}, {"label": "D", "text": "manager"}]'::jsonb, 'A');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'Letter: Warranty Service', 'REAL_TOEIC_LR_P6_G04', 'Thank you for purchasing the Model X air purifier. Your product includes a two-year limited warranty covering parts and labor. To request service, complete the online form and attach a copy of your receipt. A technician will review your request [1] two business days. If the product must be shipped to our service center, we will provide a prepaid label. Please do not attempt to repair the unit yourself, as this may [2] the warranty. We are committed to providing [3] support. For urgent problems, call our hotline [4].', '[{"type": "text", "title": "Letter: Warranty Service", "content": "Thank you for purchasing the Model X air purifier. Your product includes a two-year limited warranty covering parts and labor. To request service, complete the online form and attach a copy of your receipt. A technician will review your request [1] two business days. If the product must be shipped to our service center, we will provide a prepaid label. Please do not attempt to repair the unit yourself, as this may [2] the warranty. We are committed to providing [3] support. For urgent problems, call our hotline [4]."}]'::jsonb, '{}'::jsonb, '{"questionsPerGroup": 4, "richTextGroup": true}'::jsonb, '{"toeicPart": 6, "seed": "real_question_seed_v2"}'::jsonb, 4, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'group_choice', 'REAL_TOEIC_LR_P6_G04', 13,
        'Choose the best answer for blank [1].', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true}'::jsonb, '{"toeicPart": 6, "blankNo": 1}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 6', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "within"}, {"label": "B", "text": "between"}, {"label": "C", "text": "onto"}, {"label": "D", "text": "among"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'group_choice', 'REAL_TOEIC_LR_P6_G04', 14,
        'Choose the best answer for blank [2].', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true}'::jsonb, '{"toeicPart": 6, "blankNo": 2}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 6', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "validate"}, {"label": "B", "text": "void"}, {"label": "C", "text": "confirm"}, {"label": "D", "text": "extend"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'group_choice', 'REAL_TOEIC_LR_P6_G04', 15,
        'Choose the best answer for blank [3].', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true}'::jsonb, '{"toeicPart": 6, "blankNo": 3}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 6', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "depend"}, {"label": "B", "text": "dependent"}, {"label": "C", "text": "dependably"}, {"label": "D", "text": "dependable"}]'::jsonb, 'D');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 6', 'group_choice', 'REAL_TOEIC_LR_P6_G04', 16,
        'Choose the best answer for blank [4].', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true}'::jsonb, '{"toeicPart": 6, "blankNo": 4}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 6', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "for assistance"}, {"label": "B", "text": "to assisting"}, {"label": "C", "text": "with assisted"}, {"label": "D", "text": "by assistant"}]'::jsonb, 'A');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'Company Picnic Announcement', 'REAL_TOEIC_LR_P7_SINGLE_G01', 'Company Picnic Announcement: This document provides details about dates, services, prices, deadlines, and contact information for readers. It includes one important change and one instruction that readers should follow.', '[{"type": "single", "title": "Company Picnic Announcement", "content": "Company Picnic Announcement: This document provides details about dates, services, prices, deadlines, and contact information for readers. It includes one important change and one instruction that readers should follow."}]'::jsonb, '{}'::jsonb, '{"splitScreen": true, "passageType": "single", "questionsInGroup": 3}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "seed": "real_question_seed_v2"}'::jsonb, 1, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G01', 1,
        'What is the purpose of the document?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 1}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To provide information and instructions"}, {"label": "B", "text": "To compare two unrelated companies"}, {"label": "C", "text": "To reject a job application"}, {"label": "D", "text": "To explain a scientific theory"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G01', 2,
        'What is mentioned in the document?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 1}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A deadline or schedule is included"}, {"label": "B", "text": "All services have been cancelled"}, {"label": "C", "text": "Readers must travel overseas"}, {"label": "D", "text": "The company has changed its name"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G01', 3,
        'What are readers asked to do?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 1}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignore the notice"}, {"label": "B", "text": "Follow an instruction or contact someone"}, {"label": "C", "text": "Pay with foreign currency only"}, {"label": "D", "text": "Send personal photographs"}]'::jsonb, 'B');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'Online Order Confirmation', 'REAL_TOEIC_LR_P7_SINGLE_G02', 'Online Order Confirmation: This document provides details about dates, services, prices, deadlines, and contact information for readers. It includes one important change and one instruction that readers should follow.', '[{"type": "single", "title": "Online Order Confirmation", "content": "Online Order Confirmation: This document provides details about dates, services, prices, deadlines, and contact information for readers. It includes one important change and one instruction that readers should follow."}]'::jsonb, '{}'::jsonb, '{"splitScreen": true, "passageType": "single", "questionsInGroup": 3}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "seed": "real_question_seed_v2"}'::jsonb, 2, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G02', 4,
        'What is the purpose of the document?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 2}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To provide information and instructions"}, {"label": "B", "text": "To compare two unrelated companies"}, {"label": "C", "text": "To reject a job application"}, {"label": "D", "text": "To explain a scientific theory"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G02', 5,
        'What is mentioned in the document?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 2}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A deadline or schedule is included"}, {"label": "B", "text": "All services have been cancelled"}, {"label": "C", "text": "Readers must travel overseas"}, {"label": "D", "text": "The company has changed its name"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G02', 6,
        'What are readers asked to do?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 2}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignore the notice"}, {"label": "B", "text": "Follow an instruction or contact someone"}, {"label": "C", "text": "Pay with foreign currency only"}, {"label": "D", "text": "Send personal photographs"}]'::jsonb, 'B');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'Library Workshop Notice', 'REAL_TOEIC_LR_P7_SINGLE_G03', 'Library Workshop Notice: This document provides details about dates, services, prices, deadlines, and contact information for readers. It includes one important change and one instruction that readers should follow.', '[{"type": "single", "title": "Library Workshop Notice", "content": "Library Workshop Notice: This document provides details about dates, services, prices, deadlines, and contact information for readers. It includes one important change and one instruction that readers should follow."}]'::jsonb, '{}'::jsonb, '{"splitScreen": true, "passageType": "single", "questionsInGroup": 3}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "seed": "real_question_seed_v2"}'::jsonb, 3, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G03', 7,
        'What is the purpose of the document?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 3}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To provide information and instructions"}, {"label": "B", "text": "To compare two unrelated companies"}, {"label": "C", "text": "To reject a job application"}, {"label": "D", "text": "To explain a scientific theory"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G03', 8,
        'What is mentioned in the document?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 3}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A deadline or schedule is included"}, {"label": "B", "text": "All services have been cancelled"}, {"label": "C", "text": "Readers must travel overseas"}, {"label": "D", "text": "The company has changed its name"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G03', 9,
        'What are readers asked to do?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 3}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignore the notice"}, {"label": "B", "text": "Follow an instruction or contact someone"}, {"label": "C", "text": "Pay with foreign currency only"}, {"label": "D", "text": "Send personal photographs"}]'::jsonb, 'B');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'Hotel Guest Message', 'REAL_TOEIC_LR_P7_SINGLE_G04', 'Hotel Guest Message: This document provides details about dates, services, prices, deadlines, and contact information for readers. It includes one important change and one instruction that readers should follow.', '[{"type": "single", "title": "Hotel Guest Message", "content": "Hotel Guest Message: This document provides details about dates, services, prices, deadlines, and contact information for readers. It includes one important change and one instruction that readers should follow."}]'::jsonb, '{}'::jsonb, '{"splitScreen": true, "passageType": "single", "questionsInGroup": 3}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "seed": "real_question_seed_v2"}'::jsonb, 4, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G04', 10,
        'What is the purpose of the document?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 4}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To provide information and instructions"}, {"label": "B", "text": "To compare two unrelated companies"}, {"label": "C", "text": "To reject a job application"}, {"label": "D", "text": "To explain a scientific theory"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G04', 11,
        'What is mentioned in the document?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 4}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A deadline or schedule is included"}, {"label": "B", "text": "All services have been cancelled"}, {"label": "C", "text": "Readers must travel overseas"}, {"label": "D", "text": "The company has changed its name"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G04', 12,
        'What are readers asked to do?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 4}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignore the notice"}, {"label": "B", "text": "Follow an instruction or contact someone"}, {"label": "C", "text": "Pay with foreign currency only"}, {"label": "D", "text": "Send personal photographs"}]'::jsonb, 'B');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'Product Review', 'REAL_TOEIC_LR_P7_SINGLE_G05', 'Product Review: This document provides details about dates, services, prices, deadlines, and contact information for readers. It includes one important change and one instruction that readers should follow.', '[{"type": "single", "title": "Product Review", "content": "Product Review: This document provides details about dates, services, prices, deadlines, and contact information for readers. It includes one important change and one instruction that readers should follow."}]'::jsonb, '{}'::jsonb, '{"splitScreen": true, "passageType": "single", "questionsInGroup": 3}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "seed": "real_question_seed_v2"}'::jsonb, 5, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G05', 13,
        'What is the purpose of the document?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To provide information and instructions"}, {"label": "B", "text": "To compare two unrelated companies"}, {"label": "C", "text": "To reject a job application"}, {"label": "D", "text": "To explain a scientific theory"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G05', 14,
        'What is mentioned in the document?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A deadline or schedule is included"}, {"label": "B", "text": "All services have been cancelled"}, {"label": "C", "text": "Readers must travel overseas"}, {"label": "D", "text": "The company has changed its name"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G05', 15,
        'What are readers asked to do?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignore the notice"}, {"label": "B", "text": "Follow an instruction or contact someone"}, {"label": "C", "text": "Pay with foreign currency only"}, {"label": "D", "text": "Send personal photographs"}]'::jsonb, 'B');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'Job Posting', 'REAL_TOEIC_LR_P7_SINGLE_G06', 'Job Posting: This document provides details about dates, services, prices, deadlines, and contact information for readers. It includes one important change and one instruction that readers should follow.', '[{"type": "single", "title": "Job Posting", "content": "Job Posting: This document provides details about dates, services, prices, deadlines, and contact information for readers. It includes one important change and one instruction that readers should follow."}]'::jsonb, '{}'::jsonb, '{"splitScreen": true, "passageType": "single", "questionsInGroup": 3}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "seed": "real_question_seed_v2"}'::jsonb, 6, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G06', 16,
        'What is the purpose of the document?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 6}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To provide information and instructions"}, {"label": "B", "text": "To compare two unrelated companies"}, {"label": "C", "text": "To reject a job application"}, {"label": "D", "text": "To explain a scientific theory"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G06', 17,
        'What is mentioned in the document?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 6}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A deadline or schedule is included"}, {"label": "B", "text": "All services have been cancelled"}, {"label": "C", "text": "Readers must travel overseas"}, {"label": "D", "text": "The company has changed its name"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G06', 18,
        'What are readers asked to do?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 6}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignore the notice"}, {"label": "B", "text": "Follow an instruction or contact someone"}, {"label": "C", "text": "Pay with foreign currency only"}, {"label": "D", "text": "Send personal photographs"}]'::jsonb, 'B');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'Gym Membership Email', 'REAL_TOEIC_LR_P7_SINGLE_G07', 'Gym Membership Email: This document provides details about dates, services, prices, deadlines, and contact information for readers. It includes one important change and one instruction that readers should follow.', '[{"type": "single", "title": "Gym Membership Email", "content": "Gym Membership Email: This document provides details about dates, services, prices, deadlines, and contact information for readers. It includes one important change and one instruction that readers should follow."}]'::jsonb, '{}'::jsonb, '{"splitScreen": true, "passageType": "single", "questionsInGroup": 3}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "seed": "real_question_seed_v2"}'::jsonb, 7, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G07', 19,
        'What is the purpose of the document?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 7}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To provide information and instructions"}, {"label": "B", "text": "To compare two unrelated companies"}, {"label": "C", "text": "To reject a job application"}, {"label": "D", "text": "To explain a scientific theory"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G07', 20,
        'What is mentioned in the document?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 7}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A deadline or schedule is included"}, {"label": "B", "text": "All services have been cancelled"}, {"label": "C", "text": "Readers must travel overseas"}, {"label": "D", "text": "The company has changed its name"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G07', 21,
        'What are readers asked to do?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 7}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignore the notice"}, {"label": "B", "text": "Follow an instruction or contact someone"}, {"label": "C", "text": "Pay with foreign currency only"}, {"label": "D", "text": "Send personal photographs"}]'::jsonb, 'B');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'Restaurant Coupon', 'REAL_TOEIC_LR_P7_SINGLE_G08', 'Restaurant Coupon: This document provides details about dates, services, prices, deadlines, and contact information for readers. It includes one important change and one instruction that readers should follow.', '[{"type": "single", "title": "Restaurant Coupon", "content": "Restaurant Coupon: This document provides details about dates, services, prices, deadlines, and contact information for readers. It includes one important change and one instruction that readers should follow."}]'::jsonb, '{}'::jsonb, '{"splitScreen": true, "passageType": "single", "questionsInGroup": 3}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "seed": "real_question_seed_v2"}'::jsonb, 8, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G08', 22,
        'What is the purpose of the document?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 8}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To provide information and instructions"}, {"label": "B", "text": "To compare two unrelated companies"}, {"label": "C", "text": "To reject a job application"}, {"label": "D", "text": "To explain a scientific theory"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G08', 23,
        'What is mentioned in the document?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 8}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A deadline or schedule is included"}, {"label": "B", "text": "All services have been cancelled"}, {"label": "C", "text": "Readers must travel overseas"}, {"label": "D", "text": "The company has changed its name"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G08', 24,
        'What are readers asked to do?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 8}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignore the notice"}, {"label": "B", "text": "Follow an instruction or contact someone"}, {"label": "C", "text": "Pay with foreign currency only"}, {"label": "D", "text": "Send personal photographs"}]'::jsonb, 'B');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'Apartment Maintenance Notice', 'REAL_TOEIC_LR_P7_SINGLE_G09', 'Apartment Maintenance Notice: This document provides details about dates, services, prices, deadlines, and contact information for readers. It includes one important change and one instruction that readers should follow.', '[{"type": "single", "title": "Apartment Maintenance Notice", "content": "Apartment Maintenance Notice: This document provides details about dates, services, prices, deadlines, and contact information for readers. It includes one important change and one instruction that readers should follow."}]'::jsonb, '{}'::jsonb, '{"splitScreen": true, "passageType": "single", "questionsInGroup": 3}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "seed": "real_question_seed_v2"}'::jsonb, 9, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G09', 25,
        'What is the purpose of the document?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 9}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To provide information and instructions"}, {"label": "B", "text": "To compare two unrelated companies"}, {"label": "C", "text": "To reject a job application"}, {"label": "D", "text": "To explain a scientific theory"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G09', 26,
        'What is mentioned in the document?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 9}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A deadline or schedule is included"}, {"label": "B", "text": "All services have been cancelled"}, {"label": "C", "text": "Readers must travel overseas"}, {"label": "D", "text": "The company has changed its name"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G09', 27,
        'What are readers asked to do?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 9}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignore the notice"}, {"label": "B", "text": "Follow an instruction or contact someone"}, {"label": "C", "text": "Pay with foreign currency only"}, {"label": "D", "text": "Send personal photographs"}]'::jsonb, 'B');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'Travel Itinerary', 'REAL_TOEIC_LR_P7_SINGLE_G10', 'Travel Itinerary: This document provides details about dates, services, prices, deadlines, and contact information for readers. It includes one important change and one instruction that readers should follow.', '[{"type": "single", "title": "Travel Itinerary", "content": "Travel Itinerary: This document provides details about dates, services, prices, deadlines, and contact information for readers. It includes one important change and one instruction that readers should follow."}]'::jsonb, '{}'::jsonb, '{"splitScreen": true, "passageType": "single", "questionsInGroup": 2}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "seed": "real_question_seed_v2"}'::jsonb, 10, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G10', 28,
        'What is the purpose of the document?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 10}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To provide information and instructions"}, {"label": "B", "text": "To compare two unrelated companies"}, {"label": "C", "text": "To reject a job application"}, {"label": "D", "text": "To explain a scientific theory"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_SINGLE_G10', 29,
        'What is mentioned in the document?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "single", "groupNo": 10}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A deadline or schedule is included"}, {"label": "B", "text": "All services have been cancelled"}, {"label": "C", "text": "Readers must travel overseas"}, {"label": "D", "text": "The company has changed its name"}]'::jsonb, 'A');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'Supplier Email and Invoice', 'REAL_TOEIC_LR_P7_MULTI_G01', 'Read the two related texts and answer the questions.', '[{"type": "email", "title": "Supplier Email and Invoice - Source A", "content": "The first source gives the main request, date, price, or schedule."}, {"type": "notice", "title": "Supplier Email and Invoice - Source B", "content": "The second source gives additional details that must be compared with Source A."}]'::jsonb, '{}'::jsonb, '{"splitScreen": true, "passageType": "multiple", "questionsInGroup": 5}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "seed": "real_question_seed_v2"}'::jsonb, 21, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G01', 30,
        'Why did the writer send the message?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 1}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To request or confirm information"}, {"label": "B", "text": "To cancel a national holiday"}, {"label": "C", "text": "To advertise a movie"}, {"label": "D", "text": "To complain about weather"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G01', 31,
        'What information appears in both texts?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 1}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A person’s birthday"}, {"label": "B", "text": "A date, time, price, or item name"}, {"label": "C", "text": "A recipe ingredient"}, {"label": "D", "text": "A university ranking"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G01', 32,
        'What can be inferred about the recipient?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 1}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The recipient needs to compare details before taking action"}, {"label": "B", "text": "The recipient has already retired"}, {"label": "C", "text": "The recipient works as a musician"}, {"label": "D", "text": "The recipient lives in a hotel permanently"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G01', 33,
        'Which item is probably true?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 1}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Some detail has changed or requires confirmation"}, {"label": "B", "text": "No action is possible"}, {"label": "C", "text": "The texts are about sports results"}, {"label": "D", "text": "The sender refuses to communicate"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G01', 34,
        'What should the recipient do next?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 1}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Check the details and respond or proceed accordingly"}, {"label": "B", "text": "Delete both documents"}, {"label": "C", "text": "Buy a new computer immediately"}, {"label": "D", "text": "Close the business"}]'::jsonb, 'A');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'Conference Program and Message', 'REAL_TOEIC_LR_P7_MULTI_G02', 'Read the two related texts and answer the questions.', '[{"type": "email", "title": "Conference Program and Message - Source A", "content": "The first source gives the main request, date, price, or schedule."}, {"type": "notice", "title": "Conference Program and Message - Source B", "content": "The second source gives additional details that must be compared with Source A."}]'::jsonb, '{}'::jsonb, '{"splitScreen": true, "passageType": "multiple", "questionsInGroup": 5}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "seed": "real_question_seed_v2"}'::jsonb, 22, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G02', 35,
        'Why did the writer send the message?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 2}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To request or confirm information"}, {"label": "B", "text": "To cancel a national holiday"}, {"label": "C", "text": "To advertise a movie"}, {"label": "D", "text": "To complain about weather"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G02', 36,
        'What information appears in both texts?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 2}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A person’s birthday"}, {"label": "B", "text": "A date, time, price, or item name"}, {"label": "C", "text": "A recipe ingredient"}, {"label": "D", "text": "A university ranking"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G02', 37,
        'What can be inferred about the recipient?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 2}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The recipient needs to compare details before taking action"}, {"label": "B", "text": "The recipient has already retired"}, {"label": "C", "text": "The recipient works as a musician"}, {"label": "D", "text": "The recipient lives in a hotel permanently"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G02', 38,
        'Which item is probably true?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 2}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Some detail has changed or requires confirmation"}, {"label": "B", "text": "No action is possible"}, {"label": "C", "text": "The texts are about sports results"}, {"label": "D", "text": "The sender refuses to communicate"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G02', 39,
        'What should the recipient do next?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 2}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Check the details and respond or proceed accordingly"}, {"label": "B", "text": "Delete both documents"}, {"label": "C", "text": "Buy a new computer immediately"}, {"label": "D", "text": "Close the business"}]'::jsonb, 'A');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'Train Schedule and Customer Email', 'REAL_TOEIC_LR_P7_MULTI_G03', 'Read the two related texts and answer the questions.', '[{"type": "email", "title": "Train Schedule and Customer Email - Source A", "content": "The first source gives the main request, date, price, or schedule."}, {"type": "notice", "title": "Train Schedule and Customer Email - Source B", "content": "The second source gives additional details that must be compared with Source A."}]'::jsonb, '{}'::jsonb, '{"splitScreen": true, "passageType": "multiple", "questionsInGroup": 5}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "seed": "real_question_seed_v2"}'::jsonb, 23, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G03', 40,
        'Why did the writer send the message?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 3}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To request or confirm information"}, {"label": "B", "text": "To cancel a national holiday"}, {"label": "C", "text": "To advertise a movie"}, {"label": "D", "text": "To complain about weather"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G03', 41,
        'What information appears in both texts?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 3}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A person’s birthday"}, {"label": "B", "text": "A date, time, price, or item name"}, {"label": "C", "text": "A recipe ingredient"}, {"label": "D", "text": "A university ranking"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G03', 42,
        'What can be inferred about the recipient?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 3}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The recipient needs to compare details before taking action"}, {"label": "B", "text": "The recipient has already retired"}, {"label": "C", "text": "The recipient works as a musician"}, {"label": "D", "text": "The recipient lives in a hotel permanently"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G03', 43,
        'Which item is probably true?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 3}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Some detail has changed or requires confirmation"}, {"label": "B", "text": "No action is possible"}, {"label": "C", "text": "The texts are about sports results"}, {"label": "D", "text": "The sender refuses to communicate"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G03', 44,
        'What should the recipient do next?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 3}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Check the details and respond or proceed accordingly"}, {"label": "B", "text": "Delete both documents"}, {"label": "C", "text": "Buy a new computer immediately"}, {"label": "D", "text": "Close the business"}]'::jsonb, 'A');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'Product Advertisement and Review', 'REAL_TOEIC_LR_P7_MULTI_G04', 'Read the two related texts and answer the questions.', '[{"type": "email", "title": "Product Advertisement and Review - Source A", "content": "The first source gives the main request, date, price, or schedule."}, {"type": "notice", "title": "Product Advertisement and Review - Source B", "content": "The second source gives additional details that must be compared with Source A."}]'::jsonb, '{}'::jsonb, '{"splitScreen": true, "passageType": "multiple", "questionsInGroup": 5}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "seed": "real_question_seed_v2"}'::jsonb, 24, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G04', 45,
        'Why did the writer send the message?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 4}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To request or confirm information"}, {"label": "B", "text": "To cancel a national holiday"}, {"label": "C", "text": "To advertise a movie"}, {"label": "D", "text": "To complain about weather"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G04', 46,
        'What information appears in both texts?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 4}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A person’s birthday"}, {"label": "B", "text": "A date, time, price, or item name"}, {"label": "C", "text": "A recipe ingredient"}, {"label": "D", "text": "A university ranking"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G04', 47,
        'What can be inferred about the recipient?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 4}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The recipient needs to compare details before taking action"}, {"label": "B", "text": "The recipient has already retired"}, {"label": "C", "text": "The recipient works as a musician"}, {"label": "D", "text": "The recipient lives in a hotel permanently"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G04', 48,
        'Which item is probably true?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 4}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Some detail has changed or requires confirmation"}, {"label": "B", "text": "No action is possible"}, {"label": "C", "text": "The texts are about sports results"}, {"label": "D", "text": "The sender refuses to communicate"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G04', 49,
        'What should the recipient do next?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 4}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Check the details and respond or proceed accordingly"}, {"label": "B", "text": "Delete both documents"}, {"label": "C", "text": "Buy a new computer immediately"}, {"label": "D", "text": "Close the business"}]'::jsonb, 'A');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'Office Policy and Staff Chat', 'REAL_TOEIC_LR_P7_MULTI_G05', 'Read the two related texts and answer the questions.', '[{"type": "email", "title": "Office Policy and Staff Chat - Source A", "content": "The first source gives the main request, date, price, or schedule."}, {"type": "notice", "title": "Office Policy and Staff Chat - Source B", "content": "The second source gives additional details that must be compared with Source A."}]'::jsonb, '{}'::jsonb, '{"splitScreen": true, "passageType": "multiple", "questionsInGroup": 5}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "seed": "real_question_seed_v2"}'::jsonb, 25, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G05', 50,
        'Why did the writer send the message?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To request or confirm information"}, {"label": "B", "text": "To cancel a national holiday"}, {"label": "C", "text": "To advertise a movie"}, {"label": "D", "text": "To complain about weather"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G05', 51,
        'What information appears in both texts?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A person’s birthday"}, {"label": "B", "text": "A date, time, price, or item name"}, {"label": "C", "text": "A recipe ingredient"}, {"label": "D", "text": "A university ranking"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G05', 52,
        'What can be inferred about the recipient?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The recipient needs to compare details before taking action"}, {"label": "B", "text": "The recipient has already retired"}, {"label": "C", "text": "The recipient works as a musician"}, {"label": "D", "text": "The recipient lives in a hotel permanently"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G05', 53,
        'Which item is probably true?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Some detail has changed or requires confirmation"}, {"label": "B", "text": "No action is possible"}, {"label": "C", "text": "The texts are about sports results"}, {"label": "D", "text": "The sender refuses to communicate"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_LR', 'TOEIC', 'Reading', 'Part 7', 'group_choice', 'REAL_TOEIC_LR_P7_MULTI_G05', 54,
        'What should the recipient do next?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "splitScreen": true}'::jsonb, '{"toeicPart": 7, "part7Type": "multiple", "groupNo": 5}'::jsonb, NULL, NULL, NULL, NULL, NULL, 1, 'Reading - Part 7', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Check the details and respond or proceed accordingly"}, {"label": "B", "text": "Delete both documents"}, {"label": "C", "text": "Buy a new computer immediately"}, {"label": "D", "text": "Close the business"}]'::jsonb, 'A');


    -- Duplicate TOEIC Listening/Reading bank into TOEIC_4_SKILLS format.
    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    SELECT tenant_id, 'TOEIC_4_SKILLS', exam_type, skill, part, title || ' (TOEIC 4 Skills)', replace(group_key, 'REAL_TOEIC_LR', 'REAL_TOEIC4'), content, passages, media, display_config,
           metadata || jsonb_build_object('seed','real_question_seed_v2','sourceFormat','TOEIC_LR'), order_number, created_by
    FROM public.exam_question_groups
    WHERE tenant_id=v_tenant_id AND format_code='TOEIC_LR' AND metadata ->> 'seed'='real_question_seed_v2'
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();

    INSERT INTO public.exam_questions (
        tenant_id, exam_type, format_code, skill, part, question_type, group_key, sequence_no, question_group, question_text,
        image_url, audio_url, media, display_config, metadata, prep_seconds, response_seconds, section_seconds, min_words,
        max_words, difficulty, topic, explanation, score, status, created_by
    )
    SELECT tenant_id, exam_type, 'TOEIC_4_SKILLS', skill, part, question_type,
           CASE WHEN group_key IS NULL THEN NULL ELSE replace(group_key, 'REAL_TOEIC_LR', 'REAL_TOEIC4') END,
           sequence_no, CASE WHEN question_group IS NULL THEN NULL ELSE replace(question_group, 'REAL_TOEIC_LR', 'REAL_TOEIC4') END,
           question_text, image_url, audio_url, media, display_config,
           metadata || jsonb_build_object('seed','real_question_seed_v2','sourceFormat','TOEIC_LR'), prep_seconds, response_seconds, section_seconds, min_words,
           max_words, difficulty, topic, explanation, score, status, created_by
    FROM public.exam_questions
    WHERE tenant_id = v_tenant_id AND format_code='TOEIC_LR' AND metadata ->> 'seed' = 'real_question_seed_v2';

    INSERT INTO public.exam_question_options (question_id, option_label, option_text, is_correct)
    SELECT q4.id, o.option_label, o.option_text, o.is_correct
    FROM public.exam_questions q2
    JOIN public.exam_questions q4 ON q4.tenant_id=q2.tenant_id AND q4.format_code='TOEIC_4_SKILLS' AND q4.skill=q2.skill AND q4.part=q2.part AND q4.sequence_no=q2.sequence_no AND COALESCE(q4.group_key,'')=COALESCE(replace(q2.group_key, 'REAL_TOEIC_LR', 'REAL_TOEIC4'),'') AND q4.metadata ->> 'sourceFormat' = 'TOEIC_LR'
    JOIN public.exam_question_options o ON o.question_id=q2.id
    WHERE q2.tenant_id=v_tenant_id AND q2.format_code='TOEIC_LR' AND q2.metadata ->> 'seed'='real_question_seed_v2';


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Speaking', 'Question 1-2', 'speaking_read_aloud', NULL, 1,
        'Read the following text aloud: Welcome to Green Valley Fitness Center. Our new evening classes begin next Monday, and members can register online or at the front desk.', NULL, NULL, '{"inputMode": "text", "recording": true, "requiresImage": false, "requiresAudio": false}'::jsonb, '{"toeicSpeakingQuestion": 1, "placeholderMedia": false}'::jsonb, 45, 45, NULL, NULL, NULL, 1, 'TOEIC Speaking', 'Giáo viên chấm theo phát âm, độ trôi chảy, ngữ pháp, từ vựng và mức độ hoàn thành yêu cầu.', '[]'::jsonb, NULL);


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Speaking', 'Question 1-2', 'speaking_read_aloud', NULL, 2,
        'Read the following text aloud: Thank you for calling BrightTech Support. Our representatives are available from 8 a.m. to 8 p.m. on weekdays.', NULL, NULL, '{"inputMode": "text", "recording": true, "requiresImage": false, "requiresAudio": false}'::jsonb, '{"toeicSpeakingQuestion": 2, "placeholderMedia": false}'::jsonb, 45, 45, NULL, NULL, NULL, 1, 'TOEIC Speaking', 'Giáo viên chấm theo phát âm, độ trôi chảy, ngữ pháp, từ vựng và mức độ hoàn thành yêu cầu.', '[]'::jsonb, NULL);


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Speaking', 'Question 3-4', 'speaking_describe_picture', NULL, 3,
        'Describe the picture in as much detail as possible. Focus on the people, place, and actions you can see.', '/uploads/exams/toeic/4skills/speaking/picture_01.jpg', NULL, '{"inputMode": "image", "recording": true, "requiresImage": true, "requiresAudio": false}'::jsonb, '{"toeicSpeakingQuestion": 3, "placeholderMedia": true}'::jsonb, 45, 30, NULL, NULL, NULL, 1, 'TOEIC Speaking', 'Giáo viên chấm theo phát âm, độ trôi chảy, ngữ pháp, từ vựng và mức độ hoàn thành yêu cầu.', '[]'::jsonb, NULL);


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Speaking', 'Question 3-4', 'speaking_describe_picture', NULL, 4,
        'Describe the picture in as much detail as possible. Mention the setting, objects, and what may be happening.', '/uploads/exams/toeic/4skills/speaking/picture_02.jpg', NULL, '{"inputMode": "image", "recording": true, "requiresImage": true, "requiresAudio": false}'::jsonb, '{"toeicSpeakingQuestion": 4, "placeholderMedia": true}'::jsonb, 45, 30, NULL, NULL, NULL, 1, 'TOEIC Speaking', 'Giáo viên chấm theo phát âm, độ trôi chảy, ngữ pháp, từ vựng và mức độ hoàn thành yêu cầu.', '[]'::jsonb, NULL);


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Speaking', 'Question 5-6', 'speaking_answer_question', NULL, 5,
        'Imagine you are answering a survey. How often do you use public transportation, and why? ', NULL, '/uploads/exams/toeic/4skills/speaking/q05.mp3', '{"inputMode": "text_audio", "recording": true, "requiresImage": false, "requiresAudio": true}'::jsonb, '{"toeicSpeakingQuestion": 5, "placeholderMedia": true}'::jsonb, 3, 15, NULL, NULL, NULL, 1, 'TOEIC Speaking', 'Giáo viên chấm theo phát âm, độ trôi chảy, ngữ pháp, từ vựng và mức độ hoàn thành yêu cầu.', '[]'::jsonb, NULL);


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Speaking', 'Question 5-6', 'speaking_answer_question', NULL, 6,
        'Imagine you are answering a survey. What kind of restaurants do you usually choose when eating out?', NULL, '/uploads/exams/toeic/4skills/speaking/q06.mp3', '{"inputMode": "text_audio", "recording": true, "requiresImage": false, "requiresAudio": true}'::jsonb, '{"toeicSpeakingQuestion": 6, "placeholderMedia": true}'::jsonb, 3, 15, NULL, NULL, NULL, 1, 'TOEIC Speaking', 'Giáo viên chấm theo phát âm, độ trôi chảy, ngữ pháp, từ vựng và mức độ hoàn thành yêu cầu.', '[]'::jsonb, NULL);


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Speaking', 'Question 7', 'speaking_answer_question', NULL, 7,
        'Imagine you are answering a survey. What is one important factor when choosing a job, and why?', NULL, '/uploads/exams/toeic/4skills/speaking/q07.mp3', '{"inputMode": "text_audio", "recording": true, "requiresImage": false, "requiresAudio": true}'::jsonb, '{"toeicSpeakingQuestion": 7, "placeholderMedia": true}'::jsonb, 3, 30, NULL, NULL, NULL, 1, 'TOEIC Speaking', 'Giáo viên chấm theo phát âm, độ trôi chảy, ngữ pháp, từ vựng và mức độ hoàn thành yêu cầu.', '[]'::jsonb, NULL);


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Speaking', 'Question 8-10', 'TOEIC Speaking Information Table', 'REAL_TOEIC4_SPEAKING_Q8_10_INFO', 'Conference Schedule: 9:00 Registration, 9:30 Opening Remarks, 10:15 Marketing Workshop, 12:00 Lunch, 13:30 Client Communication Session, 15:00 Closing Discussion.', '[{"title": "Conference Schedule", "content": "9:00 Registration; 9:30 Opening Remarks; 10:15 Marketing Workshop; 12:00 Lunch; 13:30 Client Communication Session; 15:00 Closing Discussion."}]'::jsonb, '{}'::jsonb, '{"groupPreviewSeconds": 45, "inputMode": "group_audio"}'::jsonb, '{"toeicSpeakingQuestion": "8-10", "seed": "real_question_seed_v2"}'::jsonb, 1, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Speaking', 'Question 8-10', 'speaking_info_question', 'REAL_TOEIC4_SPEAKING_Q8_10_INFO', 8,
        'Based on the schedule, when does the Marketing Workshop begin?', NULL, NULL, '{"inputMode": "group_audio", "recording": true, "groupPreviewSeconds": 45}'::jsonb, '{"toeicSpeakingQuestion": 8}'::jsonb, 3, 15, NULL, NULL, NULL, 1, 'TOEIC Speaking', 'Giáo viên chấm câu trả lời dựa trên thông tin trong bảng.', '[]'::jsonb, NULL);


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Speaking', 'Question 8-10', 'speaking_info_question', 'REAL_TOEIC4_SPEAKING_Q8_10_INFO', 9,
        'Based on the schedule, what happens immediately after the workshop?', NULL, NULL, '{"inputMode": "group_audio", "recording": true, "groupPreviewSeconds": 45}'::jsonb, '{"toeicSpeakingQuestion": 9}'::jsonb, 3, 15, NULL, NULL, NULL, 1, 'TOEIC Speaking', 'Giáo viên chấm câu trả lời dựa trên thông tin trong bảng.', '[]'::jsonb, NULL);


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Speaking', 'Question 10', 'speaking_info_question', 'REAL_TOEIC4_SPEAKING_Q8_10_INFO', 10,
        'A participant wants to learn about communicating with clients. Which session should the participant attend?', NULL, NULL, '{"inputMode": "group_audio", "recording": true, "groupPreviewSeconds": 45}'::jsonb, '{"toeicSpeakingQuestion": 10}'::jsonb, 3, 30, NULL, NULL, NULL, 1, 'TOEIC Speaking', 'Giáo viên chấm câu trả lời dựa trên thông tin trong bảng.', '[]'::jsonb, NULL);


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Speaking', 'Question 11', 'speaking_opinion', NULL, 11,
        'Some people think companies should allow employees to work from home at least two days a week. Do you agree or disagree? Give reasons and examples.', NULL, NULL, '{"inputMode": "text", "recording": true}'::jsonb, '{"toeicSpeakingQuestion": 11}'::jsonb, 30, 60, NULL, NULL, NULL, 1, 'TOEIC Speaking', 'Giáo viên chấm theo quan điểm, tổ chức ý, ngữ pháp, từ vựng và phát âm.', '[]'::jsonb, NULL);


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Writing', 'Question 1-5', 'writing_picture_sentence', NULL, 1,
        'Write one sentence about the picture using the two words: "delivery" and "customer".', '/uploads/exams/toeic/4skills/writing/picture_sentence_01.jpg', NULL, '{"inputMode": "picture_keywords", "requiresImage": true, "requiredKeywords": 2}'::jsonb, '{"toeicWritingQuestion": 1, "placeholderMedia": true}'::jsonb, NULL, NULL, 480, NULL, NULL, 1, 'TOEIC Writing', 'Câu trả lời mẫu cần là một câu hoàn chỉnh, đúng ngữ pháp và dùng đủ hai từ khóa.', '[]'::jsonb, NULL);


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Writing', 'Question 1-5', 'writing_picture_sentence', NULL, 2,
        'Write one sentence about the picture using the two words: "meeting" and "laptop".', '/uploads/exams/toeic/4skills/writing/picture_sentence_02.jpg', NULL, '{"inputMode": "picture_keywords", "requiresImage": true, "requiredKeywords": 2}'::jsonb, '{"toeicWritingQuestion": 2, "placeholderMedia": true}'::jsonb, NULL, NULL, 480, NULL, NULL, 1, 'TOEIC Writing', 'Câu trả lời mẫu cần là một câu hoàn chỉnh, đúng ngữ pháp và dùng đủ hai từ khóa.', '[]'::jsonb, NULL);


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Writing', 'Question 1-5', 'writing_picture_sentence', NULL, 3,
        'Write one sentence about the picture using the two words: "factory" and "workers".', '/uploads/exams/toeic/4skills/writing/picture_sentence_03.jpg', NULL, '{"inputMode": "picture_keywords", "requiresImage": true, "requiredKeywords": 2}'::jsonb, '{"toeicWritingQuestion": 3, "placeholderMedia": true}'::jsonb, NULL, NULL, 480, NULL, NULL, 1, 'TOEIC Writing', 'Câu trả lời mẫu cần là một câu hoàn chỉnh, đúng ngữ pháp và dùng đủ hai từ khóa.', '[]'::jsonb, NULL);


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Writing', 'Question 1-5', 'writing_picture_sentence', NULL, 4,
        'Write one sentence about the picture using the two words: "restaurant" and "menu".', '/uploads/exams/toeic/4skills/writing/picture_sentence_04.jpg', NULL, '{"inputMode": "picture_keywords", "requiresImage": true, "requiredKeywords": 2}'::jsonb, '{"toeicWritingQuestion": 4, "placeholderMedia": true}'::jsonb, NULL, NULL, 480, NULL, NULL, 1, 'TOEIC Writing', 'Câu trả lời mẫu cần là một câu hoàn chỉnh, đúng ngữ pháp và dùng đủ hai từ khóa.', '[]'::jsonb, NULL);


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Writing', 'Question 1-5', 'writing_picture_sentence', NULL, 5,
        'Write one sentence about the picture using the two words: "airport" and "luggage".', '/uploads/exams/toeic/4skills/writing/picture_sentence_05.jpg', NULL, '{"inputMode": "picture_keywords", "requiresImage": true, "requiredKeywords": 2}'::jsonb, '{"toeicWritingQuestion": 5, "placeholderMedia": true}'::jsonb, NULL, NULL, 480, NULL, NULL, 1, 'TOEIC Writing', 'Câu trả lời mẫu cần là một câu hoàn chỉnh, đúng ngữ pháp và dùng đủ hai từ khóa.', '[]'::jsonb, NULL);


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Writing', 'Question 6-7', 'writing_email_response', NULL, 1,
        'You received an email from a client asking to change a product delivery date. Write a reply confirming the new date, explaining one possible limitation, and offering further help.', NULL, NULL, '{"inputMode": "email", "sectionSeconds": 1200}'::jsonb, '{"toeicWritingQuestion": 6}'::jsonb, NULL, NULL, 1200, NULL, NULL, 1, 'TOEIC Writing', 'Email cần trả lời đủ ý, lịch sự, có mở đầu/kết thúc phù hợp.', '[]'::jsonb, NULL);


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Writing', 'Question 6-7', 'writing_email_response', NULL, 2,
        'You received an email from a colleague asking for feedback on a presentation. Write a reply giving two suggestions and offering to review the slides again.', NULL, NULL, '{"inputMode": "email", "sectionSeconds": 1200}'::jsonb, '{"toeicWritingQuestion": 7}'::jsonb, NULL, NULL, 1200, NULL, NULL, 1, 'TOEIC Writing', 'Email cần trả lời đủ ý, lịch sự, có mở đầu/kết thúc phù hợp.', '[]'::jsonb, NULL);


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'TOEIC_4_SKILLS', 'TOEIC', 'Writing', 'Question 8', 'writing_essay', NULL, 8,
        'Write an essay of at least 300 words: Do you agree or disagree that companies should invest more in employee training than in advertising? Give reasons and examples.', NULL, NULL, '{"inputMode": "essay", "sectionSeconds": 1800, "minWords": 300}'::jsonb, '{"toeicWritingQuestion": 8}'::jsonb, NULL, NULL, 1800, 300, NULL, 1, 'TOEIC Writing', 'Bài luận cần có quan điểm rõ, lý do, ví dụ và bố cục mạch lạc.', '[]'::jsonb, NULL);


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 1', 'VSTEP Listening Part 1 - Full Audio', 'REAL_VSTEP_L1_PART_AUDIO', 'This part contains announcements and short instructions. Replace with the real imported audio/transcript later.', '[]'::jsonb, '{"audio": "/uploads/exams/vstep/listening/part1/part_01_full.mp3"}'::jsonb, '{"questionsPerPart": 8, "audioScope": "part", "requiresAudio": true}'::jsonb, '{"vstepPart": "L1", "placeholderMedia": true, "audioScope": "part", "seed": "real_question_seed_v2"}'::jsonb, 1, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 1', 'group_choice', 'REAL_VSTEP_L1_PART_AUDIO', 1,
        'Choose the best answer based on Listening Part 1, question 1.', NULL, '/uploads/exams/vstep/listening/part1/part_01_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L1", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The talk explains causes, examples, and possible effects."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'C');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 1', 'group_choice', 'REAL_VSTEP_L1_PART_AUDIO', 2,
        'Choose the best answer based on Listening Part 1, question 2.', NULL, '/uploads/exams/vstep/listening/part1/part_01_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L1", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The listener should check details before taking action."}]'::jsonb, 'D');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 1', 'group_choice', 'REAL_VSTEP_L1_PART_AUDIO', 3,
        'Choose the best answer based on Listening Part 1, question 3.', NULL, '/uploads/exams/vstep/listening/part1/part_01_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L1", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 1', 'group_choice', 'REAL_VSTEP_L1_PART_AUDIO', 4,
        'Choose the best answer based on Listening Part 1, question 4.', NULL, '/uploads/exams/vstep/listening/part1/part_01_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L1", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speakers disagree about a plan but reach a decision."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 1', 'group_choice', 'REAL_VSTEP_L1_PART_AUDIO', 5,
        'Choose the best answer based on Listening Part 1, question 5.', NULL, '/uploads/exams/vstep/listening/part1/part_01_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L1", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The talk explains causes, examples, and possible effects."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'C');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 1', 'group_choice', 'REAL_VSTEP_L1_PART_AUDIO', 6,
        'Choose the best answer based on Listening Part 1, question 6.', NULL, '/uploads/exams/vstep/listening/part1/part_01_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L1", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The listener should check details before taking action."}]'::jsonb, 'D');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 1', 'group_choice', 'REAL_VSTEP_L1_PART_AUDIO', 7,
        'Choose the best answer based on Listening Part 1, question 7.', NULL, '/uploads/exams/vstep/listening/part1/part_01_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L1", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 1', 'group_choice', 'REAL_VSTEP_L1_PART_AUDIO', 8,
        'Choose the best answer based on Listening Part 1, question 8.', NULL, '/uploads/exams/vstep/listening/part1/part_01_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L1", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speakers disagree about a plan but reach a decision."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'B');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 2', 'VSTEP Listening Part 2 - Full Audio', 'REAL_VSTEP_L2_PART_AUDIO', 'This part contains conversations about study, work, and daily services. Replace with the real imported audio/transcript later.', '[]'::jsonb, '{"audio": "/uploads/exams/vstep/listening/part2/part_02_full.mp3"}'::jsonb, '{"questionsPerPart": 12, "audioScope": "part", "requiresAudio": true}'::jsonb, '{"vstepPart": "L2", "placeholderMedia": true, "audioScope": "part", "seed": "real_question_seed_v2"}'::jsonb, 2, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 2', 'group_choice', 'REAL_VSTEP_L2_PART_AUDIO', 1,
        'Choose the best answer based on Listening Part 2, question 1.', NULL, '/uploads/exams/vstep/listening/part2/part_02_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L2", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The listener should check details before taking action."}]'::jsonb, 'D');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 2', 'group_choice', 'REAL_VSTEP_L2_PART_AUDIO', 2,
        'Choose the best answer based on Listening Part 2, question 2.', NULL, '/uploads/exams/vstep/listening/part2/part_02_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L2", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 2', 'group_choice', 'REAL_VSTEP_L2_PART_AUDIO', 3,
        'Choose the best answer based on Listening Part 2, question 3.', NULL, '/uploads/exams/vstep/listening/part2/part_02_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L2", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speakers disagree about a plan but reach a decision."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 2', 'group_choice', 'REAL_VSTEP_L2_PART_AUDIO', 4,
        'Choose the best answer based on Listening Part 2, question 4.', NULL, '/uploads/exams/vstep/listening/part2/part_02_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L2", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The talk explains causes, examples, and possible effects."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'C');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 2', 'group_choice', 'REAL_VSTEP_L2_PART_AUDIO', 5,
        'Choose the best answer based on Listening Part 2, question 5.', NULL, '/uploads/exams/vstep/listening/part2/part_02_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L2", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The listener should check details before taking action."}]'::jsonb, 'D');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 2', 'group_choice', 'REAL_VSTEP_L2_PART_AUDIO', 6,
        'Choose the best answer based on Listening Part 2, question 6.', NULL, '/uploads/exams/vstep/listening/part2/part_02_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L2", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 2', 'group_choice', 'REAL_VSTEP_L2_PART_AUDIO', 7,
        'Choose the best answer based on Listening Part 2, question 7.', NULL, '/uploads/exams/vstep/listening/part2/part_02_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L2", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speakers disagree about a plan but reach a decision."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 2', 'group_choice', 'REAL_VSTEP_L2_PART_AUDIO', 8,
        'Choose the best answer based on Listening Part 2, question 8.', NULL, '/uploads/exams/vstep/listening/part2/part_02_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L2", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The talk explains causes, examples, and possible effects."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'C');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 2', 'group_choice', 'REAL_VSTEP_L2_PART_AUDIO', 9,
        'Choose the best answer based on Listening Part 2, question 9.', NULL, '/uploads/exams/vstep/listening/part2/part_02_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L2", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The listener should check details before taking action."}]'::jsonb, 'D');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 2', 'group_choice', 'REAL_VSTEP_L2_PART_AUDIO', 10,
        'Choose the best answer based on Listening Part 2, question 10.', NULL, '/uploads/exams/vstep/listening/part2/part_02_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L2", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 2', 'group_choice', 'REAL_VSTEP_L2_PART_AUDIO', 11,
        'Choose the best answer based on Listening Part 2, question 11.', NULL, '/uploads/exams/vstep/listening/part2/part_02_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L2", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speakers disagree about a plan but reach a decision."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 2', 'group_choice', 'REAL_VSTEP_L2_PART_AUDIO', 12,
        'Choose the best answer based on Listening Part 2, question 12.', NULL, '/uploads/exams/vstep/listening/part2/part_02_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L2", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The talk explains causes, examples, and possible effects."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 3', 'VSTEP Listening Part 3 - Full Audio', 'REAL_VSTEP_L3_PART_AUDIO', 'This part contains lectures and presentations on education, technology, and society. Replace with the real imported audio/transcript later.', '[]'::jsonb, '{"audio": "/uploads/exams/vstep/listening/part3/part_03_full.mp3"}'::jsonb, '{"questionsPerPart": 15, "audioScope": "part", "requiresAudio": true}'::jsonb, '{"vstepPart": "L3", "placeholderMedia": true, "audioScope": "part", "seed": "real_question_seed_v2"}'::jsonb, 3, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 3', 'group_choice', 'REAL_VSTEP_L3_PART_AUDIO', 1,
        'Choose the best answer based on Listening Part 3, question 1.', NULL, '/uploads/exams/vstep/listening/part3/part_03_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L3", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 3', 'group_choice', 'REAL_VSTEP_L3_PART_AUDIO', 2,
        'Choose the best answer based on Listening Part 3, question 2.', NULL, '/uploads/exams/vstep/listening/part3/part_03_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L3", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speakers disagree about a plan but reach a decision."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 3', 'group_choice', 'REAL_VSTEP_L3_PART_AUDIO', 3,
        'Choose the best answer based on Listening Part 3, question 3.', NULL, '/uploads/exams/vstep/listening/part3/part_03_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L3", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The talk explains causes, examples, and possible effects."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'C');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 3', 'group_choice', 'REAL_VSTEP_L3_PART_AUDIO', 4,
        'Choose the best answer based on Listening Part 3, question 4.', NULL, '/uploads/exams/vstep/listening/part3/part_03_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L3", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The listener should check details before taking action."}]'::jsonb, 'D');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 3', 'group_choice', 'REAL_VSTEP_L3_PART_AUDIO', 5,
        'Choose the best answer based on Listening Part 3, question 5.', NULL, '/uploads/exams/vstep/listening/part3/part_03_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L3", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 3', 'group_choice', 'REAL_VSTEP_L3_PART_AUDIO', 6,
        'Choose the best answer based on Listening Part 3, question 6.', NULL, '/uploads/exams/vstep/listening/part3/part_03_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L3", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speakers disagree about a plan but reach a decision."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 3', 'group_choice', 'REAL_VSTEP_L3_PART_AUDIO', 7,
        'Choose the best answer based on Listening Part 3, question 7.', NULL, '/uploads/exams/vstep/listening/part3/part_03_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L3", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The talk explains causes, examples, and possible effects."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'C');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 3', 'group_choice', 'REAL_VSTEP_L3_PART_AUDIO', 8,
        'Choose the best answer based on Listening Part 3, question 8.', NULL, '/uploads/exams/vstep/listening/part3/part_03_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L3", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The listener should check details before taking action."}]'::jsonb, 'D');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 3', 'group_choice', 'REAL_VSTEP_L3_PART_AUDIO', 9,
        'Choose the best answer based on Listening Part 3, question 9.', NULL, '/uploads/exams/vstep/listening/part3/part_03_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L3", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 3', 'group_choice', 'REAL_VSTEP_L3_PART_AUDIO', 10,
        'Choose the best answer based on Listening Part 3, question 10.', NULL, '/uploads/exams/vstep/listening/part3/part_03_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L3", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speakers disagree about a plan but reach a decision."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 3', 'group_choice', 'REAL_VSTEP_L3_PART_AUDIO', 11,
        'Choose the best answer based on Listening Part 3, question 11.', NULL, '/uploads/exams/vstep/listening/part3/part_03_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L3", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The talk explains causes, examples, and possible effects."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'C');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 3', 'group_choice', 'REAL_VSTEP_L3_PART_AUDIO', 12,
        'Choose the best answer based on Listening Part 3, question 12.', NULL, '/uploads/exams/vstep/listening/part3/part_03_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L3", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The listener should check details before taking action."}]'::jsonb, 'D');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 3', 'group_choice', 'REAL_VSTEP_L3_PART_AUDIO', 13,
        'Choose the best answer based on Listening Part 3, question 13.', NULL, '/uploads/exams/vstep/listening/part3/part_03_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L3", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 3', 'group_choice', 'REAL_VSTEP_L3_PART_AUDIO', 14,
        'Choose the best answer based on Listening Part 3, question 14.', NULL, '/uploads/exams/vstep/listening/part3/part_03_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L3", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speakers disagree about a plan but reach a decision."}, {"label": "C", "text": "The speaker is reading a restaurant menu."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Listening', 'Listening Part 3', 'group_choice', 'REAL_VSTEP_L3_PART_AUDIO', 15,
        'Choose the best answer based on Listening Part 3, question 15.', NULL, '/uploads/exams/vstep/listening/part3/part_03_full.mp3', '{"showQuestionText": true, "showOptionText": true, "requiresAudio": true, "audioScope": "part"}'::jsonb, '{"vstepPart": "L3", "placeholderMedia": true, "audioScope": "part"}'::jsonb, NULL, NULL, 2400, NULL, NULL, 1, 'VSTEP Listening', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The speaker is giving practical information."}, {"label": "B", "text": "The speaker is telling a personal childhood story."}, {"label": "C", "text": "The talk explains causes, examples, and possible effects."}, {"label": "D", "text": "The speaker is describing a sports match only."}]'::jsonb, 'C');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 1', 'Urban Green Spaces', 'REAL_VSTEP_R_G01', 'Many cities are investing in parks, tree-lined streets, and community gardens. These spaces can reduce heat, improve air quality, and give residents places to exercise. However, city planners must balance green development with housing needs and maintenance costs. Successful projects usually involve local residents in planning and long-term care.', '[{"type": "article", "title": "Urban Green Spaces", "content": "Many cities are investing in parks, tree-lined streets, and community gardens. These spaces can reduce heat, improve air quality, and give residents places to exercise. However, city planners must balance green development with housing needs and maintenance costs. Successful projects usually involve local residents in planning and long-term care."}]'::jsonb, '{}'::jsonb, '{"questionsPerGroup": 10, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 1, "seed": "real_question_seed_v2"}'::jsonb, 1, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 1', 'group_choice', 'REAL_VSTEP_R_G01', 1,
        'What is the passage mainly about?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 1}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A general issue and its possible benefits or challenges"}, {"label": "B", "text": "A biography of a famous athlete"}, {"label": "C", "text": "A recipe for a traditional dish"}, {"label": "D", "text": "A travel diary with no argument"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 1', 'group_choice', 'REAL_VSTEP_R_G01', 2,
        'According to the passage, what is one benefit mentioned?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 1}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "It may improve convenience, health, or efficiency"}, {"label": "B", "text": "It always eliminates all costs"}, {"label": "C", "text": "It prevents people from using technology"}, {"label": "D", "text": "It makes planning unnecessary"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 1', 'group_choice', 'REAL_VSTEP_R_G01', 3,
        'The word “nevertheless” or a similar contrast signal is closest in meaning to:', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 1}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "therefore"}, {"label": "B", "text": "however"}, {"label": "C", "text": "for example"}, {"label": "D", "text": "in addition"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 1', 'group_choice', 'REAL_VSTEP_R_G01', 4,
        'What does the passage suggest is important for success?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 1}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignoring user needs"}, {"label": "B", "text": "Careful planning and continued support"}, {"label": "C", "text": "Avoiding all investment"}, {"label": "D", "text": "Removing public feedback"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 1', 'group_choice', 'REAL_VSTEP_R_G01', 5,
        'Which statement is TRUE according to the passage?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 1}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The topic has both advantages and challenges"}, {"label": "B", "text": "The writer rejects every solution"}, {"label": "C", "text": "Only large organizations can make improvements"}, {"label": "D", "text": "The issue is unrelated to daily life"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 1', 'group_choice', 'REAL_VSTEP_R_G01', 6,
        'Why does the writer give an example?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 1}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To make the main idea clearer"}, {"label": "B", "text": "To change the subject completely"}, {"label": "C", "text": "To introduce a fictional character"}, {"label": "D", "text": "To criticize all readers"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 1', 'group_choice', 'REAL_VSTEP_R_G01', 7,
        'What can be inferred from the passage?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 1}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Long-term results require more than one action"}, {"label": "B", "text": "The problem will disappear immediately"}, {"label": "C", "text": "People never change their habits"}, {"label": "D", "text": "Technology is always harmful"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 1', 'group_choice', 'REAL_VSTEP_R_G01', 8,
        'Which audience would probably find this passage useful?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 1}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Students or general readers interested in social development"}, {"label": "B", "text": "Only professional musicians"}, {"label": "C", "text": "Children learning the alphabet"}, {"label": "D", "text": "People looking for sports scores"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 1', 'group_choice', 'REAL_VSTEP_R_G01', 9,
        'The tone of the passage is best described as:', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 1}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "balanced and informative"}, {"label": "B", "text": "angry and insulting"}, {"label": "C", "text": "humorous and fictional"}, {"label": "D", "text": "uncertain and confusing"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 1', 'group_choice', 'REAL_VSTEP_R_G01', 10,
        'What is the writer’s likely purpose?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 1}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To explain an issue and discuss its effects"}, {"label": "B", "text": "To sell a single product aggressively"}, {"label": "C", "text": "To announce a private party"}, {"label": "D", "text": "To provide emergency medical advice"}]'::jsonb, 'A');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 2', 'Digital Learning', 'REAL_VSTEP_R_G02', 'Online learning has become common in universities and training centers. It allows learners to review materials at their own speed and gives teachers new ways to monitor progress. Nevertheless, students may struggle without face-to-face support. Blended courses often work best because they combine flexibility with direct interaction.', '[{"type": "article", "title": "Digital Learning", "content": "Online learning has become common in universities and training centers. It allows learners to review materials at their own speed and gives teachers new ways to monitor progress. Nevertheless, students may struggle without face-to-face support. Blended courses often work best because they combine flexibility with direct interaction."}]'::jsonb, '{}'::jsonb, '{"questionsPerGroup": 10, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 2, "seed": "real_question_seed_v2"}'::jsonb, 2, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 2', 'group_choice', 'REAL_VSTEP_R_G02', 1,
        'What is the passage mainly about?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 2}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A general issue and its possible benefits or challenges"}, {"label": "B", "text": "A biography of a famous athlete"}, {"label": "C", "text": "A recipe for a traditional dish"}, {"label": "D", "text": "A travel diary with no argument"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 2', 'group_choice', 'REAL_VSTEP_R_G02', 2,
        'According to the passage, what is one benefit mentioned?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 2}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "It may improve convenience, health, or efficiency"}, {"label": "B", "text": "It always eliminates all costs"}, {"label": "C", "text": "It prevents people from using technology"}, {"label": "D", "text": "It makes planning unnecessary"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 2', 'group_choice', 'REAL_VSTEP_R_G02', 3,
        'The word “nevertheless” or a similar contrast signal is closest in meaning to:', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 2}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "therefore"}, {"label": "B", "text": "however"}, {"label": "C", "text": "for example"}, {"label": "D", "text": "in addition"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 2', 'group_choice', 'REAL_VSTEP_R_G02', 4,
        'What does the passage suggest is important for success?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 2}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignoring user needs"}, {"label": "B", "text": "Careful planning and continued support"}, {"label": "C", "text": "Avoiding all investment"}, {"label": "D", "text": "Removing public feedback"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 2', 'group_choice', 'REAL_VSTEP_R_G02', 5,
        'Which statement is TRUE according to the passage?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 2}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The topic has both advantages and challenges"}, {"label": "B", "text": "The writer rejects every solution"}, {"label": "C", "text": "Only large organizations can make improvements"}, {"label": "D", "text": "The issue is unrelated to daily life"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 2', 'group_choice', 'REAL_VSTEP_R_G02', 6,
        'Why does the writer give an example?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 2}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To make the main idea clearer"}, {"label": "B", "text": "To change the subject completely"}, {"label": "C", "text": "To introduce a fictional character"}, {"label": "D", "text": "To criticize all readers"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 2', 'group_choice', 'REAL_VSTEP_R_G02', 7,
        'What can be inferred from the passage?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 2}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Long-term results require more than one action"}, {"label": "B", "text": "The problem will disappear immediately"}, {"label": "C", "text": "People never change their habits"}, {"label": "D", "text": "Technology is always harmful"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 2', 'group_choice', 'REAL_VSTEP_R_G02', 8,
        'Which audience would probably find this passage useful?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 2}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Students or general readers interested in social development"}, {"label": "B", "text": "Only professional musicians"}, {"label": "C", "text": "Children learning the alphabet"}, {"label": "D", "text": "People looking for sports scores"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 2', 'group_choice', 'REAL_VSTEP_R_G02', 9,
        'The tone of the passage is best described as:', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 2}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "balanced and informative"}, {"label": "B", "text": "angry and insulting"}, {"label": "C", "text": "humorous and fictional"}, {"label": "D", "text": "uncertain and confusing"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 2', 'group_choice', 'REAL_VSTEP_R_G02', 10,
        'What is the writer’s likely purpose?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 2}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To explain an issue and discuss its effects"}, {"label": "B", "text": "To sell a single product aggressively"}, {"label": "C", "text": "To announce a private party"}, {"label": "D", "text": "To provide emergency medical advice"}]'::jsonb, 'A');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 3', 'Small Business Innovation', 'REAL_VSTEP_R_G03', 'Small businesses often innovate by responding quickly to customer needs. Unlike large companies, they can test new ideas with fewer procedures. A local bakery, for example, may introduce online ordering after noticing changes in customer behavior. Innovation does not always require advanced technology; it often starts with careful observation.', '[{"type": "article", "title": "Small Business Innovation", "content": "Small businesses often innovate by responding quickly to customer needs. Unlike large companies, they can test new ideas with fewer procedures. A local bakery, for example, may introduce online ordering after noticing changes in customer behavior. Innovation does not always require advanced technology; it often starts with careful observation."}]'::jsonb, '{}'::jsonb, '{"questionsPerGroup": 10, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 3, "seed": "real_question_seed_v2"}'::jsonb, 3, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 3', 'group_choice', 'REAL_VSTEP_R_G03', 1,
        'What is the passage mainly about?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 3}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A general issue and its possible benefits or challenges"}, {"label": "B", "text": "A biography of a famous athlete"}, {"label": "C", "text": "A recipe for a traditional dish"}, {"label": "D", "text": "A travel diary with no argument"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 3', 'group_choice', 'REAL_VSTEP_R_G03', 2,
        'According to the passage, what is one benefit mentioned?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 3}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "It may improve convenience, health, or efficiency"}, {"label": "B", "text": "It always eliminates all costs"}, {"label": "C", "text": "It prevents people from using technology"}, {"label": "D", "text": "It makes planning unnecessary"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 3', 'group_choice', 'REAL_VSTEP_R_G03', 3,
        'The word “nevertheless” or a similar contrast signal is closest in meaning to:', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 3}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "therefore"}, {"label": "B", "text": "however"}, {"label": "C", "text": "for example"}, {"label": "D", "text": "in addition"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 3', 'group_choice', 'REAL_VSTEP_R_G03', 4,
        'What does the passage suggest is important for success?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 3}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignoring user needs"}, {"label": "B", "text": "Careful planning and continued support"}, {"label": "C", "text": "Avoiding all investment"}, {"label": "D", "text": "Removing public feedback"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 3', 'group_choice', 'REAL_VSTEP_R_G03', 5,
        'Which statement is TRUE according to the passage?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 3}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The topic has both advantages and challenges"}, {"label": "B", "text": "The writer rejects every solution"}, {"label": "C", "text": "Only large organizations can make improvements"}, {"label": "D", "text": "The issue is unrelated to daily life"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 3', 'group_choice', 'REAL_VSTEP_R_G03', 6,
        'Why does the writer give an example?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 3}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To make the main idea clearer"}, {"label": "B", "text": "To change the subject completely"}, {"label": "C", "text": "To introduce a fictional character"}, {"label": "D", "text": "To criticize all readers"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 3', 'group_choice', 'REAL_VSTEP_R_G03', 7,
        'What can be inferred from the passage?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 3}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Long-term results require more than one action"}, {"label": "B", "text": "The problem will disappear immediately"}, {"label": "C", "text": "People never change their habits"}, {"label": "D", "text": "Technology is always harmful"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 3', 'group_choice', 'REAL_VSTEP_R_G03', 8,
        'Which audience would probably find this passage useful?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 3}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Students or general readers interested in social development"}, {"label": "B", "text": "Only professional musicians"}, {"label": "C", "text": "Children learning the alphabet"}, {"label": "D", "text": "People looking for sports scores"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 3', 'group_choice', 'REAL_VSTEP_R_G03', 9,
        'The tone of the passage is best described as:', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 3}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "balanced and informative"}, {"label": "B", "text": "angry and insulting"}, {"label": "C", "text": "humorous and fictional"}, {"label": "D", "text": "uncertain and confusing"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 3', 'group_choice', 'REAL_VSTEP_R_G03', 10,
        'What is the writer’s likely purpose?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 3}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To explain an issue and discuss its effects"}, {"label": "B", "text": "To sell a single product aggressively"}, {"label": "C", "text": "To announce a private party"}, {"label": "D", "text": "To provide emergency medical advice"}]'::jsonb, 'A');


    INSERT INTO public.exam_question_groups (tenant_id, format_code, exam_type, skill, part, title, group_key, content, passages, media, display_config, metadata, order_number, created_by)
    VALUES (v_tenant_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 4', 'Public Transportation', 'REAL_VSTEP_R_G04', 'Reliable public transportation helps reduce traffic congestion and pollution. To attract more passengers, services must be safe, punctual, and easy to use. Some cities have introduced mobile payment systems and real-time arrival information. These improvements can increase public trust, but they require continuous investment.', '[{"type": "article", "title": "Public Transportation", "content": "Reliable public transportation helps reduce traffic congestion and pollution. To attract more passengers, services must be safe, punctual, and easy to use. Some cities have introduced mobile payment systems and real-time arrival information. These improvements can increase public trust, but they require continuous investment."}]'::jsonb, '{}'::jsonb, '{"questionsPerGroup": 10, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 4, "seed": "real_question_seed_v2"}'::jsonb, 4, v_admin_id)
    ON CONFLICT (tenant_id, group_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, passages=EXCLUDED.passages, media=EXCLUDED.media, display_config=EXCLUDED.display_config, metadata=EXCLUDED.metadata, updated_at=NOW();


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 4', 'group_choice', 'REAL_VSTEP_R_G04', 1,
        'What is the passage mainly about?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 4}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "A general issue and its possible benefits or challenges"}, {"label": "B", "text": "A biography of a famous athlete"}, {"label": "C", "text": "A recipe for a traditional dish"}, {"label": "D", "text": "A travel diary with no argument"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 4', 'group_choice', 'REAL_VSTEP_R_G04', 2,
        'According to the passage, what is one benefit mentioned?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 4}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "It may improve convenience, health, or efficiency"}, {"label": "B", "text": "It always eliminates all costs"}, {"label": "C", "text": "It prevents people from using technology"}, {"label": "D", "text": "It makes planning unnecessary"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 4', 'group_choice', 'REAL_VSTEP_R_G04', 3,
        'The word “nevertheless” or a similar contrast signal is closest in meaning to:', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 4}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "therefore"}, {"label": "B", "text": "however"}, {"label": "C", "text": "for example"}, {"label": "D", "text": "in addition"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 4', 'group_choice', 'REAL_VSTEP_R_G04', 4,
        'What does the passage suggest is important for success?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 4}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Ignoring user needs"}, {"label": "B", "text": "Careful planning and continued support"}, {"label": "C", "text": "Avoiding all investment"}, {"label": "D", "text": "Removing public feedback"}]'::jsonb, 'B');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 4', 'group_choice', 'REAL_VSTEP_R_G04', 5,
        'Which statement is TRUE according to the passage?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 4}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "The topic has both advantages and challenges"}, {"label": "B", "text": "The writer rejects every solution"}, {"label": "C", "text": "Only large organizations can make improvements"}, {"label": "D", "text": "The issue is unrelated to daily life"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 4', 'group_choice', 'REAL_VSTEP_R_G04', 6,
        'Why does the writer give an example?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 4}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To make the main idea clearer"}, {"label": "B", "text": "To change the subject completely"}, {"label": "C", "text": "To introduce a fictional character"}, {"label": "D", "text": "To criticize all readers"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 4', 'group_choice', 'REAL_VSTEP_R_G04', 7,
        'What can be inferred from the passage?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 4}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Long-term results require more than one action"}, {"label": "B", "text": "The problem will disappear immediately"}, {"label": "C", "text": "People never change their habits"}, {"label": "D", "text": "Technology is always harmful"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 4', 'group_choice', 'REAL_VSTEP_R_G04', 8,
        'Which audience would probably find this passage useful?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 4}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "Students or general readers interested in social development"}, {"label": "B", "text": "Only professional musicians"}, {"label": "C", "text": "Children learning the alphabet"}, {"label": "D", "text": "People looking for sports scores"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 4', 'group_choice', 'REAL_VSTEP_R_G04', 9,
        'The tone of the passage is best described as:', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 4}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "balanced and informative"}, {"label": "B", "text": "angry and insulting"}, {"label": "C", "text": "humorous and fictional"}, {"label": "D", "text": "uncertain and confusing"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Reading', 'Reading Part 4', 'group_choice', 'REAL_VSTEP_R_G04', 10,
        'What is the writer’s likely purpose?', NULL, NULL, '{"showQuestionText": true, "showOptionText": true, "richTextGroup": true, "splitScreen": true}'::jsonb, '{"vstepReadingPart": 4}'::jsonb, NULL, NULL, 3600, NULL, NULL, 1, 'VSTEP Reading', 'Đáp án đúng dựa trên ngữ cảnh, ngữ pháp hoặc thông tin trực tiếp trong bài.', '[{"label": "A", "text": "To explain an issue and discuss its effects"}, {"label": "B", "text": "To sell a single product aggressively"}, {"label": "C", "text": "To announce a private party"}, {"label": "D", "text": "To provide emergency medical advice"}]'::jsonb, 'A');


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Writing', 'Writing Task 1', 'writing_email_letter', NULL, 1,
        'You recently attended an English course at a language center. Write an email to the center manager. In your email: thank the center, describe one thing you liked, mention one problem, and suggest an improvement. Write at least 120 words.', NULL, NULL, '{"inputMode": "email_letter", "sectionSeconds": 1200, "minWords": 120}'::jsonb, '{"vstepWritingTask": 1}'::jsonb, NULL, NULL, 1200, 120, NULL, 1, 'VSTEP Writing', 'Bài viết cần đủ 4 ý, văn phong email phù hợp, tối thiểu 120 từ.', '[]'::jsonb, NULL);


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Writing', 'Writing Task 2', 'writing_essay', NULL, 2,
        'Some people believe that students should spend more time learning practical skills than studying academic subjects. To what extent do you agree or disagree? Write at least 250 words.', NULL, NULL, '{"inputMode": "academic_social_essay", "sectionSeconds": 2400, "minWords": 250}'::jsonb, '{"vstepWritingTask": 2}'::jsonb, NULL, NULL, 2400, 250, NULL, 1, 'VSTEP Writing', 'Bài luận cần có quan điểm rõ, lập luận, ví dụ, kết luận và tối thiểu 250 từ.', '[]'::jsonb, NULL);


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Speaking', 'Speaking Part 1', 'speaking_social_interaction', NULL, 1,
        'Social Interaction. Topic 1: Hometown — Where is your hometown? What do people usually do there? Would you like to live there in the future? Topic 2: Study — What subject do you enjoy most? How do you usually prepare for exams? Do you prefer studying alone or with friends?', NULL, NULL, '{"inputMode": "text_audio", "responseMode": "continuous_recording", "sectionSeconds": 180}'::jsonb, '{"vstepSpeakingPart": 1}'::jsonb, NULL, NULL, 180, NULL, NULL, 1, 'VSTEP Speaking', 'Giáo viên chấm độ trôi chảy, phát âm, từ vựng, ngữ pháp và mức độ trả lời câu hỏi.', '[]'::jsonb, NULL);


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Speaking', 'Speaking Part 2', 'speaking_solution_discussion', NULL, 2,
        'Solution Discussion. A friend wants to improve English speaking. There are three options: joining a speaking club, taking an online course, or practicing with a private tutor. Choose the best option and explain why the other two are less suitable.', NULL, NULL, '{"inputMode": "situation_solutions", "prepSeconds": 60, "responseSeconds": 180}'::jsonb, '{"vstepSpeakingPart": 2}'::jsonb, 60, 180, NULL, NULL, NULL, 1, 'VSTEP Speaking', 'Cần chọn 1 phương án, so sánh với 2 phương án còn lại và giải thích rõ.', '[]'::jsonb, NULL);


    v_qid := public.__seed_real_question(v_tenant_id, v_admin_id, 'VSTEP_4_SKILLS', 'VSTEP', 'Speaking', 'Speaking Part 3', 'speaking_topic_development', NULL, 3,
        'Topic Development. Topic: The benefits of reading books. Suggested ideas: improves knowledge, reduces stress, develops imagination. Develop the topic and answer follow-up questions from the examiner.', '/uploads/exams/vstep/speaking/topic_reading_books.jpg', NULL, '{"inputMode": "mindmap_followup", "requiresImage": true, "prepSeconds": 60, "responseSeconds": 240}'::jsonb, '{"vstepSpeakingPart": 3, "placeholderMedia": true}'::jsonb, 60, 240, NULL, NULL, NULL, 1, 'VSTEP Speaking', 'Cần phát triển chủ đề theo mindmap và trả lời câu hỏi mở rộng.', '[]'::jsonb, NULL);


    INSERT INTO public.exam_sets (tenant_id, title, exam_type, format_code, description, duration_minutes, total_score, status, blueprint, settings, created_by)
    VALUES (v_tenant_id, 'Bộ đề TOEIC 2 kỹ năng - Practice Test 01', 'TOEIC', 'TOEIC_LR', 'Bộ đề luyện TOEIC Listening & Reading 200 câu, nội dung tự biên soạn sát format thi. Audio/hình dùng placeholder để import sau.', 120, 200, 'active', '[{"skill": "Listening", "part": "Part 1", "count": 6}, {"skill": "Listening", "part": "Part 2", "count": 25}, {"skill": "Listening", "part": "Part 3", "count": 39}, {"skill": "Listening", "part": "Part 4", "count": 30}, {"skill": "Reading", "part": "Part 5", "count": 30}, {"skill": "Reading", "part": "Part 6", "count": 16}, {"skill": "Reading", "part": "Part 7", "count": 54}]'::jsonb, '{"seed":"real_question_seed_v2","placeholderMedia":true,"originalPracticeItem":true}'::jsonb, v_admin_id)
    RETURNING id INTO v_set_toeic_lr;
    v_order := 1;
    FOR v_qid IN SELECT id FROM public.exam_questions WHERE tenant_id=v_tenant_id AND format_code='TOEIC_LR' AND metadata ->> 'seed'='real_question_seed_v2' ORDER BY CASE skill WHEN 'Listening' THEN 1 WHEN 'Reading' THEN 2 ELSE 3 END, CASE part WHEN 'Part 1' THEN 1 WHEN 'Part 2' THEN 2 WHEN 'Part 3' THEN 3 WHEN 'Part 4' THEN 4 WHEN 'Part 5' THEN 5 WHEN 'Part 6' THEN 6 WHEN 'Part 7' THEN 7 ELSE 99 END, group_key NULLS FIRST, sequence_no LOOP
        INSERT INTO public.exam_set_questions (tenant_id, exam_set_id, question_id, order_number, score, section, part, group_key)
        SELECT v_tenant_id, v_set_toeic_lr, id, v_order, score, skill, part, group_key FROM public.exam_questions WHERE id=v_qid;
        v_order := v_order + 1;
    END LOOP;

    INSERT INTO public.exam_sets (tenant_id, title, exam_type, format_code, description, duration_minutes, total_score, status, blueprint, settings, created_by)
    VALUES (v_tenant_id, 'Bộ đề TOEIC 4 kỹ năng - Practice Test 01', 'TOEIC', 'TOEIC_4_SKILLS', 'Bộ đề TOEIC 4 kỹ năng gồm LR 200 câu, Speaking 11 câu, Writing 8 câu. Nội dung tự biên soạn, media placeholder.', 180, 219, 'active', '[{"skill": "Listening", "part": "Part 1", "count": 6}, {"skill": "Listening", "part": "Part 2", "count": 25}, {"skill": "Listening", "part": "Part 3", "count": 39}, {"skill": "Listening", "part": "Part 4", "count": 30}, {"skill": "Reading", "part": "Part 5", "count": 30}, {"skill": "Reading", "part": "Part 6", "count": 16}, {"skill": "Reading", "part": "Part 7", "count": 54}, {"skill": "Speaking", "part": "Question 1-11", "count": 11}, {"skill": "Writing", "part": "Question 1-8", "count": 8}]'::jsonb, '{"seed":"real_question_seed_v2","placeholderMedia":true,"originalPracticeItem":true}'::jsonb, v_admin_id)
    RETURNING id INTO v_set_toeic4;
    v_order := 1;
    FOR v_qid IN SELECT id FROM public.exam_questions WHERE tenant_id=v_tenant_id AND format_code='TOEIC_4_SKILLS' AND metadata ->> 'seed'='real_question_seed_v2' ORDER BY CASE skill WHEN 'Listening' THEN 1 WHEN 'Reading' THEN 2 WHEN 'Speaking' THEN 3 WHEN 'Writing' THEN 4 ELSE 5 END, part, group_key NULLS FIRST, sequence_no LOOP
        INSERT INTO public.exam_set_questions (tenant_id, exam_set_id, question_id, order_number, score, section, part, group_key)
        SELECT v_tenant_id, v_set_toeic4, id, v_order, score, skill, part, group_key FROM public.exam_questions WHERE id=v_qid;
        v_order := v_order + 1;
    END LOOP;

    INSERT INTO public.exam_sets (tenant_id, title, exam_type, format_code, description, duration_minutes, total_score, status, blueprint, settings, created_by)
    VALUES (v_tenant_id, 'Bộ đề VSTEP 4 kỹ năng - Practice Test 01', 'VSTEP', 'VSTEP_4_SKILLS', 'Bộ đề luyện VSTEP gồm Listening 35, Reading 40, Writing 2, Speaking 3 task. Nội dung tự biên soạn, media placeholder.', 179, 80, 'active', '[{"skill": "Listening", "part": "Listening Part 1", "count": 8}, {"skill": "Listening", "part": "Listening Part 2", "count": 12}, {"skill": "Listening", "part": "Listening Part 3", "count": 15}, {"skill": "Reading", "part": "Reading Part 1-4", "count": 40}, {"skill": "Writing", "part": "Writing Task 1-2", "count": 2}, {"skill": "Speaking", "part": "Speaking Part 1-3", "count": 3}]'::jsonb, '{"seed":"real_question_seed_v2","placeholderMedia":true,"oneWayNavigation":true,"originalPracticeItem":true}'::jsonb, v_admin_id)
    RETURNING id INTO v_set_vstep;
    v_order := 1;
    FOR v_qid IN SELECT id FROM public.exam_questions WHERE tenant_id=v_tenant_id AND format_code='VSTEP_4_SKILLS' AND metadata ->> 'seed'='real_question_seed_v2' ORDER BY CASE skill WHEN 'Listening' THEN 1 WHEN 'Reading' THEN 2 WHEN 'Writing' THEN 3 WHEN 'Speaking' THEN 4 ELSE 5 END, part, group_key NULLS FIRST, sequence_no LOOP
        INSERT INTO public.exam_set_questions (tenant_id, exam_set_id, question_id, order_number, score, section, part, group_key)
        SELECT v_tenant_id, v_set_vstep, id, v_order, score, skill, part, group_key FROM public.exam_questions WHERE id=v_qid;
        v_order := v_order + 1;
    END LOOP;

    -- Mock exams active để học viên test giao diện làm bài
    INSERT INTO public.mock_exams (tenant_id, exam_set_id, class_id, title, start_time, end_time, duration_minutes, attempt_limit, show_result, status, note, created_by)
    VALUES (v_tenant_id, v_set_toeic_lr, v_class_toeic, 'Kỳ thi thử TOEIC Practice Test 01', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '30 days', 120, 1, TRUE, 'active', 'real_question_seed_v2 - kỳ thi luyện TOEIC LR', v_admin_id)
    RETURNING id INTO v_mock_toeic;
    IF v_student_1 IS NOT NULL THEN INSERT INTO public.mock_exam_students (tenant_id, mock_exam_id, student_id, status) VALUES (v_tenant_id, v_mock_toeic, v_student_1, 'assigned') ON CONFLICT DO NOTHING; END IF;
    IF v_student_2 IS NOT NULL THEN INSERT INTO public.mock_exam_students (tenant_id, mock_exam_id, student_id, status) VALUES (v_tenant_id, v_mock_toeic, v_student_2, 'assigned') ON CONFLICT DO NOTHING; END IF;

    INSERT INTO public.mock_exams (tenant_id, exam_set_id, class_id, title, start_time, end_time, duration_minutes, attempt_limit, show_result, status, note, created_by)
    VALUES (v_tenant_id, v_set_vstep, v_class_vstep, 'Kỳ thi thử VSTEP Practice Test 01', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '30 days', 179, 1, TRUE, 'active', 'real_question_seed_v2 - kỳ thi luyện VSTEP', v_admin_id)
    RETURNING id INTO v_mock_vstep;
    IF v_student_3 IS NOT NULL THEN INSERT INTO public.mock_exam_students (tenant_id, mock_exam_id, student_id, status) VALUES (v_tenant_id, v_mock_vstep, v_student_3, 'assigned') ON CONFLICT DO NOTHING; END IF;
    IF v_student_4 IS NOT NULL THEN INSERT INTO public.mock_exam_students (tenant_id, mock_exam_id, student_id, status) VALUES (v_tenant_id, v_mock_vstep, v_student_4, 'assigned') ON CONFLICT DO NOTHING; END IF;

END $$;

DROP FUNCTION IF EXISTS public.__seed_real_question(
    INTEGER, INTEGER, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, INTEGER, TEXT, TEXT, TEXT, JSONB, JSONB, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC, TEXT, TEXT, JSONB, TEXT
);

COMMIT;
