using System.Data;
using BasarStajApp.Core.Repositories;

namespace BasarStajApp.Core.UnitOfWork;

/// <summary>
/// Unit-of-Work abstraction coordinating repositories and transactions.
/// </summary>
public interface IUnitOfWork : IAsyncDisposable
{
    IRepository<T> Repository<T>() where T : class;

    Task<int> SaveChangesAsync(CancellationToken ct = default);

    Task BeginTransactionAsync(CancellationToken ct = default);
    Task CommitAsync(CancellationToken ct = default);
    Task RollbackAsync(CancellationToken ct = default);
}
