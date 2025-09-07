using Npgsql;
using Microsoft.Extensions.Configuration;

namespace BasarStajApp.Data;

/// <summary>
/// One-time database bootstrapper for Postgres/PostGIS schema creation and simple migrations.
/// </summary>
public class PostgresDbInitializer
{
    private readonly string _cs;

    /// <summary>Reads connection string "Default".</summary>
    public PostgresDbInitializer(IConfiguration cfg) => _cs = cfg.GetConnectionString("Default")!;

    /// <summary>
    /// Ensures PostGIS extension, creates the table if missing, and migrates legacy text column to geometry(4326).
    /// </summary>
    public void EnsureCreated()
    {
        using var conn = new NpgsqlConnection(_cs);
        conn.Open();

        using (var cmd = new NpgsqlCommand("CREATE EXTENSION IF NOT EXISTS postgis;", conn))
            cmd.ExecuteNonQuery();

        const string createSql = """
        CREATE TABLE IF NOT EXISTS public.geometry_data (
            id   SERIAL PRIMARY KEY,
            name VARCHAR(200) NOT NULL UNIQUE,
            wkt  geometry(Geometry, 4326) NOT NULL
        );
        """;
        using (var cmd = new NpgsqlCommand(createSql, conn))
            cmd.ExecuteNonQuery();

        const string migrateSql = """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema='public'
                  AND table_name='geometry_data'
                  AND column_name='wkt'
                  AND data_type='text'
            ) THEN
                ALTER TABLE public.geometry_data
                    ALTER COLUMN wkt TYPE geometry(Geometry, 4326)
                    USING ST_SetSRID(ST_GeomFromText(wkt), 4326);
            END IF;
        END$$;
        """;
        using (var cmd = new NpgsqlCommand(migrateSql, conn))
            cmd.ExecuteNonQuery();
    }
}