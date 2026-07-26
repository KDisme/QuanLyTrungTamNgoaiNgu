using LanguageCenter.Api.Infrastructure;

namespace LanguageCenter.Api.Services;

public sealed class AuthService
{
    private readonly DbService _db;
    private readonly PasswordService _password;
    private readonly JwtTokenService _jwt;

    public AuthService(DbService db, PasswordService password, JwtTokenService jwt)
    {
        _db = db;
        _password = password;
        _jwt = jwt;
    }

    public async Task<List<Dictionary<string, object?>>> PortalFindTenantAsync(string email)
    {
        return await _db.QueryAsync(
            """
            SELECT t.id, t.name, t.slug
            FROM tenants t
            JOIN users u ON u.tenant_id = t.id
            JOIN roles r ON r.user_id = u.id AND r.tenant_id = t.id
            WHERE u.email = @email AND r.role_type = 'admin' AND t.is_active = TRUE
            """,
            new { email });
    }

    public async Task<object?> LoginAsync(int tenantId, string identifier, string password)
    {
        var user = await _db.QuerySingleAsync(
            """
            SELECT u.*, array_agg(r.role_type) FILTER (WHERE r.role_type IS NOT NULL) AS roles
            FROM users u
            LEFT JOIN roles r ON r.user_id = u.id AND r.tenant_id = u.tenant_id
            WHERE u.tenant_id = @tenantId AND (u.email = @identifier OR u.phone = @identifier) AND u.is_active = TRUE
            GROUP BY u.id
            """,
            new { tenantId, identifier });
        if (user is null) return null;
        var hash = Convert.ToString(user.GetValueOrDefault("password_hash"));
        if (string.IsNullOrWhiteSpace(hash) || !_password.Verify(password, hash)) return null;
        var token = _jwt.GenerateToken(user);
        await _db.ExecuteAsync("UPDATE users SET last_login_at=NOW() WHERE id=@id", new { id = Convert.ToInt32(user["id"]) });
        var roles = (user.GetValueOrDefault("roles") as IEnumerable<object?>)?.Select(x => Convert.ToString(x)).Where(x => !string.IsNullOrWhiteSpace(x)).Cast<string>().ToList() ?? [];
        return new
        {
            token,
            user = new
            {
                id = Convert.ToInt32(user["id"]),
                fullName = Convert.ToString(user["full_name"]),
                email = Convert.ToString(user["email"]),
                phone = Convert.ToString(user["phone"]),
                roles,
                tenantId = Convert.ToInt32(user["tenant_id"])
            }
        };
    }
}
