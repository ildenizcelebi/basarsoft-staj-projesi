using BasarStajApp.DTOs;
using BasarStajApp.Entity;
using BasarStajApp.Resources;
using BasarStajApp.Services.Interfaces;
using NtsGeometry = NetTopologySuite.Geometries.Geometry;

namespace BasarStajApp.Services;

/// <summary>
/// In-memory geometry store for testing/demo scenarios (thread-safe with a simple lock).
/// </summary> 
public class StaticGeometryService : IGeometryService
{
    private readonly List<Geometry> _list = new();
    private int _nextId = 1;
    private readonly object _lock = new();

    // --- GET ALL ---
    public Task<IReadOnlyList<Geometry>> GetAll(CancellationToken ct = default)
    {
        lock (_lock)
        {
            return Task.FromResult((IReadOnlyList<Geometry>)_list
                .OrderBy(x => x.Id)
                .ToList()
                .AsReadOnly());
        }
    }

    // --- GET BY ID ---
    public Task<Geometry> GetById(int id, CancellationToken ct = default)
    {
        if (id <= 0) throw new ArgumentOutOfRangeException(nameof(id), "Id must be greater than zero.");
        lock (_lock)
        {
            var p = _list.FirstOrDefault(x => x.Id == id)
                    ?? throw new KeyNotFoundException(Messages.RecordNotFound);
            return Task.FromResult(p);
        }
    }

    // --- ADD ---
    public Task<Geometry> Add(GeometryCreateDto dto, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(dto);
        lock (_lock)
        {
            if (_list.Any(x => x.Name.Equals(dto.Name, StringComparison.OrdinalIgnoreCase)))
                throw new InvalidOperationException(Messages.DuplicateName);

            var geom = dto.WKT ?? throw new ArgumentNullException(nameof(dto.WKT));
            if (geom.SRID == 0) geom.SRID = 4326;

            var e = new Geometry
            {
                Id = _nextId++,
                Name = dto.Name,
                WKT = geom
            };

            _list.Add(e);
            return Task.FromResult(e);
        }
    }

    // --- ADD RANGE ---
    public Task<IReadOnlyList<Geometry>> AddRange(IEnumerable<GeometryCreateDto> items, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(items);
        var incoming = items.ToList();
        if (incoming.Count == 0) throw new ArgumentException("Items collection is empty.", nameof(items));

        lock (_lock)
        {
            if (incoming.GroupBy(x => x.Name, StringComparer.OrdinalIgnoreCase).Any(g => g.Count() > 1))
                throw new InvalidOperationException(Messages.DuplicateName);

            var names = incoming.Select(x => x.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
            if (_list.Any(x => names.Contains(x.Name)))
                throw new InvalidOperationException(Messages.DuplicateName);

            var added = new List<Geometry>(incoming.Count);
            foreach (var dto in incoming)
            {
                var g = dto.WKT ?? throw new ArgumentNullException(nameof(dto.WKT));
                if (g.SRID == 0) g.SRID = 4326;

                var e = new Geometry { Id = _nextId++, Name = dto.Name, WKT = g };
                _list.Add(e);
                added.Add(e);
            }
            return Task.FromResult((IReadOnlyList<Geometry>)added.AsReadOnly());
        }
    }

    // --- UPDATE ---
    public async Task<Geometry> Update(int id, GeometryUpdateDto dto, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(dto);
        var _ = await GetById(id, ct); // id kontrolü

        lock (_lock)
        {
            var e = _list.FirstOrDefault(x => x.Id == id)
                    ?? throw new KeyNotFoundException(Messages.RecordNotFound);

            if (_list.Any(x => x.Id != id && x.Name.Equals(dto.Name, StringComparison.OrdinalIgnoreCase)))
                throw new InvalidOperationException(Messages.DuplicateNameOnUpdate);

            var g = dto.WKT ?? throw new ArgumentNullException(nameof(dto.WKT));
            if (g.SRID == 0) g.SRID = 4326;

            e.Name = dto.Name;
            e.WKT = g;
            return e;
        }
    }

    // --- DELETE ---
    public Task Delete(int id, CancellationToken ct = default)
    {
        lock (_lock)
        {
            var e = _list.FirstOrDefault(x => x.Id == id)
                    ?? throw new KeyNotFoundException(Messages.RecordNotFound);
            _list.Remove(e);
            return Task.CompletedTask;
        }
    }
    
    // --- GET PAGED ---
    public Task<PaginatedResult<GeometryListItemDto>> GetPaged(PaginationQuery q, CancellationToken ct = default)
    {
        const int MAX_PAGE_SIZE = 100;
        var page = Math.Max(1, q.Page);
        var pageSize = Math.Clamp(q.PageSize, 1, MAX_PAGE_SIZE);

        IEnumerable<Geometry> src;
        lock (_lock)
        {
            src = _list.AsEnumerable();

            // TYPE filtresi
            if (!string.IsNullOrWhiteSpace(q.Type) && !q.Type.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                var t = q.Type.Trim();
                if (t == "Polygon")
                    src = src.Where(x => x.WKT?.GeometryType is "Polygon" or "MultiPolygon");
                else if (t == "LineString")
                    src = src.Where(x => x.WKT?.GeometryType is "LineString" or "MultiLineString");
                else if (t == "Point")
                    src = src.Where(x => x.WKT?.GeometryType is "Point" or "MultiPoint");
                else
                    src = src.Where(x => string.Equals(x.WKT?.GeometryType, t, StringComparison.OrdinalIgnoreCase));
            }

            // Sıralama
            src = q.Sort?.Trim().ToLowerInvariant() switch
            {
                "name_asc" => src.OrderBy(x => x.Name).ThenBy(x => x.Id),
                "name_desc" => src.OrderByDescending(x => x.Name).ThenBy(x => x.Id),
                "id_asc" => src.OrderBy(x => x.Id),
                _ => src.OrderByDescending(x => x.Id)
            };

            var total = src.Count();
            var items = src.Skip((page - 1) * pageSize).Take(pageSize)
                .Select(g => new GeometryListItemDto
                {
                    Id = g.Id,
                    Name = g.Name,
                    Type = g.WKT?.GeometryType ?? ""
                })
                .ToList();

            return Task.FromResult(new PaginatedResult<GeometryListItemDto>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalItems = total,
                TotalPages = (int)Math.Ceiling(total / (double)pageSize)
            });
        }
    }
    
}