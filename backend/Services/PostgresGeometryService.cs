using Npgsql;
using BasarStajApp.DTOs;
using BasarStajApp.Entity;
using BasarStajApp.Resources;
using BasarStajApp.Services.Interfaces;
using NtsGeometry = NetTopologySuite.Geometries.Geometry;

namespace BasarStajApp.Services;

/// <summary>
/// Npgsql/NTS-based geometry service working directly with PostgreSQL.
/// Expects NpgsqlDataSource configured with NetTopologySuite type mapping.
/// </summary>
public class PostgresGeometryService : IGeometryService
{
    private readonly NpgsqlDataSource _ds;

    public PostgresGeometryService(NpgsqlDataSource ds) => _ds = ds;

    // --- GET ALL ---
    public async Task<IReadOnlyList<Geometry>> GetAll(CancellationToken ct = default)
    {
        await using var conn = await _ds.OpenConnectionAsync(ct);
        const string sql = @"SELECT id, name, wkt FROM geometry_data ORDER BY id;";
        await using var cmd = new NpgsqlCommand(sql, conn);
        await using var rd = await cmd.ExecuteReaderAsync(ct);

        var list = new List<Geometry>();
        while (await rd.ReadAsync(ct))
        {
            var geom = rd.GetFieldValue<NtsGeometry>(2);
            list.Add(new Geometry { Id = rd.GetInt32(0), Name = rd.GetString(1), WKT = geom });
        }
        return list.AsReadOnly();
    }

    // --- GET BY ID ---
    public async Task<Geometry> GetById(int id, CancellationToken ct = default)
    {
        if (id <= 0) throw new ArgumentOutOfRangeException(nameof(id), "Id must be positive.");

        await using var conn = await _ds.OpenConnectionAsync(ct);
        const string sql = @"SELECT id, name, wkt FROM geometry_data WHERE id=@id;";
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@id", id);

        await using var rd = await cmd.ExecuteReaderAsync(ct);
        if (!await rd.ReadAsync(ct)) throw new KeyNotFoundException(Messages.RecordNotFound);

        var geom = rd.GetFieldValue<NtsGeometry>(2);
        return new Geometry { Id = rd.GetInt32(0), Name = rd.GetString(1), WKT = geom };
    }

    // --- ADD ---
    public async Task<Geometry> Add(GeometryCreateDto dto, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(dto);

        await using var conn = await _ds.OpenConnectionAsync(ct);

        await using (var check = new NpgsqlCommand("SELECT 1 FROM geometry_data WHERE name=@name LIMIT 1;", conn))
        {
            check.Parameters.AddWithValue("@name", dto.Name);
            if (await check.ExecuteScalarAsync(ct) is not null)
                throw new InvalidOperationException(Messages.DuplicateName);
        }

        var g = dto.WKT ?? throw new ArgumentNullException(nameof(dto.WKT));
        if (g.SRID == 0) g.SRID = 4326;

        const string insert = @"INSERT INTO geometry_data(name, wkt)
                                VALUES (@name, @geom)
                                RETURNING id;";
        await using var cmd = new NpgsqlCommand(insert, conn);
        cmd.Parameters.AddWithValue("@name", dto.Name);
        cmd.Parameters.AddWithValue("@geom", g);

        var newId = Convert.ToInt32(await cmd.ExecuteScalarAsync(ct));
        return new Geometry { Id = newId, Name = dto.Name, WKT = g };
    }

    // --- ADD RANGE ---
    public async Task<IReadOnlyList<Geometry>> AddRange(IEnumerable<GeometryCreateDto> items, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(items);
        var incoming = items.ToList();
        if (incoming.Count == 0) throw new ArgumentException("Items collection is empty.", nameof(items));

        await using var conn = await _ds.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        try
        {
            var added = new List<Geometry>(incoming.Count);
            foreach (var dto in incoming)
            {
                if (dto is null) throw new ArgumentException("One of the items is null.", nameof(items));

                await using (var check = new NpgsqlCommand("SELECT 1 FROM geometry_data WHERE name=@name LIMIT 1;", conn, tx))
                {
                    check.Parameters.AddWithValue("@name", dto.Name);
                    if (await check.ExecuteScalarAsync(ct) is not null)
                        throw new InvalidOperationException(Messages.DuplicateName);
                }

                var g = dto.WKT ?? throw new ArgumentNullException(nameof(dto.WKT));
                if (g.SRID == 0) g.SRID = 4326;

                const string insert = @"INSERT INTO geometry_data(name, wkt)
                                        VALUES (@name, @geom)
                                        RETURNING id;";
                await using var cmd = new NpgsqlCommand(insert, conn, tx);
                cmd.Parameters.AddWithValue("@name", dto.Name);
                cmd.Parameters.AddWithValue("@geom", g);

                var id = Convert.ToInt32(await cmd.ExecuteScalarAsync(ct));
                added.Add(new Geometry { Id = id, Name = dto.Name, WKT = g });
            }

            await tx.CommitAsync(ct);
            return added.AsReadOnly();
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    // --- UPDATE ---
    public async Task<Geometry> Update(int id, GeometryUpdateDto dto, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(dto);
        if (id <= 0) throw new ArgumentOutOfRangeException(nameof(id));

        await using var conn = await _ds.OpenConnectionAsync(ct);

        await using (var check = new NpgsqlCommand("SELECT 1 FROM geometry_data WHERE name=@name AND id<>@id LIMIT 1;", conn))
        {
            check.Parameters.AddWithValue("@name", dto.Name);
            check.Parameters.AddWithValue("@id", id);
            if (await check.ExecuteScalarAsync(ct) is not null)
                throw new InvalidOperationException(Messages.DuplicateNameOnUpdate);
        }

        var g = dto.WKT ?? throw new ArgumentNullException(nameof(dto.WKT));
        if (g.SRID == 0) g.SRID = 4326;

        const string update = @"UPDATE geometry_data
                                SET name=@name, wkt=@geom
                                WHERE id=@id;";
        await using var cmd = new NpgsqlCommand(update, conn);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@name", dto.Name);
        cmd.Parameters.AddWithValue("@geom", g);

        var affected = await cmd.ExecuteNonQueryAsync(ct);
        if (affected == 0) throw new KeyNotFoundException(Messages.RecordNotFound);

        return new Geometry { Id = id, Name = dto.Name, WKT = g };
    }

    // --- DELETE ---
    public async Task Delete(int id, CancellationToken ct = default)
    {
        if (id <= 0) throw new ArgumentOutOfRangeException(nameof(id));

        await using var conn = await _ds.OpenConnectionAsync(ct);
        await using var cmd = new NpgsqlCommand("DELETE FROM geometry_data WHERE id=@id;", conn);
        cmd.Parameters.AddWithValue("@id", id);

        var affected = await cmd.ExecuteNonQueryAsync(ct);
        if (affected == 0) throw new KeyNotFoundException(Messages.RecordNotFound);
    }

    private static string BuildOrderBy(string? sort) => sort?.Trim().ToLowerInvariant() switch
    {
        "name_asc" => "ORDER BY name ASC, id ASC",
        "name_desc" => "ORDER BY name DESC, id ASC",
        "id_asc" => "ORDER BY id ASC",
        _ => "ORDER BY id DESC"
    };

    // --- GET PAGED ---
    public async Task<PaginatedResult<GeometryListItemDto>> GetPaged(PaginationQuery q, CancellationToken ct = default)
    {
        const int MAX_PAGE_SIZE = 100;
        var page = Math.Max(1, q.Page);
        var pageSize = Math.Clamp(q.PageSize, 1, MAX_PAGE_SIZE);
        var skip = (page - 1) * pageSize;

        await using var conn = await _ds.OpenConnectionAsync(ct);

        var hasType = !string.IsNullOrWhiteSpace(q.Type) && !q.Type.Equals("All", StringComparison.OrdinalIgnoreCase);

        // WHERE
        var where = new List<string>();
        if (hasType)
        {
            where.Add(@"(
                ( UPPER(@type) = 'POLYGON'    AND GeometryType(wkt) IN ('POLYGON','MULTIPOLYGON') ) OR
                ( UPPER(@type) = 'LINESTRING' AND GeometryType(wkt) IN ('LINESTRING','MULTILINESTRING') ) OR
                ( UPPER(@type) = 'POINT'      AND GeometryType(wkt) IN ('POINT','MULTIPOINT') ) OR
                ( UPPER(@type) NOT IN ('POLYGON','LINESTRING','POINT') AND GeometryType(wkt) = UPPER(@type) )
            )");
        }
        var whereSql = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";

        // COUNT
        var countSql = $"SELECT COUNT(*) FROM geometry_data {whereSql};";
        await using var countCmd = new NpgsqlCommand(countSql, conn);
        if (hasType) countCmd.Parameters.AddWithValue("@type", q.Type!.Trim());
        var total = Convert.ToInt32(await countCmd.ExecuteScalarAsync(ct));

        if (total == 0)
        {
            return new PaginatedResult<GeometryListItemDto>
            {
                Items = Array.Empty<GeometryListItemDto>(),
                Page = page,
                PageSize = pageSize,
                TotalItems = 0,
                TotalPages = 0
            };
        }

        // ORDER BY
        static string BuildOrderBy(string? sort) => sort?.Trim().ToLowerInvariant() switch
        {
            "name_asc" => "ORDER BY name ASC, id ASC",
            "name_desc" => "ORDER BY name DESC, id ASC",
            "id_asc" => "ORDER BY id ASC",
            _ => "ORDER BY id DESC"
        };
        var orderBy = BuildOrderBy(q.Sort);

        // DATA
        var dataSql = $@"
            SELECT id, name,
                INITCAP(LOWER(GeometryType(wkt))) AS type  -- 'POINT' -> 'Point'
            FROM geometry_data
            {whereSql}
            {orderBy}
            LIMIT @take OFFSET @skip;";

        await using var dataCmd = new NpgsqlCommand(dataSql, conn);
        if (hasType) dataCmd.Parameters.AddWithValue("@type", q.Type!.Trim());
        dataCmd.Parameters.AddWithValue("@take", pageSize);
        dataCmd.Parameters.AddWithValue("@skip", skip);

        var items = new List<GeometryListItemDto>(pageSize);
        await using var rd = await dataCmd.ExecuteReaderAsync(ct);
        while (await rd.ReadAsync(ct))
        {
            items.Add(new GeometryListItemDto
            {
                Id = rd.GetInt32(0),
                Name = rd.GetString(1),
                Type = rd.GetString(2)
            });
        }

        return new PaginatedResult<GeometryListItemDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalItems = total,
            TotalPages = (int)Math.Ceiling(total / (double)pageSize)
        };
    }

}