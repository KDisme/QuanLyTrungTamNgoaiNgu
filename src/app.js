const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const classRoutes = require('./routes/classRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const teachingScheduleRoutes = require('./routes/teachingScheduleRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

/**
 * Global Middlewares
 */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Request Logging (optional)
 */
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

/**
 * Health Check Endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
  });
});

/**
 * API Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/teaching-schedules', teachingScheduleRoutes);
app.use('/api/schedules', teachingScheduleRoutes);

/**
 * 404 Not Found Handler
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Không tìm thấy route',
    path: req.path,
  });
});

/**
 * Centralized Error Handler (MUST be last)
 */
app.use(errorHandler);

module.exports = app;
