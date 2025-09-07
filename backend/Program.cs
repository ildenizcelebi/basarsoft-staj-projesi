using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using BasarStajApp.Data;
using BasarStajApp.Services.Interfaces;
using BasarStajApp.Services;

using BasarStajApp.Core.Repositories;
using BasarStajApp.Core.UnitOfWork;
using BasarStajApp.Persistence.Repositories;
using BasarStajApp.Persistence.UnitOfWork;

using NetTopologySuite.IO.Converters; // GeoJSON <-> NTS
using Npgsql;
using Microsoft.OpenApi.Models;
using Microsoft.OpenApi.Any;
using NtsGeometry = NetTopologySuite.Geometries.Geometry;

var builder = WebApplication.CreateBuilder(args);

// MVC + JSON (GeoJSON <-> NetTopologySuite)
builder.Services
    .AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.Converters.Add(new GeoJsonConverterFactory());
    });

// Swagger with minimal NTS schema mapping for examples
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.MapType<NtsGeometry>(() => new OpenApiSchema
    {
        Type = "object",
        Example = new OpenApiObject
        {
            ["type"] = new OpenApiString("Point"),
            ["coordinates"] = new OpenApiArray
            {
                new OpenApiDouble(30.0),
                new OpenApiDouble(10.0)
            }
        },
        Properties = new Dictionary<string, OpenApiSchema>
        {
            ["type"] = new OpenApiSchema { Type = "string", Example = new OpenApiString("Point") },
            ["coordinates"] = new OpenApiSchema
            {
                Type = "array",
                Items = new OpenApiSchema { Type = "number" },
                Description = "GeoJSON coordinates [lon, lat] for Point; nested arrays for complex types."
            }
        },
        Required = new HashSet<string> { "type", "coordinates" }
    });
});

// We handle ModelState manually in controllers
builder.Services.Configure<ApiBehaviorOptions>(o => o.SuppressModelStateInvalidFilter = true);

// Provider selection: "postgres-ef" | "postgres-ado" | "memory"
var provider = builder.Configuration.GetValue<string>("UseSqlProvider") ?? "postgres-ef";
var cs = builder.Configuration.GetConnectionString("Default");

// Data access wiring
if (provider.Equals("postgres-ef", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddDbContext<BasarstajContext>(opt =>
        opt.UseNpgsql(cs, npgsql => npgsql.UseNetTopologySuite()));

    builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
    builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
    builder.Services.AddScoped<IGeometryService, EfGeometryService>();
}
else if (provider.Equals("postgres-ado", StringComparison.OrdinalIgnoreCase))
{
    var dsb = new NpgsqlDataSourceBuilder(cs);
    dsb.UseNetTopologySuite();
    var dataSource = dsb.Build();

    builder.Services.AddSingleton(dataSource);
    builder.Services.AddScoped<IGeometryService, PostgresGeometryService>();
    builder.Services.AddSingleton<PostgresDbInitializer>();
}
else
{
    builder.Services.AddSingleton<IGeometryService, StaticGeometryService>();
}

var app = builder.Build();

// Pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

// One-time DB bootstrap for ADO option
if (provider.Equals("postgres-ado", StringComparison.OrdinalIgnoreCase))
{
    using var scope = app.Services.CreateScope();
    scope.ServiceProvider.GetRequiredService<PostgresDbInitializer>().EnsureCreated();
}

app.Run();