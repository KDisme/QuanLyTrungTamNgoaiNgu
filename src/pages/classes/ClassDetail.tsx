import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    ArrowLeft, UserPlus, Users, Calendar,
    Clock, X, Check, Search, Trash2
} from "lucide-react";
// Chỉnh lại đường dẫn import api (lùi ra 2 cấp)
import {
    apiGetClassById,
    apiGetAllTeachers,
    apiGetAllStudents,
    apiAssignTeacher,
    apiAssignStudents,
    apiRemoveStudentFromClass // Đảm bảo hàm này đã được export trong axios.ts
} from "../../api/axios";

// Chỉnh lại đường dẫn import style (lùi ra 2 cấp)
import "../../styles/global.css";
import "../../styles/table.css";
import "../../styles/form.css";

const ClassDetail: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [classInfo, setClassInfo] = useState<any>(null);
    const [teachers, setTeachers] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showTeacherModal, setShowTeacherModal] = useState(false);
    const [showStudentModal, setShowStudentModal] = useState(false);
    const [selectedTeacher, setSelectedTeacher] = useState("");
    const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
    const [studentSearch, setStudentSearch] = useState("");

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const resClass = await apiGetClassById(id!);
            const data = resClass.data?.data || resClass.data;
            setClassInfo(data);

            if (data?.teacher_id) setSelectedTeacher(String(data.teacher_id));

            const [resT, resS] = await Promise.all([
                apiGetAllTeachers(),
                apiGetAllStudents()
            ]);

            setTeachers(resT.data?.data || resT.data || []);
            setStudents(resS.data?.data || resS.data || []);
        } catch (err) {
            console.error("Lỗi tải dữ liệu:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAssignTeacher = async () => {
        if (!selectedTeacher) return;
        try {
            await apiAssignTeacher(id!, { teacher_id: Number(selectedTeacher) });
            setShowTeacherModal(false);
            fetchData();
        } catch (err) {
            alert("Lỗi khi gán giảng viên");
        }
    };

    const handleAssignStudents = async () => {
        if (selectedStudents.length === 0) return;
        try {
            await apiAssignStudents(id!, { student_ids: selectedStudents });
            setShowStudentModal(false);
            setSelectedStudents([]);
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.error || "Lỗi khi gán học viên");
        }
    };

    // Hàm xử lý gỡ học viên khỏi lớp
    const handleRemoveStudent = async (studentId: number) => {
        if (!window.confirm("Bạn có chắc chắn muốn gỡ học viên này khỏi lớp?")) return;
        try {
            await apiRemoveStudentFromClass(id!, studentId);
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || "Lỗi khi gỡ học viên");
        }
    };

    const filteredStudentsList = useMemo(() => {
        if (!students || !Array.isArray(students)) return [];
        const currentStudentIds = classInfo?.students?.map((s: any) => s.id) || [];

        return students.filter((s: any) => {
            const name = s?.name || "";
            const search = studentSearch || "";
            const matchSearch = name.toLowerCase().includes(search.toLowerCase()) ||
                (s.citizen_id && s.citizen_id.includes(search));

            // Chỉ hiện những học viên chưa có trong lớp này
            return matchSearch && !currentStudentIds.includes(s.id);
        });
    }, [students, studentSearch, classInfo, id]);

    if (loading) return <div className="app-main">Đang tải thông tin lớp học...</div>;

    return (
        <div className="page">
            <div className="page-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="icon-btn edit" onClick={() => navigate("/class-management")}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="page-title">{classInfo?.name || "Chi tiết lớp học"}</h1>
                        <p className="page-subtitle">Quản lý thành viên và lịch trình</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-outline" onClick={() => setShowTeacherModal(true)}>
                        <UserPlus size={18} /> Gán giảng viên
                    </button>
                    <button className="btn-primary" onClick={() => setShowStudentModal(true)}>
                        <Users size={18} /> Gán học viên
                    </button>
                </div>
            </div>

            <div className="card toolbar-card" style={{ padding: '24px', marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                <div className="info-block">
                    <label className="label text-muted" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Giảng viên</label>
                    <p className="td-strong" style={{ color: '#4f46e5', margin: '4px 0 0 0' }}>
                        {classInfo?.teacher_name || "Chưa có"}
                    </p>
                </div>
                <div className="info-block">
                    <label className="label text-muted" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Thời gian</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <Calendar size={16} color="#3b82f6" />
                        <span style={{ fontWeight: 600 }}>
                            {classInfo?.start_date ? new Date(classInfo.start_date).toLocaleDateString("vi-VN") : "Chưa xác định"}
                        </span>
                    </div>
                </div>
                <div className="info-block">
                    <label className="label text-muted" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Số buổi học</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <Clock size={16} color="#64748b" />
                        <span style={{ fontWeight: 600 }}>{classInfo?.sessions || 0} buổi</span>
                    </div>
                </div>
                <div className="info-block">
                    <label className="label text-muted" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Sĩ số lớp</label>
                    <div style={{ marginTop: '4px' }}>
                        <span className="capacity-badge">
                            <Users size={14} style={{ marginRight: '6px' }} />
                            {Array.isArray(classInfo?.students) ? classInfo.students.length : 0} / {classInfo?.capacity || 0}
                        </span>
                    </div>
                </div>
            </div>

            <div className="card table-card">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Họ tên học viên</th>
                            <th>Email</th>
                            <th className="th-center">CCCD/Mã định danh</th>
                            <th className="th-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {classInfo?.students?.length > 0 ? (
                            classInfo.students.map((s: any) => (
                                <tr key={s.id}>
                                    <td className="td-strong">{s.name}</td>
                                    <td>{s.email}</td>
                                    <td className="td-center td-mono">{s.citizen_id || "---"}</td>
                                    <td className="td-right">
                                        <span className="actions">
                                            <button
                                                className="icon-btn delete"
                                                title="Gỡ khỏi lớp"
                                                onClick={() => handleRemoveStudent(s.id)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={4} className="td-center py-10 text-muted">Lớp học chưa có học viên.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* POP-UP GÁN GIẢNG VIÊN */}
            {showTeacherModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '400px' }}>
                        <div className="modal-head">
                            <h2 className="modal-title">Chọn giảng viên</h2>
                            <button className="modal-close" onClick={() => setShowTeacherModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="label">Giảng viên khả dụng</label>
                                <select className="select" value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)}>
                                    <option value="">-- Chọn giảng viên --</option>
                                    {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                                </select>
                            </div>
                            <div className="form-actions">
                                <button className="btn-outline" onClick={() => setShowTeacherModal(false)}>Hủy</button>
                                <button className="btn-save" onClick={handleAssignTeacher}>Lưu thay đổi</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* POP-UP GÁN HỌC VIÊN */}
            {showStudentModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '500px' }}>
                        <div className="modal-head">
                            <h2 className="modal-title">Thêm học viên vào lớp</h2>
                            <button className="modal-close" onClick={() => setShowStudentModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="searchbar" style={{ marginBottom: '16px' }}>
                                <Search size={18} color="#64748b" />
                                <input
                                    className="input"
                                    style={{ border: 'none', padding: '0 8px' }}
                                    placeholder="Tìm tên hoặc CCCD..."
                                    value={studentSearch}
                                    onChange={(e) => setStudentSearch(e.target.value)}
                                />
                            </div>
                            <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                {filteredStudentsList.length > 0 ? (
                                    filteredStudentsList.map((s: any) => (
                                        <div
                                            key={s.id}
                                            className={`student-select-item ${selectedStudents.includes(s.id) ? 'selected' : ''}`}
                                            style={{
                                                padding: '12px',
                                                borderBottom: '1px solid #f1f5f9',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                backgroundColor: selectedStudents.includes(s.id) ? '#eff6ff' : 'transparent'
                                            }}
                                            onClick={() => setSelectedStudents(prev => prev.includes(s.id) ? prev.filter(i => i !== s.id) : [...prev, s.id])}
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: 600 }}>{s.name}</span>
                                                <span style={{ fontSize: '12px', color: '#64748b' }}>CCCD: {s.citizen_id || "---"}</span>
                                            </div>
                                            {selectedStudents.includes(s.id) && <Check size={16} color="#2563eb" />}
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Không tìm thấy học viên phù hợp</div>
                                )}
                            </div>
                            <div className="form-actions">
                                <p style={{ marginRight: 'auto', fontSize: '13px', color: '#64748b' }}>Đã chọn: <b>{selectedStudents.length}</b></p>
                                <button className="btn-outline" onClick={() => setShowStudentModal(false)}>Hủy</button>
                                <button className="btn-save" onClick={handleAssignStudents}>Xác nhận thêm</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClassDetail;