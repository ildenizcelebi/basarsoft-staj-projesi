namespace BasarStajApp.Entity;

using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;
using NetTopologySuite;
using NetTopologySuite.IO;
using NtsGeometry = NetTopologySuite.Geometries.Geometry;


/// <summary>
/// Domain entity representing a named geometry stored as an NTS Geometry.
/// </summary>
public class Geometry
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public NtsGeometry WKT { get; set; } = default!;

}