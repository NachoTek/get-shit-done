<purpose>
Interactive update of custom model profiles with built-in protection and current value display. Uses AskUserQuestion for the 3-question flow and directly manipulates profiles file (not gsd-tools readline).
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="validate_profile_argument">
Validate that a profile name was provided as an argument.

Check the invoking prompt for the profile name argument. If not provided, inform the user:

```
Error: Profile name is required.

Usage: /gsd:update-profile <profile-name>

Example: /gsd:update-profile my-custom-profile
```

If provided, store the profile name for use in subsequent steps.
</step>

<step name="check_builtin_protection">
Check if the profile is a built-in profile that cannot be modified.

Built-in profiles: quality, balanced, budget

```bash
PROTECTED_PROFILES="quality balanced budget"

if echo "$PROTECTED_PROFILES" | grep -qw "<profile_name>"; then
  echo "Error: Cannot modify built-in profile '<profile_name>'."
  echo ""
  echo "Built-in profiles (quality, balanced, budget) are protected and cannot be modified."
  echo "To customize model assignments, create a custom profile instead:"
  echo "  /gsd:create-profile"
  exit 1
fi
```

If the profile is built-in, display error and exit immediately.
</step>

<step name="detect_storage_location">
Detect where the profile is stored (project vs global).

**Check project location first:**
```bash
if [ -f ".planning/profiles.json" ]; then
  if grep -q "\"<profile_name>\"" ".planning/profiles.json"; then
    STORAGE_LOCATION="Project"
    PROFILE_FILE=".planning/profiles.json"
    echo "Found profile in project storage: .planning/profiles.json"
  fi
fi
```

**Check global location if not found in project:**
```bash
if [ -z "$STORAGE_LOCATION" ] && [ -f "$HOME/.claude/get-shit-done/profiles.json" ]; then
  if grep -q "\"<profile_name>\"" "$HOME/.claude/get-shit-done/profiles.json"; then
    STORAGE_LOCATION="Global"
    PROFILE_FILE="$HOME/.claude/get-shit-done/profiles.json"
    echo "Found profile in global storage: ~/.claude/get-shit-done/profiles.json"
  fi
fi
```

**If profile not found:**
```bash
if [ -z "$STORAGE_LOCATION" ]; then
  echo "Error: Profile '<profile_name>' not found."
  echo ""
  echo "Checked locations:"
  echo "  - .planning/profiles.json"
  echo "  - ~/.claude/get-shit-done/profiles.json"
  echo ""
  echo "To see available profiles:"
  echo "  /gsd:list-profiles"
  exit 1
fi
```

Store the storage location and file path for use in subsequent steps.
</step>

<step name="load_current_assignments">
Load the current model assignments from the profile.

```bash
# Read the profiles file
PROFILES_JSON=$(cat "$PROFILE_FILE")

# Extract current model assignments using node
CURRENT_PLANNING=$(echo "$PROFILES_JSON" | node -e "
  const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
  const profile = data.profiles['<profile_name>'];
  if (profile && profile.agents && profile.agents.planning) {
    console.log(profile.agents.planning[0]);
  } else {
    console.log('unknown');
  }
")

CURRENT_EXECUTION=$(echo "$PROFILES_JSON" | node -e "
  const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
  const profile = data.profiles['<profile_name>'];
  if (profile && profile.agents && profile.agents.execution) {
    console.log(profile.agents.execution[0]);
  } else {
    console.log('unknown');
  }
")

CURRENT_RESEARCH=$(echo "$PROFILES_JSON" | node -e "
  const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
  const profile = data.profiles['<profile_name>'];
  if (profile && profile.agents && profile.agents.research) {
    console.log(profile.agents.research[0]);
  } else {
    console.log('unknown');
  }
")

echo "Current model assignments:"
echo "  Planning: $CURRENT_PLANNING"
echo "  Execution: $CURRENT_EXECUTION"
echo "  Research: $CURRENT_RESEARCH"
```

Store the current assignments for use in prompts.
</step>

<step name="detect_available_models">
Detect available models from the system:

```bash
MODELS_JSON=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" detect-models --raw)
echo "$MODELS_JSON"
```

Parse the JSON output to get the list of available models. The output will be a JSON array of model identifiers (e.g., ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"]).

If detection fails or returns empty, inform user and exit.
</step>

<step name="prompt_new_model_selections">
For each agent category, prompt for new model selection showing the current value:

**Planning Model:**
```
AskUserQuestion([
  {
    question: "Which model for PLANNING agents? (current: <current_planning_model>)",
    header: "Planning Model",
    multiSelect: false,
    options: [
      // Generate options from detected models, mark current as selected
      { label: "claude-3-opus", description: "Highest quality, highest cost" },
      { label: "claude-3-sonnet", description: "Balanced quality and cost" },
      { label: "claude-3-haiku", description: "Fast, lowest cost" }
      // ... other detected models
    ]
  }
])
```

**Execution Model:**
```
AskUserQuestion([
  {
    question: "Which model for EXECUTION agents? (current: <current_execution_model>)",
    header: "Execution Model",
    multiSelect: false,
    options: [
      // Same options as above
    ]
  }
])
```

**Research Model:**
```
AskUserQuestion([
  {
    question: "Which model for RESEARCH agents? (current: <current_research_model>)",
    header: "Research Model",
    multiSelect: false,
    options: [
      // Same options as above
    ]
  }
])
```

Store all three new selections.
</step>

<step name="update_profile">
Update the profile by directly manipulating the profiles file:

**Read existing profiles:**
```bash
PROFILES_JSON=$(cat "$PROFILE_FILE")
```

**Update model assignments using node:**
```bash
UPDATED_JSON=$(echo "$PROFILES_JSON" | node -e "
  const fs = require('fs');
  const data = JSON.parse(fs.readFileSync(0, 'utf-8'));
  
  if (!data.profiles['<profile_name>']) {
    console.error('Profile not found');
    process.exit(1);
  }
  
  // Update model assignments
  data.profiles['<profile_name>'].agents = {
    planning: ['<new_planning_model>'],
    execution: ['<new_execution_model>'],
    research: ['<new_research_model>']
  };
  
  console.log(JSON.stringify(data, null, 2));
")

# Write the updated JSON back to the file
echo "$UPDATED_JSON" > "$PROFILE_FILE"
```

Do NOT use gsd-tools update-profile command (it uses readline which doesn't work in opencode).
</step>

<step name="confirm">
Display confirmation:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PROFILE UPDATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Profile: <profile_name>
Storage: <Project/Global>
Path: <actual_file_path>

Updated Model Assignments:
| Agent Category | Model |
|----------------|-------|
| Planning       | <new_planning_model> |
| Execution      | <new_execution_model> |
| Research       | <new_research_model> |

To verify the update:
  /gsd:view-profile <profile_name>
```
</step>

</process>

<success_criteria>
- [ ] Profile name argument validated
- [ ] Built-in profile protection enforced
- [ ] Storage location detected correctly
- [ ] Current model assignments loaded
- [ ] Available models detected successfully
- [ ] Models selected for all three categories (with current values shown)
- [ ] Profile updated in correct location via direct file manipulation
- [ ] Confirmation displayed with updated assignments
</success_criteria>
