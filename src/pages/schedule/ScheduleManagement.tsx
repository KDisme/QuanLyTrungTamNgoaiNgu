import React, { useEffect, useState, useMemo } from "react";
import { Calendar, dayjsLocalizer, Views } from "react-big-calendar";
import { 
    Plus, X, RefreshCcw, ChevronLeft, ChevronRight, 
    Users, Clock, MapPin, AlertCircle 
} from "lucide-react";
import dayjs from "dayjs";
import http, { apiCancelSchedule, apiCreateMakeupSchedule, apiUndoMakeupSchedule } from "../../api/axios";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../../styles/ScheduleStyles.css";

const localizer = dayjsLocalizer(dayjs);

const ScheduleManagement = () => {
    // --- States Dữ liệu ---
    const [schedules, setSchedules] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // --- States Điều khiển Lịch ---
    const [currentDate, setCurrentDate] = useState(new Date());
    const [currentView, setCurrentView] = useState<any>(Views.WEEK);

    // --- States Bộ lọc ---
    const [classFilter, setClassFilter] = useState("all");
    const [teacherFilter, setTeacherFilter] = useState("all");

    // --- States Modals ---
    const [selectedEvent, setSelectedEvent] = useState<any>(null); 
    const [showMakeupForm, setShowMakeupForm] = useState(false); 
    const [showBulkModal, setShowBulkModal] = useState(false); 
    const [pendingCancelId, setPendingCancelId] = useState<number | null>(null);

    // --- State Form Rải Lịch Tự Động ---
    const [selectedClass, setSelectedClass] = useState<any>(null);
    const [bulkTeacherId, setBulkTeacherId] = useState("");
    const [bulkStartTime, setBulkStartTime] = useState("08:00");
    const [bulkEndTime, setBulkEndTime] = useState("10:00");
    const [bulkRoom, setBulkRoom] = useState("");
    const [selectedDays, setSelectedDays] = useState<number[]>([]);
    const daysOfWeek = [
        { label: "T2", value: 1 }, { label: "T3", value: 2 },
        { label: "T4", value: 3 }, { label: "T5", value: 4 },
        { label: "T6", value: 5 }, { label: "T7", value: 6 },
        { label: "CN", value: 0 }
    ];

    // --- State Form Dạy Bù ---
    const [makeupData, setMakeupForm] = useState({
        teaching_date: "",
        start_time: "08:00",
        end_time: "10:00",
        room: "",
        notes: ""
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [schRes, clsRes, teaRes] = await Promise.all([
                http.get("/teaching-schedules"),
                http.get("/classes"),
                http.get("/teachers")
            ]);
            setSchedules(schRes.data.schedules || schRes.data.data || []);
            setClasses(clsRes.data.classes || clsRes.data.data || []);
            setTeachers(teaRes.data.teachers || teaRes.data.data || []);
        } catch (error) { console.error("Lỗi tải dữ liệu:", error); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    // --- Logic Lọc & Hiển thị Lịch ---
    const calendarEvents = useMemo(() => {
        return schedules.filter(s => {
            const matchClass = classFilter === "all" || String(s.class_id) === classFilter;
            const matchTeacher = teacherFilter === "all" || String(s.teacher_id) === teacherFilter;
            return matchClass && matchTeacher && s.status !== 'CANCELLED'; // Không hiện lịch đã hủy
        }).map(s => ({
            id: s.id,
            title: s.class_name,
            start: dayjs(`${s.teaching_date.split('T')[0]}T${s.start_time}`).toDate(),
            end: dayjs(`${s.teaching_date.split('T')[0]}T${s.end_time}`).toDate(),
            resource: s
        }));
    }, [schedules, classFilter, teacherFilter]);

    // --- Xử lý Rải lịch tự động ---
    const handleSaveBulk = async () => {
        if (!selectedClass || selectedDays.length === 0 || !bulkTeacherId || !bulkRoom) {
            alert("Vui lòng nhập đủ thông tin rải lịch.");
            return;
        }
        try {
            await http.post("/teaching-schedules/bulk", {
                class_id: selectedClass.id,
                teacher_id: Number(bulkTeacherId),
                start_time: bulkStartTime,
                end_time: bulkEndTime,
                room: bulkRoom,
                day_of_week: selectedDays
            });
            alert("Đã rải lịch thành công!");
            setShowBulkModal(false);
            fetchData();
        } catch (error: any) {
            const serverMsg = error.response?.data?.message || "Lỗi hệ thống không xác định.";
            alert(`LỖI RẢI LỊCH: ${serverMsg}`); // Hiện lỗi chi tiết từ Backend[cite: 2]
        }
    };

    // --- Xử lý Hủy lịch & Dạy bù ---
    const handleCancel = async () => {
        if (selectedEvent?.status === 'MAKEUP') {
            alert("Không thể hủy lịch học bù.");
            return;
        }
        const confirmMakeup = window.confirm(
            "Bạn muốn tạo lịch học bù cho buổi học này không?"
        );
        if (!confirmMakeup) return;

        setPendingCancelId(selectedEvent.id);
        setShowMakeupForm(true);
    };

    const handleSaveMakeup = async () => {
        if (!makeupData.teaching_date || !makeupData.start_time || !makeupData.end_time || !makeupData.room) {
            alert("Vui lòng nhập ngày, giờ bắt đầu, giờ kết thúc và phòng học!");
            return;
        }

        const startTime = dayjs(`1970-01-01T${makeupData.start_time}`);
        const endTime = dayjs(`1970-01-01T${makeupData.end_time}`);
        if (!startTime.isValid() || !endTime.isValid() || !endTime.isAfter(startTime)) {
            alert("Giờ kết thúc phải sau giờ bắt đầu.");
            return;
        }
        try {
            if (pendingCancelId) {
                await apiCancelSchedule(pendingCancelId);
            }
            await apiCreateMakeupSchedule({
                original_schedule_id: pendingCancelId ?? selectedEvent.id, // Truyền ID lịch cũ để bù[cite: 1]
                ...makeupData
            });
            alert("Tạo lịch dạy bù thành công!");
            setShowMakeupForm(false);
            setSelectedEvent(null);
            setPendingCancelId(null);
            fetchData();
        } catch (error: any) {
            const serverMsg = error.response?.data?.message || "Có thể trùng lịch giáo viên/phòng.";
            alert(`LỖI TẠO LỊCH BÙ: ${serverMsg}`);
        }
    };

    const handleUndoMakeup = async () => {
        if (!selectedEvent?.id) return;
        try {
            await apiUndoMakeupSchedule(selectedEvent.id);
            alert("Đã hoàn tác lịch học bù.");
            setSelectedEvent(null);
            fetchData();
        } catch (error: any) {
            const serverMsg = error.response?.data?.message || "Không thể hoàn tác lịch học bù.";
            alert(`LỖI HOÀN TÁC: ${serverMsg}`);
        }
    };

    return (
        <div className="page">
            {/* 1. HEADER ĐIỀU HƯỚNG THEO MẪU */}
            <div className="page-head" style={{ marginBottom: '20px' }}>
                <div>
                    <h1 className="page-title">Lịch học Tổng hợp</h1>
                    <p className="page-subtitle">Xem và quản lý lịch học dạng thời khóa biểu</p>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                        <button
                            className="btn-icon"
                            onClick={() => {
                                const unit = currentView === Views.MONTH
                                    ? 'month'
                                    : currentView === Views.DAY
                                        ? 'day'
                                        : 'week';
                                setCurrentDate(dayjs(currentDate).subtract(1, unit).toDate());
                            }}
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button className="btn-outline" style={{ border: 'none', background: 'white', margin: '0 5px', fontSize: '13px' }} onClick={() => setCurrentDate(new Date())}>
                            Hôm nay
                        </button>
                        <button
                            className="btn-icon"
                            onClick={() => {
                                const unit = currentView === Views.MONTH
                                    ? 'month'
                                    : currentView === Views.DAY
                                        ? 'day'
                                        : 'week';
                                setCurrentDate(dayjs(currentDate).add(1, unit).toDate());
                            }}
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    <button className="btn-primary" onClick={() => setShowBulkModal(true)}>
                        <Plus size={18} /> Rải lịch tự động
                    </button>
                    <button className="btn-outline" onClick={fetchData}>
                        <RefreshCcw size={16} className={loading ? "animate-spin" : ""} /> Làm mới
                    </button>
                </div>
            </div>

            {/* 2. BỘ LỌC TÌM KIẾM */}
            <div className="card toolbar-card" style={{ padding: '20px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                        <label className="label">Lọc theo lớp học</label>
                        <select className="select" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                            <option value="all">Tất cả lớp học</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: 1 }}>
                        <label className="label">Lọc theo giảng viên</label>
                        <select className="select" value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)}>
                            <option value="all">Tất cả giảng viên</option>
                            {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                        </select>
                    </div>
                    <button className="btn-outline" onClick={() => { setClassFilter("all"); setTeacherFilter("all"); }}>
                        Xóa lọc
                    </button>
                </div>
            </div>

            {/* 3. LỊCH VÀ THANH CHUYỂN VIEW THEO MẪU */}
            <div className="card" style={{ padding: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: '#1e3a8a' }}>
                        {dayjs(currentDate).format(currentView === Views.MONTH ? 'MMMM YYYY' : 'MMMM D, YYYY')}
                    </div>
                    <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                        <button className={`btn-view ${currentView === Views.MONTH ? 'active' : ''}`} onClick={() => setCurrentView(Views.MONTH)}>Tháng</button>
                        <button className={`btn-view ${currentView === Views.WEEK ? 'active' : ''}`} onClick={() => setCurrentView(Views.WEEK)}>Tuần</button>
                        <button className={`btn-view ${currentView === Views.DAY ? 'active' : ''}`} onClick={() => setCurrentView(Views.DAY)}>Ngày</button>
                        <button className={`btn-view ${currentView === Views.AGENDA ? 'active' : ''}`} onClick={() => setCurrentView(Views.AGENDA)}>Sự kiện</button>
                    </div>
                </div>

                <div style={{ height: 'calc(100vh - 350px)' }}>
                    <Calendar
                        localizer={localizer}
                        events={calendarEvents}
                        date={currentDate}
                        view={currentView}
                        toolbar={false} // Ẩn toolbar mặc định[cite: 2]
                        onNavigate={(d: Date) => setCurrentDate(d)}
                        onView={(v: typeof Views[keyof typeof Views]) => setCurrentView(v)}
                        onSelectEvent={(ev: any) => setSelectedEvent(ev.resource)}
                        eventPropGetter={(ev: any) => ({
                            style: { 
                                backgroundColor: ev.resource.status === 'MAKEUP' ? '#f59e0b' : '#3b82f6', 
                                borderRadius: '6px', border: 'none'
                            }
                        })}
                        messages={{ today: "Hôm nay", previous: "Trước", next: "Sau", month: "Tháng", week: "Tuần", day: "Ngày", agenda: "Sự kiện" }}
                    />
                </div>
            </div>

            {/* MODAL RẢI LỊCH TỰ ĐỘNG */}
            {showBulkModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '550px', width: '95%' }}>
                        <div className="modal-head">
                            <h2 className="modal-title">Rải lịch học tự động</h2>
                            <button onClick={() => setShowBulkModal(false)} className="modal-close"><X /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="label">1. Chọn lớp học <span className="req">*</span></label>
                                <select className="select" onChange={e => {
                                    const cls = classes.find(c => String(c.id) === e.target.value);
                                    setSelectedClass(cls);
                                    setBulkTeacherId(cls?.teacher_id ? String(cls.teacher_id) : "");
                                }}>
                                    <option value="">-- Chọn lớp học --</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            {selectedClass && (
                                <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #bfdbfe' }}>
                                    <p style={{ fontSize: '13px', color: '#1e40af', margin: 0 }}>
                                        📅 <b>Thời gian lớp:</b> {dayjs(selectedClass.start_date).format("DD/MM/YYYY")} → {selectedClass.end_date ? dayjs(selectedClass.end_date).format("DD/MM/YYYY") : "Chưa xác định"}
                                    </p>
                                </div>
                            )}
                            <div className="form-group">
                                <label className="label">2. Giảng viên phụ trách</label>
                                <select className="select" value={bulkTeacherId} onChange={e => setBulkTeacherId(e.target.value)} disabled={!!selectedClass?.teacher_id}>
                                    <option value="">-- Chọn giảng viên --</option>
                                    {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="label">3. Chọn các thứ học trong tuần <span className="req">*</span></label>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {daysOfWeek.map(day => (
                                        <button key={day.value} type="button" className={selectedDays.includes(day.value) ? "btn-primary" : "btn-outline"} style={{ padding: '10px', flex: 1, minWidth: '60px' }} onClick={() => setSelectedDays(prev => prev.includes(day.value) ? prev.filter(d => d !== day.value) : [...prev, day.value])}>{day.label}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="form-row-2">
                                <div className="form-group"><label className="label">Giờ bắt đầu</label><input type="time" className="input" value={bulkStartTime} onChange={e => setBulkStartTime(e.target.value)} /></div>
                                <div className="form-group"><label className="label">Giờ kết thúc</label><input type="time" className="input" value={bulkEndTime} onChange={e => setBulkEndTime(e.target.value)} /></div>
                            </div>
                            <div className="form-group">
                                <label className="label">Phòng học <span className="req">*</span></label>
                                <input className="input" placeholder="Vd: P.201" value={bulkRoom} onChange={e => setBulkRoom(e.target.value)} />
                            </div>
                            <div className="form-actions" style={{ marginTop: '20px' }}>
                                <button type="button" className="btn-cancel" onClick={() => setShowBulkModal(false)}>Hủy</button>
                                <button type="button" className="btn-save" onClick={handleSaveBulk}>Xác nhận rải lịch</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CHI TIẾT & HỦY LỊCH */}
            {selectedEvent && !showMakeupForm && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '400px' }}>
                        <div className="modal-head">
                            <h2 className="modal-title">Chi tiết buổi học</h2>
                            <button onClick={() => setSelectedEvent(null)} className="modal-close"><X /></button>
                        </div>
                        <div className="modal-body">
                            <div style={{ marginBottom: '15px' }}>
                                <p><b>Lớp:</b> {selectedEvent.class_name}</p>
                                <p><b>Giảng viên:</b> {selectedEvent.teacher_name}</p>
                                <p><b>Thời gian:</b> {selectedEvent.start_time} - {selectedEvent.end_time}</p>
                                <p><b>Phòng:</b> {selectedEvent.room}</p>
                            </div>
                            <div className="form-actions" style={{ flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                                {selectedEvent.status !== 'MAKEUP' ? (
                                    <button className="btn-save w-full" style={{ background: '#dc2626' }} onClick={handleCancel}>Hủy buổi học này</button>
                                ) : (
                                    <button className="btn-outline w-full" onClick={handleUndoMakeup}>Hoàn tác lịch học bù</button>
                                )}
                                <button className="btn-cancel w-full" onClick={() => setSelectedEvent(null)}>Đóng</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL TẠO LỊCH DẠY BÙ */}
            {showMakeupForm && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '500px' }}>
                        <div className="modal-head">
                            <h2 className="modal-title">Tạo lịch dạy bù</h2>
                            <button
                                onClick={() => { setShowMakeupForm(false); setSelectedEvent(null); setPendingCancelId(null); }}
                                className="modal-close"
                            >
                                <X />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="label">Ngày dạy bù <span className="req">*</span></label>
                                <input type="date" className="input" onChange={e => setMakeupForm({...makeupData, teaching_date: e.target.value})} required />
                            </div>
                            <div className="form-row-2">
                                <div className="form-group">
                                    <label className="label">Giờ bắt đầu</label>
                                    <input type="time" className="input" value={makeupData.start_time} onChange={e => setMakeupForm({...makeupData, start_time: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Giờ kết thúc</label>
                                    <input type="time" className="input" value={makeupData.end_time} onChange={e => setMakeupForm({...makeupData, end_time: e.target.value})} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="label">Phòng học <span className="req">*</span></label>
                                <input className="input" placeholder="Vd: P.201" onChange={e => setMakeupForm({...makeupData, room: e.target.value})} required />
                            </div>
                            <div className="form-group">
                                <label className="label">Ghi chú</label>
                                <textarea className="textarea" placeholder="Nhập lý do dạy bù..." onChange={e => setMakeupForm({...makeupData, notes: e.target.value})} />
                            </div>
                            <div className="form-actions">
                                <button
                                    className="btn-cancel"
                                    onClick={() => { setShowMakeupForm(false); setSelectedEvent(null); setPendingCancelId(null); fetchData(); }}
                                >
                                    Để sau
                                </button>
                                <button className="btn-save" onClick={handleSaveMakeup}>Tạo lịch ngay</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .btn-view { padding: 6px 16px; border: none; background: transparent; cursor: pointer; border-radius: 6px; font-size: 13px; font-weight: 500; color: #64748b; transition: all 0.2s; }
                .btn-view.active { background: #fff; color: #1e3a8a; box-shadow: 0 2px 4px rgba(0,0,0,0.05); font-weight: 700; }
                .btn-icon:hover { background: #e2e8f0; }
                .w-full { width: 100%; }
            `}</style>
        </div>
    );
};

export default ScheduleManagement;