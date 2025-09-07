namespace BasarStajApp.DTOs;

/// <summary>
/// Lightweight list item for UI grids/lists.
/// </summary>
public sealed class GeometryListItemDto
{
    public int Id { get; init; }
    public string Name { get; init; } = "";
    public string Type { get; init; } = ""; // "Point", "LineString", "Polygon", ...

}