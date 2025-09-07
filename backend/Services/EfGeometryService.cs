using BasarStajApp.DTOs;
using BasarStajApp.Entity;
using BasarStajApp.Services.Interfaces;
using BasarStajApp.Core.Repositories;
using BasarStajApp.Core.UnitOfWork;
using NtsGeometry = NetTopologySuite.Geometries.Geometry;
using System.Linq.Expressions;

namespace BasarStajApp.Services;

/// <summary>
/// EF Core–based geometry service using repository + unit-of-work patterns.
/// </summary>
public class EfGeometryService : IGeometryService
{
    private readonly IUnitOfWork _uow;
    private readonly IRepository<Geometry> _geometryRepo;

    public EfGeometryService(IUnitOfWork uow, IRepository<Geometry> geometryRepo)
    {
        _uow = uow;
        _geometryRepo = geometryRepo;
    }

    // --- GET ALL ---
    public async Task<IReadOnlyList<Geometry>> GetAll(CancellationToken ct = default)
    {
        var list = await _geometryRepo.GetAllAsync(ct);
        return list.OrderBy(x => x.Id).ToList().AsReadOnly();
    }

    // --- GET BY ID ---
    public async Task<Geometry> GetById(int id, CancellationToken ct = default)
    {
        if (id <= 0) throw new ArgumentOutOfRangeException(nameof(id), "Id must be positive.");
        var g = await _geometryRepo.GetByIdAsync(id, ct);
        return g ?? throw new KeyNotFoundException("Record not found");
    }

    // --- ADD ---
    public async Task<Geometry> Add(GeometryCreateDto dto, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(dto);

        if (await _geometryRepo.AnyAsync(x => x.Name == dto.Name, ct))
            throw new InvalidOperationException("Duplicate name");

        NtsGeometry geom = dto.WKT ?? throw new ArgumentNullException(nameof(dto.WKT));
        if (geom.SRID == 0) geom.SRID = 4326;

        var entity = new Geometry { Name = dto.Name, WKT = geom };

        await _geometryRepo.AddAsync(entity, ct);
        await _uow.SaveChangesAsync(ct);
        return entity;
    }

    // --- ADD RANGE ---
    public async Task<IReadOnlyList<Geometry>> AddRange(IEnumerable<GeometryCreateDto> items, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(items);
        var list = items.ToList();
        if (list.Count == 0) throw new ArgumentException("Items collection is empty.", nameof(items));

        if (list.GroupBy(x => x.Name).Any(g => g.Count() > 1))
            throw new InvalidOperationException("Duplicate names in request.");

        var names = list.Select(x => x.Name).ToList();
        var existing = await _geometryRepo.FindAsync(x => names.Contains(x.Name), ct);
        if (existing.Count > 0)
            throw new InvalidOperationException("Some names already exist.");

        var toAdd = new List<Geometry>(list.Count);
        foreach (var dto in list)
        {
            var g = dto.WKT ?? throw new ArgumentException("WKT cannot be null.", nameof(items));
            if (g.SRID == 0) g.SRID = 4326;
            toAdd.Add(new Geometry { Name = dto.Name, WKT = g });
        }

        await _uow.BeginTransactionAsync(ct);
        try
        {
            await _geometryRepo.AddRangeAsync(toAdd, ct);
            await _uow.SaveChangesAsync(ct);
            await _uow.CommitAsync(ct);
        }
        catch
        {
            await _uow.RollbackAsync(ct);
            throw;
        }

        return toAdd.AsReadOnly();
    }

    // --- UPDATE ---
    public async Task<Geometry> Update(int id, GeometryUpdateDto dto, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(dto);

        var entity = await _geometryRepo.GetByIdAsync(id, ct)
                     ?? throw new KeyNotFoundException("Record not found");

        if (!string.Equals(entity.Name, dto.Name, StringComparison.Ordinal) &&
            await _geometryRepo.AnyAsync(x => x.Name == dto.Name, ct))
            throw new InvalidOperationException("Duplicate name");

        NtsGeometry geom = dto.WKT ?? throw new ArgumentNullException(nameof(dto.WKT));
        if (geom.SRID == 0) geom.SRID = 4326;

        entity.Name = dto.Name;
        entity.WKT = geom;

        _geometryRepo.Update(entity);
        await _uow.SaveChangesAsync(ct);
        return entity;
    }

    // --- DELETE ---
    public async Task Delete(int id, CancellationToken ct = default)
    {
        var g = await _geometryRepo.GetByIdAsync(id, ct)
                ?? throw new KeyNotFoundException("Record not found");

        _geometryRepo.Remove(g);
        await _uow.SaveChangesAsync(ct);
    }

    // --- GET PAGED ---
    public async Task<PaginatedResult<GeometryListItemDto>> GetPaged(PaginationQuery q, CancellationToken ct = default)
    {
        const int MAX_PAGE_SIZE = 100;
        var page = Math.Max(1, q.Page);
        var pageSize = Math.Clamp(q.PageSize, 1, MAX_PAGE_SIZE);

        // TYPE filter
        Expression<Func<Geometry, bool>>? pred = null;
        if (!string.IsNullOrWhiteSpace(q.Type) && !q.Type.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            var t = q.Type.Trim().ToUpperInvariant();

            if (t == "POLYGON")
                pred = g => g.WKT.GeometryType == "POLYGON" || g.WKT.GeometryType == "MULTIPOLYGON";
            else if (t == "LINESTRING")
                pred = g => g.WKT.GeometryType == "LINESTRING" || g.WKT.GeometryType == "MULTILINESTRING";
            else if (t == "POINT")
                pred = g => g.WKT.GeometryType == "POINT" || g.WKT.GeometryType == "MULTIPOINT";
            else
                pred = g => g.WKT.GeometryType == t; // fallback
        }

        // --- ORDER ---
        IOrderedQueryable<Geometry> Order(IQueryable<Geometry> src) => q.Sort switch
        {
            "name_asc" => src.OrderBy(g => g.Name).ThenBy(g => g.Id),
            "name_desc" => src.OrderByDescending(g => g.Name).ThenBy(g => g.Id),
            "id_asc" => src.OrderBy(g => g.Id),
            "id_desc" => src.OrderByDescending(g => g.Id),
            _ => src.OrderByDescending(g => g.Id)
        };

        var totalItems = await _geometryRepo.CountAsync(pred, ct);

        var pageList = await _geometryRepo.GetPageAsync(
            skip: (page - 1) * pageSize,
            take: pageSize,
            predicate: pred,
            orderBy: Order,
            ct: ct
        );

        static string ToUiType(string? dbType) => dbType switch
        {
            "POINT" or "MULTIPOINT" => "Point",
            "LINESTRING" or "MULTILINESTRING" => "LineString",
            "POLYGON" or "MULTIPOLYGON" => "Polygon",
            null or "" => "",
            var x => x // başka bir tip varsa aynen gönder
        };

        var items = pageList.Select(g => new GeometryListItemDto
        {
            Id = g.Id,
            Name = g.Name,
            Type = ToUiType(g.WKT?.GeometryType)
        }).ToList();

        return new PaginatedResult<GeometryListItemDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalItems = totalItems,
            TotalPages = (int)Math.Ceiling(totalItems / (double)pageSize)
        };
    }
}