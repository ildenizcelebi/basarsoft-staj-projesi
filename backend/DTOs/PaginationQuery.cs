namespace BasarStajApp.DTOs;

/// <summary>
/// Query parameters for paginated listing with optional sorting and type filter.
/// </summary>
public sealed class PaginationQuery
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 10;

    /// <summary>
    /// Sort key: "name_asc", "name_desc", "id_asc", or "id_desc" (default "id_asc").
    /// </summary>
    public string? Sort { get; init; } = "id_asc";
    
    /// <summary>
    /// Optional type filter: "All" | "Point" | "LineString" | "Polygon".
    /// </summary>    
    public string? Type { get; init; } = "All";

}