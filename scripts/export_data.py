#!/usr/bin/env python3
"""Export GrowthBoard records from GitHub Issues into static JSON files."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "site.json"
OUTPUT_DIR = ROOT / "public" / "data"
FORM_FIELD_RE = re.compile(r"^###\s+(.+?)\s*$", re.MULTILINE)


def field_key(label: str) -> str:
    candidate = label.rsplit("/", 1)[-1].strip().lower()
    candidate = re.sub(r"[^a-z0-9_]+", "_", candidate).strip("_")
    return candidate


def clean_value(value: str) -> str | None:
    value = value.strip()
    if value in {"", "_No response_", "No response", "none", "None", "—"}:
        return None
    return value


def parse_issue_form(body: str) -> dict[str, str]:
    matches = list(FORM_FIELD_RE.finditer(body or ""))
    fields: dict[str, str] = {}
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(body)
        value = clean_value(body[start:end])
        if value is not None:
            fields[field_key(match.group(1))] = value
    return fields


def as_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(str(value).strip().rstrip("%")))
    except (TypeError, ValueError):
        return default


def labels_of(issue: dict[str, Any]) -> list[str]:
    return [label.get("name", "") if isinstance(label, dict) else str(label) for label in issue.get("labels", [])]


def record_type(labels: list[str]) -> str | None:
    mapping = {"type:leetcode": "leetcode", "type:paper": "papers", "type:job": "jobs", "type:goal": "goals"}
    return next((value for label, value in mapping.items() if label in labels), None)


def split_topics(value: str | None) -> list[str]:
    return [part.strip() for part in re.split(r"[,，;；]", value or "") if part.strip()]


def base_record(issue: dict[str, Any], kind: str, fields: dict[str, str], labels: list[str]) -> dict[str, Any]:
    activity_keys = {"leetcode": ["solved_at"], "papers": ["finished_at", "started_at"], "jobs": ["applied_at"], "goals": ["due_at"]}[kind]
    activity_date = next((fields.get(key) for key in activity_keys if fields.get(key)), None) or issue.get("updated_at", "")[:10]
    title_keys = {"leetcode": "problem_title", "papers": "paper_title", "jobs": "company", "goals": "goal_title"}
    title = fields.get(title_keys[kind]) or issue.get("title", "Untitled")
    if kind == "jobs" and fields.get("role"):
        title = f"{title} · {fields['role']}"
    return {
        "id": issue["number"], "type": kind, "title": title, "issueUrl": issue.get("html_url", ""),
        "state": issue.get("state", "open"), "archived": issue.get("state") == "closed", "labels": labels,
        "createdAt": issue.get("created_at", ""), "updatedAt": issue.get("updated_at", ""), "activityDate": activity_date,
    }


def build_record(issue: dict[str, Any]) -> tuple[dict[str, Any] | None, str | None]:
    labels = labels_of(issue)
    if "pull_request" in issue or "record:deleted" in labels or "record:hidden" in labels:
        return None, None
    kind = record_type(labels)
    if not kind:
        return None, None
    fields = parse_issue_form(issue.get("body") or "")
    required = {"leetcode": ["problem_title", "difficulty"], "papers": ["paper_title", "status"], "jobs": ["company", "stage"], "goals": ["goal_title", "target_value", "current_value"]}[kind]
    missing = [key for key in required if not fields.get(key)]
    if missing:
        return None, f"Issue #{issue['number']} 缺少字段: {', '.join(missing)}"
    record = base_record(issue, kind, fields, labels)
    if kind == "leetcode":
        record.update({"problemUrl": fields.get("problem_url"), "difficulty": fields["difficulty"].lower(), "language": fields.get("language"), "topics": split_topics(fields.get("topics")), "solvedAt": fields.get("solved_at"), "nextReviewAt": fields.get("next_review_at"), "mastery": as_int(fields.get("mastery"), 0), "status": fields.get("status", "active"), "summary": fields.get("summary"), "mistakes": fields.get("mistakes"), "solutionUrl": fields.get("solution_url")})
    elif kind == "papers":
        record.update({"authors": fields.get("authors"), "venue": fields.get("venue"), "year": fields.get("year"), "paperUrl": fields.get("paper_url"), "codeUrl": fields.get("code_url"), "researchArea": fields.get("research_area"), "status": fields["status"], "progress": min(max(as_int(fields.get("progress"), 0), 0), 100), "rating": min(max(as_int(fields.get("rating"), 0), 0), 5), "startedAt": fields.get("started_at"), "finishedAt": fields.get("finished_at"), "nextReviewAt": fields.get("next_review_at"), "summary": fields.get("summary"), "contribution": fields.get("contribution")})
    elif kind == "jobs":
        record.update({"company": fields["company"], "role": fields.get("role"), "location": fields.get("location"), "jobUrl": fields.get("job_url"), "channel": fields.get("channel"), "appliedAt": fields.get("applied_at"), "stage": fields["stage"], "nextStepAt": fields.get("next_step_at"), "note": fields.get("note"), "result": fields.get("result")})
    else:
        record.update({"module": fields.get("module"), "period": fields.get("period"), "startAt": fields.get("start_at"), "dueAt": fields.get("due_at"), "targetValue": as_int(fields.get("target_value"), 0), "currentValue": as_int(fields.get("current_value"), 0), "metric": fields.get("metric"), "status": fields.get("status", "active"), "review": fields.get("review")})
    return {key: value for key, value in record.items() if value is not None}, None


def fetch_issues(repository: str, token: str | None) -> list[dict[str, Any]]:
    owner, repo = repository.split("/", 1)
    url = f"https://api.github.com/repos/{urllib.parse.quote(owner)}/{urllib.parse.quote(repo)}/issues?state=all&per_page=100"
    issues: list[dict[str, Any]] = []
    while url:
        headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "GrowthBoard-Exporter"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        request = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(request, timeout=30) as response:
            issues.extend(json.load(response))
            link = response.headers.get("Link", "")
        next_match = re.search(r'<([^>]+)>; rel="next"', link)
        url = next_match.group(1) if next_match else ""
    return issues


def export(issues: list[dict[str, Any]], config: dict[str, Any], repository: str) -> dict[str, Any]:
    records: dict[str, list[dict[str, Any]]] = {"leetcode": [], "papers": [], "jobs": [], "goals": []}
    invalid: list[str] = []
    for issue in issues:
        record, error = build_record(issue)
        if error:
            invalid.append(error)
        elif record and config["modules"].get(record["type"], True):
            records[record["type"]].append(record)
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for kind, items in records.items():
        items.sort(key=lambda item: (item.get("activityDate", ""), item["id"]), reverse=True)
        payload = {"generatedAt": generated_at, "repository": repository, "records": items}
        (OUTPUT_DIR / f"{kind}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUTPUT_DIR / "invalid-records.json").write_text(json.dumps({"generatedAt": generated_at, "records": invalid}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"generatedAt": generated_at, "counts": {key: len(value) for key, value in records.items()}, "invalid": invalid}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, help="Read GitHub API issue JSON from a local file")
    args = parser.parse_args()
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    repository = os.getenv("GITHUB_REPOSITORY") or config["repository"]
    try:
        issues = json.loads(args.input.read_text(encoding="utf-8")) if args.input else fetch_issues(repository, os.getenv("GITHUB_TOKEN"))
        summary = export(issues, config, repository)
    except (OSError, ValueError, urllib.error.URLError) as error:
        print(f"GrowthBoard export failed: {error}", file=sys.stderr)
        return 1
    print(json.dumps(summary, ensure_ascii=False))
    if os.getenv("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as stream:
            stream.write("## GrowthBoard 数据导出\n\n")
            stream.write(" | ".join(f"{key}: **{value}**" for key, value in summary["counts"].items()) + "\n")
            if summary["invalid"]:
                stream.write("\n### 无效记录\n" + "\n".join(f"- {item}" for item in summary["invalid"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
