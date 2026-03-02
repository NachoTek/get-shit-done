<purpose>
List all available model profiles (custom + legacy) with visibility into which profile is active, where each profile comes from (custom/legacy), and the agent-to-model mappings for each profile.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="list_profiles">
Call gsd-tools to retrieve all profiles:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" list-profiles
```

This outputs structured data about all available profiles including:
- Profile names
- Source (custom/legacy)
- Active indicator
- Agent-to-model mappings
</step>

<step name="format_output">
Parse the gsd-tools output and format as a readable table:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AVAILABLE PROFILES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Profile | Source | Active | Agents |
|---------|--------|--------|--------|
| {name} | {custom/legacy} | {✓ if active} | {agent count or key models} |
| ... | ... | ... | ... |

Legend:
- Source: custom = user-defined, legacy = built-in preset
- Active: ✓ = currently in use
```

Include agent-to-model details for each profile when available.
</step>

</process>

<success_criteria>
- [ ] gsd-tools list-profiles called successfully
- [ ] Output formatted as readable table
- [ ] Active profile clearly indicated
- [ ] Source attribution shown for each profile
</success_criteria>
