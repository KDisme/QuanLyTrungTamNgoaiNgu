# Quản Lý Trung Tâm Ngoại Ngữ

Hệ thống quản lý trung tâm ngoại ngữ gồm các tính năng: quản lý lớp học, học viên, giảng viên và lịch dạy. Xác thực JWT, kết nối PostgreSQL.

---

## Công nghệ sử dụng

| Phần | Công nghệ |
|------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Ant Design |
| Backend | Node.js, Express 5, PostgreSQL |
| Xác thực | JWT (JSON Web Token) |
| Validation | Joi |
| ORM / Query | pg (node-postgres) |

---

## Yêu cầu môi trường

- **Node.js** >= 18.x
- **npm** >= 9.x
- **PostgreSQL** >= 14

---

## Cài đặt Database (PostgreSQL)

1. Tạo database:

```sql
CREATE DATABASE myapp;
```

2. Kết nối vào database và chạy script tạo bảng:

```sql
-- Bảng người dùng (tài khoản đăng nhập)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng giảng viên
CREATE TABLE teachers (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100) UNIQUE,
  date_of_birth DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng lớp học
CREATE TABLE classes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  capacity INTEGER NOT NULL,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  sessions INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng học viên
CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,
  birth_date DATE,
  citizen_id VARCHAR(12) UNIQUE,
  target_score NUMERIC(3,1),
  class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  enrollment_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng lịch dạy
CREATE TABLE teaching_schedules (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teaching_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Cài đặt & Chạy Backend

1. Vào thư mục backend:

```bash
cd backend
```

2. Cài dependencies:

```bash
npm install
```

3. Tạo file `.env` (hoặc chỉnh sửa file `.env` có sẵn):

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=myapp

JWT_SECRET=your_super_secret_jwt_key
```

4. Chạy server:

```bash
# Development (tự reload khi sửa file)
npm run dev

# Production
npm start
```

Backend sẽ chạy tại: `http://localhost:3000`

---

## Cài đặt & Chạy Frontend

1. Vào thư mục frontend:

```bash
cd frontend
```

2. Cài dependencies:

```bash
npm install
```

3. Chạy development server:

```bash
npm run dev
```

Frontend sẽ chạy tại: `http://localhost:5173`

4. Build production:

```bash
npm run build
```

---

## Chạy toàn bộ dự án

Mở **2 terminal** riêng biệt:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Sau đó truy cập: **http://localhost:5173**

---

## Tài khoản mặc định

Đăng ký tài khoản mới tại `/register`, hoặc thêm trực tiếp vào bảng `users` trong PostgreSQL (password phải hash bằng bcrypt).

---

## Cấu trúc dự án

```
QuanLyTrungTamNgoaiNgu/
├── backend/
│   ├── server.js               # Entrypoint
│   ├── .env                    # Biến môi trường (không commit)
│   └── src/
│       ├── app.js              # Cấu hình Express
│       ├── config/db.js        # Kết nối PostgreSQL
│       ├── controllers/        # Xử lý request/response
│       ├── services/           # Business logic
│       ├── repositories/       # Truy vấn database
│       ├── models/             # Định nghĩa cấu trúc dữ liệu
│       ├── routes/             # Định tuyến API
│       ├── middlewares/        # Auth, validation, error handler
│       ├── validations/        # Joi schemas
│       └── exceptions/         # Custom error classes
│
└── frontend/
    ├── index.html
    ├── vite.config.ts
    └── src/
        ├── App.tsx             # Router chính
        ├── main.tsx            # Entrypoint React
        ├── api/axios.ts        # Axios instance + API functions
        ├── components/         # ProtectedRoute
        ├── pages/              # Các trang giao diện
        └── styles/             # CSS toàn cục
```

---

## API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/register` | Đăng ký tài khoản |
| POST | `/api/auth/login` | Đăng nhập, nhận JWT |
| GET | `/api/classes` | Danh sách lớp học |
| POST | `/api/classes` | Tạo lớp học |
| PUT | `/api/classes/:id` | Cập nhật lớp học |
| DELETE | `/api/classes/:id` | Xóa lớp học |
| GET | `/api/students` | Danh sách học viên |
| POST | `/api/students` | Thêm học viên |
| PUT | `/api/students/:id` | Cập nhật học viên |
| DELETE | `/api/students/:id` | Xóa học viên |
| GET | `/api/teachers` | Danh sách giảng viên |
| POST | `/api/teachers` | Thêm giảng viên |
| PUT | `/api/teachers/:id` | Cập nhật giảng viên |
| DELETE | `/api/teachers/:id` | Xóa giảng viên |
| GET | `/api/teaching-schedules` | Danh sách lịch dạy |
| POST | `/api/teaching-schedules` | Tạo lịch dạy |

> Tất cả endpoints (trừ auth) yêu cầu header: `Authorization: Bearer <token>`

---

## Tính năng

- **Xác thực**: Đăng nhập / Đăng ký / Đổi mật khẩu bằng JWT
- **Quản lý Lớp học**: CRUD + phân công giảng viên cho lớp
- **Quản lý Học viên**: CRUD + đăng ký học viên vào lớp (hiển thị giảng viên phụ trách)
- **Quản lý Giảng viên**: CRUD + xem lớp giảng dạy
- **Lịch dạy**: Tạo và xem lịch dạy theo giảng viên
