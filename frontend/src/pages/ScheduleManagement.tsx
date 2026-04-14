import React, { useEffect, useMemo, useState } from "react";
import { Filter, Pencil, Trash2 } from "lucide-react";
import { Modal } from "../components/Modal";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { apiGetAllSchedules, apiCreateSchedule, apiUpdateSchedule, apiDeleteSchedule } from "../api/scheduleService";
import { apiGetAllClasses } from "../api/classService";
import { apiGetAllTeachers } from "../api/teacherService";

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
  room?: string | null;
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
};

const dayLabel = (date: string) => {
  const d = dayjs(date);
  const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  return `${d.format("DD/MM/YYYY")} (${days[d.day()]})`;
};

const emptyForm = {
  teacher_id: "",
  class_id: "",
  teaching_date: dayjs().format("YYYY-MM-DD"),
  start_time: "07:30",
  end_time: "09:30",
  room: "",
};

const SchedulePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [raw, setRaw] = useState<ScheduleRaw[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);

  const [classFilter, setClassFilter] = useState("all");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [current, setCurrent] = useState<ScheduleRaw | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [schRes, clsRes, teaRes] = await Promise.all([
        apiGetAllSchedules(),
        apiGetAllClasses(),
        apiGetAllTeachers(),
      ]);
      const schedulesData = Array.isArray(schRes.data)
        ? schRes.data
        : schRes.data?.schedules || schRes.data?.data || [];
      const classesData = Array.isArray(clsRes.data)
        ? clsRes.data
        : clsRes.data?.classes || clsRes.data?.data || [];
      const teachersData = Array.isArray(teaRes.data)
        ? teaRes.data
        : teaRes.data?.teachers || teaRes.data?.data || [];

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
      room: s.room || "—",
    }));
  }, [raw, classMap, teacherMap]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchClass = classFilter === "all" || String(r.class_id) === classFilter;
      const matchTeacher = teacherFilter === "all" || String(r.teacher_id) === teacherFilter;
      const d = dayjs(r.teaching_date);
      const matchFrom = !fromDate || d.isSameOrAfter(dayjs(fromDate), "day");
      const matchTo = !toDate || d.isSameOrBefore(dayjs(toDate), "day");
      return matchClass && matchTeacher && matchFrom && matchTo;
    });
  }, [rows, classFilter, teacherFilter, fromDate, toDate]);

  const resetFilter = () => {
    setClassFilter("all");
    setTeacherFilter("all");
    setFromDate("");
    setToDate("");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const toHMS = (hhmm: string) =>
    hhmm.length === 5 ? `${hhmm}:00` : hhmm;

  const buildPayload = () => ({
    teacher_id: Number(form.teacher_id),
    class_id: Number(form.class_id),
    teaching_date: form.teaching_date,
    start_time: toHMS(form.start_time),
    end_time: toHMS(form.end_time),
    room: form.room || null,
  });

  const validate = () => {
    if (!form.teacher_id) return "Vui lòng chọn giảng viên";
    if (!form.class_id) return "Vui lòng chọn lớp học";
    if (!form.teaching_date) return "Vui lòng chọn ngày dạy";
    if (!form.start_time) return "Vui lòng nhập giờ bắt đầu";
    if (!form.end_time) return "Vui lòng nhập giờ kết thúc";
    if (form.start_time >= form.end_time) return "Giờ kết thúc phải sau giờ bắt đầu";
    return "";
  };

  const openAdd = () => {
    setForm(emptyForm);
    setShowAdd(true);
  };

  const openEdit = (s: ScheduleRaw) => {
    setCurrent(s);
    setForm({
      teacher_id: String(s.teacher_id),
      class_id: String(s.class_id),
      teaching_date: dayjs(s.teaching_date).format("YYYY-MM-DD"),
      start_time: String(s.start_time).slice(0, 5),
      end_time: String(s.end_time).slice(0, 5),
      room: s.room || "",
    });
    setShowEdit(true);
  };

  const closeAll = () => {
    setShowAdd(false);
    setShowEdit(false);
    setCurrent(null);
  };

  const handleCreate = async () => {
    const err = validate();
    if (err) return alert(err);
    try {
      await apiCreateSchedule(buildPayload());
      closeAll();
      await fetchAll();
    } catch (e: any) {
      alert(e.response?.data?.message || e.response?.data?.error || "Lỗi tạo lịch dạy");
    }
  };

  const handleUpdate = async () => {
    if (!current) return;
    const err = validate();
    if (err) return alert(err);
    try {
      await apiUpdateSchedule(current.id, buildPayload());
      closeAll();
      await fetchAll();
    } catch (e: any) {
      alert(e.response?.data?.message || e.response?.data?.error || "Lỗi cập nhật lịch dạy");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Xóa lịch dạy này?")) return;
    try {
      await apiDeleteSchedule(id);
      await fetchAll();
    } catch (e: any) {
      alert("Lỗi xóa: " + (e.response?.data?.message || "Không xóa được"));
    }
  };

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1 className="page-title">Quản lý Lịch dạy</h1>
          <p className="page-subtitle">Quản lý lịch giảng dạy của tất cả các lớp</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Thêm lịch dạy</button>
      </div>

      <div className="card">
        <div className="toolbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Filter size={18} />
            <span className="td-strong">Bộ lọc</span>
            <div style={{ marginLeft: "auto" }}>
              <button className="btn-outline" type="button" onClick={resetFilter}>Đặt lại</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14 }}>
            <div className="field">
              <label className="label">Lớp học</label>
              <select className="input" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                <option value="all">Tất cả</option>
                {classes.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label">Giảng viên</label>
              <select className="input" value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
                <option value="all">Tất cả</option>
                {teachers.map((t) => (
                  <option key={t.id} value={String(t.id)}>{t.full_name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label">Từ ngày</label>
              <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="field">
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
                <th style={{ width: 180 }}>Ngày dạy</th>
                <th>Lớp học</th>
                <th>Giảng viên</th>
                <th style={{ width: 140 }} className="th-center">Giờ học</th>
                <th style={{ width: 120 }}>Phòng</th>
                <th style={{ width: 120, textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="row-empty">
                    {loading ? "Đang tải dữ liệu..." : "Chưa có lịch dạy"}
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => (
                  <tr key={r.id}>
                    <td className="td-center">{idx + 1}</td>
                    <td className="td-strong">{dayLabel(r.teaching_date)}</td>
                    <td>{r.class_name}</td>
                    <td>{r.teacher_name}</td>
                    <td className="td-center">{r.start_time} – {r.end_time}</td>
                    <td>{r.room}</td>
                    <td className="td-right">
                      <span className="actions">
                        <button className="icon-btn edit" title="Sửa" onClick={() => {
                          const s = raw.find(x => x.id === r.id);
                          if (s) openEdit(s);
                        }}>
                          <Pencil size={16} />
                        </button>
                        <button className="icon-btn delete" title="Xóa" onClick={() => handleDelete(r.id)}>
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
        <div className="table-footer">Hiển thị {filtered.length} / {rows.length} buổi dạy</div>
      </div>

      <Modal
        isOpen={showAdd || showEdit}
        onClose={closeAll}
        title={showAdd ? "Thêm lịch dạy mới" : "Cập nhật lịch dạy"}
        maxWidth={600}
      >
        <div className="form" style={{ gap: 14 }}>
          <div className="form-row-2">
            <div className="field">
              <label className="label">Giảng viên *</label>
              <select className="input" name="teacher_id" value={form.teacher_id} onChange={handleChange}>
                <option value="">-- Chọn giảng viên --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label">Lớp học *</label>
              <select className="input" name="class_id" value={form.class_id} onChange={handleChange}>
                <option value="">-- Chọn lớp --</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label className="label">Ngày dạy *</label>
            <input className="input" type="date" name="teaching_date" value={form.teaching_date} onChange={handleChange} />
          </div>
          <div className="form-row-2">
            <div className="field">
              <label className="label">Giờ bắt đầu *</label>
              <input className="input" type="time" name="start_time" value={form.start_time} onChange={handleChange} />
            </div>
            <div className="field">
              <label className="label">Giờ kết thúc *</label>
              <input className="input" type="time" name="end_time" value={form.end_time} onChange={handleChange} />
            </div>
          </div>
          <div className="field">
            <label className="label">Phòng học</label>
            <input className="input" name="room" value={form.room} onChange={handleChange} placeholder="VD: Phòng 101" />
          </div>
          <div className="form-actions" style={{ justifyContent: "flex-end" }}>
            <button className="btn-outline" type="button" onClick={closeAll}>Hủy</button>
            <button className="btn-save" type="button" onClick={showAdd ? handleCreate : handleUpdate}>Lưu</button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default SchedulePage;