using System.Text.Json;
using Dapper;
using LanguageCenter.Api.Infrastructure;
using LanguageCenter.Api.Models;

namespace LanguageCenter.Api.Services;

public sealed class ScheduleService
{
    private readonly DbService _db;
    public ScheduleService(DbService db) => _db = db;

    public async Task<object> GetListAsync(int tenantId, IQueryCollection query, CurrentUser user, PermissionService permissions)
    {
        var p = new DynamicParameters(); p.Add("tenantId", tenantId); p.Add("userId", user.Id);
        var conditions = new List<string> { "s.tenant_id=@tenantId" };
        if (!permissions.IsAdminOrStaff(user))
        {
            if (permissions.IsTeacher(user)) conditions.Add("s.teacher_id=@userId");
            else if (permissions.IsStudent(user)) conditions.Add("EXISTS (SELECT 1 FROM class_students cs WHERE cs.tenant_id=s.tenant_id AND cs.class_id=s.class_id AND cs.student_id=@userId AND cs.status='active')");
        }
        if (!string.IsNullOrWhiteSpace(query["classId"])) { conditions.Add("s.class_id=@classId"); p.Add("classId", int.Parse(query["classId"].ToString())); }
        if (!string.IsNullOrWhiteSpace(query["teacherId"])) { conditions.Add("s.teacher_id=@teacherId"); p.Add("teacherId", int.Parse(query["teacherId"].ToString())); }
        if (!string.IsNullOrWhiteSpace(query["from"])) { conditions.Add("s.session_date>=@from"); p.Add("from", query["from"].ToString()); }
        if (!string.IsNullOrWhiteSpace(query["to"])) { conditions.Add("s.session_date<=@to"); p.Add("to", query["to"].ToString()); }
        if (!string.IsNullOrWhiteSpace(query["status"])) { conditions.Add("s.status=@status"); p.Add("status", query["status"].ToString()); }
        var rows = await _db.QueryAsync($"""
            SELECT s.*, c.name AS class_name, c.code AS class_code, b.name AS branch_name, r.name AS room_name, u.full_name AS teacher_name
            FROM schedules s
            JOIN classes c ON c.id=s.class_id
            LEFT JOIN branches b ON b.id=c.branch_id
            LEFT JOIN rooms r ON r.id=s.room_id
            LEFT JOIN users u ON u.id=s.teacher_id
            WHERE {string.Join(" AND ", conditions)}
            ORDER BY s.session_date, s.start_time
            """, p);
        return rows;
    }

    public async Task<object> GetUpcomingAsync(int tenantId, IQueryCollection query, CurrentUser user, PermissionService permissions)
    {
        var p = new DynamicParameters(); p.Add("tenantId", tenantId); p.Add("userId", user.Id); p.Add("limit", int.TryParse(query["limit"], out var lm) ? Math.Clamp(lm, 1, 100) : 10);
        var conditions = new List<string> { "s.tenant_id=@tenantId", "s.status='scheduled'", "s.session_date>=CURRENT_DATE" };
        if (!permissions.IsAdminOrStaff(user))
        {
            if (permissions.IsTeacher(user)) conditions.Add("s.teacher_id=@userId");
            else if (permissions.IsStudent(user)) conditions.Add("EXISTS (SELECT 1 FROM class_students cs WHERE cs.tenant_id=s.tenant_id AND cs.class_id=s.class_id AND cs.student_id=@userId AND cs.status='active')");
        }
        return await _db.QueryAsync($"""SELECT s.*, c.name AS class_name, c.code AS class_code, r.name AS room_name, u.full_name AS teacher_name FROM schedules s JOIN classes c ON c.id=s.class_id LEFT JOIN rooms r ON r.id=s.room_id LEFT JOIN users u ON u.id=s.teacher_id WHERE {string.Join(" AND ", conditions)} ORDER BY s.session_date, s.start_time LIMIT @limit""", p);
    }

    public Task<List<Dictionary<string, object?>>> GetByClassAsync(int tenantId, int classId) => _db.QueryAsync("""SELECT s.*, r.name AS room_name, u.full_name AS teacher_name FROM schedules s LEFT JOIN rooms r ON r.id=s.room_id LEFT JOIN users u ON u.id=s.teacher_id WHERE s.tenant_id=@tenantId AND s.class_id=@classId ORDER BY s.session_date, s.start_time""", new { tenantId, classId });

    public Task<Dictionary<string, object?>?> GetByIdAsync(int tenantId, int id) => _db.QuerySingleAsync("""SELECT s.*, c.name AS class_name, c.code AS class_code, b.name AS branch_name, r.name AS room_name, u.full_name AS teacher_name FROM schedules s JOIN classes c ON c.id=s.class_id LEFT JOIN branches b ON b.id=c.branch_id LEFT JOIN rooms r ON r.id=s.room_id LEFT JOIN users u ON u.id=s.teacher_id WHERE s.id=@id AND s.tenant_id=@tenantId""", new { tenantId, id });

    public async Task<List<Dictionary<string, object?>>> PreviewAsync(int tenantId, int classId, JsonElement body)
    {
        // Preview is generated in-memory from weeklySchedules/startDate/sessionCount; no DB writes.
        var sessions = BuildSessions(classId, body, limit: body.Int("sessionCount", "expectedSessions", "expected_sessions") ?? 10);
        return sessions.Select(s => new Dictionary<string, object?>
        {
            ["tenant_id"] = tenantId,
            ["class_id"] = classId,
            ["session_date"] = s.Date.ToString("yyyy-MM-dd"),
            ["start_time"] = s.StartTime,
            ["end_time"] = s.EndTime,
            ["room_id"] = s.RoomId,
            ["teacher_id"] = s.TeacherId,
            ["status"] = "scheduled"
        }).ToList();
    }

    public async Task<List<Dictionary<string, object?>>> GenerateAsync(int tenantId, int classId, JsonElement body)
    {
        var sessions = BuildSessions(classId, body, limit: body.Int("sessionCount", "expectedSessions", "expected_sessions") ?? 10);
        await using var conn = await _db.OpenConnectionAsync(); await using var tx = await conn.BeginTransactionAsync();
        var rows = new List<Dictionary<string, object?>>();
        try
        {
            foreach (var s in sessions)
            {
                var row = await _db.QuerySingleAsync("""INSERT INTO schedules (tenant_id, class_id, session_date, start_time, end_time, room_id, teacher_id, status) VALUES (@tenantId,@classId,@sessionDate,@startTime,@endTime,@roomId,@teacherId,'scheduled') RETURNING *""", new { tenantId, classId, sessionDate = s.Date.ToString("yyyy-MM-dd"), startTime = s.StartTime, endTime = s.EndTime, roomId = s.RoomId, teacherId = s.TeacherId }, tx);
                if (row is not null) rows.Add(row);
            }
            await tx.CommitAsync(); return rows;
        }
        catch { await tx.RollbackAsync(); throw; }
    }

    public async Task<Dictionary<string, object?>?> UpdateAsync(int tenantId, int id, JsonElement body)
    {
        var current = await GetByIdAsync(tenantId, id); if (current is null) return null;
        return await _db.QuerySingleAsync("""UPDATE schedules SET session_date=@sessionDate, start_time=@startTime, end_time=@endTime, room_id=@roomId, teacher_id=@teacherId, status=@status, note=@note, updated_at=NOW() WHERE id=@id AND tenant_id=@tenantId RETURNING *""", new { tenantId, id, sessionDate = body.Str("sessionDate", "session_date") ?? current["session_date"], startTime = body.Str("startTime", "start_time") ?? current["start_time"], endTime = body.Str("endTime", "end_time") ?? current["end_time"], roomId = body.Int("roomId", "room_id") ?? (current["room_id"] is null ? null : Convert.ToInt32(current["room_id"])), teacherId = body.Int("teacherId", "teacher_id") ?? (current["teacher_id"] is null ? null : Convert.ToInt32(current["teacher_id"])), status = body.Str("status") ?? current["status"], note = body.Str("note") ?? current["note"] });
    }

    public Task<Dictionary<string, object?>?> CancelAsync(int tenantId, int id, string? note) => _db.QuerySingleAsync("UPDATE schedules SET status='cancelled', note=COALESCE(@note,note), updated_at=NOW() WHERE id=@id AND tenant_id=@tenantId RETURNING *", new { tenantId, id, note });
    public Task<List<Dictionary<string, object?>>> GetHistoryAsync(int tenantId, int id) => _db.QueryAsync("SELECT * FROM schedule_changes WHERE tenant_id=@tenantId AND schedule_id=@id ORDER BY created_at DESC", new { tenantId, id });

    public Task<List<Dictionary<string, object?>>> GetAttendanceByScheduleAsync(int tenantId, int scheduleId) => _db.QueryAsync("""SELECT a.status, a.note, a.recorded_at, u.id AS student_id, u.full_name, u.phone, u.date_of_birth, sp.student_code FROM class_students cs JOIN users u ON u.id=cs.student_id LEFT JOIN student_profiles sp ON sp.user_id=u.id AND sp.tenant_id=u.tenant_id LEFT JOIN attendance a ON a.student_id=cs.student_id AND a.schedule_id=@scheduleId WHERE cs.class_id=(SELECT class_id FROM schedules WHERE id=@scheduleId AND tenant_id=@tenantId) AND cs.tenant_id=@tenantId AND cs.status='active' ORDER BY u.full_name""", new { tenantId, scheduleId });

    public async Task SaveAttendanceAsync(int tenantId, int scheduleId, JsonElement body, int recordedBy)
    {
        var records = body.Array("records");
        await using var conn = await _db.OpenConnectionAsync(); await using var tx = await conn.BeginTransactionAsync();
        try
        {
            foreach (var rec in records)
            {
                await _db.ExecuteAsync("""INSERT INTO attendance (tenant_id, schedule_id, student_id, status, note, recorded_by) VALUES (@tenantId,@scheduleId,@studentId,@status,@note,@recordedBy) ON CONFLICT (schedule_id, student_id) DO UPDATE SET status=@status, note=@note, recorded_by=@recordedBy, recorded_at=NOW()""", new { tenantId, scheduleId, studentId = rec.Int("studentId", "student_id"), status = rec.Str("status"), note = rec.Str("note"), recordedBy }, tx);
            }
            await _db.ExecuteAsync("UPDATE schedules SET status='completed', updated_at=NOW() WHERE id=@scheduleId AND tenant_id=@tenantId", new { tenantId, scheduleId }, tx);
            await tx.CommitAsync();
        }
        catch { await tx.RollbackAsync(); throw; }
    }

    public Task<List<Dictionary<string, object?>>> GetStudentAttendanceAsync(int tenantId, int studentId) => _db.QueryAsync("""SELECT a.*, s.session_date, s.start_time, c.name AS class_name FROM attendance a JOIN schedules s ON s.id=a.schedule_id JOIN classes c ON c.id=s.class_id WHERE a.student_id=@studentId AND a.tenant_id=@tenantId ORDER BY s.session_date DESC""", new { tenantId, studentId });

    private static List<(DateOnly Date, string? StartTime, string? EndTime, int? RoomId, int? TeacherId)> BuildSessions(int classId, JsonElement body, int limit)
    {
        var startText = body.Str("startDate", "start_date") ?? DateOnly.FromDateTime(DateTime.Today).ToString("yyyy-MM-dd");
        var start = DateOnly.TryParse(startText, out var d) ? d : DateOnly.FromDateTime(DateTime.Today);
        var weekly = body.Array("weeklySchedules", "weekly_schedules");
        if (weekly.Count == 0)
        {
            weekly = [JsonDocument.Parse("{\"dayOfWeek\":1,\"startTime\":\"18:00\",\"endTime\":\"20:00\"}").RootElement.Clone()];
        }
        var rows = new List<(DateOnly, string?, string?, int?, int?)>();
        var cursor = start;
        while (rows.Count < limit && cursor < start.AddYears(1))
        {
            var dow = ((int)cursor.DayOfWeek + 6) % 7 + 1; // Monday=1
            foreach (var s in weekly)
            {
                if ((s.Int("dayOfWeek", "day_of_week") ?? 0) == dow)
                {
                    rows.Add((cursor, s.Str("startTime", "start_time"), s.Str("endTime", "end_time"), s.Int("roomId", "room_id"), s.Int("teacherId", "teacher_id")));
                    if (rows.Count >= limit) break;
                }
            }
            cursor = cursor.AddDays(1);
        }
        return rows;
    }
}
