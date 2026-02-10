import axios from "axios";

const http = axios.create({
  baseURL: "http://localhost:3000/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

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

http.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default http;

/* CLASSES */
export const apiGetAllClasses = () => http.get("/classes");
export const apiGetClassById = (id: number | string) => http.get(`/classes/${id}`);
export const apiCreateClass = (data: any) => http.post("/classes", data);
export const apiUpdateClass = (id: number | string, data: any) => http.put(`/classes/${id}`, data);
export const apiDeleteClass = (id: number | string) => http.delete(`/classes/${id}`);

/* STUDENTS */
export const apiGetAllStudents = () => http.get("/students");
export const apiCreateStudent = (data: any) => http.post("/students", data);
export const apiUpdateStudent = (id: number | string, data: any) => http.put(`/students/${id}`, data);
export const apiDeleteStudent = (id: number | string) => http.delete(`/students/${id}`);

/* TEACHERS */
export const apiGetAllTeachers = () => http.get("/teachers");
export const apiCreateTeacher = (data: any) => http.post("/teachers", data);
export const apiUpdateTeacher = (id: number | string, data: any) => http.put(`/teachers/${id}`, data);
export const apiDeleteTeacher = (id: number | string) => http.delete(`/teachers/${id}`);

/* SCHEDULES */
export const apiGetScheduleByTeacher = (teacherId: number | string) =>
  http.get(`/teaching-schedules/teacher/${teacherId}`);

export const apiGetAllSchedules = () => http.get("/teaching-schedules");

export const apiCreateSchedule = (data: any) => http.post("/teaching-schedules", data);

/* AUTH */
export const apiLogin = (data: any) => http.post("/auth/login", data);
export const apiChangePassword = (data: any) => http.put("/auth/change-password", data);
