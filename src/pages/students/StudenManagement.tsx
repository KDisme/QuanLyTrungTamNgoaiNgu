import React, { useEffect, useMemo, useState } from "react";
import { Plus, Edit2, Trash2, X, Search, Calendar } from "lucide-react";
// Chỉnh lại đường dẫn lùi ra 2 cấp để vào đúng thư mục api
import {
    apiGetAllStudents,
    apiCreateStudent,
    apiUpdateStudent,
    apiDeleteStudent,
} from "../../api/axios";

// Chỉnh lại đường dẫn lùi ra 2 cấp để vào đúng thư mục styles
import "../../styles/global.css";
import "../../styles/table.css";
import "../../styles/form.css";

// Định nghĩa Interface (Nên chuyển vào src/@types/index.ts để dùng chung)
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

    const [errors, setErrors] = useState<any>({});

    const fetchStudents = async () => {
        try {
            setLoading(true);
            const res = await apiGetAllStudents();
            const data = Array.isArray(res.data) ? res.data : res.data?.data || [];

            setStudents(
                data.map((s: any) => ({
                    id: Number(s.id),
                    name: s.name ?? "",
                    email: s.email ?? "",
                    birth_date: s.birth_date ? String(s.birth_date).split("T")[0] : "",
                    citizen_id: s.citizen_id ?? "",
                    target_score: Number(s.target_score ?? 0),
                    created_at: s.created_at ?? new Date().toISOString(),
                }))
            );
        } catch (e) {
            console.error("Lỗi tải học viên:", e);
            setStudents([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStudents();
    }, []);

    const validateForm = () => {
        const next: any = {};
        if (!formData.name.trim()) next.name = "Tên học viên bắt buộc";
        if (!formData.email.trim()) next.email = "Email bắt buộc";
        if (!formData.birth_date) next.birth_date = "Ngày sinh bắt buộc";
        if (!formData.citizen_id.trim()) next.citizen_id = "CCCD bắt buộc";
        if (formData.target_score === "") next.target_score = "Điểm mục tiêu bắt buộc";

        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((p) => ({ ...p, [name]: value }));
        if (errors[name]) setErrors((p: any) => ({ ...p, [name]: "" }));
    };

    const openCreate = () => {
        setEditingStudent(null);
        setFormData({ name: "", email: "", birth_date: "", citizen_id: "", target_score: "" });
        setErrors({});
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
        setErrors({});
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);
        try {
            if (editingStudent) await apiUpdateStudent(editingStudent.id, formData);
            else await apiCreateStudent(formData);
            setShowForm(false);
            await fetchStudents();
        } catch (error: any) {
            alert(error.response?.data?.error || "Lỗi lưu dữ liệu");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Xóa học viên này?")) return;
        setLoading(true);
        try {
            await apiDeleteStudent(id);
            await fetchStudents();
        } catch (error: any) {
            alert(error.response?.data?.message || "Lỗi khi xóa");
        } finally {
            setLoading(false);
        }
    };

    const filteredStudents = useMemo(() => {
        const kw = keyword.toLowerCase().trim();
        return students.filter(s =>
            s.name.toLowerCase().includes(kw) ||
            s.citizen_id.includes(kw) ||
            `HV${String(s.id).padStart(3, '0')}`.toLowerCase().includes(kw)
        );
    }, [students, keyword]);

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <h1 className="page-title">Quản lý Học viên</h1>
                    <p className="page-subtitle">Danh sách học viên đăng ký tại trung tâm</p>
                </div>
                <button className="btn-primary" onClick={openCreate}>
                    <Plus size={18} /> Thêm Học viên
                </button>
            </div>

            <div className="card toolbar-card">
                <div className="searchbar" style={{ maxWidth: '400px' }}>
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Tìm theo Mã HV, tên, CCCD..."
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                    />
                </div>
            </div>

            <div className="card table-card">
                <div className="table-wrap">
                    <table className="table">
                        <thead>
                            <tr>
                                <th style={{ width: 100 }}>Mã HV</th>
                                <th>Họ tên</th>
                                <th>Email</th>
                                <th className="th-center">CCCD</th>
                                <th className="th-center">Điểm MT</th>
                                <th className="th-center">Ngày nhập học</th>
                                <th className="th-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStudents.length > 0 ? (
                                filteredStudents.map((s) => (
                                    <tr key={s.id}>
                                        <td className="td-mono text-bold" style={{ color: '#01000d' }}>
                                            {`HV${String(s.id).padStart(3, '0')}`}
                                        </td>
                                        <td className="td-strong">{s.name}</td>
                                        <td>{s.email}</td>
                                        <td className="td-center">{s.citizen_id}</td>
                                        <td className="td-center">
                                            <span className="badge-score" style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                                                {s.target_score}
                                            </span>
                                        </td>
                                        <td className="td-center">
                                            <div className="cell-flex-center">
                                                <Calendar size={14} className="text-muted" />
                                                <span>{new Date(s.created_at).toLocaleDateString("vi-VN")}</span>
                                            </div>
                                        </td>
                                        <td className="td-right">
                                            <div className="actions">
                                                <button className="icon-btn edit" onClick={() => openEdit(s)} title="Sửa">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button className="icon-btn delete" onClick={() => handleDelete(s.id)} title="Xóa">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="td-center py-10 text-muted">
                                        {loading ? "Đang tải dữ liệu..." : "Không tìm thấy học viên phù hợp"}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showForm && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-head">
                            <h2 className="modal-title">{editingStudent ? "Cập nhật học viên" : "Học viên mới"}</h2>
                            <button className="modal-close" onClick={() => setShowForm(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <form className="form" onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label className="label">Họ tên <span className="req">*</span></label>
                                    <input name="name" value={formData.name} onChange={handleInputChange} className="input" placeholder="Nhập họ và tên" />
                                    {errors.name && <p className="error-text">{errors.name}</p>}
                                </div>

                                <div className="form-row-2">
                                    <div className="form-group">
                                        <label className="label">Email <span className="req">*</span></label>
                                        <input name="email" type="email" value={formData.email} onChange={handleInputChange} className="input" placeholder="example@gmail.com" />
                                        {errors.email && <p className="error-text">{errors.email}</p>}
                                    </div>
                                    <div className="form-group">
                                        <label className="label">CCCD <span className="req">*</span></label>
                                        <input name="citizen_id" value={formData.citizen_id} onChange={handleInputChange} className="input" placeholder="Số định danh" />
                                        {errors.citizen_id && <p className="error-text">{errors.citizen_id}</p>}
                                    </div>
                                </div>

                                <div className="form-row-2">
                                    <div className="form-group">
                                        <label className="label">Ngày sinh <span className="req">*</span></label>
                                        <input name="birth_date" type="date" value={formData.birth_date} onChange={handleInputChange} className="input" />
                                        {errors.birth_date && <p className="error-text">{errors.birth_date}</p>}
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Điểm mục tiêu <span className="req">*</span></label>
                                        <input name="target_score" type="number" value={formData.target_score} onChange={handleInputChange} className="input" placeholder="Ví dụ: 990" />
                                        {errors.target_score && <p className="error-text">{errors.target_score}</p>}
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button type="button" className="btn-outline" onClick={() => setShowForm(false)}>Hủy</button>
                                    <button type="submit" className="btn-save" disabled={loading}>
                                        {loading ? "Đang xử lý..." : "Lưu thông tin"}
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

export default StudentManagement;