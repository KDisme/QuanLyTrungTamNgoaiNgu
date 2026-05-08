import React, { useState } from "react"
import { Eye, EyeOff, CheckCircle, XCircle, Save } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { apiChangePassword } from "../../api/axios"

import "../../styles/global.css"
import "../../styles/form.css"
import "../../styles/table.css"

const ChangePasswordForm: React.FC = () => {

const navigate = useNavigate()

const [currentPassword,setCurrentPassword] = useState("")
const [newPassword,setNewPassword] = useState("")
const [confirmNewPassword,setConfirmNewPassword] = useState("")

const [showCurrentPassword,setShowCurrentPassword] = useState(false)
const [showNewPassword,setShowNewPassword] = useState(false)
const [showConfirmPassword,setShowConfirmPassword] = useState(false)

const [loading,setLoading] = useState(false)

const [notification,setNotification] = useState<{
type:"success"|"error"
message:string
}|null>(null)

const showNotification = (type:"success"|"error",message:string)=>{
setNotification({type,message})
setTimeout(()=>setNotification(null),2500)
}

const handleSubmit = async (e:React.FormEvent)=>{

e.preventDefault()

if(newPassword !== confirmNewPassword){
showNotification("error","Mật khẩu xác nhận không khớp")
return
}

if(currentPassword === newPassword){
showNotification("error","Mật khẩu mới phải khác mật khẩu cũ")
return
}

setLoading(true)

try{

await apiChangePassword({
oldPassword: currentPassword,
newPassword: newPassword
})

showNotification("success","Đổi mật khẩu thành công")

setTimeout(()=>{
localStorage.removeItem("token")
navigate("/")
},1200)

}catch(error:any){

console.log(error.response?.data)

const msg =
error.response?.data?.message ||
error.response?.data?.error ||
"Đổi mật khẩu thất bại"

showNotification("error",msg)

}finally{
setLoading(false)
}

}

return (

<div className="page">

{notification && (
<div className={`toast ${notification.type === "success" ? "toast-success":"toast-error"}`}>
{notification.type === "success" ? <CheckCircle size={18}/> : <XCircle size={18}/>}
<span>{notification.message}</span>
</div>
)}

<div className="page-head">
<div>
<h1 className="page-title">Đổi mật khẩu</h1>
<p className="page-subtitle">Cập nhật mật khẩu tài khoản quản trị</p>
</div>
</div>

<div className="card">

<div className="card-body" style={{padding:"24px"}}>

<form className="form" onSubmit={handleSubmit}>

<div className="form-row-2">

<div className="form-group">

<label className="label">
Mật khẩu hiện tại <span className="req">*</span>
</label>

<div style={{position:"relative"}}>

<input
type={showCurrentPassword ? "text":"password"}
className="input"
placeholder="Nhập mật khẩu hiện tại"
value={currentPassword}
onChange={(e)=>setCurrentPassword(e.target.value)}
required
/>

<button
type="button"
onClick={()=>setShowCurrentPassword(v=>!v)}
style={{
position:"absolute",
right:"10px",
top:"50%",
transform:"translateY(-50%)",
background:"none",
border:"none",
cursor:"pointer"
}}
>
{showCurrentPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
</button>

</div>

</div>

<div className="form-group">

<label className="label">
Mật khẩu mới <span className="req">*</span>
</label>

<div style={{position:"relative"}}>

<input
type={showNewPassword ? "text":"password"}
className="input"
placeholder="Nhập mật khẩu mới"
value={newPassword}
onChange={(e)=>setNewPassword(e.target.value)}
required
/>

<button
type="button"
onClick={()=>setShowNewPassword(v=>!v)}
style={{
position:"absolute",
right:"10px",
top:"50%",
transform:"translateY(-50%)",
background:"none",
border:"none",
cursor:"pointer"
}}
>
{showNewPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
</button>

</div>

</div>

</div>

<div className="form-group">

<label className="label">
Xác nhận mật khẩu mới <span className="req">*</span>
</label>

<div style={{position:"relative"}}>

<input
type={showConfirmPassword ? "text":"password"}
className="input"
placeholder="Nhập lại mật khẩu mới"
value={confirmNewPassword}
onChange={(e)=>setConfirmNewPassword(e.target.value)}
required
/>

<button
type="button"
onClick={()=>setShowConfirmPassword(v=>!v)}
style={{
position:"absolute",
right:"10px",
top:"50%",
transform:"translateY(-50%)",
background:"none",
border:"none",
cursor:"pointer"
}}
>
{showConfirmPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
</button>

</div>

<p className="help">
Đổi mật khẩu xong hệ thống sẽ đăng xuất và yêu cầu đăng nhập lại
</p>

</div>

<div className="form-actions">

<button
type="button"
className="btn-outline"
onClick={()=>navigate("/dashboard")}
>
Quay lại
</button>

<button
type="submit"
className="btn-primary"
disabled={loading}
>

<Save size={18}/>

{loading ? "Đang xử lý":"Cập nhật"}

</button>

</div>

</form>

</div>

</div>

</div>

)

}

export default ChangePasswordForm