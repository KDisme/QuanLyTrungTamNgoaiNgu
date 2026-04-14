import http from "./axios";

export const apiGetAllStudents = () => http.get("/students");
export const apiCreateStudent = (data: any) => http.post("/students", data);
export const apiUpdateStudent = (id: number | string, data: any) => http.put(`/students/${id}`, data);
export const apiCompleteStudentCourse = (id: number | string, data?: { notes?: string }) =>
	http.put(`/students/${id}/complete`, data || {});
export const apiGetStudentCompletedHistory = () => http.get('/students/completed-history');
export const apiDeleteStudent = (id: number | string) => http.delete(`/students/${id}`);
