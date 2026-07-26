using System.Text.Json;
using Dapper;
using LanguageCenter.Api.Infrastructure;
using LanguageCenter.Api.Models;

namespace LanguageCenter.Api.Services;

public sealed class UserService
{
    private readonly DbService _db;
    private readonly PasswordService _password;
    private readonly ActivityLogService _logs;

    public UserService(DbService db, PasswordService password, ActivityLogService logs)
    {
        _db = db;
        _password = password;
        _logs = logs;
    }

    public async Task<object> GetAllAsync(int tenantId, IQueryCollection query)
    {
        var page = int.TryParse(query["page"], out var pg) ? Math.Max(pg, 1) : 1;
        var limit = int.TryParse(query["limit"], out var lm) ? Math.Clamp(lm, 1, 200) : 20;
        var offset = (page - 1) * limit;
        var role = query["role"].ToString();
        var status = query["status"].ToString();
        var search = query["search"].ToString();
        var branchId = query["branchId"].ToString();

        var conditions = new List<string> { "u.tenant_id=@tenantId" };
        var p = new DynamicParameters();
        p.Add("tenantId", tenantId);
        string roleJoin = string.Empty;
        string branchJoin = string.Empty;

        if (!string.IsNullOrWhiteSpace(search)) { conditions.Add("(u.full_name ILIKE @search OR u.email ILIKE @search OR u.phone ILIKE @search)"); p.Add("search", $"%{search}%"); }
        if (!string.IsNullOrWhiteSpace(status)) { conditions.Add("u.is_active=@isActive"); p.Add("isActive", status == "active"); }
        if (!string.IsNullOrWhiteSpace(role)) { roleJoin = "JOIN roles r2 ON r2.user_id=u.id AND r2.tenant_id=u.tenant_id AND r2.role_type=@role"; p.Add("role", role); }
        if (!string.IsNullOrWhiteSpace(branchId) && role == "staff") { branchJoin = "LEFT JOIN staff_profiles stf2 ON stf2.user_id=u.id AND stf2.tenant_id=u.tenant_id"; conditions.Add("stf2.branch_id=@branchId"); p.Add("branchId", int.Parse(branchId)); }
        if (!string.IsNullOrWhiteSpace(branchId) && role == "teacher") { branchJoin = "LEFT JOIN class_teachers ct2 ON ct2.teacher_id=u.id AND ct2.tenant_id=u.tenant_id LEFT JOIN classes c2 ON c2.id=ct2.class_id"; conditions.Add("c2.branch_id=@branchId"); p.Add("branchId", int.Parse(branchId)); }
        if (!string.IsNullOrWhiteSpace(branchId) && role == "student") { branchJoin = "LEFT JOIN class_students cs2 ON cs2.student_id=u.id AND cs2.tenant_id=u.tenant_id LEFT JOIN classes c2 ON c2.id=cs2.class_id"; conditions.Add("c2.branch_id=@branchId"); p.Add("branchId", int.Parse(branchId)); }

        var where = string.Join(" AND ", conditions);
        var total = await _db.ScalarAsync<long>($"SELECT COUNT(DISTINCT u.id) FROM users u {roleJoin} {branchJoin} WHERE {where}", p);
        p.Add("limit", limit); p.Add("offset", offset);
        var users = await _db.QueryAsync(
            $"""
            SELECT u.id, u.full_name, u.email, u.phone, u.gender, u.is_active, u.created_at,
                   (u.password_hash IS NOT NULL) AS has_password,
                   array_agg(DISTINCT r.role_type) FILTER (WHERE r.role_type IS NOT NULL) AS roles,
                   sp.student_code, sp.enrollment_date, sp.study_status,
                   tp.teacher_code, tp.specialization, tp.start_date AS teacher_start_date,
                   stf.staff_code, stf.position, stf.start_date AS staff_start_date
            FROM users u
            {roleJoin}
            {branchJoin}
            LEFT JOIN roles r ON r.user_id=u.id AND r.tenant_id=u.tenant_id
            LEFT JOIN student_profiles sp ON sp.user_id=u.id AND sp.tenant_id=u.tenant_id
            LEFT JOIN teacher_profiles tp ON tp.user_id=u.id AND tp.tenant_id=u.tenant_id
            LEFT JOIN staff_profiles stf ON stf.user_id=u.id AND stf.tenant_id=u.tenant_id
            WHERE {where}
            GROUP BY u.id, sp.student_code, sp.enrollment_date, sp.study_status,
                     tp.teacher_code, tp.specialization, tp.start_date,
                     stf.staff_code, stf.position, stf.start_date
            ORDER BY u.full_name
            LIMIT @limit OFFSET @offset
            """, p);
        return new { total, page, limit, users };
    }

    public async Task<Dictionary<string, object?>?> GetByIdAsync(int tenantId, int userId)
    {
        var user = await _db.QuerySingleAsync(
            """
            SELECT u.*, array_agg(DISTINCT r.role_type) FILTER (WHERE r.role_type IS NOT NULL) AS roles
            FROM users u
            LEFT JOIN roles r ON r.user_id=u.id AND r.tenant_id=u.tenant_id
            WHERE u.id=@userId AND u.tenant_id=@tenantId
            GROUP BY u.id
            """, new { tenantId, userId });
        if (user is null) return null;
        user.Remove("password_hash");
        user["has_password"] = true;
        user["teacherProfile"] = await _db.QuerySingleAsync("SELECT * FROM teacher_profiles WHERE user_id=@userId AND tenant_id=@tenantId", new { tenantId, userId });
        user["studentProfile"] = await _db.QuerySingleAsync("SELECT * FROM student_profiles WHERE user_id=@userId AND tenant_id=@tenantId", new { tenantId, userId });
        user["staffProfile"] = await _db.QuerySingleAsync("SELECT sp.*, b.name AS branch_name FROM staff_profiles sp LEFT JOIN branches b ON b.id=sp.branch_id WHERE sp.user_id=@userId AND sp.tenant_id=@tenantId", new { tenantId, userId });
        user["stats"] = await GetStatsAsync(tenantId, userId, user.GetValueOrDefault("roles") as IEnumerable<object?> ?? []);
        return user;
    }

    public async Task<Dictionary<string, object?>?> CreateAsync(int tenantId, JsonElement body, CurrentUser actor)
    {
        await using var conn = await _db.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();
        try
        {
            var password = body.Str("password")?.Trim();
            if (string.IsNullOrWhiteSpace(password)) password = "Default@123";
            var user = await _db.QuerySingleAsync(
                """
                INSERT INTO users (tenant_id, full_name, email, phone, gender, date_of_birth, address, password_hash)
                VALUES (@tenantId, @fullName, @email, @phone, @gender, @dateOfBirth, @address, @passwordHash)
                RETURNING *
                """,
                new
                {
                    tenantId,
                    fullName = body.Str("fullName", "full_name"),
                    email = body.Str("email"),
                    phone = body.Str("phone"),
                    gender = body.Str("gender"),
                    dateOfBirth = body.Str("dateOfBirth", "date_of_birth"),
                    address = body.Str("address"),
                    passwordHash = _password.Hash(password)
                }, tx);
            var userId = Convert.ToInt32(user!["id"]);
            var roles = body.StringArray("roles").Where(r => new[] { "admin", "teacher", "student", "staff" }.Contains(r)).Distinct().ToList();
            foreach (var role in roles)
            {
                await _db.ExecuteAsync("INSERT INTO roles (tenant_id, user_id, role_type) VALUES (@tenantId,@userId,@role) ON CONFLICT DO NOTHING", new { tenantId, userId, role }, tx);
                if (role == "teacher") await UpsertTeacherProfile(tenantId, userId, body, tx, true);
                if (role == "student") await UpsertStudentProfile(tenantId, userId, body, tx, true);
                if (role == "staff") await UpsertStaffProfile(tenantId, userId, body, tx, true);
            }
            await tx.CommitAsync();
            await _logs.LogAsync(tenantId, actor, "create", "user", userId, Convert.ToString(user["full_name"]), $"đã tạo tài khoản \"{user["full_name"]}\" ({string.Join(", ", roles)})");
            return await GetByIdAsync(tenantId, userId);
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    public async Task<Dictionary<string, object?>?> UpdateAsync(int tenantId, int userId, JsonElement body, CurrentUser actor)
    {
        await using var conn = await _db.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();
        try
        {
            var current = await _db.QuerySingleAsync("SELECT * FROM users WHERE id=@userId AND tenant_id=@tenantId", new { tenantId, userId }, tx);
            if (current is null) { await tx.RollbackAsync(); return null; }
            await _db.ExecuteAsync(
                """
                UPDATE users SET full_name=@fullName, email=@email, phone=@phone, gender=@gender, date_of_birth=@dateOfBirth,
                       address=@address, is_active=@isActive, updated_at=NOW()
                WHERE id=@userId AND tenant_id=@tenantId
                """,
                new
                {
                    tenantId, userId,
                    fullName = body.Str("fullName", "full_name") ?? Convert.ToString(current["full_name"]),
                    email = body.TryGet(out _, "email") ? body.Str("email") : Convert.ToString(current["email"]),
                    phone = body.TryGet(out _, "phone") ? body.Str("phone") : Convert.ToString(current["phone"]),
                    gender = body.TryGet(out _, "gender") ? body.Str("gender") : Convert.ToString(current["gender"]),
                    dateOfBirth = body.Str("dateOfBirth", "date_of_birth") ?? Convert.ToString(current["date_of_birth"]),
                    address = body.TryGet(out _, "address") ? body.Str("address") : Convert.ToString(current["address"]),
                    isActive = body.Bool("isActive", "is_active") ?? Convert.ToBoolean(current["is_active"])
                }, tx);
            if (body.TryGet(out _, "roles"))
            {
                var roles = body.StringArray("roles").Where(r => new[] { "admin", "teacher", "student", "staff" }.Contains(r)).Distinct().ToList();
                await _db.ExecuteAsync("DELETE FROM roles WHERE tenant_id=@tenantId AND user_id=@userId", new { tenantId, userId }, tx);
                foreach (var role in roles) await _db.ExecuteAsync("INSERT INTO roles (tenant_id, user_id, role_type) VALUES (@tenantId,@userId,@role) ON CONFLICT DO NOTHING", new { tenantId, userId, role }, tx);
                if (roles.Contains("teacher")) await UpsertTeacherProfile(tenantId, userId, body, tx, false); else await _db.ExecuteAsync("DELETE FROM teacher_profiles WHERE tenant_id=@tenantId AND user_id=@userId", new { tenantId, userId }, tx);
                if (roles.Contains("student")) await UpsertStudentProfile(tenantId, userId, body, tx, false); else await _db.ExecuteAsync("DELETE FROM student_profiles WHERE tenant_id=@tenantId AND user_id=@userId", new { tenantId, userId }, tx);
                if (roles.Contains("staff")) await UpsertStaffProfile(tenantId, userId, body, tx, false); else await _db.ExecuteAsync("DELETE FROM staff_profiles WHERE tenant_id=@tenantId AND user_id=@userId", new { tenantId, userId }, tx);
            }
            await tx.CommitAsync();
            await _logs.LogAsync(tenantId, actor, "update", "user", userId, body.Str("fullName", "full_name") ?? Convert.ToString(current["full_name"]), "đã cập nhật hồ sơ tài khoản");
            return await GetByIdAsync(tenantId, userId);
        }
        catch { await tx.RollbackAsync(); throw; }
    }

    public async Task<bool> DeleteAsync(int tenantId, int userId, CurrentUser actor)
    {
        var info = await _db.QuerySingleAsync("SELECT full_name FROM users WHERE id=@userId AND tenant_id=@tenantId", new { tenantId, userId });
        var count = await _db.ExecuteAsync("DELETE FROM users WHERE id=@userId AND tenant_id=@tenantId", new { tenantId, userId });
        if (count > 0) await _logs.LogAsync(tenantId, actor, "delete", "user", userId, Convert.ToString(info?["full_name"]), $"đã xoá tài khoản \"{info?["full_name"]}\"");
        return count > 0;
    }

    public async Task<object?> ResetPasswordAsync(int tenantId, int userId, string? newPassword, CurrentUser actor)
    {
        var password = string.IsNullOrWhiteSpace(newPassword) ? "Default@123" : newPassword.Trim();
        var row = await _db.QuerySingleAsync("UPDATE users SET password_hash=@hash, updated_at=NOW() WHERE id=@userId AND tenant_id=@tenantId RETURNING id, full_name", new { tenantId, userId, hash = _password.Hash(password) });
        if (row is null) return null;
        await _logs.LogAsync(tenantId, actor, "update", "user", userId, Convert.ToString(row["full_name"]), $"đã đặt lại mật khẩu cho tài khoản \"{row["full_name"]}\"");
        return new { id = userId, temporaryPassword = password };
    }

    private async Task<object> GetStatsAsync(int tenantId, int userId, IEnumerable<object?> rolesObj)
    {
        var roles = rolesObj.Select(Convert.ToString).Where(x => !string.IsNullOrWhiteSpace(x)).Cast<string>().ToList();
        var stats = new Dictionary<string, object?>();
        if (roles.Contains("teacher"))
        {
            var c = await _db.QuerySingleAsync("""SELECT COUNT(DISTINCT ct.class_id) AS class_count, COUNT(DISTINCT CASE WHEN c.status='active' THEN c.id END) AS active_class_count, COUNT(DISTINCT cs.student_id) AS student_count FROM class_teachers ct JOIN classes c ON c.id=ct.class_id LEFT JOIN class_students cs ON cs.class_id=ct.class_id AND cs.status='active' WHERE ct.teacher_id=@userId AND ct.tenant_id=@tenantId""", new { tenantId, userId });
            var s = await _db.QuerySingleAsync("""SELECT COUNT(*) FILTER (WHERE status='completed') AS completed_sessions, COUNT(*) FILTER (WHERE status='scheduled') AS upcoming_sessions FROM schedules WHERE teacher_id=@userId AND tenant_id=@tenantId""", new { tenantId, userId });
            stats["teacher"] = new { classCount = c?["class_count"], activeClassCount = c?["active_class_count"], studentCount = c?["student_count"], completedSessions = s?["completed_sessions"], upcomingSessions = s?["upcoming_sessions"] };
        }
        if (roles.Contains("student"))
        {
            var c = await _db.QuerySingleAsync("SELECT COUNT(DISTINCT cs.class_id) FILTER (WHERE cs.status='active') AS class_count FROM class_students cs WHERE cs.student_id=@userId AND cs.tenant_id=@tenantId", new { tenantId, userId });
            var a = await _db.QuerySingleAsync("""SELECT COUNT(*) FILTER (WHERE status='present') AS present_count, COUNT(*) FILTER (WHERE status='absent') AS absent_count, COUNT(*) FILTER (WHERE status='late') AS late_count, COUNT(*) AS total_count FROM attendance WHERE student_id=@userId AND tenant_id=@tenantId""", new { tenantId, userId });
            stats["student"] = new { classCount = c?["class_count"], presentCount = a?["present_count"], absentCount = a?["absent_count"], lateCount = a?["late_count"], totalSessions = a?["total_count"] };
        }
        return stats;
    }

    private async Task<string> GenCode(int tenantId, string prefix, string table, string column, System.Data.IDbTransaction tx)
    {
        var count = await _db.ScalarAsync<long>($"SELECT COUNT(*) FROM {table} WHERE tenant_id=@tenantId", new { tenantId }, tx);
        return $"{prefix}{(count + 1).ToString().PadLeft(4, '0')}";
    }

    private async Task UpsertTeacherProfile(int tenantId, int userId, JsonElement body, System.Data.IDbTransaction tx, bool insertPreferred)
    {
        var info = body.TryGet(out var x, "teacherInfo", "teacherProfile") ? x : default;
        var existed = await _db.QuerySingleAsync("SELECT * FROM teacher_profiles WHERE tenant_id=@tenantId AND user_id=@userId", new { tenantId, userId }, tx);
        if (existed is null)
        {
            await _db.ExecuteAsync("INSERT INTO teacher_profiles (tenant_id,user_id,teacher_code,specialization,qualifications,start_date,bank_account,notes) VALUES (@tenantId,@userId,@code,@specialization,@qualifications,@startDate,@bankAccount,@notes)", new { tenantId, userId, code = info.Str("teacherCode", "teacher_code") ?? await GenCode(tenantId, "GV", "teacher_profiles", "teacher_code", tx), specialization = info.Str("specialization"), qualifications = info.Str("qualifications"), startDate = info.Str("startDate", "start_date"), bankAccount = info.Str("bankAccount", "bank_account"), notes = info.Str("notes") }, tx);
        }
        else
        {
            await _db.ExecuteAsync("UPDATE teacher_profiles SET specialization=@specialization, qualifications=@qualifications, start_date=@startDate, bank_account=@bankAccount, notes=@notes, updated_at=NOW() WHERE tenant_id=@tenantId AND user_id=@userId", new { tenantId, userId, specialization = info.Str("specialization") ?? Convert.ToString(existed["specialization"]), qualifications = info.Str("qualifications") ?? Convert.ToString(existed["qualifications"]), startDate = info.Str("startDate", "start_date") ?? Convert.ToString(existed["start_date"]), bankAccount = info.Str("bankAccount", "bank_account") ?? Convert.ToString(existed["bank_account"]), notes = info.Str("notes") ?? Convert.ToString(existed["notes"]) }, tx);
        }
    }

    private async Task UpsertStudentProfile(int tenantId, int userId, JsonElement body, System.Data.IDbTransaction tx, bool insertPreferred)
    {
        var info = body.TryGet(out var x, "studentInfo", "studentProfile") ? x : default;
        var existed = await _db.QuerySingleAsync("SELECT * FROM student_profiles WHERE tenant_id=@tenantId AND user_id=@userId", new { tenantId, userId }, tx);
        if (existed is null)
            await _db.ExecuteAsync("INSERT INTO student_profiles (tenant_id,user_id,student_code,enrollment_date,study_status,notes) VALUES (@tenantId,@userId,@code,@enrollmentDate,@studyStatus,@notes)", new { tenantId, userId, code = info.Str("studentCode", "student_code") ?? await GenCode(tenantId, "HV", "student_profiles", "student_code", tx), enrollmentDate = info.Str("enrollmentDate", "enrollment_date"), studyStatus = info.Str("studyStatus", "study_status") ?? "active", notes = info.Str("notes") }, tx);
        else
            await _db.ExecuteAsync("UPDATE student_profiles SET enrollment_date=@enrollmentDate, study_status=@studyStatus, notes=@notes, updated_at=NOW() WHERE tenant_id=@tenantId AND user_id=@userId", new { tenantId, userId, enrollmentDate = info.Str("enrollmentDate", "enrollment_date") ?? Convert.ToString(existed["enrollment_date"]), studyStatus = info.Str("studyStatus", "study_status") ?? Convert.ToString(existed["study_status"]), notes = info.Str("notes") ?? Convert.ToString(existed["notes"]) }, tx);
    }

    private async Task UpsertStaffProfile(int tenantId, int userId, JsonElement body, System.Data.IDbTransaction tx, bool insertPreferred)
    {
        var info = body.TryGet(out var x, "staffInfo", "staffProfile") ? x : default;
        var existed = await _db.QuerySingleAsync("SELECT * FROM staff_profiles WHERE tenant_id=@tenantId AND user_id=@userId", new { tenantId, userId }, tx);
        if (existed is null)
            await _db.ExecuteAsync("INSERT INTO staff_profiles (tenant_id,user_id,staff_code,branch_id,start_date,bank_account,notes) VALUES (@tenantId,@userId,@code,@branchId,@startDate,@bankAccount,@notes)", new { tenantId, userId, code = info.Str("staffCode", "staff_code") ?? await GenCode(tenantId, "NV", "staff_profiles", "staff_code", tx), branchId = info.Int("branchId", "branch_id"), startDate = info.Str("startDate", "start_date"), bankAccount = info.Str("bankAccount", "bank_account"), notes = info.Str("notes") }, tx);
        else
            await _db.ExecuteAsync("UPDATE staff_profiles SET branch_id=@branchId, start_date=@startDate, bank_account=@bankAccount, notes=@notes, updated_at=NOW() WHERE tenant_id=@tenantId AND user_id=@userId", new { tenantId, userId, branchId = info.Int("branchId", "branch_id") ?? (existed["branch_id"] is null ? null : Convert.ToInt32(existed["branch_id"])), startDate = info.Str("startDate", "start_date") ?? Convert.ToString(existed["start_date"]), bankAccount = info.Str("bankAccount", "bank_account") ?? Convert.ToString(existed["bank_account"]), notes = info.Str("notes") ?? Convert.ToString(existed["notes"]) }, tx);
    }
}
