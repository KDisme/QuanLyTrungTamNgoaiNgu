/**
 * TEACHING SCHEDULE API ENDPOINTS REFERENCE
 * 
 * Hệ thống quản lý lịch giảng dạy với hỗ trợ hủy lịch và tạo lịch học bù
 * 
 * ==========================================
 * 1. HỦYИ LỊCHIỜ (CANCEL SCHEDULE)
 * ==========================================
 * 
 * Endpoint: PATCH /api/teaching-schedules/:id/cancel
 * Method: PATCH
 * Authentication: Required (Bearer Token)
 * 
 * URL Parameters:
 *   - id: số ID của lịch học cần hủy
 * 
 * Request Body: {} (empty)
 * 
 * Response Success (200):
 * {
 *   "success": true,
 *   "message": "Hủy lịch giảng dạy thành công",
 *   "schedule": {
 *     "id": 1,
 *     "teacher_id": 1,
 *     "class_id": 1,
 *     "teaching_date": "2026-05-15",
 *     "start_time": "09:00",
 *     "end_time": "11:00",
 *     "room": "A101",
 *     "status": "CANCELLED",
 *     "original_schedule_id": null,
 *     "notes": null,
 *     "created_at": "2026-04-28T10:30:00.000Z"
 *   }
 * }
 * 
 * Response Errors:
 *   - 404: Lịch giảng dạy không tồn tại
 *   - 422: Lịch đã bị hủy rồi
 * 
 * Frontend Flow:
 * 1. Hiển thị modal/dialog hỏi người dùng
 * 2. Gọi API này để hủy lịch
 * 3. Sau khi hủy thành công, hiển thị notification với 2 nút:
 *    - "Tạo ngay" -> Chuyển đến form tạo lịch học bù
 *    - "Để sau" -> Đóng notification
 * 
 * ==========================================
 * 2. TẠO LỊCH HỌC BỦ (CREATE MAKEUP SCHEDULE)
 * ==========================================
 * 
 * Endpoint: POST /api/teaching-schedules/makeup
 * Method: POST
 * Authentication: Required (Bearer Token)
 * 
 * Request Body:
 * {
 *   "original_schedule_id": 1,          // ID của buổi học được bù (bắt buộc)
 *   "teaching_date": "2026-05-20",      // Ngày bù học (YYYY-MM-DD, bắt buộc)
 *   "start_time": "14:00",              // Giờ bắt đầu (HH:MM, bắt buộc)
 *   "end_time": "16:00",                // Giờ kết thúc (HH:MM, bắt buộc)
 *   "room": "A102",                     // Phòng học (bắt buộc)
 *   "notes": "Bù buổi hôm 15/5"         // Ghi chú (không bắt buộc)
 * }
 * 
 * Response Success (201):
 * {
 *   "success": true,
 *   "message": "Tạo lịch học bù thành công",
 *   "schedule": {
 *     "id": 139,
 *     "teacher_id": 1,
 *     "class_id": 1,
 *     "day_of_week": null,
 *     "teaching_date": "2026-05-20",
 *     "start_time": "14:00",
 *     "end_time": "16:00",
 *     "room": "A102",
 *     "status": "MAKEUP",
 *     "original_schedule_id": 1,
 *     "notes": "Bù buổi hôm 15/5",
 *     "created_at": "2026-04-28T10:35:00.000Z"
 *   }
 * }
 * 
 * Response Errors:
 *   - 400: Dữ liệu không hợp lệ
 *   - 404: Lịch gốc không tồn tại
 *   - 422: Xung đột lịch (giáo viên hoặc phòng)
 * 
 * Validation Rules:
 *   - original_schedule_id: phải là số, phải tồn tại
 *   - teaching_date: bắt buộc, định dạng YYYY-MM-DD
 *   - start_time: bắt buộc, định dạng HH:MM, 00:00-23:59
 *   - end_time: bắt buộc, phải sau start_time
 *   - room: bắt buộc, 1-50 ký tự
 *   - notes: tùy chọn, max 500 ký tự
 * 
 * ==========================================
 * 3. LẤY DANH SÁCH LỊCH HỌC BỦ (GET MAKEUP SCHEDULES)
 * ==========================================
 * 
 * Endpoint: GET /api/teaching-schedules/makeup
 * Method: GET
 * Authentication: Required (Bearer Token)
 * 
 * Query Parameters (all optional):
 *   - class_id: lọc theo lớp học
 *   - teacher_id: lọc theo giáo viên
 *   - original_schedule_id: lọc theo lịch gốc
 * 
 * Example: GET /api/teaching-schedules/makeup?class_id=1&teacher_id=1
 * 
 * Response Success (200):
 * {
 *   "success": true,
 *   "message": "Lấy danh sách lịch học bù thành công",
 *   "schedules": [
 *     {
 *       "id": 139,
 *       "teacher_id": 1,
 *       "class_id": 1,
 *       "teaching_date": "2026-05-20",
 *       "start_time": "14:00",
 *       "end_time": "16:00",
 *       "room": "A102",
 *       "status": "MAKEUP",
 *       "original_schedule_id": 1,
 *       "notes": "Bù buổi hôm 15/5",
 *       "created_at": "2026-04-28T10:35:00.000Z",
 *       "teacher_name": "Nguyễn Văn A",
 *       "class_name": "Lớp A1",
 *       "original_teaching_date": "2026-05-15",
 *       "original_start_time": "09:00"
 *     }
 *   ],
 *   "total": 1
 * }
 * 
 * ==========================================
 * 4. LẤY LỊCH HỌC BỦ THEO LỊCHดGỐC (GET MAKEUP BY ORIGINAL)
 * ==========================================
 * 
 * Endpoint: GET /api/teaching-schedules/:id/makeup
 * Method: GET
 * Authentication: Required (Bearer Token)
 * 
 * URL Parameters:
 *   - id: ID của lịch học gốc
 * 
 * Response Success (200):
 * {
 *   "success": true,
 *   "message": "Lấy lịch học bù theo lịch gốc thành công",
 *   "schedules": [...],
 *   "total": 1
 * }
 * 
 * ==========================================
 * FRONTEND LOGIC FLOW
 * ==========================================
 * 
 * Quy trình hủy lịch và tạo lịch học bù:
 * 
 * 1. HIỂN THỊ LỚP HỌC
 *    - Lấy danh sách lịch học từ: GET /api/teaching-schedules/class/:class_id
 *    - Hiển thị các lịch với status SCHEDULED
 * 
 * 2. CHỌN HỦY LỊCH
 *    - Người dùng click vào nút "Ẩn/Hủy lịch học"
 *    - Hiển thị dialog xác nhận: "Bạn có chắc muốn hủy buổi học này?"
 * 
 * 3. GỬI YÊU CẦU HỦY LỊCH
 *    - PATCH /api/teaching-schedules/:id/cancel
 *    - Chờ response từ server
 * 
 * 4. HIỂN THỊ THÔNG BÁO VỀ LỊCH HỌC BỦ
 *    - Khi hủy thành công, hiển thị notification:
 *      "Lịch học đã được hủy. Bạn có muốn tạo lịch học bù không?"
 *    - 2 nút lựa chọn:
 *      a) "Tạo ngay" -> Mở form tạo lịch học bù
 *      b) "Để sau" -> Đóng notification
 * 
 * 5. FORM TẠO LỊCH HỌC BỦ
 *    - Các trường:
 *      * original_schedule_id: (tự động điền từ lịch vừa hủy)
 *      * teaching_date: (input ngày tháng)
 *      * start_time: (input giờ)
 *      * end_time: (input giờ)
 *      * room: (input hoặc select danh sách phòng)
 *      * notes: (textarea tùy chọn)
 * 
 * 6. GỬIYA YÊU CẦU TẠO LỊCH HỌC BỦ
 *    - POST /api/teaching-schedules/makeup
 *    - Với dữ liệu từ form
 * 
 * 7. XỬ LÝ KỊ KẾT QUẢ
 *    - Nếu thành công: 
 *      * Hiển thị "Lịch học bù đã được tạo thành công"
 *      * Đóng form
 *      * Refresh danh sách lịch học
 *    - Nếu lỗi xung đột:
 *      * Hiển thị lỗi: "Giáo viên hoặc phòng đã bị đặt lịch"
 *      * Cho phép thay đổi thông tin
 *    - Nếu lỗi khác:
 *      * Hiển thị thông báo lỗi
 * 
 * ==========================================
 * FIELD DESCRIPTIONS FOR MAKEUP SCHEDULE
 * ==========================================
 * 
 * original_schedule_id
 *   - Loại: Integer
 *   - Bắt buộc: Có
 *   - Mô tả: ID của buổi học gốc được bù
 *   - Lấy từ: Lịch học vừa hủy hoặc chọn từ danh sách
 * 
 * teaching_date
 *   - Loại: String (YYYY-MM-DD)
 *   - Bắt buộc: Có
 *   - Mô tả: Ngày giảng dạy buổi bù
 *   - Validation: Phải là ngày hợp lệ
 * 
 * start_time
 *   - Loại: String (HH:MM)
 *   - Bắt buộc: Có
 *   - Mô tả: Giờ bắt đầu buổi bù (24h)
 *   - Range: 00:00 - 23:59
 * 
 * end_time
 *   - Loại: String (HH:MM)
 *   - Bắt buộc: Có
 *   - Mô tả: Giờ kết thúc buổi bù
 *   - Validation: Phải sau start_time
 * 
 * room
 *   - Loại: String
 *   - Bắt buộc: Có
 *   - Mô tả: Phòng học sử dụng cho buổi bù
 *   - Length: 1-50 ký tự
 * 
 * notes (optional)
 *   - Loại: String
 *   - Bắt buộc: Không
 *   - Mô tả: Ghi chú bổ sung về buổi bù
 *   - MaxLength: 500 ký tự
 *   - Ví dụ: "Bù buổi hôm 15/5 do bệnh", "Bù buổi hôm thứ 3 phần 1"
 * 
 * ==========================================
 * ERROR HANDLING
 * ==========================================
 * 
 * Common Error Responses:
 * 
 * 404 Not Found:
 * {
 *   "success": false,
 *   "message": "Lịch giảng dạy không tồn tại"
 * }
 * 
 * 422 Unprocessable Entity:
 * {
 *   "success": false,
 *   "message": "Giáo viên đã có lịch giảng dạy vào ngày 2026-05-20",
 *   "code": "TEACHER_SCHEDULE_CONFLICT"
 * }
 * 
 * 422 Conflict:
 * {
 *   "success": false,
 *   "message": "Phòng học đã được sử dụng vào ngày 2026-05-20",
 *   "code": "ROOM_CONFLICT"
 * }
 * 
 * 400 Bad Request:
 * {
 *   "success": false,
 *   "message": "Dữ liệu không hợp lệ: teaching_date là bắt buộc và phải có định dạng YYYY-MM-DD"
 * }
 */
