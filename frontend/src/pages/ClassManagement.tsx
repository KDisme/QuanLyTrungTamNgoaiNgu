import React, { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Search } from "lucide-react";
import type { AxiosError } from "axios";
import { Modal } from "../components/Modal";
import {
  apiGetAllClasses,
  apiCreateClass,
  apiUpdateClass,
  apiDeleteClass,
} from "../api/classService";
import { apiGetAllTeachers } from "../api/teacherService";

import "../styles/table.css";
import "../styles/form.css";

interface Teacher {
  id: number;
  full_name: string;
}

interface ClassItem {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  capacity: number;
  sessions: number;
  teacher_id: number | null;
  teacher_name?: string | null;
  code?: string;
}

type ApiErrorBody = {
  message?: string;
  error?: string;
};

type ClassFormData = {
  name: string;
  start_date: string;
  end_date: string;
  capacity: number;
  sessions: number;
  teacher_id: string | number;
};

type ClassFormErrors = {
  name: string;
  start_date: string;
  end_date: string;
  capacity: string;
  sessions: string;
  teacher_id: string;
};

type ClassPayload = {
  name: string;
  start_date: string;
  end_date: string;
  capacity: number;
  sessions: number;
  teacher_id: number | null;
};

const getAxiosErrorMessage = (error: unknown, fallback: string) => {
  const axiosError = error as AxiosError<ApiErrorBody>;
  return (
    axiosError?.response?.data?.message ||
    axiosError?.response?.data?.error ||
    fallback
  );
};

const ClassManagement: React.FC = () => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");

  const [formData, setFormData] = useState<ClassFormData>({
    name: "",
    start_date: "",
    end_date: "",
    capacity: 0,
    sessions: 0,
    teacher_id: "" as string | number
  });

  const [errors, setErrors] = useState<ClassFormErrors>({
    name: "",
    start_date: "",
    end_date: "",
    capacity: "",
    sessions: "",
    teacher_id: ""
  });

  /* ================== FORMAT MÃ LỚP ================== */
  const formatClassCode = (cls: ClassItem) => {
    if (cls.code && String(cls.code).trim()) return String(cls.code).trim();
    const num = Number.isFinite(cls.id) ? cls.id : 0;
    return `LH${String(num).padStart(3, "0")}`;
  };

  const formatDateVN = (value: string | null | undefined) => {
    if (!value) return "";
    const iso = String(value).slice(0, 10);
    const [yyyy, mm, dd] = iso.split("-");
    if (!yyyy || !mm || !dd) return iso;
    return `${dd}/${mm}/${yyyy}`;
  };

  /* ================== FETCH ================== */
  const fetchClasses = async () => {
    try {
      setLoading(true);
      const res = await apiGetAllClasses();
      const classData: ClassItem[] = Array.isArray(res.data)
        ? res.data
        : res.data?.classes || res.data?.data || [];
      setClasses(classData);
    } catch (error) {
      console.error("Lỗi tải lớp học:", error);
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const res = await apiGetAllTeachers();
      const data: Teacher[] = Array.isArray(res.data)
        ? res.data
        : res.data?.teachers || res.data?.data || [];
      setTeachers(data);
    } catch (error) {
      console.error("Lỗi tải giảng viên:", error);
    }
  };

  useEffect(() => {
    fetchClasses();
    fetchTeachers();
  }, []);

  const getTeacherName = (teacherId: number | null | undefined) => {
    if (!teacherId) return "";
    const t = teachers.find((x) => x.id === teacherId);
    return t?.full_name || "";
  };

  /* ================== VALIDATE ================== */
  const validateForm = () => {
    const newErrors: ClassFormErrors = {
      name: "",
      start_date: "",
      end_date: "",
      capacity: "",
      sessions: "",
      teacher_id: ""
    };

    if (!formData.name.trim()) newErrors.name = "Tên lớp bắt buộc";
    if (!formData.start_date) newErrors.start_date = "Chọn ngày bắt đầu";
    if (!formData.end_date) newErrors.end_date = "Chọn ngày kết thúc";
    if (formData.start_date && formData.end_date && new Date(formData.start_date) >= new Date(formData.end_date))
      newErrors.end_date = "Ngày kết thúc phải sau ngày bắt đầu";
    if (formData.capacity <= 0) newErrors.capacity = "Sĩ số phải lớn hơn 0";
    if (formData.sessions <= 0) newErrors.sessions = "Số buổi phải lớn hơn 0";

    setErrors(newErrors);
    return Object.values(newErrors).every((e) => !e);
  };
  /* ================== FORM HANDLERS ================== */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (errors[name as keyof typeof errors]) setErrors((p) => ({ ...p, [name]: "" }));
  };

  const handleOpenCreate = () => {
    setEditingClass(null);
    setFormData({ name: "", start_date: "", end_date: "", capacity: 0, sessions: 0, teacher_id: "" });
    setErrors({ name: "", start_date: "", end_date: "", capacity: "", sessions: "", teacher_id: "" });
    setShowForm(true);
  };

  const handleEditClick = (cls: ClassItem) => {
    setEditingClass(cls);
    setFormData({
      name: cls.name,
      start_date: cls.start_date ? cls.start_date.slice(0, 10) : "",
      end_date: cls.end_date ? cls.end_date.slice(0, 10) : "",
      capacity: cls.capacity,
      sessions: cls.sessions,
      teacher_id: cls.teacher_id ?? ""
    });
    setErrors({ name: "", start_date: "", end_date: "", capacity: "", sessions: "", teacher_id: "" });
    setShowForm(true);
  };

  const handleCloseModal = () => {
    setShowForm(false);
    setEditingClass(null);
  };

  /* ================== SUBMIT ================== */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload: ClassPayload = {
      name: formData.name.trim(),
      start_date: formData.start_date,
      end_date: formData.end_date,
      capacity: Number(formData.capacity),
      sessions: Number(formData.sessions),
      teacher_id: formData.teacher_id === "" ? null : Number(formData.teacher_id)
    };

    setLoading(true);
    try {
      if (editingClass) {
        await apiUpdateClass(editingClass.id, payload);
      } else {
        await apiCreateClass(payload);
      }
      setShowForm(false);
      setEditingClass(null);
      fetchClasses();
    } catch (error: unknown) {
      alert(getAxiosErrorMessage(error, "Lỗi lưu dữ liệu"));
    } finally {
      setLoading(false);
    }
  };

  /* ================== DELETE ================== */
  const handleDelete = async (id: number) => {
    if (!window.confirm("Xóa lớp học này?")) return;
    try {
      await apiDeleteClass(id);
      fetchClasses();
    } catch (error: unknown) {
      alert("Lỗi xóa: " + getAxiosErrorMessage(error, "Không xóa được"));
    }
  };

  /* ================== FILTER ================== */
  const filteredClasses = classes.filter((c) => {
    const kw = keyword.toLowerCase();
    return formatClassCode(c).toLowerCase().includes(kw) || c.name.toLowerCase().includes(kw);
  });

  /* ================== RENDER ================== */
  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1 className="page-title">Quản lý Lớp học</h1>
          <p className="page-subtitle">Danh sách các lớp học của trung tâm</p>
        </div>

        <button className="btn-primary" onClick={handleOpenCreate}>
          <Plus size={18} />
          Thêm Lớp học
        </button>
      </div>

      <div className="searchbar">
        <Search size={18} color="#94a3b8" />
        <input
          type="text"
          placeholder="Tìm theo mã hoặc tên lớp..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mã lớp</th>
                <th>Tên lớp</th>
                <th>Giảng viên</th>
                <th>Thời gian</th>
                <th className="th-center" style={{ width: 90 }}>Sĩ số</th>
                <th className="th-center" style={{ width: 90 }}>Số buổi</th>
                <th className="th-right" style={{ width: 120 }}>Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {filteredClasses.length > 0 ? (
                filteredClasses.map((c) => (
                  <tr key={c.id}>
                    <td className="td-mono">{formatClassCode(c)}</td>
                    <td className="td-strong">{c.name}</td>
                    <td>
                      {getTeacherName(c.teacher_id) || c.teacher_name || (
                        <span style={{ color: "#94a3b8" }}>Chưa phân công</span>
                      )}
                    </td>
                    <td>{formatDateVN(c.start_date)} → {formatDateVN(c.end_date)}</td>
                    <td className="td-center">{c.capacity}</td>
                    <td className="td-center">{c.sessions}</td>
                    <td className="td-right">
                      <div className="actions">
                        <button className="icon-btn edit" onClick={() => handleEditClick(c)} title="Chỉnh sửa">
                          <Edit2 size={16} />
                        </button>
                        <button className="icon-btn delete" onClick={() => handleDelete(c.id)} title="Xóa">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="row-empty">
                    {loading ? "Đang tải dữ liệu..." : "Chưa có lớp học"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          Hiển thị {filteredClasses.length} / {classes.length} lớp học
        </div>
      </div>

      <Modal
        isOpen={showForm}
        onClose={handleCloseModal}
        title={editingClass ? "Chỉnh sửa lớp học" : "Thêm lớp học"}
      >
        <form className="form" onSubmit={handleSubmit}>
          <div>
            <label>Tên lớp <span style={{ color: "red" }}>*</span></label>
            <input
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`input ${errors.name ? "error" : ""}`}
              placeholder="Nhập tên lớp"
            />
            {errors.name && <div className="error-text">{errors.name}</div>}
          </div>

          <div className="form-row-2">
            <div>
              <label>Ngày bắt đầu <span style={{ color: "red" }}>*</span></label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleInputChange}
                className={`input ${errors.start_date ? "error" : ""}`}
              />
              {errors.start_date && <div className="error-text">{errors.start_date}</div>}
            </div>

            <div>
              <label>Ngày kết thúc <span style={{ color: "red" }}>*</span></label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleInputChange}
                className={`input ${errors.end_date ? "error" : ""}`}
              />
              {errors.end_date && <div className="error-text">{errors.end_date}</div>}
            </div>
          </div>

          <div className="form-row-2">
            <div>
              <label>Sĩ số <span style={{ color: "red" }}>*</span></label>
              <input
                type="number"
                name="capacity"
                value={formData.capacity}
                onChange={handleInputChange}
                className={`input ${errors.capacity ? "error" : ""}`}
              />
              {errors.capacity && <div className="error-text">{errors.capacity}</div>}
            </div>

            <div>
              <label>Số buổi học <span style={{ color: "red" }}>*</span></label>
              <input
                type="number"
                name="sessions"
                value={formData.sessions}
                onChange={handleInputChange}
                className={`input ${errors.sessions ? "error" : ""}`}
              />
              {errors.sessions && <div className="error-text">{errors.sessions}</div>}
            </div>
          </div>

          <div>
            <label>Giảng viên phụ trách</label>
            <select
              name="teacher_id"
              value={formData.teacher_id}
              onChange={handleInputChange}
              className={`input ${errors.teacher_id ? "error" : ""}`}
            >
              <option value="">-- Chưa phân công --</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
            {errors.teacher_id && <div className="error-text">{errors.teacher_id}</div>}
          </div>

          <div className="form-actions" style={{ marginTop: 16 }}>
            <button type="button" className="btn-outline" onClick={handleCloseModal}>
              Hủy
            </button>
            <button type="submit" className="btn-save" disabled={loading}>
              {loading ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ClassManagement;
