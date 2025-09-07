using System.ComponentModel.DataAnnotations;
using BasarStajApp.Entity;
using NetTopologySuite.Geometries;
using NtsGeometry = NetTopologySuite.Geometries.Geometry;



namespace BasarStajApp.DTOs;

public class GeometryCreateDto
{
    /// <summary>Display name (1–200 chars; letters, spaces, apostrophes, hyphens).</summary>
    [Required(ErrorMessage = "Name is required.")]
    [StringLength(200, MinimumLength = 1, ErrorMessage = "Name must be between 1 and 200 characters.")]
    [RegularExpression(
        @"^[\p{L}\p{M}\s'’–-]{1,200}$",
        ErrorMessage = "Name may contain only letters, spaces, apostrophes (’ ') and hyphens (– -); length must be 1–200 characters."
    )]
    public string Name { get; set; } = string.Empty;

    /// <summary>Geometry payload (SRID must be 4326; only Point/LineString/Polygon allowed).</summary>
    [Required]
    public NtsGeometry WKT { get; set; } = default!;

    public IEnumerable<ValidationResult> Validate(ValidationContext _)
    {
        if (WKT == null)
            yield return new ValidationResult("Geometry is required.", new[] { nameof(WKT) });

        if (WKT != null)
        {
            if (WKT.IsEmpty)
                yield return new ValidationResult("Geometry cannot be empty.", new[] { nameof(WKT) });

            if (WKT.SRID != 0 && WKT.SRID != 4326)
                yield return new ValidationResult("Geometry SRID must be 4326.", new[] { nameof(WKT) });

            if (WKT is not Point && WKT is not LineString && WKT is not Polygon)
                yield return new ValidationResult("Only Point, LineString, or Polygon are allowed.", new[] { nameof(WKT) });
        }
    }

}

/// <summary>
/// Payload for updating a geometry (same rules as create).
/// </summary>
public class GeometryUpdateDto : GeometryCreateDto { }
