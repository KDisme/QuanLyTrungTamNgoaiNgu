const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
  console.log(`Kiểm tra sức khỏe: http://localhost:${PORT}/health`);
  console.log(`Tài liệu API:`);
  console.log(`  POST   http://localhost:${PORT}/api/auth/register - Đăng ký`);
  console.log(`  POST   http://localhost:${PORT}/api/auth/login - Đăng nhập`);
  console.log(`  GET    http://localhost:${PORT}/api/students - Lấy tất cả sinh viên`);
  console.log(`  GET    http://localhost:${PORT}/api/students/:id - Lấy sinh viên theo ID`);
  console.log(`  POST   http://localhost:${PORT}/api/students - Tạo sinh viên`);
  console.log(`  PUT    http://localhost:${PORT}/api/students/:id - Cập nhật sinh viên`);
  console.log(`  DELETE http://localhost:${PORT}/api/students/:id - Xóa sinh viên`);
});
