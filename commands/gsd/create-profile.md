---
name: gsd:create-profile
description: Create a custom model profile via interactive 3-question flow
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
Interactive creation of custom model profiles with auto-detected models and storage choice.

Routes to the create-profile workflow which handles:
- Auto-detection of available models
- Profile name prompt
- Storage location selection (project vs global)
- Model selection for each agent category (planning, execution, research)
- Profile creation via direct file manipulation
- Confirmation display with storage path
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/create-profile.md
</execution_context>

<process>
**Follow the create-profile workflow** from `@~/.claude/get-shit-done/workflows/create-profile.md`.

The workflow handles all logic including:
1. Detecting available models from the system
2. Prompting for profile name
3. Prompting for storage location
4. Prompting for model selections per category
5. Creating the profile in the appropriate location
6. Displaying confirmation
</process>
