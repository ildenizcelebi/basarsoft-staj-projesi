namespace BasarStajApp.Common.Responses;

public class ApiResponse
{
    public bool Success { get; init; }
    public string? Message { get; init; } = "";
    public object? Data { get; init; }

    private ApiResponse(bool success, string message, object? data)
        => (Success, Message, Data) = (success, message, data);

    public static ApiResponse SuccessResponse(object? data, string message)
        => new(true, message, data);

    public static ApiResponse FailResponse(string message, object? data = null)
        => new(false, message, data);
}