import React, { useEffect, useMemo, useState } from "react";
import { Eye, Filter, RefreshCcw } from "lucide-react";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

// Chỉnh lại đường dẫn lùi ra 2 cấp để vào đúng thư mục api
import http from "../../api/axios";

// Chỉnh lại đường dẫn lùi ra 2 cấp để vào đúng thư mục styles
import "../../styles/global.css";
import "../../styles/table.css";
import "../../styles/form.css";

// Kích hoạt plugin so sánh ngày cho dayjs
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// Định nghĩa Types (Bạn nên chuyển các interface này vào src/@types/index.ts)
type ScheduleRaw = {
    id: number;
    teacher_id: number;
    teacher_name: string;
    class_id: number;
    class_name: string;
    teaching_date: string;
    start_time: string;
    end_time: string;
    room: string;
};

type ClassItem = { id: number; name: string };
type TeacherItem = { id: number; full_name: string };

const dayLabel = (date: string) => {
    const d = dayjs(date);
    const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    return `${d.format("DD/MM/YYYY")} (${days[d.day()]})`;
};

const SchedulePage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [raw, setRaw] = useState<ScheduleRaw[]>([]);
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [teachers, setTeachers] = useState<TeacherItem[]>([]);

    const [classFilter, setClassFilter] = useState("all");
    const [teacherFilter, setTeacherFilter] = useState("all");
    const [roomFilter, setRoomFilter] = useState("all");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    const fetchAll = async () => {
        setLoading(true);
        try {
            // Đảm bảo API khớp với cấu hình trong axios.ts và Backend
            const [schRes, clsRes, teaRes] = await Promise.all([
                http.get("/schedules"),
                http.get("/classes"),
                http.get("/teachers")
            ]);

            // Xử lý dữ liệu trả về linh hoạt từ Axios
            setRaw(Array.isArray(schRes.data) ? schRes.data : schRes.data?.data || []);
            setClasses(Array.isArray(clsRes.data) ? clsRes.data : clsRes.data?.data || []);
            setTeachers(Array.isArray(teaRes.data) ? teaRes.data : teaRes.data?.data || []);
        } catch (e: azny) {
            console.error("Lỗi tải dữ liệu:", e);
            alert("Không thể tải dữ liệu: " + (e.response?.data?.error || e.message));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    const roomOptions = useMemo(() => {
        const rooms = Array.from(new Set(raw.map((r) => r.room))).filter(Boolean);
        return rooms.sort();
    }, [raw]);

    const filtered = useMemo(() => {
        return raw.filter((r) => {
            const matchClass = classFilter === "all" ? true : String(r.class_id) === classFilter;
            const matchTeacher = teacherFilter === "all" ? true : String(r.teacher_id) === teacherFilter;
            const matchRoom = roomFilter === "all" ? true : r.room === roomFilter;

            const d = dayjs(r.teaching_date);
            const matchFrom = !fromDate || d.isSameOrAfter(dayjs(fromDate), "day");
            const matchTo = !toDate || d.isSameOrBefore(dayjs(toDate), "day");

            return matchClass && matchTeacher && matchRoom && matchFrom && matchTo;
        });
    }, [raw, classFilter, teacherFilter, roomFilter, fromDate, toDate]);

    const resetFilter = () => {
        setClassFilter("all");
        setTeacherFilter("all");
        setRoomFilter("all");
        setFromDate("");
        setToDate("");
    };

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <h1 className="page-title">Lịch học Tổng hợp</h1>
                    <p className="page-subtitle">Quản lý và xem lịch học của tất cả các lớp</p>
                </div>
                <button className="btn-outline" onClick={fetchAll} disabled={loading}>
                    <RefreshCcw size={16} className={loading ? "animate-spin" : ""} /> Làm mới
                </button>
            </div>

            <div className="card toolbar-card">
                <div className="toolbar">
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                        <Filter size={18} color="#64748b" />
                        <span className="td-strong">Bộ lọc tìm kiếm</span>
                        <button className="btn-outline" style={{ marginLeft: "auto", padding: "6px 12px" }} onClick={resetFilter}>
                            Đặt lại
                        </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
                        <div className="form-group">
                            <label className="label">Lớp học</label>
                            <select className="select" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                                <option value="all">Tất cả lớp</option>
                                {classes.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="label">Giáo viên</label>
                            <select className="select" value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
                                <option value="all">Tất cả giáo viên</option>
                                {teachers.map((t) => (
                                    <option key={t.id} value={t.id}>{t.full_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="label">Phòng học</label>
                            <select className="select" value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
                                <option value="all">Tất cả phòng</option>
                                {roomOptions.map((room) => (
                                    <option key={room} value={room}>{room}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="label">Từ ngày</label>
                            <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                        </div>

                        <div className="form-group">
                            <label className="label">Đến ngày</label>
                            <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="card table-card">
                <div className="table-wrap">
                    <table className="table">
                        <thead>
                            <tr>
                                <th style={{ width: 60 }} className="th-center">STT</th>
                                <th style={{ width: 180 }}>Ngày (Thứ)</th>
                                <th>Thông tin lớp</th>
                                <th style={{ width: 140 }} className="th-center">Giờ học</th>
                                <th style={{ width: 100 }}>Phòng</th>
                                <th style={{ width: 180 }}>Giáo viên</th>
                                <th style={{ width: 100 }} className="th-center">Trạng thái</th>
                                <th style={{ width: 80 }} className="th-right">Xem</th>
                            </tr>
                        </thead>

                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} className="td-center py-10">Đang tải lịch học...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={8} className="row-empty">Không tìm thấy lịch học phù hợp</td></tr>
                            ) : (
                                filtered.map((r, idx) => (
                                    <tr key={r.id}>
                                        <td className="td-center">{idx + 1}</td>
                                        <td className="td-strong">{dayLabel(r.teaching_date)}</td>
                                        <td>
                                            <div className="td-strong">{r.class_name}</div>
                                            <div className="td-mono" style={{ fontSize: '11px' }}>{`ID: LH${String(r.class_id).padStart(3, "0")}`}</div>
                                        </td>
                                        <td className="td-center">
                                            <div className="cell-flex-center">
                                                <Clock size={14} className="text-muted" />
                                                <span>{`${r.start_time.slice(0, 5)} - ${r.end_time.slice(0, 5)}`}</span>
                                            </div>
                                        </td>
                                        <td><span className="td-strong">{r.room}</span></td>
                                        <td>{r.teacher_name}</td>
                                        <td className="td-center">
                                            <span className="pill pill-success" style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                                        </td>
                                        <td className="td-right">
                                            <button className="icon-btn edit" title="Xem chi tiết"><Eye size={16} /></button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="table-footer">Tổng số: <b>{filtered.length}</b> buổi học</div>
            </div>
        </div>
    );
};

export default SchedulePage;