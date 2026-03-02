---
name: gsd:profile-info
description: Show currently active profile with resolution examples
allowed-tools:
  - Bash
---

<objective>
Display information about the currently active model profile, including how agents resolve to models and example resolution paths.

Routes to the profile-info workflow which handles:
- Retrieving active profile information from gsd-tools
- Displaying active profile name and source
- Showing resolution examples for common agents
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/profile-info.md
</execution_context>

<process>
**Follow the profile-info workflow** from `@~/.claude/get-shit-done/workflows/profile-info.md`.

The workflow handles all logic including:
1. Calling gsd-tools profile-info command
2. Parsing active profile data
3. Displaying profile details and resolution examples
</process>
