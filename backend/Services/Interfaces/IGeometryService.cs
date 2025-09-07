using BasarStajApp.DTOs;
using BasarStajApp.Entity;

namespace BasarStajApp.Services.Interfaces;

/// <summary>
/// Abstraction for geometry CRUD and listing operations across storage backends.
/// </summary>
public interface IGeometryService
{
    Task<IReadOnlyList<Geometry>> GetAll(CancellationToken ct = default);
    Task<Geometry> GetById(int id, CancellationToken ct = default);
    Task<Geometry> Add(GeometryCreateDto dto, CancellationToken ct = default);
    Task<IReadOnlyList<Geometry>> AddRange(IEnumerable<GeometryCreateDto> items, CancellationToken ct = default);
    Task<Geometry> Update(int id, GeometryUpdateDto dto, CancellationToken ct = default);
    Task Delete(int id, CancellationToken ct = default);
    Task<PaginatedResult<GeometryListItemDto>> GetPaged(PaginationQuery q, CancellationToken ctc = default);

}