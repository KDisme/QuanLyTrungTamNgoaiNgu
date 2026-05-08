import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    ArrowLeft, UserPlus, Users,
    X, Search, Trash2, CheckCircle
} from "lucide-react";

import {
    apiGetClassById,
    apiGetAllTeachers,
    apiGetAllStudents,
    apiAssignTeacher,
    apiAssignStudentToClass,
    apiRemoveStudentFromClass
} from "../../api/axios";

import "../../styles/global.css";
import "../../styles/table.css";
import "../../styles/form.css";

const ClassDetail: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    // State dữ liệu
    const [classInfo, setClassInfo] = useState<any>(null);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // State Modal & Form
    const [showTeacherModal, setShowTeacherModal] = useState(false);
    const [showStudentModal, setShowStudentModal] = useState(false);
    const [selectedTeacher, setSelectedTeacher] = useState("");
    const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
    const [studentSearch, setStudentSearch] = useState("");

    // --- FETCH DATA ---
    const fetchData = async () => {
        try {
            setLoading(true);
            const [resClass, resT, resS] = await Promise.all([
                apiGetClassById(id!),
                apiGetAllTeachers(),
                apiGetAllStudents()
            ]);

            // Lấy thông tin lớp
            const classData = resClass.data?.class || resClass.data;
            setClassInfo(classData);

            // Đồng bộ ID giảng viên cho Modal select
            if (classData?.teacher_id) {
                setSelectedTeacher(String(classData.teacher_id));
            } else {
                setSelectedTeacher("");
            }

            // Danh sách giảng viên tổng
            setTeachers(Array.isArray(resT.data) ? resT.data : (resT.data?.teachers || []));

            // Danh sách học viên tổng
            setStudents(Array.isArray(resS.data) ? resS.data : (resS.data?.students || []));

        } catch (err) {
            console.error("Lỗi khi tải dữ liệu:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    // --- LOGIC LỌC HỌC VIÊN CHƯA CÓ TRONG LỚP ---
    const availableStudents = useMemo(() => {
        const currentStudentIds = classInfo?.students?.map((s: any) => s.id) || [];
        return students.filter(s =>
            !currentStudentIds.includes(s.id) &&
            (s.name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
                s.email?.toLowerCase().includes(studentSearch.toLowerCase()))
        );
    }, [students, classInfo, studentSearch]);

    // --- HANDLERS ---

    const handleAssignTeacher = async () => {
        if (!selectedTeacher) return;
        try {
            await apiAssignTeacher(id!, { teacher_id: Number(selectedTeacher) });
            alert("Gán giảng viên thành công!");
            setShowTeacherModal(false);
            await fetchData(); 
        } catch (err: any) {
            alert("Lỗi khi gán giảng viên");
        }
    };

    const handleAddStudents = async () => {
        if (selectedStudents.length === 0) return;
        try {
            setLoading(true);
            const promises = selectedStudents.map(studentId =>
                apiAssignStudentToClass(studentId, { class_id: Number(id) })
            );
            await Promise.all(promises);
            
            alert(`Đã thêm ${selectedStudents.length} học viên thành công!`);
            setSelectedStudents([]);
            setShowStudentModal(false);
            setStudentSearch("");
            await fetchData();
        } catch (err) {
            alert("Lỗi khi thêm học viên");
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveStudent = async (studentId: number) => {
        if (!window.confirm("Bạn có chắc chắn muốn gỡ học viên này khỏi lớp?")) return;
        try {
            await apiRemoveStudentFromClass(studentId);
            alert("Đã gỡ học viên thành công");
            await fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || "Lỗi gỡ học viên");
        }
    };

    const toggleStudentSelection = (studentId: number) => {
        setSelectedStudents(prev =>
            prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
        );
    };

    if (loading && !classInfo) return <div className="page td-center" style={{ padding: '100px' }}>Đang tải dữ liệu...</div>;

    return (
        <div className="page">
            <div className="page-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="btn-icon" onClick={() => navigate("/class-management")}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="page-title">{classInfo?.name || "Chi tiết lớp"}</h1>
                        <p className="page-subtitle">Quản lý thành viên và giảng viên</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-outline" onClick={() => setShowTeacherModal(true)}>
                        <UserPlus size={18} /> Gán giảng viên
                    </button>
                    <button className="btn-primary" onClick={() => setShowStudentModal(true)}>
                        <Users size={18} /> Thêm học viên
                    </button>
                </div>
            </div>

            {/* THÔNG TIN TỔNG QUAN */}
            <div className="card toolbar-card" style={{ padding: '20px', marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                <div className="info-block">
                    <label className="label text-muted">GIẢNG VIÊN</label>
                    <p className="td-strong" style={{ color: '#4f46e5', marginTop: '4px' }}>
                        {/* FIX TẠI ĐÂY: Dò tên từ danh sách teachers thay vì dùng classInfo.teacher_name */}
                        {teachers.find(t => t.id === classInfo?.teacher_id)?.full_name || "Chưa gán"}
                    </p>
                </div>
                <div className="info-block">
                    <label className="label text-muted">NGÀY BẮT ĐẦU</label>
                    <p className="td-strong" style={{ marginTop: '4px' }}>
                        {classInfo?.start_date ? new Date(classInfo.start_date).toLocaleDateString("vi-VN") : "---"}
                    </p>
                </div>
                <div className="info-block">
                    <label className="label text-muted">SỐ BUỔI HỌC</label>
                    <p className="td-strong" style={{ marginTop: '4px' }}>{classInfo?.sessions || 0} buổi</p>
                </div>
                <div className="info-block">
                    <label className="label text-muted">SĨ SỐ</label>
                    <div style={{ marginTop: '4px' }}>
                        <span className={`capacity-badge ${classInfo?.students?.length >= classInfo?.capacity ? 'text-danger' : ''}`}>
                            {classInfo?.students?.length || 0} / {classInfo?.capacity || 0} học viên
                        </span>
                    </div>
                </div>
            </div>

            {/* BẢNG HỌC VIÊN */}
            <div className="card table-card">
                <div className="card-header" style={{ padding: '15px 20px', borderBottom: '1px solid #eee' }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>Danh sách học viên lớp</h3>
                </div>
                <table className="table">
                    <thead>
                        <tr>
                            <th>Tên học viên</th>
                            <th>Email</th>
                            <th className="td-center">CCCD</th>
                            <th className="td-right">Thao tác</th>
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
                                        <button className="btn-icon text-danger" onClick={() => handleRemoveStudent(s.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={4} className="td-center py-10 text-muted">Chưa có học viên.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL GÁN GIẢNG VIÊN */}
            {showTeacherModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '400px' }}>
                        <div className="modal-head">
                            <h2 className="modal-title">Gán giảng viên</h2>
                            <button className="modal-close" onClick={() => setShowTeacherModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="label">Chọn giảng viên giảng dạy <span className="req">*</span></label>
                                <select className="input" value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)}>
                                    <option value="">-- Chọn giảng viên --</option>
                                    {teachers.map((t: any) => (
                                        <option key={t.id} value={t.id}>{t.full_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-actions">
                                <button className="btn-cancel" onClick={() => setShowTeacherModal(false)}>Hủy</button>
                                <button className="btn-save" onClick={handleAssignTeacher}>Xác nhận</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL THÊM HỌC VIÊN */}
            {showStudentModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '600px', width: '95%' }}>
                        <div className="modal-head">
                            <h2 className="modal-title">Thêm học viên vào lớp</h2>
                            <button className="modal-close" onClick={() => { setShowStudentModal(false); setSelectedStudents([]); }}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="label">Tìm kiếm học viên</label>
                                <div style={{ position: 'relative' }}>
                                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                                    <input 
                                        type="text" className="input" style={{ paddingLeft: '35px' }}
                                        placeholder="Nhập tên hoặc email..."
                                        value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="student-list-scroll" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '10px' }}>
                                {availableStudents.length > 0 ? (
                                    availableStudents.map((s) => (
                                        <div 
                                            key={s.id} 
                                            className={`student-item ${selectedStudents.includes(s.id) ? 'selected' : ''}`}
                                            onClick={() => toggleStudentSelection(s.id)}
                                            style={{
                                                display: 'flex', alignItems: 'center', padding: '10px 15px', cursor: 'pointer',
                                                borderBottom: '1px solid #f1f5f9', background: selectedStudents.includes(s.id) ? '#eff6ff' : '#fff'
                                            }}
                                        >
                                            <input type="checkbox" checked={selectedStudents.includes(s.id)} readOnly style={{ marginRight: '15px' }} />
                                            <div style={{ flex: 1 }}>
                                                <div className="td-strong" style={{ fontSize: '14px' }}>{s.name}</div>
                                                <div className="text-muted" style={{ fontSize: '12px' }}>{s.email}</div>
                                            </div>
                                            {selectedStudents.includes(s.id) && <CheckCircle size={16} color="#4f46e5" />}
                                        </div>
                                    ))
                                ) : (
                                    <div className="td-center" style={{ padding: '30px', color: '#94a3b8' }}>Không có học viên phù hợp.</div>
                                )}
                            </div>

                            <div className="form-actions">
                                <button className="btn-cancel" onClick={() => { setShowStudentModal(false); setSelectedStudents([]); }}>Hủy bỏ</button>
                                <button className="btn-save" onClick={handleAddStudents} disabled={selectedStudents.length === 0}>Thêm vào lớp</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClassDetail;