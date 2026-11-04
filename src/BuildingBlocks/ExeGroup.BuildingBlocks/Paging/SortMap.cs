using System.Linq.Expressions;
using ExeGroup.BuildingBlocks.Errors;

namespace ExeGroup.BuildingBlocks.Paging;

public sealed class SortMap<T>
{
    private readonly Dictionary<string, LambdaExpression> _keys = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<string> _names = [];
    private SortField? _default;
    private LambdaExpression? _tieBreaker;

    public bool HasDefault => _default is not null;

    public SortMap<T> Add<TKey>(string name, Expression<Func<T, TKey>> key)
    {
        if (!_keys.TryAdd(name, key))
        {
            throw new InvalidOperationException($"Sort key '{name}' is registered twice.");
        }

        _names.Add(name);
        return this;
    }

    public SortMap<T> ByDefault(string name, bool descending = false)
    {
        if (!_keys.ContainsKey(name))
        {
            throw new InvalidOperationException($"Default sort '{name}' is not a registered sort key.");
        }

        _default = new SortField(name, descending);
        return this;
    }

    public SortMap<T> TieBreaker<TKey>(Expression<Func<T, TKey>> uniqueKey)
    {
        _tieBreaker = uniqueKey;
        return this;
    }

    internal IQueryable<T> Apply(IQueryable<T> source, IReadOnlyList<SortField> sort)
    {
        var requested = sort.Count > 0 ? sort : _default is null ? [] : [_default];
        var expression = source.Expression;
        var ordered = false;

        foreach (var field in requested)
        {
            if (!_keys.TryGetValue(field.Field, out var key))
            {
                throw new ValidationFailedException(
                    "sort",
                    $"'{field.Field}' cannot be sorted. Allowed fields: {string.Join(", ", _names)}.");
            }

            expression = AppendOrdering(expression, key, field.Descending, ordered);
            ordered = true;
        }

        if (ordered && _tieBreaker is not null)
        {
            expression = AppendOrdering(expression, _tieBreaker, descending: false, thenBy: true);
        }

        return ordered ? source.Provider.CreateQuery<T>(expression) : source;
    }

    private static MethodCallExpression AppendOrdering(Expression source, LambdaExpression key, bool descending, bool thenBy)
    {
        var method = (thenBy, descending) switch
        {
            (false, false) => nameof(Queryable.OrderBy),
            (false, true) => nameof(Queryable.OrderByDescending),
            (true, false) => nameof(Queryable.ThenBy),
            (true, true) => nameof(Queryable.ThenByDescending),
        };

        return Expression.Call(typeof(Queryable), method, [typeof(T), key.ReturnType], source, Expression.Quote(key));
    }
}
