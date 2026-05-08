import React, { useEffect, useState, useMemo } from "react";
import { Users, MapPin, RefreshCcw, GraduationCap, School, UserCheck } from "lucide-react";
import { Calendar, dayjsLocalizer, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import http from "../../api/axios";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import "../../styles/global.css";
import "../../styles/table.css";
import "../../styles/form.css";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
const localizer = dayjsLocalizer(dayjs);

interface ScheduleItem {
    id: number;
    class_id: number;
    teacher_id: number;
    teaching_date: string;
    start_time: string;
    end_time: string;
    room: string;
    class_name?: string;
    teacher_name?: string;
}

const HomeScreen = () => {
    const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
    const [counts, setCounts] = useState({ teachers: 0, students: 0, classes: 0 });
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [schRes, clsRes, teaRes, stuRes] = await Promise.all([
                http.get("/teaching-schedules"),
                http.get("/classes"),
                http.get("/teachers"),
                http.get("/students") 
            ]);

            const schData = schRes.data.schedules || schRes.data.data || [];
            const clsData = clsRes.data.classes || clsRes.data.data || [];
            const teaData = teaRes.data.teachers || teaRes.data.data || [];
            const stuData = stuRes.data.students || stuRes.data.data || [];

           
            setCounts({
                teachers: teaData.length,
                classes: clsData.length,
                students: stuData.length
            });

            const mapped = schData.map((s: any) => ({
                ...s,
                class_name: clsData.find((c: any) => c.id === s.class_id)?.name,
                teacher_name: teaData.find((t: any) => t.id === s.teacher_id)?.full_name,
            }));

            setSchedules(mapped);
        } catch (error) {
            console.error("Lỗi tải dữ liệu:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const calendarEvents = useMemo(() => {
        return schedules.map((item) => {
            const datePart = item.teaching_date.split('T')[0];
            return {
                id: item.id,
                title: item.class_name || "Lớp học",
                start: dayjs(datePart).hour(parseInt(item.start_time.split(':')[0])).minute(parseInt(item.start_time.split(':')[1])).toDate(),
                end: dayjs(datePart).hour(parseInt(item.end_time.split(':')[0])).minute(parseInt(item.end_time.split(':')[1])).toDate(),
                resource: { teacher: item.teacher_name, room: item.room }
            };
        });
    }, [schedules]);

    const EventComponent = ({ event }: any) => (
        <div className="calendar-event-box">
            <div className="event-title-main">{event.title}</div>
            <div className="event-info-row"><UserCheck size={10} /> {event.resource.teacher}</div>
            <div className="event-info-row"><MapPin size={10} /> {event.resource.room}</div>
        </div>
    );

    return (
        <div className="home-dashboard">
            <div className="dashboard-head">
                <div>
                    <h1 className="title-text">Bảng điều khiển hệ thống</h1>
                    <p className="subtitle-text">Chào mừng Tiên, đây là tổng quan trung tâm hôm nay</p>
                </div>
                <button className={`refresh-minimal ${loading ? 'spinning' : ''}`} onClick={fetchData}>
                    <RefreshCcw size={20} />
                </button>
            </div>

            {/* 3 Ô THỐNG KÊ (STAT CARDS) */}
            <div className="stats-grid">
                <div className="stat-card teacher-card">
                    <div className="stat-icon"><GraduationCap size={28} /></div>
                    <div className="stat-content">
                        <span className="stat-label">Giảng viên</span>
                        <span className="stat-value">{counts.teachers}</span>
                    </div>
                </div>
                <div className="stat-card student-card">
                    <div className="stat-icon"><Users size={28} /></div>
                    <div className="stat-content">
                        <span className="stat-label">Học viên</span>
                        <span className="stat-value">{counts.students}</span>
                    </div>
                </div>
                <div className="stat-card class-card">
                    <div className="stat-icon"><School size={28} /></div>
                    <div className="stat-content">
                        <span className="stat-label">Lớp học</span>
                        <span className="stat-value">{counts.classes}</span>
                    </div>
                </div>
            </div>

            <div className="calendar-main-container">
                <Calendar
                    localizer={localizer}
                    events={calendarEvents}
                    defaultView={Views.WEEK}
                    views={['month', 'week', 'day']}
                    components={{ event: EventComponent }}
                    eventPropGetter={() => ({ className: 'custom-event-style' })}
                    scrollToTime={new Date(1970, 1, 1, 7, 0, 0)}
                    messages={{ next: "Sau", previous: "Trước", today: "Hôm nay", month: "Tháng", week: "Tuần", day: "Ngày" }}
                />
            </div>

            <style>{`
                .home-dashboard { padding: 24px; background: #f8fafc; min-height: 100vh; }
                .dashboard-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
                .title-text { font-size: 24px; font-weight: 850; color: #0f172a; margin: 0; letter-spacing: -0.8px; }
                .subtitle-text { color: #64748b; margin: 4px 0 0 0; font-size: 14px; }

                /* CSS CHO 3 Ô THỐNG KÊ */
                .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 24px; }
                .stat-card { 
                    background: white; 
                    padding: 20px; 
                    border-radius: 16px; 
                    display: flex; 
                    align-items: center; 
                    gap: 16px; 
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                    transition: transform 0.2s;
                }
                .stat-card:hover { transform: translateY(-2px); }
                .stat-icon { padding: 12px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
                .teacher-card .stat-icon { background: #eef2ff; color: #4f46e5; }
                .student-card .stat-icon { background: #f0fdf4; color: #16a34a; }
                .class-card .stat-icon { background: #fff7ed; color: #ea580c; }
                .stat-label { display: block; color: #64748b; font-size: 14px; font-weight: 600; }
                .stat-value { display: block; color: #1e293b; font-size: 24px; font-weight: 800; }

                .calendar-main-container { 
                    background: white; 
                    border-radius: 20px; 
                    padding: 20px; 
                    border: 1px solid #e2e8f0; 
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.04);
                    height: calc(100vh - 280px);
                }
                .custom-event-style { 
                    background: #eef2ff !important; 
                    border-left: 4px solid #4f46e5 !important; 
                    border-radius: 8px !important;
                    color: #3730a3 !important;
                }
                .calendar-event-box { padding: 4px 6px; }
                .event-title-main { font-weight: 800; font-size: 12px; margin-bottom: 2px; }
                .event-info-row { display: flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 500; }
                .refresh-minimal { background: white; border: 1px solid #e2e8f0; padding: 10px; border-radius: 12px; cursor: pointer; }
                .spinning { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default HomeScreen;