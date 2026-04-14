import React, { useEffect, useMemo, useState } from "react";
import { Search, Eye, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import dayjs from "dayjs";
import type { AxiosError } from "axios";
import { Modal } from "../components/Modal";

import {
  apiGetAllStudents,
  apiCreateStudent,
  apiUpdateStudent,
  apiCompleteStudentCourse,
  apiDeleteStudent,
} from "../api/studentService";
import { apiGetAllClasses } from "../api/classService";
import { apiGetAllTeachers } from "../api/teacherService";

import "../styles/global.css";
import "../styles/table.css";
import "../styles/form.css";

interface Student {
  id: number;
  name: string;
  email: string;
  birth_date: string;
  citizen_id: string;
  target_score: number | null;
  class_id: number | null;
  enrollment_date: string | null;
  status?: "active" | "completed";
  completed_at?: string | null;
  created_at?: string;
}

interface ClassOption {
  id: number;
  name: string;
  teacher_id?: number | null;
}

interface TeacherOption {
	id: number;
	full_name: string;
}

type ApiErrorBody = {
  message?: string;
  error?: string;
};

type StudentPayload = {
  name: string;
  email: string;
  birth_date: string;
  citizen_id: string;
  enrollment_date: string | null;
  target_score: number | null;
  class_id: number | null;
};

const getAxiosErrorMessage = (error: unknown, fallback: string) => {
  const axiosError = error as AxiosError<ApiErrorBody>;
  return (
    axiosError?.response?.data?.message ||
    axiosError?.response?.data?.error ||
    fallback
  );
};

const formatStudentCode = (id: number) => `HV${String(id).padStart(3, "0")}`;

const StudentManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
	const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [keyword, setKeyword] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const [current, setCurrent] = useState<Student | null>(null);

  const emptyForm = {
    name: "",
    email: "",
    birth_date: "",
    citizen_id: "",
    target_score: "",
    class_id: "",
    enrollment_date: dayjs().format("YYYY-MM-DD")
  };

  const [form, setForm] = useState(emptyForm);

  const closeAllModal = () => {
    setShowAdd(false);
    setShowEdit(false);
    setShowDetail(false);
    setCurrent(null);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [studRes, classRes, teachRes] = await Promise.all([
        apiGetAllStudents(),
        apiGetAllClasses(),
			apiGetAllTeachers()
      ]);
      const studentData: Student[] = Array.isArray(studRes.data)
        ? studRes.data
        : studRes.data?.students || studRes.data?.data || [];
      const classData: ClassOption[] = Array.isArray(classRes.data)
        ? classRes.data
        : classRes.data?.classes || classRes.data?.data || [];
		const teacherData: TeacherOption[] = Array.isArray(teachRes.data)
			? teachRes.data
			: teachRes.data?.teachers || teachRes.data?.data || [];
      setStudents(studentData);
      setClasses(classData);
		setTeachers(teacherData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredStudents = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return students;
    return students.filter((s) => {
      const name = (s.name || "").toLowerCase();
      const email = (s.email || "").toLowerCase();
      const citizenId = String(s.citizen_id || "");
      return name.includes(kw) || email.includes(kw) || citizenId.includes(kw);
    });
  }, [students, keyword]);

  const getClassName = (class_id: number | null) => {
    if (!class_id) return "---";
    const cls = classes.find((c) => c.id === class_id);
    return cls ? cls.name : String(class_id);
  };

  const getStatusLabel = (status?: string) => (status === "completed" ? "Đã hoàn thành" : "Đang học");
  const getStatusClass = (status?: string) => (status === "completed" ? "status-completed" : "status-active");

  const getTeacherName = (class_id: number | null) => {
    if (!class_id) return "---";
    const cls = classes.find((c) => c.id === class_id);
		if (!cls?.teacher_id) return "Chưa phân công";
		const teacher = teachers.find((t) => t.id === cls.teacher_id);
		return teacher?.full_name || `ID: ${cls.teacher_id}`;
  };

  const getTeacherNameByTeacherId = (teacherId: number | null | undefined) => {
    if (!teacherId) return "";
    const teacher = teachers.find((t) => t.id === teacherId);
    return teacher?.full_name || `ID: ${teacherId}`;
  };

  const openAdd = () => {
    setForm(emptyForm);
    setShowAdd(true);
  };

  const openEdit = (s: Student) => {
    setCurrent(s);
    setForm({
      name: s.name || "",
      email: s.email || "",
      birth_date: s.birth_date ? dayjs(s.birth_date).format("YYYY-MM-DD") : "",
      citizen_id: s.citizen_id || "",
      target_score: s.target_score !== null && s.target_score !== undefined ? String(s.target_score) : "",
      class_id: s.class_id !== null && s.class_id !== undefined ? String(s.class_id) : "",
      enrollment_date: s.enrollment_date
        ? dayjs(s.enrollment_date).format("YYYY-MM-DD")
        : dayjs().format("YYYY-MM-DD")
    });
    setShowEdit(true);
  };

  const openDetail = (s: Student) => {
    setCurrent(s);
    setShowDetail(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const buildPayload = (): StudentPayload => {
    return {
      name: form.name.trim(),
      email: form.email.trim(),
      birth_date: form.birth_date,
      citizen_id: form.citizen_id.trim(),
      enrollment_date: form.enrollment_date || null,
      target_score: form.target_score !== "" ? Number(form.target_score) : null,
      class_id: form.class_id !== "" ? Number(form.class_id) : null
    };
  };

  const validateAdd = () => {
    if (!form.name.trim()) return "Thiếu họ tên";
    if (!form.email.trim()) return "Thiếu email";
    if (!form.birth_date) return "Thiếu ngày sinh";
    if (!form.citizen_id.trim()) return "Thiếu số CMND/CCCD";
    if (form.citizen_id.trim().length < 9 || form.citizen_id.trim().length > 12)
      return "CMND/CCCD phải từ 9-12 ký tự";
    return "";
  };

  const validateEdit = () => {
    if (!form.name.trim()) return "Thiếu họ tên";
    if (!form.email.trim()) return "Thiếu email";
    if (!form.birth_date) return "Thiếu ngày sinh";
    return "";
  };

  const handleCreate = async () => {
    const err = validateAdd();
    if (err) return alert(err);
    try {
      await apiCreateStudent(buildPayload());
      closeAllModal();
      await loadData();
    } catch (e: unknown) {
      alert(getAxiosErrorMessage(e, "Lỗi tạo học viên"));
    }
  };

  const handleUpdate = async () => {
    if (!current) return;
    const err = validateEdit();
    if (err) return alert(err);
    try {
      await apiUpdateStudent(current.id, buildPayload());
      closeAllModal();
      await loadData();
    } catch (e: unknown) {
      alert(getAxiosErrorMessage(e, "Lỗi cập nhật học viên"));
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Xóa học viên này?")) return;
    try {
      await apiDeleteStudent(id);
      await loadData();
    } catch (e: unknown) {
      alert("Lỗi xóa: " + getAxiosErrorMessage(e, "Không xóa được"));
    }
  };

  const handleCompleteCourse = async (student: Student) => {
    if (student.status === "completed") {
      alert("Học viên này đã ở trạng thái hoàn thành");
      return;
    }

    if (!window.confirm(`Đánh dấu học viên ${student.name} đã hoàn thành khóa học hiện tại?`)) return;

    try {
      await apiCompleteStudentCourse(student.id, {});
      await loadData();
    } catch (e: unknown) {
      alert(getAxiosErrorMessage(e, "Lỗi cập nhật trạng thái học viên"));
    }
  };

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1 className="page-title">Quản lý Học viên</h1>
          <p className="page-subtitle">Quản lý danh sách học viên của trung tâm</p>
        </div>
        <button className="btn-primary" onClick={openAdd} style={{ whiteSpace: "nowrap" }}>
          + Thêm học viên
        </button>
      </div>

      <div className="searchbar">
        <Search size={18} color="#94a3b8" />
        <input
          type="text"
          placeholder="Tìm theo tên, email, CMND/CCCD..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      <div className="card table-card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Mã HV</th>
                <th>Họ tên</th>
                <th>Email</th>
                <th style={{ width: 130 }}>Ngày sinh</th>
                <th>Lớp học</th>
                <th>Giảng viên</th>
                <th style={{ width: 140 }}>Trạng thái</th>
                <th style={{ width: 150, textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="row-empty">
                    {loading ? "Đang tải dữ liệu..." : "Chưa có học viên"}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s.id}>
                    <td className="td-center">{formatStudentCode(s.id)}</td>
                    <td className="td-strong">{s.name}</td>
                    <td>{s.email}</td>
                    <td>{s.birth_date ? dayjs(s.birth_date).format("DD/MM/YYYY") : ""}</td>
                    <td>{getClassName(s.class_id)}</td>
                    <td>{getTeacherName(s.class_id)}</td>
                    <td>
                      <span className={`status-pill ${getStatusClass(s.status)}`}>{getStatusLabel(s.status)}</span>
                    </td>
                    <td className="td-right">
                      <span className="actions">
                        {s.status !== "completed" && (
                          <button className="icon-btn view" title="Đánh dấu hoàn thành khóa" onClick={() => handleCompleteCourse(s)}>
                            <CheckCircle2 size={16} />
                          </button>
                        )}
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

      <Modal
        isOpen={showAdd || showEdit}
        onClose={closeAllModal}
        title={showAdd ? "Thêm học viên mới" : "Cập nhật học viên"}
        maxWidth={680}
      >
        <div className="form" style={{ gap: 14 }}>
          <div className="form-row-2">
            <div className="field">
              <label className="label">Họ tên <span style={{ color: "red" }}>*</span></label>
              <input className="input" name="name" value={form.name} onChange={handleChange} placeholder="Nguyễn Văn A" />
            </div>
            <div className="field">
              <label className="label">Email <span style={{ color: "red" }}>*</span></label>
              <input className="input" name="email" type="email" value={form.email} onChange={handleChange} placeholder="example@email.com" />
            </div>
          </div>
          <div className="form-row-2">
            <div className="field">
              <label className="label">Ngày sinh <span style={{ color: "red" }}>*</span></label>
              <input className="input" name="birth_date" type="date" value={form.birth_date} onChange={handleChange} />
            </div>
            <div className="field">
              <label className="label">CMND / CCCD <span style={{ color: "red" }}>*</span></label>
              <input className="input" name="citizen_id" value={form.citizen_id} onChange={handleChange} placeholder="9-12 ký số" maxLength={12} />
            </div>
          </div>
          <div className="form-row-2">
            <div className="field">
              <label className="label">Điểm mục tiêu (0–9)</label>
              <input className="input" name="target_score" type="number" step="0.5" min="0" max="9" value={form.target_score} onChange={handleChange} placeholder="VD: 6.5" />
            </div>
            <div className="field">
              <label className="label">Ngày nhập học</label>
              <input className="input" name="enrollment_date" type="date" value={form.enrollment_date} onChange={handleChange} />
            </div>
          </div>
          <div className="field">
            <label className="label">Lớp học (chọn để phân công giảng viên)</label>
            <select className="input" name="class_id" value={form.class_id} onChange={handleChange}>
              <option value="">-- Chưa đăng ký lớp --</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                  {cls.teacher_id ? ` — GV: ${getTeacherNameByTeacherId(cls.teacher_id)}` : ""}
                </option>
              ))}
            </select>
          </div>
          {form.class_id && (() => {
            const cls = classes.find(c => c.id === Number(form.class_id));
            const teacherLabel = cls?.teacher_id ? getTeacherNameByTeacherId(cls.teacher_id) : "";

            return teacherLabel ? (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "#166534" }}>
                Giảng viên phụ trách: <strong>{teacherLabel}</strong>
              </div>
            ) : null;
          })()}
          <div className="form-actions" style={{ justifyContent: "flex-end" }}>
            <button className="btn-outline" type="button" onClick={closeAllModal}>Hủy</button>
            <button className="btn-save" type="button" onClick={showAdd ? handleCreate : handleUpdate}>Lưu</button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDetail && !!current}
        onClose={closeAllModal}
        title="Chi tiết học viên"
        maxWidth={560}
      >
        {current && (
          <div className="form" style={{ gap: 12 }}>
            <div className="form-row-2">
              <div className="field">
                <label className="label">Mã học viên</label>
                <div className="input">{formatStudentCode(current.id)}</div>
              </div>
              <div className="field">
                <label className="label">Họ tên</label>
                <div className="input">{current.name}</div>
              </div>
            </div>
            <div className="form-row-2">
              <div className="field">
                <label className="label">Email</label>
                <div className="input">{current.email}</div>
              </div>
              <div className="field">
                <label className="label">Ngày sinh</label>
                <div className="input">{current.birth_date ? dayjs(current.birth_date).format("DD/MM/YYYY") : "---"}</div>
              </div>
            </div>
            <div className="form-row-2">
              <div className="field">
                <label className="label">CMND / CCCD</label>
                <div className="input">{current.citizen_id || "---"}</div>
              </div>
              <div className="field">
                <label className="label">Điểm mục tiêu</label>
                <div className="input">{current.target_score !== null ? current.target_score : "---"}</div>
              </div>
            </div>
            <div className="form-row-2">
              <div className="field">
                <label className="label">Lớp học</label>
                <div className="input">{getClassName(current.class_id)}</div>
              </div>
              <div className="field">
                <label className="label">Giảng viên</label>
                <div className="input">{getTeacherName(current.class_id)}</div>
              </div>
            </div>
            <div className="form-row-2">
              <div className="field">
                <label className="label">Trạng thái</label>
                <div className="input">{getStatusLabel(current.status)}</div>
              </div>
              <div className="field">
                <label className="label">Ngày hoàn thành</label>
                <div className="input">{current.completed_at ? dayjs(current.completed_at).format("DD/MM/YYYY HH:mm") : "---"}</div>
              </div>
            </div>
            <div className="field">
              <label className="label">Ngày nhập học</label>
              <div className="input">{current.enrollment_date ? dayjs(current.enrollment_date).format("DD/MM/YYYY") : "---"}</div>
            </div>
            <div className="form-actions" style={{ justifyContent: "flex-end" }}>
              <button className="btn-outline" type="button" onClick={closeAllModal}>Đóng</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default StudentManagement;
