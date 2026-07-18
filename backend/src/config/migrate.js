require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('./database');

const statements = [
  `CREATE TABLE IF NOT EXISTS homework_assignments (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,
    due_date TIMESTAMPTZ NULL,
    allow_late_submission BOOLEAN NOT NULL DEFAULT FALSE,
    total_score NUMERIC(10,2) NOT NULL DEFAULT 100,
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    show_answers_after_submit BOOLEAN NOT NULL DEFAULT FALSE,
    show_score_after_submit BOOLEAN NOT NULL DEFAULT TRUE,
    require_password BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash VARCHAR(255),
    time_limit_minutes INTEGER,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE homework_assignments ADD COLUMN IF NOT EXISTS show_answers_after_submit BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE homework_assignments ADD COLUMN IF NOT EXISTS show_score_after_submit BOOLEAN NOT NULL DEFAULT TRUE`,
  `ALTER TABLE homework_assignments ADD COLUMN IF NOT EXISTS require_password BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE homework_assignments ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`,
  `ALTER TABLE homework_assignments ADD COLUMN IF NOT EXISTS time_limit_minutes INTEGER`,
  `ALTER TABLE homework_assignments ALTER COLUMN due_date TYPE TIMESTAMPTZ`,
  `CREATE INDEX IF NOT EXISTS idx_homework_assignments_tenant_status ON homework_assignments(tenant_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_homework_assignments_tenant_class ON homework_assignments(tenant_id, class_id)`,
  `CREATE TABLE IF NOT EXISTS homework_assignment_questions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    assignment_id INTEGER NOT NULL REFERENCES homework_assignments(id) ON DELETE CASCADE,
    order_number INTEGER NOT NULL DEFAULT 1,
    question_type VARCHAR(40) NOT NULL,
    question_text TEXT NOT NULL,
    help_text TEXT,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    score NUMERIC(10,2) NOT NULL DEFAULT 1,
    correct_answer TEXT,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_homework_questions_assignment ON homework_assignment_questions(tenant_id, assignment_id, order_number)`,
  `CREATE TABLE IF NOT EXISTS homework_assignment_students (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    assignment_id INTEGER NOT NULL REFERENCES homework_assignments(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'assigned',
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP NULL,
    submitted_at TIMESTAMP NULL,
    total_score NUMERIC(10,2) NULL,
    feedback TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (assignment_id, student_id)
  )`,
  `ALTER TABLE homework_assignment_students ADD COLUMN IF NOT EXISTS started_at TIMESTAMP NULL`,
  `ALTER TABLE homework_assignment_students ADD COLUMN IF NOT EXISTS question_order JSONB`,
  `ALTER TABLE homework_assignment_students ADD COLUMN IF NOT EXISTS option_order JSONB NOT NULL DEFAULT '{}'::jsonb`,
  `CREATE INDEX IF NOT EXISTS idx_homework_assignment_students_assignment ON homework_assignment_students(tenant_id, assignment_id)`,
  `CREATE INDEX IF NOT EXISTS idx_homework_assignment_students_student ON homework_assignment_students(tenant_id, student_id)`,
  `CREATE TABLE IF NOT EXISTS homework_submissions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    assignment_student_id INTEGER NOT NULL REFERENCES homework_assignment_students(id) ON DELETE CASCADE,
    answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'submitted',
    total_score NUMERIC(10,2) NOT NULL DEFAULT 0,
    feedback TEXT,
    submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    graded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    graded_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (assignment_student_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_homework_submissions_tenant_status ON homework_submissions(tenant_id, status)`,
  `CREATE TABLE IF NOT EXISTS homework_question_bank (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    question_type VARCHAR(30) NOT NULL DEFAULT 'multiple_choice_4',
    question_text TEXT NOT NULL,
    help_text TEXT,
    score NUMERIC(10,2) NOT NULL DEFAULT 1,
    correct_answer VARCHAR(20),
    options JSONB NOT NULL DEFAULT '[]',
    category VARCHAR(150),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_homework_question_bank_tenant ON homework_question_bank(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_homework_question_bank_category ON homework_question_bank(tenant_id, category)`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL DEFAULT 'system',
    title VARCHAR(255) NOT NULL,
    message TEXT,
    link VARCHAR(255),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user ON notifications(tenant_id, user_id, is_read, created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    actor_name VARCHAR(255),
    actor_role VARCHAR(30),
    action_type VARCHAR(30) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    entity_name VARCHAR(255),
    description TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_created ON activity_logs(tenant_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON activity_logs(tenant_id, actor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(tenant_id, entity_type, entity_id)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(tenant_id, action_type)`
];

async function migrate() {
  const client = await pool.connect();
  try {
    for (const statement of statements) {
      await client.query(statement);
    }
    console.log('✅ Homework schema migrated successfully');
  } finally {
    client.release();
  }
}

module.exports = migrate;

if (require.main === module) {
  migrate()
    .then(() => pool.end())
    .catch((err) => {
      console.error('❌ Homework migration failed:', err);
      pool.end().finally(() => process.exit(1));
    });
}