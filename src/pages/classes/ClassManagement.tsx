import React, { useEffect, useMemo, useState } from "react";
import { Plus, Edit2, Trash2, X, Search, Calendar, Users, Clock, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
// Chỉnh lại đường dẫn lùi ra 2 cấp để vào đúng thư mục api
import {
    apiGetAllClasses,
    apiCreateClass,
    apiUpdateClass,
    apiDeleteClass,
} from "../../api/axios";

// Chỉnh lại đường dẫn lùi ra 2 cấp để vào đúng thư mục styles
import "../../styles/global.css";
import "../../styles/table.css";
import "../../styles/form.css";

// Bạn nên chuyển Interface này vào src/@types/index.ts để dùng chung
interface ClassItem {
    id: number;
    class_code?: string;
    name: string;
    hv_count?: number;
    capacity: number;
    start_date: string;
    end_date: string;
    sessions: number;
}

const ClassManagement: React.FC = () => {
    const navigate = useNavigate();
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [keyword, setKeyword] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editingClass, setEditingClass] = useState<ClassItem | null>(null);

    const [formData, setFormData] = useState({
        name: "",
        start_date: "",
        end_date: "",
        capacity: "",
        sessions: "",
    });

    const [errors, setErrors] = useState<any>({});

    const fetchClasses = async () => {
        try {
            const res = await apiGetAllClasses();
            // Xử lý dữ liệu trả về linh hoạt từ Axios
            const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
            setClasses(data);
        } catch (err) {
            console.error("Lỗi tải lớp học:", err);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchClasses().finally(() => setLoading(false));
    }, []);

    const validate = () => {
        const next: any = {};
        if (!formData.name.trim()) next.name = "Tên lớp bắt buộc";
        if (!formData.start_date) next.start_date = "Ngày bắt đầu bắt buộc";
        if (!formData.end_date) next.end_date = "Ngày kết thúc bắt buộc";
        if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
            next.end_date = "Ngày kết thúc phải sau ngày bắt đầu";
        }
        if (!formData.capacity || Number(formData.capacity) <= 0) next.capacity = "Sĩ số phải > 0";
        if (!formData.sessions || Number(formData.sessions) <= 0) next.sessions = "Số buổi phải > 0";

        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const openCreate = () => {
        setEditingClass(null);
        setFormData({ name: "", start_date: "", end_date: "", capacity: "", sessions: "" });
        setErrors({});
        setShowForm(true);
    };

    const openEdit = (item: ClassItem) => {
        setEditingClass(item);
        setFormData({
            name: item.name,
            start_date: item.start_date ? item.start_date.split('T')[0] : "",
            end_date: item.end_date ? item.end_date.split('T')[0] : "",
            capacity: String(item.capacity || ""),
            sessions: String(item.sessions || ""),
        });
        setErrors({});
        setShowForm(true);
    };

    const closeModal = () => {
        setShowForm(false);
        setEditingClass(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        const payload = {
            name: formData.name.trim(),
            start_date: formData.start_date,
            end_date: formData.end_date,
            capacity: Number(formData.capacity),
            sessions: Number(formData.sessions),
        };

        setLoading(true);
        try {
            if (editingClass) await apiUpdateClass(editingClass.id, payload);
            else await apiCreateClass(payload);
            closeModal();
            await fetchClasses();
        } catch (error: any) {
            alert(error.response?.data?.error || "Lỗi lưu dữ liệu");
        } finally {
            setLoading(false);
        }
    };

    const filteredClasses = useMemo(() => {
        const kw = keyword.trim().toLowerCase();
        return classes.filter((c) =>
            !kw || c.name.toLowerCase().includes(kw) || (c.class_code || "").toLowerCase().includes(kw)
        );
    }, [classes, keyword]);

    const handleDelete = async (id: number) => {
        if (!window.confirm("Xóa lớp này?")) return;
        setLoading(true);
        try {
            await apiDeleteClass(id);
            await fetchClasses();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <h1 className="page-title">Quản lý Lớp học</h1>
                    <p className="page-subtitle">Theo dõi lịch trình và sĩ số lớp học</p>
                </div>
                <button className="btn-primary" onClick={openCreate}>
                    <Plus size={18} /> Thêm Lớp học
                </button>
            </div>

            <div className="card toolbar-card">
                <div className="toolbar">
                    <div className="searchbar" style={{ maxWidth: '400px' }}>
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Tìm theo mã hoặc tên lớp..."
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="card table-card">
                <div className="table-wrap">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Mã lớp</th>
                                <th>Tên lớp</th>
                                <th className="th-center">Bắt đầu</th>
                                <th className="th-center">Kết thúc</th>
                                <th className="th-center">Sĩ số </th>
                                <th className="th-center">Số buổi</th>
                                <th className="th-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredClasses.length > 0 ? (
                                filteredClasses.map((c) => (
                                    <tr key={c.id}>
                                        <td className="td-mono">{`LH${String(c.id).padStart(3, '0')}`}</td>
                                        <td
                                            className="td-strong clickable-name"
                                            onClick={() => navigate(`/class-management/${c.id}`)}
                                        >
                                            {c.name}
                                        </td>
                                        <td className="td-center">
                                            <div className="cell-flex-center">
                                                <Calendar size={14} color="#3b82f6" />
                                                <span>{c.start_date ? new Date(c.start_date).toLocaleDateString("vi-VN") : "---"}</span>
                                            </div>
                                        </td>
                                        <td className="td-center">
                                            <div className="cell-flex-center">
                                                <Calendar size={14} color="#ef4444" />
                                                <span>{c.end_date ? new Date(c.end_date).toLocaleDateString("vi-VN") : "---"}</span>
                                            </div>
                                        </td>
                                        <td className="td-center">
                                            <div className="capacity-badge">
                                                <Users size={14} className="icon-sub" />
                                                <span className="text-bold">{c.hv_count ?? 0}</span>
                                                <span className="text-sep">/</span>
                                                <span>{c.capacity}</span>
                                            </div>
                                        </td>
                                        <td className="td-center">
                                            <div className="cell-flex-center">
                                                <Clock size={14} />
                                                <span>{c.sessions} buổi</span>
                                            </div>
                                        </td>
                                        <td className="td-right">
                                            <span className="actions">
                                                <button
                                                    className="icon-btn edit"
                                                    title="Chi tiết"
                                                    onClick={() => navigate(`/class-management/${c.id}`)}
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button className="icon-btn edit" title="Sửa" onClick={() => openEdit(c)}>
                                                    <Edit2 size={16} />
                                                </button>
                                                <button className="icon-btn delete" title="Xóa" onClick={() => handleDelete(c.id)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="td-center py-10 text-muted">Không tìm thấy lớp học nào.</td>
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
                            <h2 className="modal-title">{editingClass ? "Chỉnh sửa lớp" : "Thêm lớp mới"}</h2>
                            <button className="modal-close" onClick={closeModal}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <form className="form" onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label className="label">Tên lớp học <span className="req">*</span></label>
                                    <input className="input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                                    {errors.name && <div className="error-text">{errors.name}</div>}
                                </div>

                                <div className="form-row-2">
                                    <div className="form-group">
                                        <label className="label">Ngày bắt đầu <span className="req">*</span></label>
                                        <input type="date" className="input" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
                                        {errors.start_date && <div className="error-text">{errors.start_date}</div>}
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Ngày kết thúc <span className="req">*</span></label>
                                        <input type="date" className="input" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
                                        {errors.end_date && <div className="error-text">{errors.end_date}</div>}
                                    </div>
                                </div>

                                <div className="form-row-2">
                                    <div className="form-group">
                                        <label className="label">Sĩ số tổng <span className="req">*</span></label>
                                        <input type="number" className="input" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: e.target.value })} />
                                        {errors.capacity && <div className="error-text">{errors.capacity}</div>}
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Số buổi học <span className="req">*</span></label>
                                        <input type="number" className="input" value={formData.sessions} onChange={(e) => setFormData({ ...formData, sessions: e.target.value })} />
                                        {errors.sessions && <div className="error-text">{errors.sessions}</div>}
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button type="button" className="btn-outline" onClick={closeModal}>Hủy</button>
                                    <button type="submit" className="btn-save" disabled={loading}>{loading ? "Đang lưu..." : "Lưu thông tin"}</button>
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