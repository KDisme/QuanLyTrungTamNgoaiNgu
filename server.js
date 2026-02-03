const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API Documentation:`);
  console.log(`  POST   http://localhost:${PORT}/api/students - Create student`);
  console.log(`  GET    http://localhost:${PORT}/api/students - Get all students`);
  console.log(`  GET    http://localhost:${PORT}/api/students/:id - Get student by ID`);
  console.log(`  PUT    http://localhost:${PORT}/api/students/:id - Update student`);
  console.log(`  DELETE http://localhost:${PORT}/api/students/:id - Delete student`);
});
