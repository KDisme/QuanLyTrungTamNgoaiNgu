using Npgsql;

namespace LanguageCenter.Api.Infrastructure;

public sealed class DbConnectionFactory
{
    private readonly string _connectionString;

    public DbConnectionFactory(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Missing ConnectionStrings:DefaultConnection");
    }

    public NpgsqlConnection Create() => new(_connectionString);
}
