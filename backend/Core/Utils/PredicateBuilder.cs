using System.Linq.Expressions;

namespace BasarStajApp.Core.Utils;

/// <summary>
/// Helpers for composing LINQ expression predicates.
/// </summary>
public static class PredicateBuilder
{
    public static Expression<Func<T,bool>> True<T>() => _ => true;

    public static Expression<Func<T,bool>> And<T>(
        this Expression<Func<T,bool>> left,
        Expression<Func<T,bool>> right)
    {
        var p = Expression.Parameter(typeof(T), "x");
        var leftBody  = new ReplaceParam(left.Parameters[0],  p).Visit(left.Body)!;
        var rightBody = new ReplaceParam(right.Parameters[0], p).Visit(right.Body)!;
        return Expression.Lambda<Func<T,bool>>(Expression.AndAlso(leftBody, rightBody), p);
    }

    private sealed class ReplaceParam : ExpressionVisitor
    {
        private readonly ParameterExpression _from, _to;
        public ReplaceParam(ParameterExpression from, ParameterExpression to) { _from = from; _to = to; }
        protected override Expression VisitParameter(ParameterExpression node)
            => node == _from ? _to : base.VisitParameter(node);
    }
}
