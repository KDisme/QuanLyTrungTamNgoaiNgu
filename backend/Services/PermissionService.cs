using System.Security.Claims;
using LanguageCenter.Api.Infrastructure;
using LanguageCenter.Api.Models;

namespace LanguageCenter.Api.Services;

public sealed class PermissionService
{
    private readonly DbService _db;
    private readonly JwtTokenService _jwt;

    public PermissionService(DbService db, JwtTokenService jwt)
    {
        _db = db;
        _jwt = jwt;
    }

    public async Task<Tenant?> ResolveTenantAsync(string tenantSlug)
    {
        var row = await _db.QuerySingleAsync(
            "SELECT id, name, slug, is_active FROM tenants WHERE slug=@slug",
            new { slug = tenantSlug });
        if (row is null) return null;
        return new Tenant(Convert.ToInt32(row["id"]), Convert.ToString(row["name"]) ?? tenantSlug, Convert.ToString(row["slug"]) ?? tenantSlug, Convert.ToBoolean(row["is_active"]));
    }

    public async Task<CurrentUser?> GetCurrentUserAsync(HttpContext context, int tenantId)
    {
        var auth = context.Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(auth) || !auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return null;
        var principal = _jwt.ValidateToken(auth["Bearer ".Length..].Trim());
        if (principal is null) return null;

        var userIdText = principal.FindFirstValue("userId") ?? principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal.FindFirstValue("sub");
        var tenantIdText = principal.FindFirstValue("tenantId");
        if (!int.TryParse(userIdText, out var userId)) return null;
        if (int.TryParse(tenantIdText, out var tokenTenantId) && tokenTenantId != tenantId) return null;

        var row = await _db.QuerySingleAsync(
            "SELECT id, tenant_id, full_name, email, is_active FROM users WHERE id=@userId AND tenant_id=@tenantId",
            new { userId, tenantId });
        if (row is null || !Convert.ToBoolean(row["is_active"])) return null;

        var roles = principal.Claims
            .Where(c => c.Type == "roles" || c.Type == ClaimTypes.Role)
            .Select(c => c.Value)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct()
            .ToList();

        if (roles.Count == 0)
        {
            var rows = await _db.QueryAsync("SELECT role_type FROM roles WHERE user_id=@userId AND tenant_id=@tenantId", new { userId, tenantId });
            roles = rows.Select(r => Convert.ToString(r["role_type"])!).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList();
        }

        return new CurrentUser
        {
            Id = userId,
            TenantId = tenantId,
            FullName = Convert.ToString(row["full_name"]),
            Email = Convert.ToString(row["email"]),
            IsActive = true,
            Roles = roles
        };
    }

    public bool HasAnyRole(CurrentUser? user, params string[] roles)
    {
        if (user is null) return false;
        return roles.Any(r => user.Roles.Contains(r, StringComparer.OrdinalIgnoreCase));
    }

    public bool IsAdminOrStaff(CurrentUser? user) => HasAnyRole(user, "admin", "staff");
    public bool IsTeacher(CurrentUser? user) => HasAnyRole(user, "teacher");
    public bool IsStudent(CurrentUser? user) => HasAnyRole(user, "student");

    public async Task<bool> CanAccessStudentAsync(int tenantId, CurrentUser user, int studentId)
    {
        if (IsAdminOrStaff(user)) return true;
        if (IsStudent(user) && user.Id == studentId) return true;
        if (IsTeacher(user))
        {
            var exists = await _db.ScalarAsync<int>(
                """
                SELECT 1
                FROM class_teachers ct
                JOIN class_students cs ON cs.class_id=ct.class_id AND cs.tenant_id=ct.tenant_id
                WHERE ct.tenant_id=@tenantId AND ct.teacher_id=@teacherId AND cs.student_id=@studentId AND cs.status='active'
                LIMIT 1
                """,
                new { tenantId, teacherId = user.Id, studentId });
            return exists == 1;
        }
        return false;
    }

    public async Task<bool> CanAccessClassAsync(int tenantId, CurrentUser user, int classId)
    {
        if (IsAdminOrStaff(user)) return true;
        var rows = await _db.QueryAsync(
            """
            SELECT 1 WHERE
            EXISTS (SELECT 1 FROM class_teachers ct WHERE ct.tenant_id=@tenantId AND ct.class_id=@classId AND ct.teacher_id=@userId)
            OR EXISTS (SELECT 1 FROM class_students cs WHERE cs.tenant_id=@tenantId AND cs.class_id=@classId AND cs.student_id=@userId AND cs.status='active')
            LIMIT 1
            """,
            new { tenantId, classId, userId = user.Id });
        return rows.Count > 0;
    }

    public async Task<bool> CanAccessScheduleAsync(int tenantId, CurrentUser user, int scheduleId, bool write = false)
    {
        if (IsAdminOrStaff(user)) return true;
        var row = await _db.QuerySingleAsync(
            """
            SELECT s.id, s.teacher_id, s.class_id,
                   EXISTS (SELECT 1 FROM class_students cs WHERE cs.tenant_id=s.tenant_id AND cs.class_id=s.class_id AND cs.student_id=@userId AND cs.status='active') AS is_student_in_class
            FROM schedules s
            WHERE s.id=@scheduleId AND s.tenant_id=@tenantId
            """,
            new { tenantId, scheduleId, userId = user.Id });
        if (row is null) return false;
        if (IsTeacher(user) && Convert.ToInt32(row["teacher_id"] ?? 0) == user.Id) return true;
        if (!write && IsStudent(user) && Convert.ToBoolean(row["is_student_in_class"] ?? false)) return true;
        return false;
    }

    public async Task<bool> CanAccessFeeItemAsync(int tenantId, CurrentUser user, int itemId)
    {
        if (IsAdminOrStaff(user)) return true;
        if (!IsStudent(user)) return false;
        var exists = await _db.ScalarAsync<int>(
            "SELECT 1 FROM fee_collection_items WHERE id=@itemId AND tenant_id=@tenantId AND student_id=@studentId LIMIT 1",
            new { itemId, tenantId, studentId = user.Id });
        return exists == 1;
    }
}
