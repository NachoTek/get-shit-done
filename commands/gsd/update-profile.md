---
name: gsd:update-profile
description: Update an existing custom profile's model assignments via interactive 3-question flow
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
argument-hint:
  name: profile-name
  description: Name of the custom profile to update (built-in profiles cannot be modified)
---

<objective>
Interactive update of custom model profiles with built-in profile protection and current value display.

Routes to the update-profile workflow which handles:
- Validation that profile is not built-in (quality/balanced/budget)
- Detection of profile storage location (project vs global)
- Loading current model assignments
- Auto-detection of available models
- Prompting for new model selections with current values shown
- Updating profile via direct file manipulation
- Confirmation display with updated assignments
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/update-profile.md
</execution_context>

<process>
**Follow the update-profile workflow** from `@~/.claude/get-shit-done/workflows/update-profile.md`.

The workflow handles all logic including:
1. Validating profile name argument
2. Checking built-in profile protection
3. Detecting profile storage location
4. Loading current model assignments
5. Detecting available models
6. Prompting for new model selections (showing current values)
7. Updating the profile in the appropriate location
8. Displaying confirmation
</process>
