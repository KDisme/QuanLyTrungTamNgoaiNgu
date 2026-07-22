# Quản Lý Trung Tâm Ngoại Ngữ

Hệ thống quản lý trung tâm ngoại ngữ đa chi nhánh (multi-tenant), hỗ trợ 4 vai trò người dùng: **Admin**, **Nhân viên (Staff)**, **Giáo viên (Teacher)**, **Học viên (Student)**. Hệ thống bao gồm quản lý lớp học, lịch học, điểm danh, học phí, ngân hàng câu hỏi thi (TOEIC/VSTEP), thi thử, bài tập về nhà, thông báo và nhật ký hoạt động.

---

## 1. Kiến trúc tổng quan

| Thành phần | Công nghệ |
|---|---|
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Frontend | React + TypeScript (Vite) |
| Styling | CSS thuần (design tokens qua CSS variables) |
| Xác thực | JWT (`jsonwebtoken`), băm mật khẩu (`bcryptjs`) |
| Biểu đồ | Recharts |
| Upload file | Multer (lưu local `uploads/`) |

Dự án là **multi-tenant**: mỗi trung tâm (tenant) có `slug` riêng trong URL, ví dụ `/{tenantSlug}/admin/dashboard`. Toàn bộ dữ liệu được phân vùng theo `tenant_id`.

---

## 2. Cấu trúc thư mục

```
QuanLyTrungTamNgoaiNgu/
├── backend/
│   └── src/
│       ├── config/          # kết nối DB, migration (*.migrate.js), config nghiệp vụ (exam.config.js...)
│       ├── controllers/     # xử lý request/response, không chứa business logic
│       ├── services/        # business logic chính, truy vấn DB
│       ├── middlewares/     # auth.middleware.js — xác thực, phân quyền, resolve tenant
│       ├── routes/          # index.js — khai báo toàn bộ route theo tenant
│       └── app.js
└── frontend/
    └── src/
        ├── api.ts            # toàn bộ API client (axios instance + các nhóm API)
        ├── App.tsx            # khai báo route theo từng portal (admin/staff/teacher/student)
        ├── components/
        │   ├── common/        # Modal, Badge, StatusBadge, Loading, EmptyState...
        │   └── layout/        # Sidebar.tsx, MainLayout.tsx
        ├── config/
        │   └── roleConfig.ts  # điều hướng menu theo vai trò (ROLE_NAV), nhãn vai trò
        ├── hooks/
        │   └── useAuth.tsx    # AuthProvider, quản lý session/token/tenant
        └── pages/
            ├── portal/         # RoleDashboard.tsx — dashboard dùng chung cho 4 vai trò
            ├── admin/          # trang riêng cho Admin (vd: ActivityLogPage.tsx)
            ├── users/          # quản lý tài khoản (Admin/Staff)
            ├── classes/        # quản lý lớp học
            ├── schedules/      # lịch học
            ├── attendance/     # điểm danh
            ├── exams/          # ngân hàng câu hỏi, bộ đề, thi thử (TOEIC/VSTEP)
            ├── homework/        # bài tập về nhà
            ├── tuition/         # học phí
            ├── expenses/        # chi phí
            └── student/         # các trang riêng cho học viên
```

---

## 3. Mô hình đa vai trò (Role-based Portal)

Một tài khoản có thể có **nhiều vai trò** cùng lúc (`roles: string[]`), nhưng giao diện chỉ hiển thị theo **vai trò ưu tiên cao nhất** tại một thời điểm, theo thứ tự:

```
admin > staff > teacher > student
```

- Route được tổ chức theo tiền tố portal: `/{tenantSlug}/admin/...`, `/{tenantSlug}/staff/...`, `/{tenantSlug}/teacher/...`, `/{tenantSlug}/student/...`
- `RoleRoute` (trong `App.tsx`) chặn truy cập nếu vai trò không khớp; `WrongPortalGuard` tự điều hướng nếu vào nhầm portal.
- Sidebar menu được cấu hình tập trung tại `frontend/src/config/roleConfig.ts` (biến `ROLE_NAV`), mỗi vai trò có bộ menu và nhóm (section) riêng.
- Dashboard (`RoleDashboard.tsx`) dùng chung 1 component cho cả 4 vai trò, render nội dung khác nhau theo `role`.

---

## 4. Các module chức năng chính

### 4.1. Quản lý tài khoản & phân quyền
- 1 user — nhiều role (bảng `roles` liên kết `user_id` + `role_type`).
- Mỗi vai trò có hồ sơ riêng: `teacher_profiles`, `student_profiles`, `staff_profiles`.
- Admin: tạo/sửa/xoá tài khoản, khoá/mở khoá, đặt lại mật khẩu.

### 4.2. Lớp học & Lịch học
- Lớp học có 2 loại: **có thời hạn** (`fixed` — tự tính ngày kết thúc từ số buổi + lịch tuần mẫu) và **không thời hạn** (`open`).
- Hỗ trợ tự động sinh lịch học thật (`schedules`) từ lịch tuần mẫu (`class_weekly_schedules`), kiểm tra trùng phòng/giáo viên.
- Điểm danh (`attendance`) gắn theo từng buổi học (`schedule_id`) và học viên.

### 4.3. Học phí
- Mẫu học phí (`fee_templates`) → Đợt thu (`fee_collections`, có trạng thái `draft/active/closed/cancelled`) → Khoản thu từng học viên (`fee_collection_items`) → Giao dịch thanh toán (`fee_transactions`).
- Hỗ trợ phân tích công nợ theo tuổi nợ (1-30, 31-60, 61-90, >90 ngày), top học viên nợ nhiều nhất.
- Quản lý chi phí phát sinh (`expenses`).

### 4.4. Thi thử (TOEIC / VSTEP)
- Ngân hàng câu hỏi (`exam_questions`, `exam_question_groups`, `exam_question_options`) hỗ trợ nhiều kỹ năng (Listening, Reading, Writing, Speaking), có audio/hình ảnh.
- Bộ đề thi (`exam_sets`) được cấu hình theo blueprint chuẩn của từng định dạng thi (`exam.config.js`), có thể tạo tự động (`generateExamSet`) từ ngân hàng câu hỏi.
- Kỳ thi thử (`mock_exams`) giao cho lớp/học viên, hỗ trợ giới hạn số lần làm (`attempt_limit`), chấm điểm tự động (trắc nghiệm) và chấm tay (Writing/Speaking), tính điểm theo từng kỹ năng cho VSTEP.

### 4.5. Bài tập về nhà (Homework)
- Hỗ trợ 3 dạng câu hỏi: Đúng/Sai, Trắc nghiệm 4 đáp án, Tự luận.
- Ngân hàng câu hỏi riêng cho bài tập về nhà (`homework_question_bank`), có thể chọn nhanh vào bài thay vì soạn lại.
- Giao bài cho **nhiều lớp cùng lúc** (`homework_assignment_classes`), hệ thống tự gom học viên từ tất cả các lớp.
- Xáo trộn câu hỏi và đáp án **riêng cho từng học viên** (`question_order`, `option_order`) để chống nhìn bài — vị trí đáp án A/B/C/D giữ cố định, chỉ nội dung bên trong được đảo, đảm bảo logic chấm điểm không đổi.
- Cấu hình linh hoạt: giới hạn thời gian làm bài, cho phép nộp muộn, yêu cầu mật khẩu, công bố điểm/đáp án sau khi nộp.
- Trạng thái bài tập: Nháp / Đang mở / Đã đóng (tự động đóng khi quá hạn nếu không cho nộp muộn).

### 4.6. Thông báo (Notifications)
- Thông báo hệ thống theo `user_id`, có loại (`type`), liên kết (`link`), trạng thái đã đọc.
- Tự động gửi khi giao bài tập mới cho học viên.

### 4.7. Nhật ký hoạt động (Activity Log) — chỉ Admin xem
- Ghi lại các hành động quan trọng: tạo/sửa/xoá lớp học, tạo/khoá/mở/đổi mật khẩu tài khoản, tạo đợt thu học phí, thanh toán/huỷ giao dịch, chấm bài tập về nhà, chấm bài thi thử.
- Mỗi log lưu: người thực hiện, vai trò, hành động, đối tượng tác động, mô tả dựng sẵn, và `metadata` (JSON) chứa chi tiết bổ sung (VD: điểm cũ → điểm mới).
- Giao diện dạng timeline có bộ lọc theo người thực hiện, loại hành động, loại đối tượng, khoảng thời gian.
- Dữ liệu log được lưu **vĩnh viễn**, không tự động xoá.

### 4.8. Dashboard tổng quan
- Thống kê theo vai trò: số học viên/lớp/giáo viên, buổi học hôm nay.
- Biểu đồ: tỷ lệ điểm danh theo tuần, phân bổ trạng thái học viên, top lớp đông nhất.
- Khối "Cần xử lý": số bài tập / bài thi thử đang chờ chấm.

---

## 5. Xác thực & phân quyền (Backend)

- Đăng nhập theo tenant: `POST /api/{tenantSlug}/auth/login` — trả về JWT chứa `{ userId, tenantId, roles }`.
- Middleware `authenticate` giải mã token, gắn `req.user`; `resolveTenant` xác định tenant từ `tenantSlug` trong URL, gắn `req.tenant`.
- Middleware `requireRole(...)` giới hạn route theo vai trò; các middleware `requireSelfOrRole`, `requireClassAccess`, `requireStudentAccess`... kiểm tra quyền truy cập theo phạm vi dữ liệu (VD: giáo viên chỉ thao tác được lớp mình phụ trách).

---

## 6. Cài đặt & chạy dự án

### Yêu cầu
- Node.js (khuyến nghị bản LTS gần nhất)
- PostgreSQL đã cài đặt và chạy sẵn

### Backend

```bash
cd backend
npm install
```

Tạo file `.env` trong `backend/` với các biến môi trường cần thiết (kết nối DB, `JWT_SECRET`, `JWT_EXPIRES_IN`...).

Chạy migration để khởi tạo schema:

```bash
node src/config/migrate.js
```

Khởi động server:

```bash
npm start
# hoặc dùng nodemon nếu có cấu hình dev script
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Mặc định truy cập qua trình duyệt tại địa chỉ Vite dev server cung cấp (thường là `http://localhost:5173`), sau đó vào `/{tenantSlug}/login` để đăng nhập (tenant mặc định: `demo`).

---

## 7. Quy ước phát triển

- **Không sửa cấu trúc bảng trực tiếp qua GUI** — mọi thay đổi schema đi qua file migration (`*.migrate.js`), dùng `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN IF NOT EXISTS` để migration chạy lại an toàn (idempotent).
- **Service chứa business logic**, **Controller chỉ điều phối** request/response — không viết truy vấn SQL trực tiếp trong controller.
- Các trường bắt buộc trên form hiển thị dấu `*` màu đỏ (`<span className="required">*</span>`), đồng bộ với điều kiện validate phía client trước khi gửi request.
- Khi thêm hành động quan trọng mới (tạo/sửa/xoá dữ liệu nhạy cảm), cân nhắc bổ sung ghi log vào `activity_logs` thông qua `activityLogService.log(...)` (gọi không chặn luồng chính, tự bắt lỗi nội bộ).

---

## 8. Giấy phép

Dự án nội bộ — chưa công khai giấy phép sử dụng.