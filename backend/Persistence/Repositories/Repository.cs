using System.Linq.Expressions;
using BasarStajApp.Core.Repositories;
using BasarStajApp.Data;
using Microsoft.EntityFrameworkCore;

namespace BasarStajApp.Persistence.Repositories

/// <summary>
/// EF Core repository implementation with no-tracking reads and basic paging.
/// </summary>
{
    public class Repository<T> : IRepository<T> where T : class
    {
        protected readonly BasarstajContext _context;
        protected readonly DbSet<T> _dbSet;

        public Repository(BasarstajContext context)
        {
            _context = context;
            _dbSet = _context.Set<T>();
        }

        public async Task<T?> GetByIdAsync(object id, CancellationToken ct = default)
            => await _dbSet.FindAsync(new[] { id }, ct);

        public async Task<IReadOnlyList<T>> GetAllAsync(CancellationToken ct = default)
            => await _dbSet.AsNoTracking().ToListAsync(ct);

        public async Task<IReadOnlyList<T>> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default)
            => await _dbSet.AsNoTracking().Where(predicate).ToListAsync(ct);

        public Task AddAsync(T entity, CancellationToken ct = default)
            => _dbSet.AddAsync(entity, ct).AsTask();

        public Task AddRangeAsync(IEnumerable<T> entities, CancellationToken ct = default)
            => _dbSet.AddRangeAsync(entities, ct);

        public void Update(T entity) => _dbSet.Update(entity);
        public void Remove(T entity) => _dbSet.Remove(entity);
        public void RemoveRange(IEnumerable<T> entities) => _dbSet.RemoveRange(entities);

        public Task<bool> AnyAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default)
            => _dbSet.AnyAsync(predicate, ct);

        public Task<int> CountAsync(Expression<Func<T, bool>>? predicate = null, CancellationToken ct = default)
            => predicate is null ? _dbSet.CountAsync(ct) : _dbSet.CountAsync(predicate, ct);

        public async Task<IReadOnlyList<T>> GetPageAsync(
            int skip,
            int take,
            Expression<Func<T, bool>>? predicate,
            Func<IQueryable<T>, IOrderedQueryable<T>> orderBy,
            CancellationToken ct = default)
        {
            IQueryable<T> q = _dbSet.AsNoTracking();
            if (predicate is not null)
                q = q.Where(predicate);

            q = orderBy(q);

            var list = await q.Skip(skip).Take(take).ToListAsync(ct);
            return list.AsReadOnly();
        }
    }
}