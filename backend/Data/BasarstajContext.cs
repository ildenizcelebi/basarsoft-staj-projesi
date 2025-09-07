using Microsoft.EntityFrameworkCore;
using BasarStajApp.Entity;

namespace BasarStajApp.Data;

/// <summary>
/// EF Core DbContext configured for PostGIS + NetTopologySuite.
/// </summary>
public class BasarstajContext : DbContext
{
    public BasarstajContext(DbContextOptions<BasarstajContext> options) : base(options) { }

    /// <summary>Geometry aggregate root.</summary>
    public DbSet<Geometry> Geometries => Set<Geometry>();

    /// <summary>
    /// Maps the SQL function GeometryType to be usable in LINQ (server-side).
    /// </summary>
    [DbFunction("GeometryType", IsBuiltIn = true)]
    public static string GeometryType(NetTopologySuite.Geometries.Geometry geom)
        => throw new NotSupportedException();

    /// <summary>
    /// Model configuration for table/columns, function mappings and indexes.
    /// </summary>
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Explicit function registration with fully qualified NTS type
        modelBuilder
            .HasDbFunction(typeof(BasarstajContext).GetMethod(
                nameof(GeometryType),
                new[] { typeof(NetTopologySuite.Geometries.Geometry) })!)
            .HasName("GeometryType");

        var e = modelBuilder.Entity<Geometry>();
        e.ToTable("geometry_data");
        e.HasKey(x => x.Id);

        e.Property(x => x.Id).HasColumnName("id");
        e.Property(x => x.Name)
            .HasColumnName("name")
            .HasColumnType("varchar(200)")
            .IsRequired();

        e.Property(x => x.WKT)
            .HasColumnName("wkt")
            .HasColumnType("geometry")
            .IsRequired();

        e.HasIndex(x => x.Name).IsUnique();
    }
}