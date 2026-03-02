---
name: gsd:delete-profile
description: Delete a custom model profile with built-in protection and active profile confirmation
argument-hint: <profile-name>
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
Delete a custom model profile with appropriate safeguards.

Routes to the delete-profile workflow which handles:
- Built-in profile protection (quality/balanced/budget cannot be deleted)
- Detection of profile storage location (project vs global)
- Active profile detection and confirmation prompt
- Profile deletion via direct file manipulation
- Appropriate messaging about profile selection state after deletion
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/delete-profile.md
</execution_context>

<process>
**Follow the delete-profile workflow** from `@~/.claude/get-shit-done/workflows/delete-profile.md`.

The workflow handles all logic including:
1. Validating the profile name argument
2. Checking built-in profile protection
3. Detecting where the profile is stored
4. Checking if the profile is currently active
5. Prompting for confirmation if profile is active
6. Deleting the profile from the appropriate location
7. Clearing active profile if it was the deleted one
8. Displaying confirmation with profile selection state
</process>
