# Cấu hình chấm VSTEP bằng Gemini Free Tier

## 1. Tạo API key an toàn

1. Mở [Google AI Studio](https://aistudio.google.com/apikey).
2. Thu hồi key đã từng gửi trong tin nhắn, ảnh chụp hoặc commit Git.
3. Tạo một key mới trong project dùng cho ứng dụng này.
4. Không đặt key trong frontend và không commit file `backend/.env`.

## 2. Cấu hình backend

Sao chép `backend/.env.example` thành `backend/.env`, giữ nguyên cấu hình database hiện có và thêm:

```env
GEMINI_API_KEY=dan_key_moi_vao_day
GEMINI_GRADING_MODEL=gemini-3.8-flash
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta
AI_GRADING_TIMEOUT_MS=120000
```

Khởi động lại backend sau khi thay đổi `.env`:

```bash
cd backend
npm install
npm run migrate
npm start
```

## 3. Cách hoạt động

- Listening và Reading vẫn được hệ thống chấm tự động.
- Gemini chấm Writing từ bài viết và Speaking trực tiếp từ bản ghi âm.
- Mỗi file Speaking gửi trực tiếp cần nhỏ hơn khoảng 14 MB.
- AI chỉ tạo điểm nháp. Teacher/Admin duyệt, có thể sửa điểm, rồi bấm **Công bố**.
- Mỗi lần chấm hoặc chấm lại đều được lưu lịch sử.

## 4. Thông báo lỗi thường gặp

| Thông báo | Ý nghĩa | Cách xử lý |
|---|---|---|
| `Chưa cấu hình GEMINI_API_KEY` | Backend chưa đọc được key | Kiểm tra `backend/.env`, sau đó khởi động lại backend |
| `GEMINI_API_KEY không hợp lệ` | Key sai hoặc đã bị thu hồi | Tạo key mới trong Google AI Studio |
| `Gemini Free Tier đã vượt giới hạn` | Hết quota hoặc gửi quá nhanh | Chờ rồi bấm **Thử lại AI**, kiểm tra quota của project |
| `API key Gemini không có quyền dùng model này` | Project, khu vực hoặc model chưa được cấp quyền | Chọn model được project hỗ trợ hoặc tạo key trong project khác |
| `Không tìm thấy model Gemini` | Tên model không tồn tại/không khả dụng | Kiểm tra `GEMINI_GRADING_MODEL` |
| `Không kết nối được Gemini API` | Lỗi Internet, DNS hoặc firewall | Kiểm tra kết nối từ máy chạy backend |
| `Tệp Speaking quá lớn` | File vượt giới hạn inline an toàn | Nén hoặc rút ngắn bản ghi |

Gemini Free Tier có giới hạn theo project/model và dữ liệu gửi lên có thể được Google dùng để cải thiện sản phẩm. Không gửi dữ liệu thật có thông tin cá nhân nhạy cảm nếu chưa có chính sách và sự đồng ý phù hợp.
