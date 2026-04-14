---
name: bootstrap-smoke-suite
description: Creates a minimal smoke suite for a feature by reusing existing cases and adding missing ones.
---

# Bootstrap Smoke Suite

## Goal

Create a realistic starter smoke pack for one feature with minimal duplication.

## Steps

1. Determine target feature from the user request. If not explicit, use `"Checkout"`.
2. Call `testops_find_testcases` with `tag: "smoke"`.
3. Check whether there are already smoke cases for the feature (name contains feature keyword).
4. Ensure the following smoke scenarios exist (create only missing):
   - `[SMOKE] {feature} :: happy path`
   - `[SMOKE] {feature} :: validation errors`
   - `[SMOKE] {feature} :: recovery after failure`
5. For every missing scenario, call `testops_create_testcase` with:
   - `name` = scenario name
   - `tags` = `["smoke", "{feature-kebab-case}"]`
6. Return a concise summary:
   - total smoke cases found
   - created cases
   - skipped existing cases
