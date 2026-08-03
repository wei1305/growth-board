import unittest

from scripts.export_data import build_record, parse_issue_form


class ExportDataTests(unittest.TestCase):
    def test_parse_issue_form_uses_machine_keys(self):
        body = "### 题目名称 / problem_title\n\n146. LRU Cache\n\n### 难度 / difficulty\n\nmedium\n"
        self.assertEqual(parse_issue_form(body), {"problem_title": "146. LRU Cache", "difficulty": "medium"})

    def test_build_leetcode_record(self):
        issue = {"number": 12, "title": "[LC] LRU", "body": "### 题目名称 / problem_title\n\n146. LRU Cache\n\n### 难度 / difficulty\n\nmedium\n\n### 标签 / topics\n\nHash Table, Linked List\n", "labels": [{"name": "type:leetcode"}], "state": "open", "html_url": "https://example.com/12", "created_at": "2026-08-01T00:00:00Z", "updated_at": "2026-08-02T00:00:00Z"}
        record, error = build_record(issue)
        self.assertIsNone(error)
        self.assertEqual(record["title"], "146. LRU Cache")
        self.assertEqual(record["topics"], ["Hash Table", "Linked List"])

    def test_invalid_record_is_reported(self):
        issue = {"number": 9, "body": "", "labels": [{"name": "type:paper"}]}
        record, error = build_record(issue)
        self.assertIsNone(record)
        self.assertIn("paper_title", error)

    def test_hidden_record_is_skipped(self):
        issue = {"number": 5, "body": "", "labels": [{"name": "type:goal"}, {"name": "record:hidden"}]}
        self.assertEqual(build_record(issue), (None, None))


if __name__ == "__main__":
    unittest.main()
