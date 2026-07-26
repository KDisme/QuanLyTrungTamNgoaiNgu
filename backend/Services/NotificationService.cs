using Dapper;
using LanguageCenter.Api.Infrastructure;

namespace LanguageCenter.Api.Services;

public sealed class NotificationService
{
    private readonly DbService _db;
    public NotificationService(DbService db) => _db = db;

    public async Task<object> ListAsync(int tenantId, int userId, IQueryCollection query)
    {
        var page = int.TryParse(query["page"], out var pg) ? Math.Max(pg, 1) : 1;
        var limit = int.TryParse(query["limit"], out var lm) ? Math.Clamp(lm, 1, 100) : 20;
        var p = new DynamicParameters(); p.Add("tenantId", tenantId); p.Add("userId", userId); p.Add("limit", limit); p.Add("offset", (page - 1) * limit);
        var total = await _db.ScalarAsync<long>("SELECT COUNT(*) FROM notifications WHERE tenant_id=@tenantId AND user_id=@userId", p);
        var notifications = await _db.QueryAsync("SELECT * FROM notifications WHERE tenant_id=@tenantId AND user_id=@userId ORDER BY created_at DESC LIMIT @limit OFFSET @offset", p);
        return new { total, page, limit, notifications };
    }

    public Task<long> UnreadCountAsync(int tenantId, int userId) => _db.ScalarAsync<long>("SELECT COUNT(*) FROM notifications WHERE tenant_id=@tenantId AND user_id=@userId AND is_read=FALSE", new { tenantId, userId });
    public Task<int> MarkReadAsync(int tenantId, int userId, int id) => _db.ExecuteAsync("UPDATE notifications SET is_read=TRUE WHERE tenant_id=@tenantId AND user_id=@userId AND id=@id", new { tenantId, userId, id });
    public Task<int> MarkAllReadAsync(int tenantId, int userId) => _db.ExecuteAsync("UPDATE notifications SET is_read=TRUE WHERE tenant_id=@tenantId AND user_id=@userId", new { tenantId, userId });
}
