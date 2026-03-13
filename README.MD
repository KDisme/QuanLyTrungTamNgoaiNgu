# Kiến Trúc Hệ Thống Quản Lý Lớp Học - Class Management

## 📋 Tổng Quan Kiến Trúc Monolithic

Hệ thống quản lý lớp học xây dựng theo kiến trúc **Monolithic** với các tầng rõ ràng (Layered Architecture):

```
┌─────────────────────────────────────┐
│      HTTP REQUEST (Routes)          │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Controller (classController.js)    │  - Tiếp nhận request
│  ├─ Validation đầu vào              │  - Gọi validator
│  └─ Gọi Service xử lý logic         │  - Gọi service
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Service (classService.js)          │  - Xử lý business logic
│  ├─ Validate dữ liệu                │  - Gọi repository
│  ├─ Process logic                   │  - Throw ApiError
│  └─ Handle errors                   │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Repository (classRepository.js)    │  - Giao tiếp database
│  ├─ Query database                  │  - CRUD operations
│  └─ Return data                     │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│     DATABASE (PostgreSQL)           │
└─────────────────────────────────────┘
```

## 🏗️ Cấu Trúc Thư Mục

```
src/
├── constants/
│   └── errorCodes.js              # Định nghĩa error codes và messages
├── controllers/
│   └── classController.js         # Xử lý HTTP requests
├── services/
│   └── classService.js            # Business logic
├── repositories/
│   └── classRepository.js         # Data access layer
├── models/
│   └── class.js                   # Data structure definition
├── validators/
│   └── classValidator.js          # Validation rules
├── routes/
│   └── classRoutes.js             # API endpoints
├── middlewares/
│   ├── errorHandler.js            # Centralized error handling
│   └── auth.js                    # Authentication
├── exceptions/
│   └── ApiError.js                # Custom error class
└── config/
    └── database.js                # Database configuration
```

## 🔄 Luồng Xử Lý Request

### Ví dụ: Tạo Lớp Học (POST /classes)

```
1. HTTP Request
   POST /classes
   {
     "name": "Lớp A1",
     "start_date": "2024-03-15",
     "end_date": "2024-06-15",
     "capacity": 30,
     "sessions": 12
   }

2. Route → Controller
   classController.createClass(req, res, next)

3. Validation
   classValidator.validateCreateClass(req.body)
   ├─ Kiểm tra fields bắt buộc
   ├─ Validate định dạng ngày
   ├─ Validate capacity > 0
   ├─ Validate sessions > 0
   └─ Throw ApiError nếu không hợp lệ

4. Service
   classService.createClass(validatedData)
   ├─ Gọi repository.createClass()
   ├─ Xử lý logic kinh doanh
   └─ Throw ApiError nếu lỗi

5. Repository
   classRepository.createClass(data)
   ├─ Execute SQL query
   ├─ Return data từ database
   └─ Throw ApiError nếu database error

6. Response Success
   {
     "success": true,
     "message": "Tạo lớp học thành công",
     "data": { ... class data ... }
   }

7. Error Handling (nếu có lỗi)
   Error → Middleware errorHandler
   {
     "success": false,
     "message": "Thiếu dữ liệu bắt buộc",
     "errorCode": "CLASS_002"
   }
```

## 📝 Error Codes

Tất cả errors được định nghĩa trong `src/constants/errorCodes.js`

### Danh Sách Error Codes

| Code | Message | HTTP Status |
|------|---------|-------------|
| CLASS_001 | Không tìm thấy lớp học | 404 |
| CLASS_002 | Thiếu dữ liệu bắt buộc | 400 |
| CLASS_003 | Ngày bắt đầu phải trước ngày kết thúc | 400 |
| CLASS_004 | Sức chứa phải lớn hơn 0 | 400 |
| CLASS_005 | Số buổi học phải lớn hơn 0 | 400 |
| CLASS_006 | Ngày kết thúc phải từ hôm nay trở đi | 400 |
| CLASS_007 | Tạo lớp học thất bại | 500 |
| CLASS_008 | Cập nhật lớp học thất bại | 500 |
| CLASS_009 | Không có dữ liệu cần cập nhật | 400 |
| CLASS_010 | Xóa lớp học thất bại | 500 |
| CLASS_011 | Vui lòng cung cấp ID giáo viên | 400 |
| CLASS_012 | Không tìm thấy giáo viên | 404 |
| CLASS_013 | Gán giáo viên thất bại | 500 |
| CLASS_014 | Vui lòng cung cấp danh sách học viên | 400 |
| CLASS_015 | ID học viên phải là mảng không rỗng | 400 |
| CLASS_016 | Một hoặc nhiều học viên không tồn tại | 404 |
| CLASS_017 | Lớp học đã đạt sức chứa tối đa | 400 |
| CLASS_018 | Gán học viên thất bại | 500 |
| CLASS_999 | Bạn không có quyền thực hiện hành động này | 403 |

## 🛡️ Xử Lý Errors

### ApiError Class
```javascript
class ApiError extends Error {
  constructor(statusCode, message, errorCode = null, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.errors = errors;
    this.success = false;
  }
}
```

### Cách Throw Error

```javascript
// Trong Service hoặc Controller
throw new ApiError(
  400,
  ERROR_MESSAGES[ERROR_CODES.CLASS_INVALID_CAPACITY],
  ERROR_CODES.CLASS_INVALID_CAPACITY
);
```

### Error Response Format
```json
{
  "success": false,
  "message": "Sức chứa phải lớn hơn 0",
  "errorCode": "CLASS_004"
}
```

## 📚 API Endpoints

### 1. Lấy Danh Sách Lớp Học
```http
GET /classes
```
**Response Success:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Lớp A1",
      "start_date": "2024-03-15",
      "end_date": "2024-06-15",
      "capacity": 30,
      "sessions": 12,
      "teacher_id": null,
      "created_at": "2024-03-10T10:00:00Z",
      "updated_at": "2024-03-10T10:00:00Z"
    }
  ]
}
```

### 2. Lấy Chi Tiết Lớp Học
```http
GET /classes/:id
```
**Response Success:**
```json
{
  "success": true,
  "data": { ... class data ... }
}
```

### 3. Tạo Lớp Học
```http
POST /classes
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Lớp A1",
  "start_date": "2024-03-15",
  "end_date": "2024-06-15",
  "capacity": 30,
  "sessions": 12
}
```

### 4. Cập Nhật Lớp Học
```http
PUT /classes/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Lớp A1 - Cập nhật",
  "capacity": 35
}
```

### 5. Xóa Lớp Học
```http
DELETE /classes/:id
Authorization: Bearer <token>
```

### 6. Gán Giáo Viên cho Lớp
```http
PUT /classes/:id/assign-teacher
Authorization: Bearer <token>
Content-Type: application/json

{
  "teacher_id": "uuid"
}
```

### 7. Gán Học Viên cho Lớp
```http
PUT /classes/:id/assign-students
Authorization: Bearer <token>
Content-Type: application/json

{
  "student_ids": ["uuid1", "uuid2", "uuid3"]
}
```

## 🔐 Authentication & Authorization

- Các endpoint GET không cần xác thực
- Các endpoint POST, PUT, DELETE cần token JWT
- Header: `Authorization: Bearer <token>`

## ✅ Best Practices

### 1. Validation Layers
- **Controller validator**: Kiểm tra input format
- **Service validator**: Kiểm tra business rules
- **Repository validator**: Kiểm tra database constraints

### 2. Error Handling
- Luôn throw ApiError với errorCode
- Sử dụng ERROR_CODES từ constants
- Middleware xử lý tất cả errors

### 3. Naming Conventions
- Controllers: `xxxController.js`
- Services: `xxxService.js`
- Repositories: `xxxRepository.js`
- Validators: `xxxValidator.js`
- Routes: `xxxRoutes.js`
- Models: `xxx.js`

### 4. Code Style
- Sử dụng async/await
- Try-catch ở controller level, throw ở service/validator
- Khai báo JSDoc comments
- Không hardcode messages, sử dụng ERROR_MESSAGES

## 🚀 Mở Rộng Hệ Thống

### Thêm Chức Năng Mới

1. **Tạo Validator** (`validateXxx`)
   ```javascript
   // src/validators/classValidator.js
   const validateNewFeature = (data) => {
     // validation logic
   };
   ```

2. **Tạo Service Method** (`xxxNewFeature`)
   ```javascript
   // src/services/classService.js
   const newFeatureMethod = async (params) => {
     // business logic
   };
   ```

3. **Tạo Repository Method**
   ```javascript
   // src/repositories/classRepository.js
   const newFeatureMethod = async (params) => {
     // database query
   };
   ```

4. **Tạo Controller Handler**
   ```javascript
   // src/controllers/classController.js
   exports.newFeatureHandler = async (req, res, next) => {
     try {
       const validated = validator.validateNewFeature(req.body);
       const result = await service.newFeatureMethod(validated);
       res.json({ success: true, data: result });
     } catch (err) {
       next(err);
     }
   };
   ```

5. **Thêm Route**
   ```javascript
   // src/routes/classRoutes.js
   router.post('/new-feature', authMiddleware, classController.newFeatureHandler);
   ```

## 📖 Tài Liệu Tham Khảo

- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Express.js Guide](https://expressjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
