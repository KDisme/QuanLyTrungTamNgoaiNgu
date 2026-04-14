import http from "./axios";

export const apiGetAllClasses = () => http.get("/classes");
export const apiGetClassById = (id: number | string) => http.get(`/classes/${id}`);
export const apiCreateClass = (data: any) => http.post("/classes", data);
export const apiUpdateClass = (id: number | string, data: any) => http.put(`/classes/${id}`, data);
export const apiDeleteClass = (id: number | string) => http.delete(`/classes/${id}`);
