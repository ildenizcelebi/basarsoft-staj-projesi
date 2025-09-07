namespace BasarStajApp.Resources;

/// <summary>
/// Centralized user-facing message texts used in API responses.
/// </summary>
public static class Messages
{
    // General
    public const string UnexpectedError = "An unexpected error occurred.";
    public const string ValidationFailed = "Model validation failed";
    public const string EmptyRequest = "Request body is empty or contains no items";

    // GET
    public const string SuccessRecordsRetrieved = "Records retrieved successfully";
    public const string NoRecordsFound = "No Records found";
    public const string SuccessRecordRetrieved = "Record retrieved successfully";
    public const string RecordNotFound = "Record not found";

    // POST
    public const string SuccessRecordCreated = "Record created successfully";
    public const string SuccessRecordsCreated = "Records created successfully";
    public const string DuplicateName = "A geometry with the same name already exists.";

    // PUT
    public const string SuccessRecordUpdated = "Record updated successfully";
    public const string DuplicateNameOnUpdate = "Another geometry with the same name already exists.";

    // DELETE
    public const string SuccessRecordDeleted = "Record deleted successfully";
}