"""Generate database/schema.sql (SQL Server DDL for every database) from spec.py.

Usage: python sqlgen.py <out_file>
The script is the design's DDL: EF Core migrations must produce the same tables, keys, indexes and checks.
Foreign keys are added after the tables of each database; role seed rows follow IdentityDb.
The output has no comment lines (the repository's convention check rejects new SQL comments).
"""
import sys

import spec


def default_sql(value):
    return f"({value})"


def column_sql(table, c):
    line = f"    [{c['name']}] {c['type']} {'NULL' if c['null'] else 'NOT NULL'}"
    if c["default"] is not None:
        line += f" CONSTRAINT [DF_{table}_{c['name']}] DEFAULT {default_sql(c['default'])}"
    return line


def cols(names):
    return ", ".join(f"[{n}]" for n in names)


def table_sql(t):
    name = t["name"]
    body = [column_sql(name, c) for c in t["columns"]]
    body.append(f"    CONSTRAINT [PK_{name}] PRIMARY KEY CLUSTERED ({cols(t['pk'])})")
    for ak, columns in t.get("alternate_keys", []):
        body.append(f"    CONSTRAINT [{ak}] UNIQUE ({cols(columns)})")
    for ck, expr in t.get("checks", []):
        body.append(f"    CONSTRAINT [{ck}] CHECK ({expr})")
    out = [f"CREATE TABLE dbo.[{name}] (", ",\n".join(body), ");"]
    for ux, columns, flt in t.get("unique_indexes", []):
        out.append(f"CREATE UNIQUE INDEX [{ux}] ON dbo.[{name}] ({cols(columns)})" + (f" WHERE {flt};" if flt else ";"))
    for ix, columns, flt in t.get("indexes", []):
        out.append(f"CREATE INDEX [{ix}] ON dbo.[{name}] ({cols(columns)})" + (f" WHERE {flt};" if flt else ";"))
    out.append("GO")
    return "\n".join(out)


def database_sql(db):
    name = db["name"]
    out = [f"IF DB_ID(N'{name}') IS NULL CREATE DATABASE [{name}];", "GO", f"USE [{name}];", "GO",
           "SET ANSI_NULLS ON;", "SET QUOTED_IDENTIFIER ON;", "GO", ""]
    for t in db["tables"]:
        out += [table_sql(t), ""]
    fks = [(t["name"], fk) for t in db["tables"] for fk in t.get("fks", [])]
    if fks:
        for table, (fk, columns, ref, ref_columns, action) in fks:
            out.append(f"ALTER TABLE dbo.[{table}] ADD CONSTRAINT [{fk}] FOREIGN KEY ({cols(columns)}) "
                       f"REFERENCES dbo.[{ref}] ({cols(ref_columns)}) ON DELETE {action};")
        out += ["GO", ""]
    for t in db["tables"]:
        if t.get("seed"):
            values = ",\n".join(f"    ('{key}', '{value}')" for key, value in t["seed"])
            out += [f"INSERT INTO dbo.[{t['name']}] ([{t['pk'][0]}], [{t['columns'][1]['name']}]) VALUES", values + ";",
                    "GO", ""]
    return "\n".join(out)


def schema_sql():
    return "\n".join(database_sql(db) for db in spec.DATABASES).rstrip() + "\n"


if __name__ == "__main__":
    with open(sys.argv[1], "w", encoding="utf-8", newline="\n") as f:
        f.write(schema_sql())
    print("wrote", sys.argv[1])
