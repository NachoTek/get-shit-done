---
name: gsd:view-profile
description: View detailed profile configuration showing agent-to-model mappings
argument-hint: <profile-name>
allowed-tools:
  - Bash
---

<objective>
Display detailed information about a specific model profile, including the complete agent-to-model mapping and profile metadata.

Routes to the view-profile workflow which handles:
- Argument validation (profile name required)
- Retrieving profile details from gsd-tools
- Displaying agent-to-model mappings in formatted table
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/view-profile.md
</execution_context>

<process>
**Follow the view-profile workflow** from `@~/.claude/get-shit-done/workflows/view-profile.md`.

The workflow handles all logic including:
1. Validating profile argument is provided
2. Calling gsd-tools view-profile with profile name
3. Formatting and displaying agent-to-model mappings
</process>
