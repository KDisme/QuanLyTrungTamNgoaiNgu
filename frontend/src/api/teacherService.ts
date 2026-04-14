import http from "./axios";

export const apiGetAllTeachers = () => http.get("/teachers");
export const apiCreateTeacher = (data: any) => http.post("/teachers", data);
export const apiUpdateTeacher = (id: number | string, data: any) => http.put(`/teachers/${id}`, data);
export const apiDeleteTeacher = (id: number | string) => http.delete(`/teachers/${id}`);
