<purpose>
Interactive creation of custom model profiles with auto-detected models and storage choice. Uses AskUserQuestion for the 3-question flow and directly manipulates profiles file (not gsd-tools readline).
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="detect_available_models">
Detect available models from the system:

```bash
MODELS_JSON=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" detect-models --raw)
echo "$MODELS_JSON"
```

Parse the JSON output to get the list of available models. The output will be a JSON array of model identifiers (e.g., ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"]).

If detection fails or returns empty, inform user and exit.
</step>

<step name="prompt_profile_name">
Prompt user for profile name using AskUserQuestion:

```
AskUserQuestion([
  {
    question: "What would you like to name this profile?",
    header: "Profile Name",
    multiSelect: false,
    options: [
      { label: "my-custom-profile", description: "Enter a custom name (alphanumeric, hyphens, underscores)" }
    ],
    allowCustomInput: true
  }
])
```

Store the response as the profile name. Validate that it contains only alphanumeric characters, hyphens, and underscores.
</step>

<step name="prompt_storage_location">
Prompt user for storage location using AskUserQuestion:

```
AskUserQuestion([
  {
    question: "Where should this profile be stored?",
    header: "Storage",
    multiSelect: false,
    options: [
      { label: "Project", description: "Store in .planning/profiles.json (only available in this project)" },
      { label: "Global", description: "Store in ~/.claude/get-shit-done/profiles.json (available across all projects)" }
    ]
  }
])
```

Store the response as the storage location.
</step>

<step name="prompt_model_selections">
For each agent category (Planning, Execution, Research), prompt for model selection:

**Planning Model:**
```
AskUserQuestion([
  {
    question: "Which model for PLANNING agents?",
    header: "Planning Model",
    multiSelect: false,
    options: [
      // Generate options from detected models
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
    question: "Which model for EXECUTION agents?",
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
    question: "Which model for RESEARCH agents?",
    header: "Research Model",
    multiSelect: false,
    options: [
      // Same options as above
    ]
  }
])
```

Store all three selections.
</step>

<step name="create_profile">
Create the profile by directly manipulating the profiles file:

**Determine target file:**
- If storage is "Project": `.planning/profiles.json`
- If storage is "Global": `$HOME/.claude/get-shit-done/profiles.json`

**Read existing profiles (if file exists):**
```bash
if [ -f "$TARGET_FILE" ]; then
  cat "$TARGET_FILE"
else
  echo "{}"
fi
```

**Build profile structure:**
```json
{
  "profiles": {
    "<profile_name>": {
      "name": "<profile_name>",
      "agents": {
        "planning": ["<selected_planning_model>"],
        "execution": ["<selected_execution_model>"],
        "research": ["<selected_research_model>"]
      }
    }
  }
}
```

**Merge with existing profiles:**
- If profiles file exists, merge the new profile into existing "profiles" object
- If profiles file doesn't exist, create it with the new profile

**Write the file:**
```bash
# Ensure directory exists
mkdir -p "$(dirname "$TARGET_FILE")"

# Write merged profiles JSON
echo "$MERGED_JSON" > "$TARGET_FILE"
```

Do NOT use gsd-tools create-profile command (it uses readline which doesn't work in opencode).
</step>

<step name="confirm">
Display confirmation:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PROFILE CREATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Profile: <profile_name>
Storage: <Project/Global>
Path: <actual_file_path>

Model Assignments:
| Agent Category | Model |
|----------------|-------|
| Planning       | <planning_model> |
| Execution      | <execution_model> |
| Research       | <research_model> |

To use this profile:
  /gsd:set-profile <profile_name>
```
</step>

</process>

<success_criteria>
- [ ] Available models detected successfully
- [ ] Profile name prompted and validated
- [ ] Storage location prompted and selected
- [ ] Models selected for all three categories
- [ ] Profile created in correct location via direct file manipulation
- [ ] Confirmation displayed with storage path
</success_criteria>
