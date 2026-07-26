namespace LanguageCenter.Api.Models;

public sealed record Tenant(int Id, string Name, string Slug, bool IsActive);

public sealed class CurrentUser
{
    public int Id { get; init; }
    public int TenantId { get; init; }
    public string? FullName { get; init; }
    public string? Email { get; init; }
    public bool IsActive { get; init; }
    public IReadOnlyList<string> Roles { get; init; } = [];
}
