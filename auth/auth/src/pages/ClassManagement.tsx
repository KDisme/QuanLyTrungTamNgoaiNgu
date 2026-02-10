import React, { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, X, Search } from "lucide-react";
import {
  apiGetAllClasses,
  apiCreateClass,
  apiUpdateClass,
  apiDeleteClass
} from "../api/axios";

import "../styles/table.css";
import "../styles/form.css";

interface ClassItem {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  capacity: number;
  sessions: number;
  code?: string; // mã lớp nếu API có trả
}

const ClassManagement: React.FC = () => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    start_date: "",
    end_date: "",
    capacity: 0,
    sessions: 0
  });

  const [errors, setErrors] = useState({
    name: "",
    start_date: "",
    end_date: "",
    capacity: "",
    sessions: ""
  });

  /* ================== FORMAT MÃ LỚP ================== */
  const formatClassCode = (cls: ClassItem) => {
    if (cls.code && String(cls.code).trim()) return String(cls.code).trim();
    const num = Number.isFinite(cls.id) ? cls.id : 0;
    return `LH${String(num).padStart(3, "0")}`;
  };

  /* ================== FETCH ================== */
  const fetchClasses = async () => {
    try {
      setLoading(true);
      const res = await apiGetAllClasses();
      // API có thể trả res.data hoặc res.data.data
      const classData: ClassItem[] = Array.isArray(res.data)
        ? res.data
        : res.data?.data || [];
      setClasses(classData);
    } catch (error) {
      console.error("Lỗi tải lớp học:", error);
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  /* ================== VALIDATE ================== */
  const validateForm = () => {
    const newErrors: any = {
      name: "",
      start_date: "",
      end_date: "",
      capacity: "",
      sessions: ""
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
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (errors[name as keyof typeof errors]) setErrors((p) => ({ ...p, [name]: "" }));
  };

  const handleOpenCreate = () => {
    setEditingClass(null);
    setFormData({ name: "", start_date: "", end_date: "", capacity: 0, sessions: 0 });
    setErrors({ name: "", start_date: "", end_date: "", capacity: "", sessions: "" });
    setShowForm(true);
  };

  const handleEditClick = (cls: ClassItem) => {
    setEditingClass(cls);
    setFormData({
      name: cls.name,
      start_date: cls.start_date,
      end_date: cls.end_date,
      capacity: cls.capacity,
      sessions: cls.sessions
    });
    setErrors({ name: "", start_date: "", end_date: "", capacity: "", sessions: "" });
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

    const payload = {
      name: formData.name.trim(),
      start_date: formData.start_date,
      end_date: formData.end_date,
      capacity: Number(formData.capacity),
      sessions: Number(formData.sessions)
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
    } catch (error: any) {
      alert(error.response?.data?.error || "Lỗi lưu dữ liệu");
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
    } catch (error: any) {
      alert("Lỗi xóa: " + (error.response?.data?.message || "Không xóa được"));
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
                <th className="th-center">Thời gian</th>
                <th className="th-center">Sĩ số</th>
                <th className="th-center">Số buổi</th>
                <th className="th-right">Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {filteredClasses.length > 0 ? (
                filteredClasses.map((c) => (
                  <tr key={c.id}>
                    <td className="td-mono">{formatClassCode(c)}</td>
                    <td className="td-strong">{c.name}</td>
                    <td className="td-center">{c.start_date} → {c.end_date}</td>
                    <td className="td-center">{c.capacity}</td>
                    <td className="td-center">{c.sessions}</td>
                    <td className="td-right">
                      <button className="icon-btn edit" onClick={() => handleEditClick(c)} title="Chỉnh sửa">
                        <Edit2 size={16} />
                      </button>
                      <button className="icon-btn delete" onClick={() => handleDelete(c.id)} title="Xóa">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="row-empty">
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

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-head">
              <h2>{editingClass ? "Chỉnh sửa lớp học" : "Thêm lớp học"}</h2>
              <button onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <form className="form" onSubmit={handleSubmit}>
                <div>
                  <label>Tên lớp *</label>
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
                    <label>Ngày bắt đầu *</label>
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
                    <label>Ngày kết thúc *</label>
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
                    <label>Sĩ số *</label>
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
                    <label>Số buổi học *</label>
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

                <div className="form-actions">
                  <button type="button" className="btn-outline" onClick={handleCloseModal}>
                    Hủy
                  </button>
                  <button type="submit" className="btn-save" disabled={loading}>
                    {loading ? "Đang lưu..." : "Lưu"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassManagement;
