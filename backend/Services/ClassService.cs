using System.Text.Json;
using Dapper;
using LanguageCenter.Api.Infrastructure;
using LanguageCenter.Api.Models;

namespace LanguageCenter.Api.Services;

public sealed class ClassService
{
    private readonly DbService _db;
    private readonly ActivityLogService _logs;
    public ClassService(DbService db, ActivityLogService logs) { _db = db; _logs = logs; }

    public async Task<object> GetNextCodeAsync(int tenantId)
    {
        var count = await _db.ScalarAsync<long>("SELECT COUNT(*) FROM classes WHERE tenant_id=@tenantId", new { tenantId });
        return new { code = $"LH{(count + 1).ToString().PadLeft(4, '0')}" };
    }

    public async Task<object> GetAllAsync(int tenantId, IQueryCollection query, CurrentUser user, PermissionService permissions)
    {
        var p = new DynamicParameters(); p.Add("tenantId", tenantId); p.Add("userId", user.Id);
        var conditions = new List<string> { "c.tenant_id=@tenantId" };
        if (!permissions.IsAdminOrStaff(user))
        {
            if (permissions.IsTeacher(user)) conditions.Add("EXISTS (SELECT 1 FROM class_teachers x WHERE x.tenant_id=c.tenant_id AND x.class_id=c.id AND x.teacher_id=@userId)");
            else if (permissions.IsStudent(user)) conditions.Add("EXISTS (SELECT 1 FROM class_students x WHERE x.tenant_id=c.tenant_id AND x.class_id=c.id AND x.student_id=@userId AND x.status='active')");
        }
        if (!string.IsNullOrWhiteSpace(query["search"])) { conditions.Add("(c.name ILIKE @search OR c.code ILIKE @search)"); p.Add("search", $"%{query["search"]}%"); }
        if (!string.IsNullOrWhiteSpace(query["status"])) { conditions.Add("c.status=@status"); p.Add("status", query["status"].ToString()); }
        if (!string.IsNullOrWhiteSpace(query["branchId"])) { conditions.Add("c.branch_id=@branchId"); p.Add("branchId", int.Parse(query["branchId"].ToString())); }
        var where = string.Join(" AND ", conditions);
        var rows = await _db.QueryAsync($"""
            SELECT c.*, b.name AS branch_name,
                   COUNT(DISTINCT cs.student_id) FILTER (WHERE cs.status='active') AS student_count,
                   COALESCE(array_agg(DISTINCT u.full_name) FILTER (WHERE u.id IS NOT NULL), ARRAY[]::varchar[]) AS teacher_names
            FROM classes c
            LEFT JOIN branches b ON b.id=c.branch_id
            LEFT JOIN class_students cs ON cs.class_id=c.id AND cs.tenant_id=c.tenant_id
            LEFT JOIN class_teachers ct ON ct.class_id=c.id AND ct.tenant_id=c.tenant_id
            LEFT JOIN users u ON u.id=ct.teacher_id
            WHERE {where}
            GROUP BY c.id, b.name
            ORDER BY c.created_at DESC
            """, p);
        return rows;
    }

    public async Task<Dictionary<string, object?>?> GetByIdAsync(int tenantId, int id)
    {
        var cls = await _db.QuerySingleAsync(
            """
            SELECT c.*, b.name AS branch_name
            FROM classes c
            LEFT JOIN branches b ON b.id=c.branch_id
            WHERE c.id=@id AND c.tenant_id=@tenantId
            """, new { tenantId, id });
        if (cls is null) return null;
        cls["teachers"] = await _db.QueryAsync("""SELECT u.id, u.full_name, u.email, u.phone, tp.teacher_code FROM class_teachers ct JOIN users u ON u.id=ct.teacher_id LEFT JOIN teacher_profiles tp ON tp.user_id=u.id AND tp.tenant_id=u.tenant_id WHERE ct.class_id=@id AND ct.tenant_id=@tenantId ORDER BY u.full_name""", new { tenantId, id });
        cls["students"] = await _db.QueryAsync("""SELECT u.id, u.full_name, u.email, u.phone, sp.student_code, cs.status, cs.joined_at FROM class_students cs JOIN users u ON u.id=cs.student_id LEFT JOIN student_profiles sp ON sp.user_id=u.id AND sp.tenant_id=u.tenant_id WHERE cs.class_id=@id AND cs.tenant_id=@tenantId ORDER BY u.full_name""", new { tenantId, id });
        cls["weeklySchedules"] = await _db.QueryAsync("SELECT * FROM class_weekly_schedules WHERE class_id=@id AND tenant_id=@tenantId ORDER BY weekday,start_time", new { tenantId, id });
        return cls;
    }

    public async Task<Dictionary<string, object?>?> CreateAsync(int tenantId, JsonElement body, CurrentUser actor)
    {
        await using var conn = await _db.OpenConnectionAsync(); await using var tx = await conn.BeginTransactionAsync();
        try
        {
            var row = await _db.QuerySingleAsync(
                """
                INSERT INTO classes (tenant_id, code, name, branch_id, max_students, expected_fee, class_type, start_date, end_date, expected_sessions, status, description)
                VALUES (@tenantId,@code,@name,@branchId,@maxStudents,@expectedFee,@classType,@startDate,@endDate,@expectedSessions,COALESCE(@status,'upcoming'),@description)
                RETURNING *
                """,
                new { tenantId, code = body.Str("code"), name = body.Str("name"), branchId = body.Int("branchId", "branch_id"), maxStudents = body.Int("maxStudents", "max_students") ?? 20, expectedFee = body.Dec("expectedFee", "expected_fee") ?? 0, classType = body.Str("classType", "class_type") ?? "fixed", startDate = body.Str("startDate", "start_date"), endDate = body.Str("endDate", "end_date"), expectedSessions = body.Int("expectedSessions", "expected_sessions"), status = body.Str("status"), description = body.Str("description", "note") }, tx);
            var id = Convert.ToInt32(row!["id"]);
            await ReplaceTeachers(tenantId, id, body, tx);
            await ReplaceWeeklySchedules(tenantId, id, body, tx);
            await tx.CommitAsync();
            await _logs.LogAsync(tenantId, actor, "create", "class", id, Convert.ToString(row["name"]), $"đã tạo lớp \"{row["name"]}\"");
            return await GetByIdAsync(tenantId, id);
        }
        catch { await tx.RollbackAsync(); throw; }
    }

    public async Task<Dictionary<string, object?>?> UpdateAsync(int tenantId, int id, JsonElement body, CurrentUser actor)
    {
        await using var conn = await _db.OpenConnectionAsync(); await using var tx = await conn.BeginTransactionAsync();
        try
        {
            var current = await _db.QuerySingleAsync("SELECT * FROM classes WHERE id=@id AND tenant_id=@tenantId", new { tenantId, id }, tx); if (current is null) { await tx.RollbackAsync(); return null; }
            await _db.ExecuteAsync(
                """
                UPDATE classes SET code=@code, name=@name, branch_id=@branchId, max_students=@maxStudents, expected_fee=@expectedFee,
                       class_type=@classType, start_date=@startDate, end_date=@endDate, expected_sessions=@expectedSessions, status=@status, description=@description, updated_at=NOW()
                WHERE id=@id AND tenant_id=@tenantId
                """,
                new { tenantId, id, code = body.Str("code") ?? current["code"], name = body.Str("name") ?? current["name"], branchId = body.Int("branchId", "branch_id") ?? (current["branch_id"] is null ? null : Convert.ToInt32(current["branch_id"])), maxStudents = body.Int("maxStudents", "max_students") ?? Convert.ToInt32(current["max_students"] ?? 20), expectedFee = body.Dec("expectedFee", "expected_fee") ?? Convert.ToDecimal(current["expected_fee"] ?? 0), classType = body.Str("classType", "class_type") ?? current["class_type"], startDate = body.Str("startDate", "start_date") ?? current["start_date"], endDate = body.Str("endDate", "end_date") ?? current["end_date"], expectedSessions = body.Int("expectedSessions", "expected_sessions") ?? (current["expected_sessions"] is null ? null : Convert.ToInt32(current["expected_sessions"])), status = body.Str("status") ?? current["status"], description = body.Str("description", "note") ?? current["note"] }, tx);
            if (body.TryGet(out _, "teacherIds", "teachers")) await ReplaceTeachers(tenantId, id, body, tx);
            if (body.TryGet(out _, "weeklySchedules", "weekly_schedules")) await ReplaceWeeklySchedules(tenantId, id, body, tx);
            await tx.CommitAsync();
            await _logs.LogAsync(tenantId, actor, "update", "class", id, body.Str("name") ?? Convert.ToString(current["name"]), "đã cập nhật lớp học");
            return await GetByIdAsync(tenantId, id);
        }
        catch { await tx.RollbackAsync(); throw; }
    }

    public async Task<bool> DeleteAsync(int tenantId, int id, CurrentUser actor)
    {
        var info = await _db.QuerySingleAsync("SELECT name FROM classes WHERE id=@id AND tenant_id=@tenantId", new { tenantId, id });
        var count = await _db.ExecuteAsync("DELETE FROM classes WHERE id=@id AND tenant_id=@tenantId", new { tenantId, id });
        if (count > 0) await _logs.LogAsync(tenantId, actor, "delete", "class", id, Convert.ToString(info?["name"]), $"đã xoá lớp \"{info?["name"]}\"");
        return count > 0;
    }

    public async Task AddStudentAsync(int tenantId, int id, int studentId)
    {
        await _db.ExecuteAsync("INSERT INTO class_students (tenant_id, class_id, student_id, status) VALUES (@tenantId,@id,@studentId,'active') ON CONFLICT (class_id, student_id) DO UPDATE SET status='active'", new { tenantId, id, studentId });
    }

    public async Task RemoveStudentAsync(int tenantId, int id, int studentId)
    {
        await _db.ExecuteAsync("UPDATE class_students SET status='inactive' WHERE tenant_id=@tenantId AND class_id=@id AND student_id=@studentId", new { tenantId, id, studentId });
    }

    public async Task<List<Dictionary<string, object?>>> GetByStudentAsync(int tenantId, int studentId)
    {
        return await _db.QueryAsync("""SELECT c.*, cs.status AS enrollment_status, cs.joined_at FROM class_students cs JOIN classes c ON c.id=cs.class_id WHERE cs.tenant_id=@tenantId AND cs.student_id=@studentId ORDER BY c.start_date DESC NULLS LAST""", new { tenantId, studentId });
    }

    private async Task ReplaceTeachers(int tenantId, int classId, JsonElement body, System.Data.IDbTransaction tx)
    {
        var ids = new List<int>();
        if (body.TryGet(out var arr, "teacherIds", "teacher_ids", "teachers") && arr.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in arr.EnumerateArray())
            {
                if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out var i)) ids.Add(i);
                else if (el.ValueKind == JsonValueKind.Object && el.TryGet(out var p, "id") && p.TryGetInt32(out var oi)) ids.Add(oi);
            }
        }
        await _db.ExecuteAsync("DELETE FROM class_teachers WHERE tenant_id=@tenantId AND class_id=@classId", new { tenantId, classId }, tx);
        foreach (var teacherId in ids.Distinct()) await _db.ExecuteAsync("INSERT INTO class_teachers (tenant_id, class_id, teacher_id) VALUES (@tenantId,@classId,@teacherId) ON CONFLICT DO NOTHING", new { tenantId, classId, teacherId }, tx);
    }

    private async Task ReplaceWeeklySchedules(int tenantId, int classId, JsonElement body, System.Data.IDbTransaction tx)
    {
        if (!body.TryGet(out var schedules, "weeklySchedules", "weekly_schedules") || schedules.ValueKind != JsonValueKind.Array) return;
        await _db.ExecuteAsync("DELETE FROM class_weekly_schedules WHERE tenant_id=@tenantId AND class_id=@classId", new { tenantId, classId }, tx);
        foreach (var s in schedules.EnumerateArray())
        {
            await _db.ExecuteAsync("""INSERT INTO class_weekly_schedules (tenant_id, class_id, weekday, start_time, end_time, room_id) VALUES (@tenantId,@classId,@weekday,@startTime,@endTime,@roomId)""", new { tenantId, classId, weekday = s.Int("weekday", "dayOfWeek", "day_of_week"), startTime = s.Str("startTime", "start_time"), endTime = s.Str("endTime", "end_time"), roomId = s.Int("roomId", "room_id") }, tx);
        }
    }
}
