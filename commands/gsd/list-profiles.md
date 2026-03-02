---
name: gsd:list-profiles
description: List all available model profiles (custom + legacy) with active indicator
allowed-tools:
  - Bash
---

<objective>
Display all available model profiles showing which are custom vs legacy, which is currently active, and their agent-to-model mappings.

Routes to the list-profiles workflow which handles:
- Retrieving all profiles from gsd-tools
- Formatting output as a table with profile metadata
- Highlighting the currently active profile
- Showing source attribution (custom/legacy)
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/list-profiles.md
</execution_context>

<process>
**Follow the list-profiles workflow** from `@~/.claude/get-shit-done/workflows/list-profiles.md`.

The workflow handles all logic including:
1. Calling gsd-tools list-profiles command
2. Parsing and formatting profile data
3. Displaying table with profile name, source, active status, model assignments
</process>
