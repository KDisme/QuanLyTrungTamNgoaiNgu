import React, { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Search } from "lucide-react";
import { Modal } from "../components/Modal";
import {
  apiGetAllTeachers,
  apiCreateTeacher,
  apiUpdateTeacher,
  apiDeleteTeacher,
} from "../api/teacherService";
import { apiGetAllClasses } from "../api/classService";

import "../styles/table.css";
import "../styles/form.css";

interface TeacherItem {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  date_of_birth: string;
  class_count: number;
  maGV?: string;
}

interface ClassItem {
  id: number;
  name: string;
}

const TeacherManagement: React.FC = () => {
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherItem | null>(null);
  const [loading, setLoading] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    date_of_birth: ""
  });

  const [errors, setErrors] = useState({
    full_name: "",
    phone: "",
    email: "",
    date_of_birth: ""
  });

  const formatMaGV = (t: TeacherItem) => {
    if (t.maGV && String(t.maGV).trim()) return String(t.maGV).trim();
    const num = Number.isFinite(t.id) ? t.id : 0;
    return `GV${String(num).padStart(3, "0")}`;
  };

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const res = await apiGetAllTeachers();
      const teacherData = Array.isArray(res.data) ? res.data : res.data?.teachers || res.data?.data || [];
      setTeachers(teacherData);
    } catch (error) {
      console.error("Lỗi tải giáo viên:", error);
      setTeachers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await apiGetAllClasses();
      const classData = Array.isArray(res.data) ? res.data : res.data?.classes || res.data?.data || [];
      setClasses(classData);
    } catch (error) {
      console.error("Lỗi tải lớp học:", error);
      setClasses([]);
    }
  };

  useEffect(() => {
    fetchTeachers();
    fetchClasses();
  }, []);

  const validateForm = () => {
    const newErrors: any = {
      full_name: "",
      phone: "",
      email: "",
      date_of_birth: ""
    };

    if (!formData.full_name.trim()) newErrors.full_name = "Họ tên bắt buộc";
    else if (formData.full_name.trim().length < 2 || formData.full_name.trim().length > 50)
      newErrors.full_name = "Họ tên 2-50 ký tự";

    if (!formData.phone.trim()) newErrors.phone = "SĐT bắt buộc";
    else if (!/^0\d{9}$/.test(formData.phone.trim())) newErrors.phone = "SĐT: 0xxxxxxxxx";

    if (!formData.email.trim()) newErrors.email = "Email bắt buộc";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()))
      newErrors.email = "Email không hợp lệ";

    if (!formData.date_of_birth) newErrors.date_of_birth = "Ngày sinh bắt buộc";
    else {
      const birthDate = new Date(formData.date_of_birth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
      if (age < 18 || age > 100) newErrors.date_of_birth = "Tuổi 18-100";
    }

    setErrors(newErrors);
    return Object.values(newErrors).every((e) => !e);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (errors[name as keyof typeof errors]) setErrors((p) => ({ ...p, [name]: "" }));
  };

  const handleOpenCreate = () => {
    setEditingTeacher(null);
    setFormData({ full_name: "", phone: "", email: "", date_of_birth: "" });
    setErrors({ full_name: "", phone: "", email: "", date_of_birth: "" });
    setShowForm(true);
  };

  const handleCloseModal = () => {
    setShowForm(false);
    setEditingTeacher(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const payload = editingTeacher
        ? {
            full_name: formData.full_name.trim(),
            phone: formData.phone.trim(),
            date_of_birth: formData.date_of_birth
          }
        : {
            full_name: formData.full_name.trim(),
            phone: formData.phone.trim(),
            email: formData.email.trim(),
            date_of_birth: formData.date_of_birth
          };

      if (editingTeacher) {
        await apiUpdateTeacher(editingTeacher.id, payload);
      } else {
        await apiCreateTeacher(payload);
      }

      setShowForm(false);
      setEditingTeacher(null);
      fetchTeachers();
    } catch (error: any) {
      alert(error.response?.data?.error || "Lỗi lưu dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (teacher: TeacherItem) => {
    setEditingTeacher(teacher);
    setFormData({
      full_name: teacher.full_name,
      phone: teacher.phone,
      email: teacher.email,
      date_of_birth: teacher.date_of_birth?.split("T")[0] || ""
    });
    setErrors({ full_name: "", phone: "", email: "", date_of_birth: "" });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Xóa giáo viên này?")) return;
    try {
      await apiDeleteTeacher(id);
      fetchTeachers();
    } catch (error: any) {
      alert("Lỗi xóa: " + (error.response?.data?.message || "Không xóa được"));
    }
  };

  const filteredTeachers = teachers.filter((t) => {
    const kw = keyword.toLowerCase();
    return (
      formatMaGV(t).toLowerCase().includes(kw) ||
      t.full_name.toLowerCase().includes(kw) ||
      t.email.toLowerCase().includes(kw) ||
      t.phone.includes(kw)
    );
  });

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1 className="page-title">Quản lý Giáo viên</h1>
          <p className="page-subtitle">Quản lý danh sách giáo viên của trung tâm</p>
        </div>

        <button className="btn-primary" onClick={handleOpenCreate}>
          <Plus size={18} />
          Thêm Giáo viên
        </button>
      </div>

      <div className="searchbar">
        <Search size={18} color="#94a3b8" />
        <input
          type="text"
          placeholder="Tìm theo mã GV, họ tên, email, SĐT..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mã GV</th>
                <th>Họ và tên</th>
                <th>Email</th>
                <th>Số điện thoại</th>
                <th className="th-center">Ngày sinh</th>
                <th className="th-right">Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {filteredTeachers.length > 0 ? (
                filteredTeachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td className="td-mono">{formatMaGV(teacher)}</td>
                    <td className="td-strong">{teacher.full_name}</td>
                    <td>{teacher.email}</td>
                    <td>{teacher.phone}</td>
                    <td className="td-center">
                      {teacher.date_of_birth ? new Date(teacher.date_of_birth).toLocaleDateString("vi-VN") : "---"}
                    </td>
                    <td className="td-right">
                      <span className="actions">
                        <button className="icon-btn edit" onClick={() => handleEditClick(teacher)} title="Chỉnh sửa">
                          <Edit2 size={16} />
                        </button>
                        <button className="icon-btn delete" onClick={() => handleDelete(teacher.id)} title="Xóa">
                          <Trash2 size={16} />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="row-empty">
                    {loading ? "Đang tải dữ liệu..." : "Chưa có giáo viên nào"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          Hiển thị {filteredTeachers.length} / {teachers.length} giáo viên
        </div>
      </div>

      <Modal
        isOpen={showForm}
        onClose={handleCloseModal}
        title={editingTeacher ? "Chỉnh sửa giáo viên" : "Thêm giáo viên"}
      >
        <form className="form" onSubmit={handleSubmit}>
          <div>
            <label className="label">
              Họ và tên <span className="req" style={{ color: "red" }}>*</span>
            </label>
            <input
              name="full_name"
              value={formData.full_name}
              onChange={handleInputChange}
              className={`input ${errors.full_name ? "error" : ""}`}
              placeholder="Nhập họ và tên"
            />
            {errors.full_name && <div className="error-text">{errors.full_name}</div>}
          </div>

          <div className="form-row-2">
            <div>
              <label className="label">
                Số điện thoại <span className="req" style={{ color: "red" }}>*</span>
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                maxLength={10}
                className={`input ${errors.phone ? "error" : ""}`}
                placeholder="09xxxxxxxx"
              />
              {errors.phone && <div className="error-text">{errors.phone}</div>}
            </div>

            <div>
              <label className="label">
                Email <span className="req" style={{ color: "red" }}>*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`input ${errors.email ? "error" : ""}`}
                placeholder="example@gmail.com"
              />
              {errors.email && <div className="error-text">{errors.email}</div>}
            </div>
          </div>

          <div>
            <label className="label">
              Ngày sinh <span className="req" style={{ color: "red" }}>*</span>
            </label>
            <input
              type="date"
              name="date_of_birth"
              value={formData.date_of_birth}
              onChange={handleInputChange}
              max={new Date().toISOString().split("T")[0]}
              className={`input ${errors.date_of_birth ? "error" : ""}`}
            />
            {errors.date_of_birth && <div className="error-text">{errors.date_of_birth}</div>}
          </div>

          <div className="form-actions" style={{ marginTop: 16 }}>
            <button type="button" className="btn-outline" onClick={handleCloseModal}>
              Hủy
            </button>

            <button type="submit" className="btn-save" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" />
                  Đang lưu...
                </>
              ) : (
                "Lưu"
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TeacherManagement;
