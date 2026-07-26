using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using LanguageCenter.Api.Models;
using Microsoft.IdentityModel.Tokens;

namespace LanguageCenter.Api.Services;

public sealed class JwtTokenService
{
    private readonly IConfiguration _configuration;

    public JwtTokenService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string GenerateToken(Dictionary<string, object?> user)
    {
        var secret = _configuration["Jwt:Secret"] ?? throw new InvalidOperationException("Missing Jwt:Secret");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var userId = Convert.ToString(user.GetValueOrDefault("id")) ?? "0";
        var tenantId = Convert.ToString(user.GetValueOrDefault("tenant_id")) ?? "0";
        var roles = (user.GetValueOrDefault("roles") as IEnumerable<object?>)?.Select(x => Convert.ToString(x)).Where(x => !string.IsNullOrWhiteSpace(x)).Cast<string>().ToList() ?? [];

        var claims = new List<Claim>
        {
            new("userId", userId),
            new("tenantId", tenantId),
            new(JwtRegisteredClaimNames.Sub, userId),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N"))
        };
        claims.AddRange(roles.Select(role => new Claim("roles", role)));
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var days = int.TryParse(_configuration["Jwt:ExpiresInDays"], out var parsedDays) ? parsedDays : 7;
        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(days),
            signingCredentials: credentials
        );
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public ClaimsPrincipal? ValidateToken(string token)
    {
        var secret = _configuration["Jwt:Secret"] ?? throw new InvalidOperationException("Missing Jwt:Secret");
        var handler = new JwtSecurityTokenHandler();
        try
        {
            return handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
                ValidateIssuer = false,
                ValidateAudience = false,
                ClockSkew = TimeSpan.FromMinutes(2)
            }, out _);
        }
        catch
        {
            return null;
        }
    }
}
