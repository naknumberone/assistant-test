---
name: ensure-first-testcase
description: Creates the first test case if none exist in the system. Uses find and create tools.
---

# Ensure First Test Case Exists

## Steps

1. Call the `testops_find_testcases` tool to retrieve all existing test cases.
2. Check the `data` array in the result:
   - If `data` is **empty**: call `testops_create_testcase` with name `"First Test Case"`, then report: "Created the first test case: {name}, id: {id}"
   - If `data` is **not empty**: report: "A test case already exists: {first item name}"
