using System.Collections.Concurrent;
using System.Data;
using BasarStajApp.Core.Repositories;
using BasarStajApp.Core.UnitOfWork;
using BasarStajApp.Data;
using BasarStajApp.Persistence.Repositories;
using Microsoft.EntityFrameworkCore.Storage;

namespace BasarStajApp.Persistence.UnitOfWork

/// <summary>
/// EF Core Unit-of-Work with lazy repository provisioning and optional transactions.
/// </summary>
{
    public class UnitOfWork : IUnitOfWork
    {
        private readonly BasarstajContext _context;
        private readonly ConcurrentDictionary<Type, object> _repositories = new();
        private IDbContextTransaction? _tx;


        public UnitOfWork(BasarstajContext context) => _context = context;

        public IRepository<T> Repository<T>() where T : class
        {
            if (_repositories.TryGetValue(typeof(T), out var repo))
                return (IRepository<T>)repo;

            var instance = new Repository<T>(_context);
            _repositories[typeof(T)] = instance;
            return instance;
        }


        public Task<int> SaveChangesAsync(CancellationToken ct = default) => _context.SaveChangesAsync(ct);

        public async Task BeginTransactionAsync(CancellationToken ct = default)
        {
            if (_tx is null)
                _tx = await _context.Database.BeginTransactionAsync(ct);
        }

        public async Task CommitAsync(CancellationToken ct = default)
        {
            if (_tx is null) return;
            await _tx.CommitAsync(ct);
            await _tx.DisposeAsync();
            _tx = null;
        }

        public async Task RollbackAsync(CancellationToken ct = default)
        {
            if (_tx is null) return;
            await _tx.RollbackAsync(ct);
            await _tx.DisposeAsync();
            _tx = null;
        }

        public async ValueTask DisposeAsync()
        {
            if (_tx is not null) await _tx.DisposeAsync();
            await _context.DisposeAsync();
        }
    }
}