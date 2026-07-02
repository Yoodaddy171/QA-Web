import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

database_path = Path(sys.argv[1] if len(sys.argv) > 1 else "prisma/db/custom.db").resolve()
output_path = Path(sys.argv[2] if len(sys.argv) > 2 else "data-migration/sqlite-export.json").resolve()
tables = {
    "projects": "Project",
    "projectKnowledge": "ProjectKnowledge",
    "modules": "Module",
    "testCases": "TestCase",
    "bugFixes": "BugFix",
}

connection = sqlite3.connect(database_path)
connection.row_factory = sqlite3.Row
try:
    data = {
        "exportedAt": datetime.now(timezone.utc).isoformat(),
    }
    for key, table in tables.items():
        data[key] = [dict(row) for row in connection.execute(f'SELECT * FROM "{table}"')]
    data["counts"] = {key: len(data[key]) for key in tables}
finally:
    connection.close()

output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
print(f"SQLite export written to {output_path}")
print(json.dumps(data["counts"]))
