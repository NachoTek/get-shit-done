<purpose>
Display information about the currently active model profile, showing which profile is in use, where it comes from, and providing resolution examples that demonstrate how agents map to models.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="get_profile_info">
Call gsd-tools to retrieve active profile information:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" profile-info
```

This outputs information about the currently active profile including:
- Profile name
- Source (custom/legacy)
- Custom profile status
- Resolution examples
</step>

<step name="format_output">
Parse the gsd-tools output and display formatted result:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► ACTIVE PROFILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Profile: {profile-name}
Source: {custom/legacy}
Custom: {Yes/No}

Resolution Examples:

gsd-planner → {model}
gsd-executor → {model}
gsd-verifier → {model}
{Additional examples if available}

Use /gsd:list-profiles to see all available profiles
Use /gsd:view-profile <name> for detailed mappings
```
</step>

</process>

<success_criteria>
- [ ] gsd-tools profile-info called successfully
- [ ] Active profile name displayed
- [ ] Source and custom status shown
- [ ] Resolution examples provided
</success_criteria>
