import http from "./axios";

export const apiGetScheduleByTeacher = (teacherId: number | string) =>
  http.get(`/schedules/teacher/${teacherId}`);

export const apiGetAllSchedules = () => http.get("/schedules");

export const apiCreateSchedule = (data: any) => http.post("/schedules", data);

export const apiUpdateSchedule = (id: number | string, data: any) => http.put(`/schedules/${id}`, data);

export const apiDeleteSchedule = (id: number | string) => http.delete(`/schedules/${id}`);
