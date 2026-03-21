// src/app.js
// Cấu hình Express, đăng ký routes

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bodyParser = require('body-parser');

const errorHandler = require('./middlewares/errorHandler');

// Routes
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const classRoutes = require('./routes/classRoutes');
const teachingScheduleRoutes = require('./routes/teachingScheduleRoutes');
const examSetRoutes = require('./routes/examSetRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());

// Health check
app.get('/', (req, res) => {
	res.json({ message: 'API is running' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/schedules', teachingScheduleRoutes);
app.use('/api/exam-sets', examSetRoutes);

// Global error handler
app.use(errorHandler);

module.exports = app;

