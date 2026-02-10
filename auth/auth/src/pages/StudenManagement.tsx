import React, { useEffect, useMemo, useState } from "react";
import { Search, Eye, Pencil, Trash2, X } from "lucide-react";
import dayjs from "dayjs";

import {
  apiGetAllStudents,
  apiCreateStudent,
  apiUpdateStudent,
  apiDeleteStudent
} from "../api/axios";

import "../styles/global.css";
import "../styles/table.css";
import "../styles/form.css";

interface Student {
  id: number;
  name: string;
  email: string;
  phone: string;
  birth_date: string;
  class_id: number;
  class_name?: string;
  created_at?: string;

  student_code?: string;
  enroll_date?: string;

  academy_name?: string;
}

const pad3 = (n: number) => String(n).padStart(3, "0");
const genStudentCode = (nextId: number) => `HV${pad3(nextId)}`;
const formatStudentCode = (id: number | undefined, code?: string) => {
  if (code) return code;
  if (!id) return "HV000";
  return `HV${String(id).padStart(3, "0")}`;
};

const StudentManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [keyword, setKeyword] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const [current, setCurrent] = useState<Student | null>(null);

  const [form, setForm] = useState({
    academy_name: "",
    password: "",
    confirmPassword: "",
    name: "",
    student_code: "",
    phone: "",
    birth_date: "",
    email: "",
    enroll_date: dayjs().format("YYYY-MM-DD"),
    class_id: ""
  });

  const closeAllModal = () => {
    setShowAdd(false);
    setShowEdit(false);
    setShowDetail(false);
    setCurrent(null);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiGetAllStudents();
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setStudents(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const nextStudentCode = useMemo(() => {
    const maxId = students.reduce((m, s) => Math.max(m, Number(s.id || 0)), 0);
    return genStudentCode(maxId + 1);
  }, [students]);

  const filteredStudents = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return students;

    return students.filter((s) => {
      const name = (s.name || "").toLowerCase();
      const email = (s.email || "").toLowerCase();
      const phone = String(s.phone || "");
      return name.includes(kw) || email.includes(kw) || phone.includes(kw);
    });
  }, [students, keyword]);

  const openAdd = () => {
    setForm({
      academy_name: "",
      password: "",
      confirmPassword: "",
      name: "",
      student_code: nextStudentCode,
      phone: "",
      birth_date: "",
      email: "",
      enroll_date: dayjs().format("YYYY-MM-DD"),
      class_id: ""
    });
    setShowAdd(true);
  };

  const openEdit = (s: Student) => {
    setCurrent(s);
    setForm({
      academy_name: s.academy_name || "",
      password: "",
      confirmPassword: "",
      name: s.name || "",
      student_code: formatStudentCode(s.id, s.student_code),
      phone: s.phone || "",
      birth_date: s.birth_date ? dayjs(s.birth_date).format("YYYY-MM-DD") : "",
      email: s.email || "",
      enroll_date: s.enroll_date
        ? dayjs(s.enroll_date).format("YYYY-MM-DD")
        : dayjs().format("YYYY-MM-DD"),
      class_id: String(s.class_id ?? "")
    });
    setShowEdit(true);
  };

  const openDetail = (s: Student) => {
    setCurrent(s);
    setShowDetail(true);
  };

  const validateCommon = () => {
    if (!form.academy_name.trim()) return "Thiếu tên học viện";
    if (!form.name.trim()) return "Thiếu họ tên";
    if (!form.phone.trim()) return "Thiếu số điện thoại";
    if (!form.birth_date) return "Thiếu ngày sinh";
    if (!form.enroll_date) return "Thiếu ngày nhập học";
    return "";
  };

  const validateAdd = () => {
    const common = validateCommon();
    if (common) return common;
    if (!form.password) return "Thiếu mật khẩu";
    if (form.password !== form.confirmPassword) return "Mật khẩu không khớp";
    return "";
  };

  const validateEdit = () => {
    const common = validateCommon();
    if (common) return common;
    if ((form.password || form.confirmPassword) && form.password !== form.confirmPassword)
      return "Mật khẩu không khớp";
    return "";
  };

  const handleCreate = async () => {
    const err = validateAdd();
    if (err) return alert(err);

    const payload = {
      academy_name: form.academy_name.trim(),
      password: form.password,
      name: form.name.trim(),
      student_code: form.student_code,
      phone: form.phone.trim(),
      birth_date: form.birth_date,
      email: form.email.trim(),
      enroll_date: form.enroll_date,
      class_id: form.class_id ? Number(form.class_id) : null
    };

    await apiCreateStudent(payload);
    closeAllModal();
    await loadData();
  };

  const handleUpdate = async () => {
    if (!current) return;

    const err = validateEdit();
    if (err) return alert(err);

    const payload: any = {
      academy_name: form.academy_name.trim(),
      name: form.name.trim(),
      student_code: form.student_code,
      phone: form.phone.trim(),
      birth_date: form.birth_date,
      email: form.email.trim(),
      enroll_date: form.enroll_date,
      class_id: form.class_id ? Number(form.class_id) : current.class_id
    };

    if (form.password) payload.password = form.password;

    await apiUpdateStudent(current.id, payload);
    closeAllModal();
    await loadData();
  };

  const handleDelete = async (id: number) => {
    const ok = window.confirm("Xóa học viên này?");
    if (!ok) return;
    await apiDeleteStudent(id);
    await loadData();
  };

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1 className="page-title">Quản lý Học viên</h1>
          <p className="page-subtitle">Quản lý danh sách học viên của trung tâm</p>
        </div>
      </div>

      <div className="card">
        <div className="toolbar" style={{ justifyContent: "space-between", gap: 12 }}>
          <div className="search" style={{ flex: 1, maxWidth: 520 }}>
            <Search size={16} />
            <input
              className="input"
              placeholder="Tìm theo tên, email, SĐT"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          <button className="btn-primary" onClick={openAdd} style={{ whiteSpace: "nowrap" }}>
            + Thêm học viên
          </button>
        </div>
      </div>

      <div className="card table-card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Mã HV</th>
                <th>Họ tên</th>
                <th>Email</th>
                <th style={{ width: 140 }}>Ngày sinh</th>
                <th style={{ width: 90, textAlign: "center" }}>Lớp</th>
                <th style={{ width: 150, textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="row-empty">
                    {loading ? "Đang tải dữ liệu..." : "Chưa có học viên"}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s.id}>
                    <td className="td-center">{formatStudentCode(s.id, s.student_code)}</td>
                    <td className="td-strong">{s.name}</td>
                    <td>{s.email}</td>
                    <td>{s.birth_date ? dayjs(s.birth_date).format("DD/MM/YYYY") : ""}</td>
                    <td className="td-center">{s.class_name || s.class_id || "---"}</td>
                    <td className="td-right">
                      <span className="actions">
                        <button className="icon-btn view" title="Xem" onClick={() => openDetail(s)}>
                          <Eye size={16} />
                        </button>
                        <button className="icon-btn edit" title="Sửa" onClick={() => openEdit(s)}>
                          <Pencil size={16} />
                        </button>
                        <button className="icon-btn delete" title="Xóa" onClick={() => handleDelete(s.id)}>
                          <Trash2 size={16} />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          Hiển thị {filteredStudents.length} / {students.length} học viên
        </div>
      </div>

      {(showAdd || showEdit) && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: 860 }}>
            <div className="modal-head">
              <h2 className="modal-title">{showAdd ? "Thêm học viên mới" : "Cập nhật học viên"}</h2>
              <button className="modal-close" onClick={closeAllModal} aria-label="Đóng">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form" style={{ gap: 12 }}>
                {/* Form fields giữ nguyên */}
                <div className="field">
                  <label className="label">Mã học viên</label>
                  <input className="input" value={form.student_code} readOnly />
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>Mã tự động tạo</div>
                </div>
                {/* Các field khác giữ nguyên */}
              </div>
            </div>
          </div>
        </div>
      )}

      {showDetail && current && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-head">
              <h2 className="modal-title">Chi tiết học viên</h2>
              <button className="modal-close" onClick={closeAllModal} aria-label="Đóng">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form" style={{ gap: 12 }}>
                <div className="field">
                  <label className="label">Họ tên</label>
                  <div className="input">{current.name}</div>
                </div>

                <div className="field">
                  <label className="label">Mã học viên</label>
                  <div className="input">{formatStudentCode(current.id, current.student_code)}</div>
                </div>

                <div className="field">
                  <label className="label">SĐT</label>
                  <div className="input">{current.phone}</div>
                </div>

                <div className="field">
                  <label className="label">Ngày sinh</label>
                  <div className="input">{current.birth_date ? dayjs(current.birth_date).format("DD/MM/YYYY") : ""}</div>
                </div>

                <div className="field">
                  <label className="label">Lớp</label>
                  <div className="input">{current.class_name || current.class_id || "---"}</div>
                </div>

                <div className="form-actions" style={{ justifyContent: "flex-end" }}>
                  <button className="btn-outline" type="button" onClick={closeAllModal}>
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentManagement;
