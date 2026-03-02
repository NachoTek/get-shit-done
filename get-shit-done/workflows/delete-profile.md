<purpose>
Delete custom model profiles with built-in protection and active profile confirmation. Uses AskUserQuestion for confirmation and directly manipulates profiles file (not gsd-tools readline).
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="validate_profile_name">
Validate that a profile name argument was provided.

Check if the command was invoked with a profile name argument. If no argument provided, display usage message and exit:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DELETE PROFILE ERROR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Error: No profile name specified.

Usage: /gsd:delete-profile <profile-name>

Example: /gsd:delete-profile my-custom-profile
```

Store the profile name for use in subsequent steps.
</step>

<step name="check_builtin_protection">
Check if the profile is a built-in profile that cannot be deleted.

Built-in profiles: quality, balanced, budget

If the profile name matches a built-in profile, display protection message and exit:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DELETE PROFILE ERROR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Error: Cannot delete built-in profile '<profile_name>'.

Built-in profiles (quality, balanced, budget) are protected and cannot be deleted.

To switch to a different profile, use: /gsd:set-profile <profile-name>
```

This check happens BEFORE any other checks to provide immediate feedback.
</step>

<step name="detect_profile_location">
Detect where the profile is stored (project vs global).

Check both locations for the profile:

**Check project location:**
```bash
if [ -f ".planning/profiles.json" ]; then
  PROJECT_PROFILES=$(cat .planning/profiles.json)
  # Check if profile exists in project profiles
fi
```

**Check global location:**
```bash
if [ -f "$HOME/.claude/get-shit-done/profiles.json" ]; then
  GLOBAL_PROFILES=$(cat "$HOME/.claude/get-shit-done/profiles.json")
  # Check if profile exists in global profiles
fi
```

If profile is not found in either location, display error and exit:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DELETE PROFILE ERROR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Error: Profile '<profile_name>' not found.

Checked locations:
  - .planning/profiles.json (project)
  - ~/.claude/get-shit-done/profiles.json (global)

Use /gsd:list-profiles to see available profiles.
```

Store the location where the profile was found (project or global).
</step>

<step name="check_active_profile">
Check if the profile to be deleted is currently active.

Get the current active profile:
```bash
ACTIVE_PROFILE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" get-active-profile --raw 2>/dev/null || echo "")
```

Compare with the profile to be deleted:
- If active_profile equals the profile to delete → profile IS active
- Otherwise → profile is NOT active

Store this status for use in confirmation and deletion steps.
</step>

<step name="confirm_if_active">
If the profile is active, prompt for confirmation before deletion.

**If profile is NOT active:**
- Skip confirmation, proceed directly to deletion

**If profile IS active:**
Prompt user for confirmation using AskUserQuestion:

```
AskUserQuestion([
  {
    question: "Profile '<profile_name>' is currently active. After deletion, no profile will be selected. Continue?",
    header: "Confirm Deletion",
    multiSelect: false,
    options: [
      { label: "Yes, delete it", description: "Delete the profile and clear active profile selection" },
      { label: "No, cancel", description: "Keep the profile and exit" }
    ]
  }
])
```

If user selects "No, cancel", display cancellation message and exit:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DELETE PROFILE CANCELLED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Profile '<profile_name>' was not deleted.

The profile remains active. To switch to a different profile:
  /gsd:set-profile <profile-name>
```

If user selects "Yes, delete it", proceed to deletion step.
</step>

<step name="delete_profile">
Delete the profile by directly manipulating the profiles file.

**Determine target file:**
- If location is "project": `.planning/profiles.json`
- If location is "global": `$HOME/.claude/get-shit-done/profiles.json`

**Read existing profiles:**
```bash
PROFILES_JSON=$(cat "$TARGET_FILE")
```

**Remove the profile from the JSON:**
Parse the JSON and remove the profile entry from the "profiles" object while preserving all other profiles.

**Write the updated file:**
```bash
echo "$UPDATED_JSON" > "$TARGET_FILE"
```

Do NOT use gsd-tools delete-profile command (it uses readline which doesn't work in opencode).

After deletion, if the file's "profiles" object is empty, consider whether to remove the file entirely or leave it empty (typically leave it empty for consistency).
</step>

<step name="clear_active_if_needed">
If the deleted profile was active, clear the active profile selection.

**If profile WAS active:**
Clear the active profile by removing or updating the state file:
```bash
# Clear active profile in state
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" clear-active-profile
```

Or if that command doesn't exist, directly manipulate the state file to remove the active profile setting.

**If profile was NOT active:**
No action needed - active profile remains unchanged.

Store whether we cleared the active profile for the confirmation message.
</step>

<step name="display_confirmation">
Display appropriate confirmation message based on what happened.

**If profile WAS active (and was cleared):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PROFILE DELETED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Profile '<profile_name>' has been deleted.
Storage: <Project/Global>
Location: <file_path>

Note: This profile was active. No profile is currently selected.

To select a new profile:
  /gsd:set-profile <profile-name>

To see available profiles:
  /gsd:list-profiles
```

**If profile was NOT active:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PROFILE DELETED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Profile '<profile_name>' has been deleted.
Storage: <Project/Global>
Location: <file_path>

Your active profile remains unchanged.

To see available profiles:
  /gsd:list-profiles
```

This provides clear feedback about the deletion and the current profile selection state.
</step>

</process>

<success_criteria>
- [ ] Profile name argument validated
- [ ] Built-in profile protection checked (quality/balanced/budget)
- [ ] Profile storage location detected (project vs global)
- [ ] Active profile status checked
- [ ] Confirmation prompt shown only if profile is active
- [ ] Profile deleted via direct file manipulation
- [ ] Active profile cleared if deleted profile was active
- [ ] Appropriate confirmation message displayed with profile selection state
</success_criteria>
