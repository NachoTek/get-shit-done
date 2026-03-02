<purpose>
View detailed configuration of a specific model profile, showing the complete agent-to-model mapping and profile metadata. Requires profile name as argument.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="validate_argument">
Validate that profile argument is provided:

```
if not $ARGUMENTS.profile:
  Error: Profile name required
  Usage: /gsd:view-profile <profile-name>
  Use /gsd:list-profiles to see available profiles
  EXIT
```
</step>

<step name="view_profile">
Call gsd-tools to retrieve profile details:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" view-profile "$ARGUMENTS.profile"
```

This outputs detailed profile configuration including:
- Profile name and source
- Agent-to-model mappings
- Profile metadata
</step>

<step name="format_output">
Parse the gsd-tools output and display formatted result:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PROFILE: {profile-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Source: {custom/legacy}
Status: {active/inactive}

Agent-to-Model Mappings:

| Agent | Model |
|-------|-------|
| {agent} | {model} |
| ... | ... |

{Additional metadata if available}
```
</step>

</process>

<success_criteria>
- [ ] Argument validated (profile name present)
- [ ] gsd-tools view-profile called with profile name
- [ ] Output formatted showing agent-to-model mappings
- [ ] Error handling for missing argument
</success_criteria>
