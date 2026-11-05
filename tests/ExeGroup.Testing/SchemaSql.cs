using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

namespace ExeGroup.Testing;

public sealed record DatabaseShape(IReadOnlySet<string> Columns, IReadOnlySet<string> NamedObjects)
{
    public IEnumerable<string> Differences(DatabaseShape actual) =>
        Columns.Except(actual.Columns).Select(column => $"missing column {column}")
            .Concat(actual.Columns.Except(Columns).Select(column => $"undeclared column {column}"))
            .Concat(NamedObjects.Except(actual.NamedObjects).Select(name => $"missing {name}"))
            .Concat(actual.NamedObjects.Except(NamedObjects).Select(name => $"undeclared {name}"))
            .Order(StringComparer.Ordinal);
}

public static partial class SchemaSql
{
    private const string ReadColumnsSql = """
        SELECT t.name, c.name, ty.name, c.max_length, c.precision, c.scale, c.is_nullable
        FROM sys.columns c
        JOIN sys.tables t ON t.object_id = c.object_id
        JOIN sys.types ty ON ty.user_type_id = c.user_type_id
        WHERE t.name <> '__EFMigrationsHistory'
        """;

    private const string ReadNamesSql = """
        SELECT o.name FROM sys.objects o
        JOIN sys.tables t ON t.object_id = o.parent_object_id
        WHERE o.type IN ('PK', 'F', 'C', 'D', 'UQ') AND t.name <> '__EFMigrationsHistory'
        UNION ALL
        SELECT i.name FROM sys.indexes i
        JOIN sys.tables t ON t.object_id = i.object_id
        WHERE i.name IS NOT NULL AND i.is_primary_key = 0 AND i.is_unique_constraint = 0 AND t.name <> '__EFMigrationsHistory'
        """;

    public static DatabaseShape Declared(string database)
    {
        var section = Section(File.ReadAllText(SchemaPath()), database);
        var columns = new HashSet<string>(StringComparer.Ordinal);
        foreach (Match table in TablePattern().Matches(section))
        {
            foreach (Match column in ColumnPattern().Matches(table.Groups["body"].Value))
            {
                var type = column.Groups["type"].Value.Replace(" ", string.Empty, StringComparison.Ordinal).ToLowerInvariant();
                columns.Add(Describe(table.Groups["table"].Value, column.Groups["column"].Value, type, column.Groups["null"].Value == "NULL"));
            }
        }

        var names = NamePattern().Matches(section).Select(match => match.Groups["name"].Value).ToHashSet(StringComparer.Ordinal);
        return new DatabaseShape(columns, names);
    }

    public static async Task<DatabaseShape> ReadAsync(string connectionString, CancellationToken cancellationToken = default)
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);

        var columns = new HashSet<string>(StringComparer.Ordinal);
        await using (var command = new SqlCommand(ReadColumnsSql, connection))
        await using (var reader = await command.ExecuteReaderAsync(cancellationToken))
        {
            while (await reader.ReadAsync(cancellationToken))
            {
                var type = TypeName(reader.GetString(2), reader.GetInt16(3), reader.GetByte(4), reader.GetByte(5));
                columns.Add(Describe(reader.GetString(0), reader.GetString(1), type, reader.GetBoolean(6)));
            }
        }

        var names = new HashSet<string>(StringComparer.Ordinal);
        await using (var command = new SqlCommand(ReadNamesSql, connection))
        await using (var reader = await command.ExecuteReaderAsync(cancellationToken))
        {
            while (await reader.ReadAsync(cancellationToken))
            {
                names.Add(reader.GetString(0));
            }
        }

        return new DatabaseShape(columns, names);
    }

    private static string Describe(string table, string column, string type, bool nullable) =>
        $"{table}.{column} {type}{(nullable ? " NULL" : " NOT NULL")}";

    private static string TypeName(string type, short maxLength, byte precision, byte scale) => type switch
    {
        "nvarchar" or "nchar" => maxLength < 0 ? $"{type}(max)" : $"{type}({maxLength / 2})",
        "varchar" or "char" or "varbinary" or "binary" => maxLength < 0 ? $"{type}(max)" : $"{type}({maxLength})",
        "decimal" or "numeric" => $"{type}({precision},{scale})",
        "datetime2" or "time" or "datetimeoffset" => scale == 7 ? type : $"{type}({scale})",
        _ => type,
    };

    private static string Section(string schema, string database)
    {
        var start = schema.IndexOf($"USE [{database}];", StringComparison.Ordinal);
        if (start < 0)
        {
            throw new InvalidOperationException($"database/schema.sql has no section for {database}.");
        }

        var end = schema.IndexOf("IF DB_ID(", start, StringComparison.Ordinal);
        return end < 0 ? schema[start..] : schema[start..end];
    }

    private static string SchemaPath()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            var candidate = Path.Combine(directory.FullName, "database", "schema.sql");
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        throw new FileNotFoundException("database/schema.sql was not found above the test output folder.");
    }

    [GeneratedRegex(@"CREATE TABLE dbo\.\[(?<table>\w+)\] \((?<body>.*?)\r?\n\);", RegexOptions.Singleline)]
    private static partial Regex TablePattern();

    [GeneratedRegex(@"^\s*\[(?<column>\w+)\]\s+(?<type>[a-z0-9]+(?:\([^)]*\))?)\s+(?<null>NOT NULL|NULL)", RegexOptions.Multiline)]
    private static partial Regex ColumnPattern();

    [GeneratedRegex(@"\[(?<name>(?:PK|FK|CK|DF|UX|IX|AK|UQ)_\w+)\]")]
    private static partial Regex NamePattern();
}
