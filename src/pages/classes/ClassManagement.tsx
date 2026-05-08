import React, { useEffect, useMemo, useState } from "react";
import { Plus, Edit2, Trash2, X, Search, Users, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
    apiGetAllClasses,
    apiCreateClass,
    apiUpdateClass,
    apiDeleteClass,
} from "../../api/axios";

import "../../styles/global.css";
import "../../styles/table.css";
import "../../styles/form.css";

interface ClassItem {
    id: number;
    name: string;
    hv_count?: number;
    capacity: number;
    start_date: string;
    end_date: string;
    sessions: number;
    sessions_per_week: number;
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
        capacity: "",
        sessions: "",
        sessions_per_week: "",
    });

    const fetchClasses = async () => {
        try {
            setLoading(true);
            const res = await apiGetAllClasses();
            let rawData: any[] = [];
            if (res.data?.classes) {
                rawData = res.data.classes;
            } else if (res.data?.data) {
                rawData = res.data.data;
            } else if (Array.isArray(res.data)) {
                rawData = res.data;
            }

            const formatted = rawData.map((c: any) => ({
                ...c,
                id: Number(c.id),
                hv_count: Number(c.hv_count || 0), 
                start_date: c.start_date ? c.start_date.split('T')[0] : "",
                end_date: c.end_date ? c.end_date.split('T')[0] : "", 
                sessions_per_week: Number(c.sessions_per_week || 0)
            }));
            setClasses(formatted);
        } catch (err) {
            console.error("Lỗi tải lớp học:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchClasses(); }, []);

    const openCreate = () => {
        setEditingClass(null);
        setFormData({ name: "", start_date: "", capacity: "", sessions: "", sessions_per_week: "" });
        setShowForm(true);
    };

    const openEdit = (item: ClassItem) => {
        setEditingClass(item);
        setFormData({
            name: item.name,
            start_date: item.start_date,
            capacity: String(item.capacity),
            sessions: String(item.sessions),
            sessions_per_week: String(item.sessions_per_week || ""),
        });
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.start_date || !formData.sessions_per_week || !formData.sessions) {
            alert("Vui lòng điền đầy đủ các thông tin bắt buộc.");
            return;
        }

        const payload = {
            name: formData.name.trim(),
            start_date: formData.start_date,
            capacity: Number(formData.capacity),
            sessions: Number(formData.sessions),
            sessions_per_week: Number(formData.sessions_per_week),
        };

        try {
            if (editingClass) {
                await apiUpdateClass(editingClass.id, payload);
                alert("Cập nhật lớp học thành công!");
            } else {
                await apiCreateClass(payload);
                alert("Thêm lớp học thành công!");
            }
            setShowForm(false);
            fetchClasses();
        } catch (error: any) {
            const serverMsg = error.response?.data?.message || "Lỗi lưu dữ liệu.";
            alert(serverMsg);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa lớp này?")) return;
        try {
            await apiDeleteClass(id);
            fetchClasses();
        } catch (error) {
            alert("Xóa lớp học thất bại.");
        }
    };

    const filteredClasses = useMemo(() => {
        const kw = keyword.trim().toLowerCase();
        return classes.filter((c) =>
            c.name.toLowerCase().includes(kw) || 
            `LH${String(c.id).padStart(3, '0')}`.toLowerCase().includes(kw)
        );
    }, [classes, keyword]);

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

            <div className="card">
                <div className="searchbar">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Tìm theo mã hoặc tên lớp..."
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                    />
                </div>
            </div>

            <div className="card table-card">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Mã lớp</th>
                            <th>Tên lớp</th>
                            <th className="td-center">Bắt đầu</th>
                            <th className="td-center">Kết thúc</th>
                            <th className="td-center">Sĩ số</th>
                            <th className="td-center">Số buổi</th>
                            <th className="td-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} className="td-center">Đang tải...</td></tr>
                        ) : filteredClasses.length > 0 ? (
                            filteredClasses.map((c) => (
                                <tr key={c.id}>
                                    <td className="td-mono">{`LH${String(c.id).padStart(3, '0')}`}</td>
                                    <td className="td-strong clickable-name" onClick={() => navigate(`/class-management/${c.id}`)}>
                                        {c.name}
                                    </td>
                                    <td className="td-center">{c.start_date ? new Date(c.start_date).toLocaleDateString("vi-VN") : "---"}</td>
                                    <td className="td-center">
                                        <span className={!c.end_date ? "text-muted" : ""}>
                                            {c.end_date ? new Date(c.end_date).toLocaleDateString("vi-VN") : "---"}
                                        </span>
                                    </td>
                                    <td className="td-center">
                                        <div className="capacity-badge">
                                            <Users size={14} style={{marginRight: '4px'}} />
                                            <b>{c.hv_count ?? 0}</b> / {c.capacity}
                                        </div>
                                    </td>
                                    <td className="td-center">{c.sessions} buổi</td>
                                    <td className="td-right">
                                        <button className="btn-icon" onClick={() => navigate(`/class-management/${c.id}`)} title="Xem chi tiết">
                                            <Eye size={16} />
                                        </button>
                                        <button className="btn-icon" onClick={() => openEdit(c)} title="Sửa">
                                            <Edit2 size={16} />
                                        </button>
                                        <button className="btn-icon text-danger" onClick={() => handleDelete(c.id)} title="Xóa">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={7} className="td-center">Không tìm thấy lớp học nào.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showForm && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-head">
                            <h2 className="modal-title">{editingClass ? "Chỉnh sửa lớp học" : "Thêm lớp học mới"}</h2>
                            <button className="modal-close" onClick={() => setShowForm(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <form className="form" onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label className="label">Tên lớp học <span className="req">*</span></label>
                                    <input 
                                        className="input" 
                                        value={formData.name} 
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                                        required 
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="label">Ngày bắt đầu <span className="req">*</span></label>
                                    <input 
                                        type="date" 
                                        className="input" 
                                        value={formData.start_date} 
                                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} 
                                        required 
                                    />
                                </div>

                                <div className="form-row-2">
                                    <div className="form-group">
                                        <label className="label">Sĩ số tối đa <span className="req">*</span></label>
                                        <input 
                                            type="number" 
                                            className="input" 
                                            value={formData.capacity} 
                                            onChange={(e) => setFormData({ ...formData, capacity: e.target.value })} 
                                            required 
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Tổng số buổi học <span className="req">*</span></label>
                                        <input 
                                            type="number" 
                                            className="input" 
                                            value={formData.sessions} 
                                            onChange={(e) => setFormData({ ...formData, sessions: e.target.value })} 
                                            required 
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="label">Số buổi học trong tuần <span className="req">*</span></label>
                                    <input 
                                        type="number" 
                                        className="input" 
                                        placeholder="Ví dụ: 2 hoặc 3"
                                        value={formData.sessions_per_week} 
                                        onChange={(e) => setFormData({ ...formData, sessions_per_week: e.target.value })} 
                                        required 
                                        min="1"
                                        max="7"
                                    />
                                </div>

                                <div className="form-actions">
                                    <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>Hủy</button>
                                    <button type="submit" className="btn-save">Lưu lớp học</button>
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