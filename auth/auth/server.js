import express from 'express';
import cors from 'cors';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const app = express();
const PORT = 3000;
const DB_PATH = path.resolve('.', 'db.json');

app.use(cors());
app.use(express.json());

async function readDB() {
  try {
    const raw = await readFile(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return { users: [], teachers: [], classes: [], students: [], schedules: [] };
  }
}

async function writeDB(db) {
  await writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

/* ==================== AUTH ==================== */

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const db = await readDB();
  const users = db.users || [];
  const { name, email, password } = req.body;

  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const exists = users.find(u => u.email === email);
  if (exists) return res.status(409).json({ error: 'Email already registered' });

  const newUser = {
    id: users.length ? Math.max(...users.map(u => u.id)) + 1 : 1,
    name: name || '',
    email,
    password,
    created_at: new Date().toISOString()
  };
  users.push(newUser);
  db.users = users;
  await writeDB(db);
  res.status(201).json({ message: 'Registration successful!' });
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const db = await readDB();
  const users = db.users || [];
  const { email, password } = req.body;

  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const token = crypto.randomBytes(32).toString('hex');
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

// PUT /api/auth/change-password
app.put('/api/auth/change-password', async (req, res) => {
  const db = await readDB();
  const users = db.users || [];
  const { currentPassword, newPassword } = req.body;

  // In a real app, you'd identify the user from the token.
  // Here we simply find the first user whose password matches.
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  // Simple: find user by matching currentPassword (demo only)
  const userIdx = users.findIndex(u => u.password === currentPassword);
  if (userIdx === -1) return res.status(400).json({ error: 'Current password is incorrect' });

  users[userIdx].password = newPassword;
  db.users = users;
  await writeDB(db);
  res.json({ message: 'Password changed successfully' });
});

/* ==================== TEACHERS ==================== */

// GET all teachers
app.get('/api/teachers', async (req, res) => {
  const db = await readDB();
  res.json(db.teachers || []);
});

// POST create teacher
app.post('/api/teachers', async (req, res) => {
  const db = await readDB();
  const teachers = db.teachers || [];
  const nextId = teachers.length ? Math.max(...teachers.map(t => t.id)) + 1 : 1;
  const now = new Date().toISOString();
  const newTeacher = {
    id: nextId,
    full_name: req.body.full_name || 'Không tên',
    phone: req.body.phone || '',
    email: req.body.email || '',
    date_of_birth: req.body.date_of_birth || now,
    class_count: req.body.class_count || 0,
    created_at: now,
  };
  teachers.unshift(newTeacher);
  db.teachers = teachers;
  await writeDB(db);
  res.status(201).json(newTeacher);
});

// PUT update teacher
app.put('/api/teachers/:id', async (req, res) => {
  const id = Number(req.params.id);
  const db = await readDB();
  const teachers = db.teachers || [];
  const idx = teachers.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Teacher not found' });
  const updated = { ...teachers[idx], ...req.body };
  teachers[idx] = updated;
  db.teachers = teachers;
  await writeDB(db);
  res.json(updated);
});

// DELETE teacher
app.delete('/api/teachers/:id', async (req, res) => {
  const id = Number(req.params.id);
  const db = await readDB();
  const teachers = db.teachers || [];
  const idx = teachers.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Teacher not found' });
  teachers.splice(idx, 1);
  db.teachers = teachers;
  await writeDB(db);
  res.status(204).end();
});

/* ==================== CLASSES ==================== */

app.get('/api/classes', async (req, res) => {
  const db = await readDB();
  res.json(db.classes || []);
});

app.get('/api/classes/:id', async (req, res) => {
  const id = Number(req.params.id);
  const db = await readDB();
  const cls = (db.classes || []).find(c => c.id === id);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  res.json(cls);
});

app.post('/api/classes', async (req, res) => {
  const db = await readDB();
  const classes = db.classes || [];
  const nextId = classes.length ? Math.max(...classes.map(c => c.id)) + 1 : 1;
  const newClass = {
    id: nextId,
    name: req.body.name || '',
    start_date: req.body.start_date || '',
    end_date: req.body.end_date || '',
    capacity: req.body.capacity || 0,
    sessions: req.body.sessions || 0,
    created_at: new Date().toISOString()
  };
  classes.unshift(newClass);
  db.classes = classes;
  await writeDB(db);
  res.status(201).json(newClass);
});

app.put('/api/classes/:id', async (req, res) => {
  const id = Number(req.params.id);
  const db = await readDB();
  const classes = db.classes || [];
  const idx = classes.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Class not found' });
  classes[idx] = { ...classes[idx], ...req.body };
  db.classes = classes;
  await writeDB(db);
  res.json(classes[idx]);
});

app.delete('/api/classes/:id', async (req, res) => {
  const id = Number(req.params.id);
  const db = await readDB();
  const classes = db.classes || [];
  const idx = classes.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Class not found' });
  classes.splice(idx, 1);
  db.classes = classes;
  await writeDB(db);
  res.status(204).end();
});

/* ==================== STUDENTS ==================== */

app.get('/api/students', async (req, res) => {
  const db = await readDB();
  res.json(db.students || []);
});

app.post('/api/students', async (req, res) => {
  const db = await readDB();
  const students = db.students || [];
  const nextId = students.length ? Math.max(...students.map(s => s.id)) + 1 : 1;
  const newStudent = {
    id: nextId,
    name: req.body.name || '',
    email: req.body.email || '',
    phone: req.body.phone || '',
    birth_date: req.body.birth_date || '',
    class_id: req.body.class_id || null,
    student_code: req.body.student_code || `HV${String(nextId).padStart(3, '0')}`,
    academy_name: req.body.academy_name || '',
    enroll_date: req.body.enroll_date || new Date().toISOString(),
    created_at: new Date().toISOString()
  };
  students.unshift(newStudent);
  db.students = students;
  await writeDB(db);
  res.status(201).json(newStudent);
});

app.put('/api/students/:id', async (req, res) => {
  const id = Number(req.params.id);
  const db = await readDB();
  const students = db.students || [];
  const idx = students.findIndex(s => s.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Student not found' });
  students[idx] = { ...students[idx], ...req.body };
  db.students = students;
  await writeDB(db);
  res.json(students[idx]);
});

app.delete('/api/students/:id', async (req, res) => {
  const id = Number(req.params.id);
  const db = await readDB();
  const students = db.students || [];
  const idx = students.findIndex(s => s.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Student not found' });
  students.splice(idx, 1);
  db.students = students;
  await writeDB(db);
  res.status(204).end();
});

/* ==================== TEACHING SCHEDULES ==================== */

app.get('/api/teaching-schedules', async (req, res) => {
  const db = await readDB();
  res.json(db.schedules || []);
});

app.get('/api/teaching-schedules/teacher/:teacherId', async (req, res) => {
  const teacherId = Number(req.params.teacherId);
  const db = await readDB();
  const filtered = (db.schedules || []).filter(s => s.teacher_id === teacherId);
  res.json(filtered);
});

app.post('/api/teaching-schedules', async (req, res) => {
  const db = await readDB();
  const schedules = db.schedules || [];
  const nextId = schedules.length ? Math.max(...schedules.map(s => s.id)) + 1 : 1;
  const newSchedule = {
    id: nextId,
    teacher_id: req.body.teacher_id,
    class_id: req.body.class_id,
    teaching_date: req.body.teaching_date || '',
    start_time: req.body.start_time || '',
    end_time: req.body.end_time || '',
    created_at: new Date().toISOString()
  };
  schedules.unshift(newSchedule);
  db.schedules = schedules;
  await writeDB(db);
  res.status(201).json(newSchedule);
});

app.listen(PORT, () => {
  console.log(`Mock API server running: http://localhost:${PORT}/api`);
});
