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
    due_date TIMESTAMP NULL,
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
  `CREATE INDEX IF NOT EXISTS idx_homework_submissions_tenant_status ON homework_submissions(tenant_id, status)`
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