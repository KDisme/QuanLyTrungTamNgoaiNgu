# Backend ASP.NET Core Web API

Backend này đã thay thế backend Node.js/Express cũ bằng **ASP.NET Core Web API + Dapper + Npgsql**.

## Stack

- ASP.NET Core Web API (.NET 8)
- PostgreSQL
- Dapper + Npgsql
- JWT tự tương thích payload cũ: `userId`, `tenantId`, `roles`
- BCrypt.Net-Next để kiểm tra/hash mật khẩu
- Static files cho upload tại `wwwroot/uploads/exams`

## Chạy backend

```bash
cd backend
dotnet restore
dotnet run
```

Mặc định backend chạy tại:

```text
http://localhost:5001
https://localhost:7001
```

Frontend Vite đã được đổi proxy `/api` và `/uploads` sang `http://localhost:5001`.

## Cấu hình quan trọng

Sửa `appsettings.json` hoặc dùng biến môi trường tương ứng:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=quanly_trungtam;Username=postgres;Password=postgres"
  },
  "Jwt": {
    "Secret": "phải giống JWT_SECRET backend cũ nếu muốn token cũ còn dùng được"
  }
}
```

## Ghi chú migration

- Frontend React TypeScript được giữ nguyên.
- PostgreSQL được giữ nguyên.
- API contract `/api/{tenantSlug}/...` được giữ nguyên.
- Backend Node.js cũ được chuyển sang thư mục `backend-node-legacy/` để đối chiếu SQL/logic khi cần.
- Các module đã được tạo controller/service C#: Auth, Users, Branches, Classes, Schedules, Attendance, Fees, Expenses, Homework, Homework Question Bank, Exams, Mock Exams, Notifications, Dashboard, Activity Logs.
- Vì môi trường tạo file không có .NET SDK/PostgreSQL runtime nên bạn cần chạy `dotnet restore` + `dotnet run` tại máy để kiểm thử với DB thật.
