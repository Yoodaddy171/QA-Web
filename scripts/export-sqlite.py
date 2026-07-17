import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

database_path = Path(sys.argv[1] if len(sys.argv) > 1 else "prisma/db/custom.db").resolve()
output_path = Path(sys.argv[2] if len(sys.argv) > 2 else "data-migration/sqlite-export.json").resolve()
tables = {
    "workspaces": "Workspace",
    "users": "User",
    "workspaceMemberships": "WorkspaceMembership",
    "aiRequestAudits": "AIRequestAudit",
    "aiUsageMonths": "AIUsageMonth",
    "projects": "Project",
    "projectKnowledge": "ProjectKnowledge",
    "modules": "Module",
    "testCases": "TestCase",
    "requirements": "Requirement",
    "testPlans": "TestPlan",
    "testPlanRequirements": "TestPlanRequirement",
    "requirementTestCases": "RequirementTestCase",
    "testRuns": "TestRun",
    "testRunCases": "TestRunCase",
    "testExecutions": "TestExecution",
    "testExecutionEvidence": "TestExecutionEvidence",
    "bugFixes": "BugFix",
    "activityHistory": "ActivityHistory",
    "notifications": "Notification",
    "reports": "Report",
    "automationRuns": "AutomationRun",
    "automationEvents": "AutomationEvent",
    "recordings": "Recording",
}

connection = sqlite3.connect(database_path)
connection.row_factory = sqlite3.Row
try:
    data = {
        "exportedAt": datetime.now(timezone.utc).isoformat(),
    }
    for key, table in tables.items():
        try:
            data[key] = [dict(row) for row in connection.execute(f'SELECT * FROM "{table}"')]
        except sqlite3.OperationalError as error:
            if "no such table" not in str(error).lower():
                raise
            data[key] = []
    data["counts"] = {key: len(data[key]) for key in tables}
finally:
    connection.close()

output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
print(f"SQLite export written to {output_path}")
print(json.dumps(data["counts"]))
