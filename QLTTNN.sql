BEGIN;

CREATE TABLE public.activity_logs (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    actor_id integer,
    actor_name character varying(255),
    actor_role character varying(30),
    action_type character varying(30) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id integer,
    entity_name character varying(255),
    description text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.attendance (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    schedule_id integer NOT NULL,
    student_id integer NOT NULL,
    status character varying(20) DEFAULT 'present'::character varying NOT NULL,
    note text,
    recorded_by integer,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attendance_status_check CHECK (((status)::text = ANY (ARRAY[('present'::character varying)::text, ('absent'::character varying)::text, ('late'::character varying)::text, ('excused'::character varying)::text])))
);

CREATE TABLE public.branches (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(20),
    address text,
    phone character varying(20),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT branches_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text, ('maintenance'::character varying)::text])))
);

CREATE TABLE public.class_students (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    class_id integer NOT NULL,
    student_id integer NOT NULL,
    joined_at date DEFAULT CURRENT_DATE NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    CONSTRAINT class_students_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('dropped'::character varying)::text, ('completed'::character varying)::text])))
);

CREATE TABLE public.class_teachers (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    class_id integer NOT NULL,
    teacher_id integer NOT NULL,
    is_primary boolean DEFAULT true NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.class_weekly_schedules (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    class_id integer NOT NULL,
    weekday integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    room_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT class_weekly_schedules_weekday_check CHECK (((weekday >= 0) AND (weekday <= 6)))
);

CREATE TABLE public.classes (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    branch_id integer NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(20),
    class_type character varying(20) DEFAULT 'fixed'::character varying NOT NULL,
    max_students integer DEFAULT 20,
    expected_fee numeric(12,2) DEFAULT 0,
    start_date date,
    end_date date,
    expected_sessions integer,
    status character varying(20) DEFAULT 'upcoming'::character varying NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT classes_class_type_check CHECK (((class_type)::text = ANY (ARRAY[('fixed'::character varying)::text, ('open'::character varying)::text]))),
    CONSTRAINT classes_status_check CHECK (((status)::text = ANY (ARRAY[('upcoming'::character varying)::text, ('active'::character varying)::text, ('completed'::character varying)::text, ('cancelled'::character varying)::text])))
);

CREATE TABLE public.exam_question_groups (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    format_code character varying(50) NOT NULL,
    exam_type character varying(50) NOT NULL,
    skill character varying(50),
    part character varying(100),
    title character varying(255),
    group_key character varying(255) NOT NULL,
    content text,
    passages jsonb DEFAULT '[]'::jsonb NOT NULL,
    media jsonb DEFAULT '{}'::jsonb NOT NULL,
    display_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    order_number integer,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.exam_question_options (
    id integer NOT NULL,
    question_id integer NOT NULL,
    option_label character varying(10) NOT NULL,
    option_text text NOT NULL,
    is_correct boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.exam_questions (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    exam_type character varying(50) NOT NULL,
    format_code character varying(50) NOT NULL,
    skill character varying(50) NOT NULL,
    part character varying(100) NOT NULL,
    question_type character varying(50) DEFAULT 'single_choice'::character varying NOT NULL,
    group_key character varying(255),
    sequence_no integer,
    question_group text,
    question_text text,
    image_url text,
    audio_url text,
    media jsonb DEFAULT '{}'::jsonb NOT NULL,
    display_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    prep_seconds integer,
    response_seconds integer,
    section_seconds integer,
    min_words integer,
    max_words integer,
    difficulty character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    topic character varying(255),
    explanation text,
    score numeric(8,2) DEFAULT 1 NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exam_questions_difficulty_check CHECK (((difficulty)::text = ANY (ARRAY[('easy'::character varying)::text, ('medium'::character varying)::text, ('hard'::character varying)::text]))),
    CONSTRAINT exam_questions_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text, ('draft'::character varying)::text, ('archived'::character varying)::text])))
);

CREATE TABLE public.exam_set_questions (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    exam_set_id integer NOT NULL,
    question_id integer NOT NULL,
    order_number integer NOT NULL,
    score numeric(8,2) DEFAULT 1 NOT NULL,
    section character varying(50),
    part character varying(100),
    group_key character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.exam_sets (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    title character varying(255) NOT NULL,
    exam_type character varying(50) NOT NULL,
    format_code character varying(50) NOT NULL,
    description text,
    duration_minutes integer DEFAULT 120 NOT NULL,
    total_score numeric(8,2) DEFAULT 100 NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    blueprint jsonb DEFAULT '[]'::jsonb NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exam_sets_status_check CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('active'::character varying)::text, ('inactive'::character varying)::text, ('archived'::character varying)::text])))
);

CREATE TABLE public.expenses (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    category character varying(50) DEFAULT 'other'::character varying NOT NULL,
    description text,
    payment_method character varying(30) DEFAULT 'cash'::character varying NOT NULL,
    expense_date date DEFAULT CURRENT_DATE NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.fee_collection_classes (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    collection_id integer NOT NULL,
    class_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.fee_collection_items (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    collection_id integer NOT NULL,
    student_id integer NOT NULL,
    amount_due numeric(12,2) DEFAULT 0 NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fee_collection_items_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('partial'::character varying)::text, ('paid'::character varying)::text, ('cancelled'::character varying)::text])))
);

CREATE TABLE public.fee_collections (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    class_id integer,
    name character varying(255) NOT NULL,
    due_date date,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    description text,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    collection_code character varying(50),
    fee_template_id integer,
    cycle_type character varying(20) DEFAULT 'monthly'::character varying,
    start_date date,
    end_date date,
    grace_days integer DEFAULT 7,
    scope_type character varying(20) DEFAULT 'class'::character varying,
    cancelled_at timestamp with time zone,
    closed_at timestamp with time zone,
    activated_at timestamp with time zone,
    CONSTRAINT fee_collections_status_check CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('active'::character varying)::text, ('closed'::character varying)::text, ('cancelled'::character varying)::text])))
);

CREATE TABLE public.fee_templates (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    name character varying(255) NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.fee_transactions (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    item_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    payment_method character varying(30) DEFAULT 'cash'::character varying NOT NULL,
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    collected_by integer,
    note text,
    is_cancelled boolean DEFAULT false NOT NULL,
    cancelled_at timestamp with time zone,
    cancelled_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    bill_number character varying(50),
    paid_date date,
    CONSTRAINT fee_transactions_payment_method_check CHECK (((payment_method)::text = ANY (ARRAY[('cash'::character varying)::text, ('transfer'::character varying)::text, ('momo'::character varying)::text, ('zalopay'::character varying)::text, ('vnpay'::character varying)::text, ('card'::character varying)::text, ('other'::character varying)::text])))
);

CREATE TABLE public.homework_assignment_classes (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    assignment_id integer NOT NULL,
    class_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.homework_assignment_questions (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    assignment_id integer NOT NULL,
    order_number integer DEFAULT 1 NOT NULL,
    question_type character varying(40) NOT NULL,
    question_text text NOT NULL,
    help_text text,
    is_required boolean DEFAULT true NOT NULL,
    score numeric(10,2) DEFAULT 1 NOT NULL,
    correct_answer text,
    options jsonb DEFAULT '[]'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    bank_question_id integer
);

CREATE TABLE public.homework_assignment_students (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    assignment_id integer NOT NULL,
    student_id integer NOT NULL,
    status character varying(30) DEFAULT 'assigned'::character varying NOT NULL,
    assigned_at timestamp without time zone DEFAULT now() NOT NULL,
    submitted_at timestamp without time zone,
    total_score numeric(10,2),
    feedback text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    started_at timestamp without time zone,
    question_order jsonb,
    option_order jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public.homework_assignments (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    class_id integer,
    title character varying(255) NOT NULL,
    description text,
    instructions text,
    due_date timestamp with time zone,
    allow_late_submission boolean DEFAULT false NOT NULL,
    total_score numeric(10,2) DEFAULT 100 NOT NULL,
    status character varying(30) DEFAULT 'draft'::character varying NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    show_answers_after_submit boolean DEFAULT false NOT NULL,
    show_score_after_submit boolean DEFAULT true NOT NULL,
    require_password boolean DEFAULT false NOT NULL,
    password_hash character varying(255),
    time_limit_minutes integer,
    shuffle_questions boolean DEFAULT false NOT NULL
);

CREATE TABLE public.homework_question_bank (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    question_type character varying(30) DEFAULT 'multiple_choice_4'::character varying NOT NULL,
    question_text text NOT NULL,
    help_text text,
    score numeric(10,2) DEFAULT 1 NOT NULL,
    correct_answer character varying(20),
    options jsonb DEFAULT '[]'::jsonb NOT NULL,
    category character varying(150),
    created_by integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.homework_submissions (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    assignment_student_id integer NOT NULL,
    answers jsonb DEFAULT '[]'::jsonb NOT NULL,
    status character varying(30) DEFAULT 'submitted'::character varying NOT NULL,
    total_score numeric(10,2) DEFAULT 0 NOT NULL,
    feedback text,
    submitted_by integer,
    submitted_at timestamp without time zone DEFAULT now() NOT NULL,
    graded_by integer,
    graded_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.mock_exam_students (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    mock_exam_id integer NOT NULL,
    student_id integer NOT NULL,
    status character varying(20) DEFAULT 'assigned'::character varying NOT NULL,
    started_at timestamp with time zone,
    submitted_at timestamp with time zone,
    objective_score numeric(8,2) DEFAULT 0 NOT NULL,
    manual_score numeric(8,2) DEFAULT 0 NOT NULL,
    total_score numeric(8,2) DEFAULT 0 NOT NULL,
    overall_score numeric(8,2),
    skill_score_breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    feedback text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mock_exam_students_status_check CHECK (((status)::text = ANY (ARRAY[('assigned'::character varying)::text, ('in_progress'::character varying)::text, ('submitted'::character varying)::text, ('graded'::character varying)::text, ('absent'::character varying)::text])))
);

CREATE TABLE public.mock_exams (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    exam_set_id integer NOT NULL,
    class_id integer,
    title character varying(255) NOT NULL,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    duration_minutes integer DEFAULT 120 NOT NULL,
    attempt_limit integer DEFAULT 1 NOT NULL,
    show_result boolean DEFAULT true NOT NULL,
    status character varying(20) DEFAULT 'upcoming'::character varying NOT NULL,
    note text,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mock_exams_status_check CHECK (((status)::text = ANY (ARRAY[('upcoming'::character varying)::text, ('active'::character varying)::text, ('closed'::character varying)::text, ('cancelled'::character varying)::text])))
);

CREATE TABLE public.notifications (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    user_id integer NOT NULL,
    type character varying(50) DEFAULT 'system'::character varying NOT NULL,
    title character varying(255) NOT NULL,
    message text,
    link character varying(255),
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.roles (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    user_id integer NOT NULL,
    role_type character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT roles_role_type_check CHECK (((role_type)::text = ANY (ARRAY[('admin'::character varying)::text, ('teacher'::character varying)::text, ('student'::character varying)::text, ('staff'::character varying)::text])))
);

CREATE TABLE public.rooms (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    branch_id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20),
    capacity integer DEFAULT 0,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rooms_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('maintenance'::character varying)::text, ('inactive'::character varying)::text])))
);

CREATE TABLE public.schedule_changes (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    schedule_id integer NOT NULL,
    change_type character varying(30) NOT NULL,
    reason text,
    old_session_date date,
    new_session_date date,
    old_start_time time without time zone,
    new_start_time time without time zone,
    old_end_time time without time zone,
    new_end_time time without time zone,
    old_room_id integer,
    new_room_id integer,
    old_teacher_id integer,
    new_teacher_id integer,
    changed_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT schedule_changes_change_type_check CHECK (((change_type)::text = ANY (ARRAY[('reschedule'::character varying)::text, ('teacher_change'::character varying)::text, ('room_change'::character varying)::text, ('status_change'::character varying)::text])))
);

CREATE TABLE public.schedules (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    class_id integer NOT NULL,
    room_id integer,
    teacher_id integer,
    session_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    session_number integer,
    status character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT schedules_status_check CHECK (((status)::text = ANY (ARRAY[('scheduled'::character varying)::text, ('completed'::character varying)::text, ('cancelled'::character varying)::text, ('postponed'::character varying)::text])))
);

CREATE TABLE public.staff_profiles (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    user_id integer NOT NULL,
    staff_code character varying(20) NOT NULL,
    "position" character varying(100),
    branch_id integer,
    start_date date,
    bank_account character varying(255),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.student_exam_answers (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    attempt_id integer NOT NULL,
    mock_exam_student_id integer NOT NULL,
    question_id integer NOT NULL,
    selected_option_id integer,
    answer_text text,
    is_correct boolean,
    score numeric(8,2) DEFAULT 0 NOT NULL,
    recording_url text,
    duration_seconds integer,
    word_count integer,
    char_count integer,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    graded_by integer,
    graded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.student_exam_attempts (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    mock_exam_student_id integer NOT NULL,
    attempt_no integer NOT NULL,
    status character varying(20) DEFAULT 'in_progress'::character varying NOT NULL,
    started_at timestamp with time zone DEFAULT now(),
    submitted_at timestamp with time zone,
    objective_score numeric(8,2) DEFAULT 0 NOT NULL,
    manual_score numeric(8,2) DEFAULT 0 NOT NULL,
    total_score numeric(8,2) DEFAULT 0 NOT NULL,
    overall_score numeric(8,2),
    skill_score_breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    feedback text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_exam_attempts_status_check CHECK (((status)::text = ANY (ARRAY[('in_progress'::character varying)::text, ('submitted'::character varying)::text, ('graded'::character varying)::text, ('expired'::character varying)::text, ('cancelled'::character varying)::text])))
);

CREATE TABLE public.student_profiles (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    user_id integer NOT NULL,
    student_code character varying(20) NOT NULL,
    enrollment_date date,
    study_status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_profiles_study_status_check CHECK (((study_status)::text = ANY (ARRAY[('active'::character varying)::text, ('completed'::character varying)::text, ('suspended'::character varying)::text, ('dropped'::character varying)::text])))
);

CREATE TABLE public.teacher_profiles (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    user_id integer NOT NULL,
    teacher_code character varying(20) NOT NULL,
    specialization text,
    qualifications text,
    start_date date,
    bank_account character varying(255),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.tenants (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    logo_url text,
    address text,
    phone character varying(20),
    email character varying(255),
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.users (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    full_name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(20),
    gender character varying(10),
    date_of_birth date,
    address text,
    avatar_url text,
    password_hash character varying(255),
    google_id character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT users_gender_check CHECK (((gender)::text = ANY (ARRAY[('male'::character varying)::text, ('female'::character varying)::text, ('other'::character varying)::text])))
);

COMMIT;
