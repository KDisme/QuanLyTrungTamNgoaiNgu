import React, { useEffect, useMemo, useState } from "react";
import { Plus, Edit2, Trash2, Search, X } from "lucide-react";
import {
  apiGetAllStudents,
  apiCreateStudent,
  apiUpdateStudent,
  apiDeleteStudent,
} from "../../api/axios";

import "../../styles/global.css";
import "../../styles/table.css";
import "../../styles/form.css";

interface StudentItem {
  id: number;
  name: string;
  email: string;
  birth_date: string;
  citizen_id: string;
  target_score: number;
  created_at: string;
}

const StudentManagement: React.FC = () => {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    birth_date: "",
    citizen_id: "",
    target_score: "",
  });

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await apiGetAllStudents();
      let rawData: any[] = [];
      if (Array.isArray(res.data)) {
        rawData = res.data;
      } else if (res.data?.students) {
        rawData = res.data.students;
      } else if (res.data?.data) {
        rawData = res.data.data;
      }

      const formatted = rawData.map((s: any) => ({
        id: s.id,
        name: s.name || "",
        email: s.email || "",
        birth_date: s.birth_date ? s.birth_date.split("T")[0] : "",
        citizen_id: s.citizen_id || "",
        target_score: Number(s.target_score || 0),
        created_at: s.created_at || new Date().toISOString(),
      }));

      setStudents(formatted);
    } catch (error) {
      console.error("Lỗi lấy danh sách học viên:", error);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openCreate = () => {
    setEditingStudent(null);
    setFormData({ name: "", email: "", birth_date: "", citizen_id: "", target_score: "" });
    setShowForm(true);
  };

  const openEdit = (s: StudentItem) => {
    setEditingStudent(s);
    setFormData({
      name: s.name,
      email: s.email,
      birth_date: s.birth_date,
      citizen_id: s.citizen_id,
      target_score: String(s.target_score),
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.citizen_id.trim() || !formData.birth_date) {
      alert("Vui lòng nhập đầy đủ Tên, CCCD và Ngày sinh!");
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        birth_date: formData.birth_date,
        citizen_id: formData.citizen_id.trim(),
        target_score: Number(formData.target_score) || 0,
      };

      if (editingStudent) {
      
        await apiUpdateStudent(editingStudent.id, payload);
        alert("Cập nhật học viên thành công!");
      } else {
      
        await apiCreateStudent(payload);
        alert("Thêm học viên thành công!");
      }

      setShowForm(false);
      fetchStudents(); 
    } catch (error: any) {
      console.log("CHI TIẾT LỖI:", error.response?.data);
      const serverData = error.response?.data;

      if (serverData?.errors) {
       
        const detailMsg = Object.entries(serverData.errors)
          .map(([key, val]) => {
            const field = key === 'citizen_id' ? 'CCCD' : key;
            return `${field}: ${Array.isArray(val) ? val.join(", ") : val}`;
          })
          .join("\n");
        alert(`Dữ liệu không hợp lệ:\n${detailMsg}`);
      } else {
        alert(serverData?.message || "Lỗi hệ thống, vui lòng thử lại.");
      }
    }
  };

  
  const handleDelete = async (id: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa học viên này?")) return;
    try {
      await apiDeleteStudent(id);
      fetchStudents();
    } catch (error) {
      alert("Xóa học viên thất bại.");
    }
  };

 
  const filteredStudents = useMemo(() => {
    const kw = keyword.toLowerCase().trim();
    return students.filter((s) =>
      s.name.toLowerCase().includes(kw) ||
      s.citizen_id.includes(kw) ||
      `hv${String(s.id).padStart(3, "0")}`.includes(kw)
    );
  }, [students, keyword]);

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Quản lý Học viên</h1>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={18} /> Thêm học viên
        </button>
      </div>

      <div className="card">
        <div className="searchbar">
          <Search size={18} />
          <input
            type="text"
            placeholder="Tìm theo tên, mã HV hoặc CCCD..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
      </div>

      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Mã HV</th>
              <th>Tên</th>
              <th>Email</th>
              <th>CCCD</th>
              <th>Điểm</th>
              <th>Ngày đăng ký</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: "center" }}>Đang tải dữ liệu...</td></tr>
            ) : filteredStudents.length > 0 ? (
              filteredStudents.map((s) => (
                <tr key={s.id}>
                  <td>{`HV${String(s.id).padStart(3, "0")}`}</td>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>{s.email}</td>
                  <td>{s.citizen_id}</td>
                  <td>{s.target_score}</td>
                  <td>{new Date(s.created_at).toLocaleDateString("vi-VN")}</td>
                  <td>
                    <button onClick={() => openEdit(s)} className="btn-icon">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="btn-icon text-danger">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={7} style={{ textAlign: "center" }}>Không tìm thấy học viên.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-head">
              <h3 className="modal-title">{editingStudent ? "Sửa học viên" : "Thêm học viên mới"}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit} className="form">
                <div className="form-group">
                  <label className="label">Họ và tên <span className="req">*</span></label>
                  <input className="input" name="name" value={formData.name} onChange={handleInputChange} placeholder="Nguyễn Văn A" required />
                </div>
                
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="label">Email</label>
                    <input className="input" name="email" type="email" value={formData.email} onChange={handleInputChange} placeholder="email@gmail.com" />
                  </div>
                  <div className="form-group">
                    <label className="label">Ngày sinh <span className="req">*</span></label>
                    <input type="date" className="input" name="birth_date" value={formData.birth_date} onChange={handleInputChange} required />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="label">CCCD <span className="req">*</span></label>
                    <input className="input" name="citizen_id" value={formData.citizen_id} onChange={handleInputChange} placeholder="Số CCCD" required />
                  </div>
                  <div className="form-group">
                    <label className="label">Điểm mục tiêu</label>
                    <input type="number" className="input" name="target_score" value={formData.target_score} onChange={handleInputChange} placeholder="0" />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>Hủy</button>
                  <button type="submit" className="btn-save">Lưu thông tin</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentManagement;