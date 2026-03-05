import axios from "axios";

// Cấu hình Instance axios chung cho toàn dự án
const http = axios.create({
    baseURL: "http://localhost:3000/api", // Cổng Backend
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 15000,
});

// Interceptor cho Request: Tự động đính kèm Token vào Header mỗi khi gọi API
http.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptor cho Response: Xử lý lỗi kết nối tập trung
http.interceptors.response.use(
    (response) => response,
    (error) => {
        if (!error.response) {
            console.error("Lỗi kết nối: Server không phản hồi ở cổng 3000.");
        }
        return Promise.reject(error);
    }
);

export default http;

/** * QUẢN LÝ LỚP HỌC (CLASSES)
 */
export const apiGetAllClasses = () => http.get("/classes");
export const apiGetClassById = (id: number | string) => http.get(`/classes/${id}`);
export const apiCreateClass = (data: any) => http.post("/classes", data);
export const apiUpdateClass = (id: number | string, data: any) => http.put(`/classes/${id}`, data);
export const apiDeleteClass = (id: number | string) => http.delete(`/classes/${id}`);

// Các hàm bổ trợ chi tiết lớp học
export const apiGetClassDetail = (id: number | string) => http.get(`/classes/${id}/detail`);
export const apiAssignTeacher = (classId: number | string, data: { teacher_id: number }) =>
    http.post(`/classes/${classId}/assign-teacher`, data);
export const apiAssignStudents = (classId: number | string, data: { student_ids: number[] }) =>
    http.post(`/classes/${classId}/assign-students`, data);
export const apiRemoveStudentFromClass = (classId: number | string, studentId: number) =>
    http.delete(`/classes/${classId}/students/${studentId}`);

/** * QUẢN LÝ HỌC VIÊN (STUDENTS)
 */
export const apiGetAllStudents = () => http.get("/students");
export const apiCreateStudent = (data: any) => http.post("/students", data);
export const apiUpdateStudent = (id: number | string, data: any) => http.put(`/students/${id}`, data);
export const apiDeleteStudent = (id: number | string) => http.delete(`/students/${id}`);

/** * QUẢN LÝ GIẢNG VIÊN (TEACHERS)
 */
export const apiGetAllTeachers = () => http.get("/teachers");
export const apiCreateTeacher = (data: any) => http.post("/teachers", data);
export const apiUpdateTeacher = (id: number | string, data: any) => http.put(`/teachers/${id}`, data);
export const apiDeleteTeacher = (id: number | string) => http.delete(`/teachers/${id}`);

/** * QUẢN LÝ LỊCH HỌC (SCHEDULES)
 */
export const apiGetAllSchedules = () => http.get("/schedules");
export const apiGetScheduleByTeacher = (teacherId: number | string) =>
    http.get(`/schedules/teacher/${teacherId}`);
export const apiCreateSchedule = (data: any) => http.post("/schedules", data);

/** * XÁC THỰC (AUTH)
 */
export const apiLogin = (data: any) => http.post("/auth/login", data);
export const apiChangePassword = (data: any) => http.put("/auth/change-password", data);