import axios from "axios"

const http = axios.create({
 baseURL: "http://localhost:3000/api",
 headers:{
  "Content-Type":"application/json"
 },
 timeout:15000
})

http.interceptors.request.use(
(config)=>{const token = localStorage.getItem("token")
if(token){config.headers.Authorization = `Bearer ${token}`
}
return config},
(error)=>Promise.reject(error))

http.interceptors.response.use(
(response)=>response,(error)=>{if(error.response){
const status = error.response.status
if(status === 401){
localStorage.removeItem("token")
window.location.href="/"}
if(status === 403){
alert("Bạn không có quyền truy cập")}
}
return Promise.reject(error)})

export default http

export const apiRegister = (data:{
 name:string
 email:string
 password:string
}) => http.post("/auth/register",data)

export const apiLogin = (data:{
 email:string
 password:string
}) => http.post("/auth/login",data)

export const apiChangePassword = (data:{
 oldPassword:string
 newPassword:string
}) => http.post("/auth/change-password",data)

export const apiGetAllClasses = () =>
http.get("/classes")

export const apiGetClassById = (id:number|string) =>
http.get(`/classes/${id}`)

export const apiCreateClass = (data:any) =>
http.post("/classes",data)

export const apiUpdateClass = (id:number|string,data:any) =>
http.put(`/classes/${id}`,data)

export const apiDeleteClass = (id:number|string) =>
http.delete(`/classes/${id}`)

export const apiAssignTeacher = (
classId:number|string,
data:{teacher_id:number}
) =>
http.post(`/classes/${classId}/assign-teacher`,data)

export const apiRemoveTeacher = (classId:number|string) =>
http.delete(`/classes/${classId}/remove-teacher`)

export const apiGetStudentsByClass = (classId:number|string) =>
http.get(`/classes/${classId}/students`)

export const apiAssignStudentToClass = (
 studentId:number|string,
 data:{class_id:number}
) => http.post(`/students/${studentId}/assign-class`, data)

export const apiRemoveStudentFromClass = (
 studentId:number|string
) => http.delete(`/students/${studentId}/remove-class`)

export const apiGetAllStudents = () =>
http.get("/students")

export const apiGetStudentById = (id:number|string) =>
http.get(`/students/${id}`)

export const apiCreateStudent = (data:any) =>
http.post("/students",data)

export const apiUpdateStudent = (id:number|string,data:any) =>
http.put(`/students/${id}`,data)

export const apiDeleteStudent = (id:number|string) =>
http.delete(`/students/${id}`)

export const apiGetAllTeachers = () =>
http.get("/teachers")

export const apiGetTeacherById = (id:number|string) =>
http.get(`/teachers/${id}`)

export const apiCreateTeacher = (data:any) =>
http.post("/teachers",data)

export const apiUpdateTeacher = (id:number|string,data:any) =>
http.put(`/teachers/${id}`,data)

export const apiDeleteTeacher = (id:number|string) =>
http.delete(`/teachers/${id}`)

export const apiGetAllSchedules = () =>
http.get("/teaching-schedules")

export const apiGetScheduleById = (id:number|string) =>
http.get(`/teaching-schedules/${id}`)

export const apiCreateSchedule = (data:any) =>
http.post("/teaching-schedules",data)

export const apiUpdateSchedule = (id:number|string,data:any) =>
http.put(`/teaching-schedules/${id}`,data)

export const apiDeleteSchedule = (id:number|string) =>
http.delete(`/teaching-schedules/${id}`)

export const apiGetScheduleByTeacher = (teacherId:number|string) =>
http.get(`/teaching-schedules/teacher/${teacherId}`)

export const apiGetScheduleByClass = (classId:number|string) =>
http.get(`/teaching-schedules/class/${classId}`)

export const apiGetScheduleByDate = (date:string) =>
http.get(`/teaching-schedules/date/${date}`)

// === HAI HÀM ĐƯỢC THÊM MỚI ĐỂ SỬA LỖI TRANG TRẮNG ===
export const apiCancelSchedule = (id: number | string) => 
    http.patch(`/teaching-schedules/${id}/cancel`); // Dùng patch theo route backend

export const apiCreateMakeupSchedule = (data: any) => 
    http.post("/teaching-schedules/makeup", data); // Dùng post theo route backend[cite: 1]

export const apiUndoMakeupSchedule = (id: number | string) =>
    http.patch(`/teaching-schedules/${id}/undo-makeup`);