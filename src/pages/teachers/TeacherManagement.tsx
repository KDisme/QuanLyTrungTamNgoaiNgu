import React, { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Search } from "lucide-react";

import FormModal from "../../components/FormModal";
import {
  apiGetAllTeachers,
  apiCreateTeacher,
  apiUpdateTeacher,
  apiDeleteTeacher,
} from "../../api/axios";

import "../../styles/table.css";
import "../../styles/form.css";
import "../../styles/global.css";

// Định nghĩa Interface cho dữ liệu Giáo viên
interface TeacherItem {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  created_at: string;
}

const TeacherManagement: React.FC = () => {
  // --- States ---
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherItem | null>(null);
  const [keyword, setKeyword] = useState("");
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
  });

  // --- Side Effects ---
  useEffect(() => {
    fetchTeachers();
  }, []);

  // --- Logic Handlers ---
  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const res = await apiGetAllTeachers();
      // Linh hoạt xử lý các cấu trúc trả về khác nhau từ API
      const data = res.data.data || res.data.teachers || res.data || [];
      setTeachers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Lỗi khi tải danh sách giáo viên:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTeacher) {
        await apiUpdateTeacher(editingTeacher.id, formData);
      } else {
        await apiCreateTeacher(formData);
      }
      handleCloseModal();
      fetchTeachers();
    } catch (error) {
      console.error("Lỗi khi lưu dữ liệu:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn xoá giáo viên này?")) return;
    try {
      await apiDeleteTeacher(id);
      fetchTeachers();
    } catch (error) {
      console.error("Lỗi khi xoá:", error);
    }
  };

  const handleEdit = (teacher: TeacherItem) => {
    setEditingTeacher(teacher);
    setFormData({
      full_name: teacher.full_name,
      email: teacher.email,
      phone: teacher.phone,
      date_of_birth: teacher.date_of_birth?.split("T")[0] || "",
    });
    setShowForm(true);
  };

  const handleCloseModal = () => {
    setShowForm(false);
    setEditingTeacher(null);
    setFormData({ full_name: "", email: "", phone: "", date_of_birth: "" });
  };

  // --- Filtering Logic ---
  const filteredTeachers = teachers.filter((t) => {
    const k = keyword.toLowerCase();
    return (
      t.full_name.toLowerCase().includes(k) ||
      t.email.toLowerCase().includes(k) ||
      t.phone.includes(k)
    );
  });

  // --- Render ---
  return (
    <div className="page">
      <div className="page-head">
        <h1>Quản lý Giáo viên</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={18} /> Thêm Giáo viên
        </button>
      </div>

      <div className="searchbar">
        <Search size={18} />
        <input
          placeholder="Tìm kiếm theo tên, email hoặc số điện thoại..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Họ tên</th>
            <th>Email</th>
            <th>Điện thoại</th>
            <th>Ngày sinh</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {filteredTeachers.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: "center" }}>
                {loading ? "Đang tải dữ liệu..." : "Không tìm thấy kết quả"}
              </td>
            </tr>
          ) : (
            filteredTeachers.map((teacher) => (
              <tr key={teacher.id}>
                <td>{teacher.id}</td>
                <td className="font-semibold">{teacher.full_name}</td>
                <td>{teacher.email}</td>
                <td>{teacher.phone}</td>
                <td>
                  {teacher.date_of_birth
                    ? new Date(teacher.date_of_birth).toLocaleDateString("vi-VN")
                    : "---"}
                </td>
                <td className="actions">
                  <button className="btn-icon" onClick={() => handleEdit(teacher)} title="Sửa">
                    <Edit2 size={16} />
                  </button>
                  <button 
                    className="btn-icon text-danger" 
                    onClick={() => handleDelete(teacher.id)} 
                    title="Xoá"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Modal thêm/sửa giáo viên */}
      {showForm && (
        <FormModal
          title={editingTeacher ? "Cập nhật thông tin Giáo viên" : "Thêm Giáo viên mới"}
          onClose={handleCloseModal}
          onSubmit={handleSubmit}
          submitText={editingTeacher ? "Cập nhật" : "Thêm mới"}
        >
          <div className="form-group">
            <label>Họ tên <span className="required">*</span></label>
            <input
              name="full_name"
              placeholder="Nhập họ tên đầy đủ"
              value={formData.full_name}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Email <span className="required">*</span></label>
            <input
              type="email"
              name="email"
              placeholder="example@gmail.com"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Số điện thoại <span className="required">*</span></label>
            <input
              name="phone"
              placeholder="Nhập số điện thoại"
              value={formData.phone}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Ngày sinh <span className="required">*</span></label>
            <input
              type="date"
              name="date_of_birth"
              value={formData.date_of_birth}
              onChange={handleInputChange}
              required
            />
          </div>
        </FormModal>
      )}
    </div>
  );
};

export default TeacherManagement;