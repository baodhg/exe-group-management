using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

namespace ExeGroup.Testing;

public sealed record DatabaseShape(IReadOnlySet<string> Columns, IReadOnlySet<string> NamedObjects, IReadOnlySet<string> Structures)
{
    public IEnumerable<string> Differences(DatabaseShape actual) =>
        Compare("column", Columns, actual.Columns)
            .Concat(Compare("object", NamedObjects, actual.NamedObjects))
            .Concat(Compare("structure", Structures, actual.Structures))
            .Order(StringComparer.Ordinal);

    private static IEnumerable<string> Compare(string kind, IReadOnlySet<string> declared, IReadOnlySet<string> actual) =>
        declared.Except(actual).Select(item => $"missing {kind} {item}")
            .Concat(actual.Except(declared).Select(item => $"undeclared {kind} {item}"));
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

    private const string ReadIndexesSql = """
        SELECT i.name, t.name, i.is_unique, ISNULL(i.filter_definition, ''),
            STRING_AGG(c.name, ',') WITHIN GROUP (ORDER BY ic.key_ordinal)
        FROM sys.indexes i
        JOIN sys.tables t ON t.object_id = i.object_id
        JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE i.name IS NOT NULL AND t.name <> '__EFMigrationsHistory'
        GROUP BY i.name, t.name, i.is_unique, i.filter_definition
        """;

    private const string ReadForeignKeysSql = """
        SELECT fk.name, parent.name, referenced.name, fk.delete_referential_action_desc,
            STRING_AGG(parentColumn.name, ',') WITHIN GROUP (ORDER BY fkc.constraint_column_id),
            STRING_AGG(referencedColumn.name, ',') WITHIN GROUP (ORDER BY fkc.constraint_column_id)
        FROM sys.foreign_keys fk
        JOIN sys.tables parent ON parent.object_id = fk.parent_object_id
        JOIN sys.tables referenced ON referenced.object_id = fk.referenced_object_id
        JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
        JOIN sys.columns parentColumn ON parentColumn.object_id = fkc.parent_object_id AND parentColumn.column_id = fkc.parent_column_id
        JOIN sys.columns referencedColumn ON referencedColumn.object_id = fkc.referenced_object_id AND referencedColumn.column_id = fkc.referenced_column_id
        GROUP BY fk.name, parent.name, referenced.name, fk.delete_referential_action_desc
        """;

    public static DatabaseShape Declared(string database)
    {
        var section = Section(File.ReadAllText(SchemaPath()), database);
        var columns = new HashSet<string>(StringComparer.Ordinal);
        var structures = new HashSet<string>(StringComparer.Ordinal);
        foreach (Match table in TablePattern().Matches(section))
        {
            var name = table.Groups["table"].Value;
            var body = table.Groups["body"].Value;
            foreach (Match column in ColumnPattern().Matches(body))
            {
                var type = column.Groups["type"].Value.Replace(" ", string.Empty, StringComparison.Ordinal).ToLowerInvariant();
                columns.Add(Column(name, column.Groups["column"].Value, type, column.Groups["null"].Value == "NULL"));
            }

            foreach (Match key in KeyPattern().Matches(body))
            {
                structures.Add(Index(key.Groups["name"].Value, name, ColumnList(key.Groups["columns"].Value), unique: true, string.Empty));
            }
        }

        foreach (Match index in IndexPattern().Matches(section))
        {
            structures.Add(Index(
                index.Groups["name"].Value,
                index.Groups["table"].Value,
                ColumnList(index.Groups["columns"].Value),
                index.Groups["unique"].Success,
                index.Groups["filter"].Value));
        }

        foreach (Match foreignKey in ForeignKeyPattern().Matches(section))
        {
            structures.Add(ForeignKey(
                foreignKey.Groups["name"].Value,
                foreignKey.Groups["table"].Value,
                ColumnList(foreignKey.Groups["columns"].Value),
                foreignKey.Groups["referenced"].Value,
                ColumnList(foreignKey.Groups["referencedColumns"].Value),
                foreignKey.Groups["action"].Value.Replace(' ', '_')));
        }

        var names = NamePattern().Matches(section).Select(match => match.Groups["name"].Value).ToHashSet(StringComparer.Ordinal);
        return new DatabaseShape(columns, names, structures);
    }

    public static async Task<DatabaseShape> ReadAsync(string connectionString, CancellationToken cancellationToken = default)
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);

        var columns = await ReadSetAsync(connection, ReadColumnsSql, reader => Column(
            reader.GetString(0),
            reader.GetString(1),
            TypeName(reader.GetString(2), reader.GetInt16(3), reader.GetByte(4), reader.GetByte(5)),
            reader.GetBoolean(6)), cancellationToken);
        var names = await ReadSetAsync(connection, ReadNamesSql, reader => reader.GetString(0), cancellationToken);
        var indexes = await ReadSetAsync(connection, ReadIndexesSql, reader => Index(
            reader.GetString(0),
            reader.GetString(1),
            reader.GetString(4),
            reader.GetBoolean(2),
            reader.GetString(3)), cancellationToken);
        var foreignKeys = await ReadSetAsync(connection, ReadForeignKeysSql, reader => ForeignKey(
            reader.GetString(0),
            reader.GetString(1),
            reader.GetString(4),
            reader.GetString(2),
            reader.GetString(5),
            reader.GetString(3)), cancellationToken);

        return new DatabaseShape(columns, names, indexes.Concat(foreignKeys).ToHashSet(StringComparer.Ordinal));
    }

    private static async Task<HashSet<string>> ReadSetAsync(
        SqlConnection connection,
        string sql,
        Func<SqlDataReader, string> describe,
        CancellationToken cancellationToken)
    {
        var items = new HashSet<string>(StringComparer.Ordinal);
        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(describe(reader));
        }

        return items;
    }

    private static string Column(string table, string column, string type, bool nullable) =>
        $"{table}.{column} {type}{(nullable ? " NULL" : " NOT NULL")}";

    private static string Index(string name, string table, string columns, bool unique, string filter) =>
        $"index {name} on {table}({columns}){(unique ? " unique" : string.Empty)}{(filter.Length > 0 ? $" where {Normalize(filter)}" : string.Empty)}";

    private static string ForeignKey(string name, string table, string columns, string referenced, string referencedColumns, string action) =>
        $"foreign key {name} {table}({columns}) -> {referenced}({referencedColumns}) on delete {action}";

    private static string ColumnList(string columns) => string.Join(',', columns.Split(',').Select(column => column.Trim().Trim('[', ']')));

    private static string Normalize(string expression) =>
        new(expression.Where(character => !char.IsWhiteSpace(character) && character is not ('(' or ')' or '[' or ']')).ToArray());

    private static string TypeName(string type, short maxLength, byte precision, byte scale) => type switch
    {
        "nvarchar" or "nchar" => maxLength < 0 ? $"{type}(max)" : $"{type}({maxLength / 2})",
        "varchar" or "char" or "varbinary" or "binary" => maxLength < 0 ? $"{type}(max)" : $"{type}({maxLength})",
        "decimal" or "numeric" => $"{type}({precision},{scale})",
        "datetime2" or "time" or "datetimeoffset" => scale == 7 ? type : $"{type}({scale})",
        "timestamp" => "rowversion",
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

    [GeneratedRegex(@"CONSTRAINT \[(?<name>(?:PK|AK|UQ)_\w+)\] (?:PRIMARY KEY(?: CLUSTERED)?|UNIQUE) \((?<columns>[^)]*)\)")]
    private static partial Regex KeyPattern();

    [GeneratedRegex(@"CREATE (?<unique>UNIQUE )?INDEX \[(?<name>\w+)\] ON dbo\.\[(?<table>\w+)\] \((?<columns>[^)]*)\)(?: WHERE (?<filter>[^;]+))?;")]
    private static partial Regex IndexPattern();

    [GeneratedRegex(@"ALTER TABLE dbo\.\[(?<table>\w+)\] ADD CONSTRAINT \[(?<name>\w+)\] FOREIGN KEY \((?<columns>[^)]*)\) REFERENCES dbo\.\[(?<referenced>\w+)\] \((?<referencedColumns>[^)]*)\) ON DELETE (?<action>NO ACTION|CASCADE|SET NULL)")]
    private static partial Regex ForeignKeyPattern();

    [GeneratedRegex(@"\[(?<name>(?:PK|FK|CK|DF|UX|IX|AK|UQ)_\w+)\]")]
    private static partial Regex NamePattern();
}
