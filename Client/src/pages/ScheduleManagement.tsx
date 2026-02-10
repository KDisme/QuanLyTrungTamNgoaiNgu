import React, { useEffect, useMemo, useState } from "react";
import { Eye, Filter } from "lucide-react";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import http from "../api/axios";

import "../styles/global.css";
import "../styles/table.css";
import "../styles/form.css";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

type ScheduleRaw = {
  id: number;
  teacher_id: number;
  class_id: number;
  teaching_date: string;
  start_time: string;
  end_time: string;
  created_at?: string;
};

type ClassItem = { id: number; name: string };
type TeacherItem = { id: number; full_name: string };

type Row = {
  id: number;
  teaching_date: string;
  start_time: string;
  end_time: string;
  class_id: number;
  class_name: string;
  teacher_id: number;
  teacher_name: string;
  room: string;
  status: string;
};

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
      const [schRes, clsRes, teaRes] = await Promise.all([
        http.get("/teaching-schedules"),
        http.get("/classes"),
        http.get("/teachers")
      ]);

      const schedulesData = Array.isArray(schRes.data) ? schRes.data : schRes.data?.data || [];
      const classesData = Array.isArray(clsRes.data) ? clsRes.data : clsRes.data?.data || [];
      const teachersData = Array.isArray(teaRes.data) ? teaRes.data : teaRes.data?.data || [];

      setRaw(schedulesData);
      setClasses(classesData.map((c: any) => ({ id: c.id, name: c.name })));
      setTeachers(teachersData.map((t: any) => ({ id: t.id, full_name: t.full_name })));
    } catch (e: any) {
      alert("Không thể tải dữ liệu: " + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const classMap = useMemo(() => {
    const m = new Map<number, string>();
    classes.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [classes]);

  const teacherMap = useMemo(() => {
    const m = new Map<number, string>();
    teachers.forEach((t) => m.set(t.id, t.full_name));
    return m;
  }, [teachers]);

  const rows: Row[] = useMemo(() => {
    return raw.map((s) => ({
      id: s.id,
      teaching_date: s.teaching_date,
      start_time: String(s.start_time).slice(0, 5),
      end_time: String(s.end_time).slice(0, 5),
      class_id: s.class_id,
      class_name: classMap.get(s.class_id) || `ID: ${s.class_id}`,
      teacher_id: s.teacher_id,
      teacher_name: teacherMap.get(s.teacher_id) || `ID: ${s.teacher_id}`,
      room: "N/A",
      status: "Hoàn thành"
    }));
  }, [raw, classMap, teacherMap]);

  const classOptions = useMemo(() => {
    return classes.map((c) => ({ id: String(c.id), name: c.name }));
  }, [classes]);

  const teacherOptions = useMemo(() => {
    return teachers.map((t) => ({ id: String(t.id), name: t.full_name }));
  }, [teachers]);

  const roomOptions = useMemo(() => [{ id: "N/A", name: "N/A" }], []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchClass = classFilter === "all" ? true : String(r.class_id) === classFilter;
      const matchTeacher = teacherFilter === "all" ? true : String(r.teacher_id) === teacherFilter;
      const matchRoom = roomFilter === "all" ? true : r.room === roomFilter;

      const d = dayjs(r.teaching_date);
      const matchFrom = !fromDate || d.isSameOrAfter(dayjs(fromDate), "day");
      const matchTo = !toDate || d.isSameOrBefore(dayjs(toDate), "day");

      return matchClass && matchTeacher && matchRoom && matchFrom && matchTo;
    });
  }, [rows, classFilter, teacherFilter, roomFilter, fromDate, toDate]);

  const resetFilter = () => {
    setClassFilter("all");
    setTeacherFilter("all");
    setRoomFilter("all");
    setFromDate("");
    setToDate("");
  };

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1 className="page-title">Lịch học Tổng hợp</h1>
          <p className="page-subtitle">Quản lý và xem lịch học của tất cả các lớp</p>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Filter size={18} />
            <div className="td-strong">Bộ lọc</div>
            <div style={{ marginLeft: "auto" }}>
              <button className="btn-outline" type="button" onClick={resetFilter}>
                Đặt lại
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 14 }}>
            <div className="field">
              <label className="field-label">Lớp học</label>
              <select className="select" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                <option value="all">Chọn...</option>
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field-label">Giáo viên</label>
              <select className="select" value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
                <option value="all">Chọn...</option>
                {teacherOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field-label">Phòng học</label>
              <select className="select" value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
                <option value="all">Chọn...</option>
                {roomOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field-label">Từ ngày</label>
              <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>

            <div className="field">
              <label className="field-label">Đến ngày</label>
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
                <th style={{ width: 70 }} className="th-center">STT</th>
                <th style={{ width: 180 }}>Ngày (Thứ)</th>
                <th>Lớp</th>
                <th style={{ width: 140 }} className="th-center">Giờ</th>
                <th style={{ width: 120 }}>Phòng</th>
                <th style={{ width: 180 }}>Giáo viên</th>
                <th style={{ width: 140 }} className="th-center">Trạng thái</th>
                <th style={{ width: 110 }} className="th-right">Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="row-empty">
                    {loading ? "Đang tải dữ liệu..." : "Chưa có lịch học"}
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => (
                  <tr key={String(r.id)}>
                    <td className="td-center">{idx + 1}</td>
                    <td className="td-strong">{dayLabel(r.teaching_date)}</td>
                    <td>
                      <div className="td-strong">{r.class_name}</div>
                      <div className="td-muted">{`LH${String(r.class_id).padStart(3, "0")}`}</div>
                    </td>
                    <td className="td-center">{`${r.start_time} - ${r.end_time}`}</td>
                    <td>{r.room}</td>
                    <td>{r.teacher_name}</td>
                    <td className="td-center">
                      <span className="pill pill-success">{r.status}</span>
                    </td>
                    <td className="td-right">
                      <span className="actions">
                        <button className="icon-btn edit" title="Xem">
                          <Eye size={16} />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">{filtered.length} buổi học</div>
      </div>
    </div>
  );
};

export default SchedulePage;
