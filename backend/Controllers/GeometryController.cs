using Microsoft.AspNetCore.Mvc;
using System.Linq;
using BasarStajApp.DTOs;
using BasarStajApp.Common.Responses;
using BasarStajApp.Services.Interfaces;
using BasarStajApp.Resources;

namespace BasarStajApp.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GeometryController : ControllerBase
{
    private readonly IGeometryService geometryService;
    public GeometryController(IGeometryService svc) => geometryService = svc;

    /// <summary>
    /// Returns all geometry records.
    /// </summary>
    /// <remarks>GET /api/geometry</remarks>
    [HttpGet]
    public async Task<ActionResult<ApiResponse>> GetAll(CancellationToken ct)
    {
        try
        {
            var data = await geometryService.GetAll(ct);
            var msg = data.Any()
                ? Messages.SuccessRecordsRetrieved
                : Messages.NoRecordsFound;

            return Ok(ApiResponse.SuccessResponse(data, msg));
        }
        catch
        {
            return StatusCode(500, ApiResponse.FailResponse(Messages.UnexpectedError));
        }
    }

    /// <summary>
    /// Returns a geometry by id.
    /// </summary>
    /// <remarks>GET /api/geometry/{id}</remarks>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<ApiResponse>> GetById(int id, CancellationToken ct)
    {
        try
        {
            var g = await geometryService.GetById(id, ct);
            return Ok(ApiResponse.SuccessResponse(g, Messages.SuccessRecordRetrieved));
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return BadRequest(ApiResponse.FailResponse(ex.Message));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(ApiResponse.FailResponse(Messages.RecordNotFound));
        }
        catch
        {
            return StatusCode(500, ApiResponse.FailResponse(Messages.UnexpectedError));
        }
    }

    /// <summary>
    /// Creates a new geometry.
    /// </summary>
    /// <remarks>POST /api/geometry</remarks>
    [HttpPost]
    public async Task<ActionResult<ApiResponse>> Add([FromBody] GeometryCreateDto dto, CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return BadRequest(ApiResponse.FailResponse(Messages.ValidationFailed));

        try
        {
            var g = await geometryService.Add(dto, ct);
            return CreatedAtAction(nameof(GetById), new { id = g.Id },
                ApiResponse.SuccessResponse(g, Messages.SuccessRecordCreated));
        }
        catch (InvalidOperationException)
        {
            return Conflict(ApiResponse.FailResponse(Messages.DuplicateName));
        }
        catch (ArgumentNullException ex)
        {
            return BadRequest(ApiResponse.FailResponse(ex.Message));
        }
        catch
        {
            return StatusCode(500, ApiResponse.FailResponse(Messages.UnexpectedError));
        }
    }

    /// <summary>
    /// Bulk-create geometries.
    /// </summary>
    /// <remarks>POST /api/geometry/range</remarks>
    [HttpPost("range")]
    public async Task<ActionResult<ApiResponse>> AddRange([FromBody] IEnumerable<GeometryCreateDto>? items, CancellationToken ct)
    {
        if (items is null || !items.Any())
            return BadRequest(ApiResponse.FailResponse(Messages.EmptyRequest));

        foreach (var dto in items)
        {
            TryValidateModel(dto);
            if (!ModelState.IsValid)
                return BadRequest(ApiResponse.FailResponse(Messages.ValidationFailed));
        }

        try
        {
            var added = await geometryService.AddRange(items, ct);
            return Ok(ApiResponse.SuccessResponse(added, Messages.SuccessRecordsCreated));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse.FailResponse(ex.Message));
        }
        catch (Exception ex) when (ex is ArgumentNullException || ex is ArgumentException)
        {
            return BadRequest(ApiResponse.FailResponse(ex.Message));
        }
        catch
        {
            return StatusCode(500, ApiResponse.FailResponse(Messages.UnexpectedError));
        }
    }

    /// <summary>
    /// Updates an existing geometry.
    /// </summary>
    /// <remarks>PUT /api/geometry/{id}</remarks>
    [HttpPut("{id:int}")]
    public async Task<ActionResult<ApiResponse>> Update(int id, [FromBody] GeometryUpdateDto dto, CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return BadRequest(ApiResponse.FailResponse(Messages.ValidationFailed));

        try
        {
            var g = await geometryService.Update(id, dto, ct);
            return Ok(ApiResponse.SuccessResponse(g, Messages.SuccessRecordUpdated));
        }
        catch (InvalidOperationException)
        {
            return Conflict(ApiResponse.FailResponse(Messages.DuplicateName));
        }
        catch (Exception ex) when (ex is ArgumentNullException || ex is ArgumentOutOfRangeException)
        {
            return BadRequest(ApiResponse.FailResponse(ex.Message));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(ApiResponse.FailResponse(Messages.RecordNotFound));
        }
        catch
        {
            return StatusCode(500, ApiResponse.FailResponse(Messages.UnexpectedError));
        }
    }

    /// <summary>
    /// Deletes a geometry by id.
    /// </summary>
    /// <remarks>DELETE /api/geometry/{id}</remarks>
    [HttpDelete("{id:int}")]
    public async Task<ActionResult<ApiResponse>> Delete(int id, CancellationToken ct)
    {
        try
        {
            await geometryService.Delete(id, ct);
            return Ok(ApiResponse.SuccessResponse(null, Messages.SuccessRecordDeleted));
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return BadRequest(ApiResponse.FailResponse(ex.Message));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(ApiResponse.FailResponse(Messages.RecordNotFound));
        }
        catch
        {
            return StatusCode(500, ApiResponse.FailResponse(Messages.UnexpectedError));
        }
    }

    /// <summary>
    /// Returns a paginated list of geometries with optional type-filter and sorting.
    /// </summary>
    /// <remarks>GET /api/geometry/paged?page=1&amp;pageSize=10&amp;type=Point&amp;sort=createdAt_desc</remarks>
    [HttpGet("paged")]
    public async Task<ActionResult<ApiResponse>> GetPaged([FromQuery] PaginationQuery q, CancellationToken ct)
    {
        var data = await geometryService.GetPaged(q, ct);
        return Ok(ApiResponse.SuccessResponse(data, Messages.SuccessRecordsRetrieved));
    }
}