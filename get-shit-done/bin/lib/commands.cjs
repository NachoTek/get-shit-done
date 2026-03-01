/**
 * Commands — Standalone utility commands
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { safeReadFile, loadConfig, isGitIgnored, execGit, normalizePhaseName, comparePhaseNum, getArchivedPhaseDirs, generateSlugInternal, getMilestoneInfo, resolveModelWithDetails, MODEL_PROFILES, output, error, findPhaseInternal } = require('./core.cjs');
const { extractFrontmatter } = require('./frontmatter.cjs');
const profiles = require('./profiles.cjs');
const profileResolution = require('./profile-resolution.cjs');
const modelDetection = require('./model-detection.cjs');
const interactivePrompts = require('./interactive-prompts.cjs');

function cmdGenerateSlug(text, raw) {
  if (!text) {
    error('text required for slug generation');
  }

  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const result = { slug };
  output(result, raw, slug);
}

function cmdCurrentTimestamp(format, raw) {
  const now = new Date();
  let result;

  switch (format) {
    case 'date':
      result = now.toISOString().split('T')[0];
      break;
    case 'filename':
      result = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
      break;
    case 'full':
    default:
      result = now.toISOString();
      break;
  }

  output({ timestamp: result }, raw, result);
}

function cmdListTodos(cwd, area, raw) {
  const pendingDir = path.join(cwd, '.planning', 'todos', 'pending');

  let count = 0;
  const todos = [];

  try {
    const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(pendingDir, file), 'utf-8');
        const createdMatch = content.match(/^created:\s*(.+)$/m);
        const titleMatch = content.match(/^title:\s*(.+)$/m);
        const areaMatch = content.match(/^area:\s*(.+)$/m);

        const todoArea = areaMatch ? areaMatch[1].trim() : 'general';

        // Apply area filter if specified
        if (area && todoArea !== area) continue;

        count++;
        todos.push({
          file,
          created: createdMatch ? createdMatch[1].trim() : 'unknown',
          title: titleMatch ? titleMatch[1].trim() : 'Untitled',
          area: todoArea,
          path: path.join('.planning', 'todos', 'pending', file),
        });
      } catch {}
    }
  } catch {}

  const result = { count, todos };
  output(result, raw, count.toString());
}

function cmdVerifyPathExists(cwd, targetPath, raw) {
  if (!targetPath) {
    error('path required for verification');
  }

  const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(cwd, targetPath);

  try {
    const stats = fs.statSync(fullPath);
    const type = stats.isDirectory() ? 'directory' : stats.isFile() ? 'file' : 'other';
    const result = { exists: true, type };
    output(result, raw, 'true');
  } catch {
    const result = { exists: false, type: null };
    output(result, raw, 'false');
  }
}

function cmdHistoryDigest(cwd, raw) {
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const digest = { phases: {}, decisions: [], tech_stack: new Set() };

  // Collect all phase directories: archived + current
  const allPhaseDirs = [];

  // Add archived phases first (oldest milestones first)
  const archived = getArchivedPhaseDirs(cwd);
  for (const a of archived) {
    allPhaseDirs.push({ name: a.name, fullPath: a.fullPath, milestone: a.milestone });
  }

  // Add current phases
  if (fs.existsSync(phasesDir)) {
    try {
      const currentDirs = fs.readdirSync(phasesDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .sort();
      for (const dir of currentDirs) {
        allPhaseDirs.push({ name: dir, fullPath: path.join(phasesDir, dir), milestone: null });
      }
    } catch {}
  }

  if (allPhaseDirs.length === 0) {
    digest.tech_stack = [];
    output(digest, raw);
    return;
  }

  try {
    for (const { name: dir, fullPath: dirPath } of allPhaseDirs) {
      const summaries = fs.readdirSync(dirPath).filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');

      for (const summary of summaries) {
        try {
          const content = fs.readFileSync(path.join(dirPath, summary), 'utf-8');
          const fm = extractFrontmatter(content);

          const phaseNum = fm.phase || dir.split('-')[0];

          if (!digest.phases[phaseNum]) {
            digest.phases[phaseNum] = {
              name: fm.name || dir.split('-').slice(1).join(' ') || 'Unknown',
              provides: new Set(),
              affects: new Set(),
              patterns: new Set(),
            };
          }

          // Merge provides
          if (fm['dependency-graph'] && fm['dependency-graph'].provides) {
            fm['dependency-graph'].provides.forEach(p => digest.phases[phaseNum].provides.add(p));
          } else if (fm.provides) {
            fm.provides.forEach(p => digest.phases[phaseNum].provides.add(p));
          }

          // Merge affects
          if (fm['dependency-graph'] && fm['dependency-graph'].affects) {
            fm['dependency-graph'].affects.forEach(a => digest.phases[phaseNum].affects.add(a));
          }

          // Merge patterns
          if (fm['patterns-established']) {
            fm['patterns-established'].forEach(p => digest.phases[phaseNum].patterns.add(p));
          }

          // Merge decisions
          if (fm['key-decisions']) {
            fm['key-decisions'].forEach(d => {
              digest.decisions.push({ phase: phaseNum, decision: d });
            });
          }

          // Merge tech stack
          if (fm['tech-stack'] && fm['tech-stack'].added) {
            fm['tech-stack'].added.forEach(t => digest.tech_stack.add(typeof t === 'string' ? t : t.name));
          }

        } catch (e) {
          // Skip malformed summaries
        }
      }
    }

    // Convert Sets to Arrays for JSON output
    Object.keys(digest.phases).forEach(p => {
      digest.phases[p].provides = [...digest.phases[p].provides];
      digest.phases[p].affects = [...digest.phases[p].affects];
      digest.phases[p].patterns = [...digest.phases[p].patterns];
    });
    digest.tech_stack = [...digest.tech_stack];

    output(digest, raw);
  } catch (e) {
    error('Failed to generate history digest: ' + e.message);
  }
}

function cmdResolveModel(cwd, agentType, raw) {
  if (!agentType) {
    error('agent-type required');
  }

  const config = loadConfig(cwd);
  const profile = config.model_profile || 'balanced';
  const { model, resolution } = resolveModelWithDetails(cwd, agentType);

  const agentModels = MODEL_PROFILES[agentType];
  const result = agentModels
    ? { model, profile, resolution }
    : { model, profile, resolution, unknown_agent: true };
  output(result, raw, model);
}

function cmdCommit(cwd, message, files, raw, amend) {
  if (!message && !amend) {
    error('commit message required');
  }

  const config = loadConfig(cwd);

  // Check commit_docs config
  if (!config.commit_docs) {
    const result = { committed: false, hash: null, reason: 'skipped_commit_docs_false' };
    output(result, raw, 'skipped');
    return;
  }

  // Check if .planning is gitignored
  if (isGitIgnored(cwd, '.planning')) {
    const result = { committed: false, hash: null, reason: 'skipped_gitignored' };
    output(result, raw, 'skipped');
    return;
  }

  // Stage files
  const filesToStage = files && files.length > 0 ? files : ['.planning/'];
  for (const file of filesToStage) {
    execGit(cwd, ['add', file]);
  }

  // Commit
  const commitArgs = amend ? ['commit', '--amend', '--no-edit'] : ['commit', '-m', message];
  const commitResult = execGit(cwd, commitArgs);
  if (commitResult.exitCode !== 0) {
    if (commitResult.stdout.includes('nothing to commit') || commitResult.stderr.includes('nothing to commit')) {
      const result = { committed: false, hash: null, reason: 'nothing_to_commit' };
      output(result, raw, 'nothing');
      return;
    }
    const result = { committed: false, hash: null, reason: 'nothing_to_commit', error: commitResult.stderr };
    output(result, raw, 'nothing');
    return;
  }

  // Get short hash
  const hashResult = execGit(cwd, ['rev-parse', '--short', 'HEAD']);
  const hash = hashResult.exitCode === 0 ? hashResult.stdout : null;
  const result = { committed: true, hash, reason: 'committed' };
  output(result, raw, hash || 'committed');
}

function cmdSummaryExtract(cwd, summaryPath, fields, raw) {
  if (!summaryPath) {
    error('summary-path required for summary-extract');
  }

  const fullPath = path.join(cwd, summaryPath);

  if (!fs.existsSync(fullPath)) {
    output({ error: 'File not found', path: summaryPath }, raw);
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const fm = extractFrontmatter(content);

  // Parse key-decisions into structured format
  const parseDecisions = (decisionsList) => {
    if (!decisionsList || !Array.isArray(decisionsList)) return [];
    return decisionsList.map(d => {
      const colonIdx = d.indexOf(':');
      if (colonIdx > 0) {
        return {
          summary: d.substring(0, colonIdx).trim(),
          rationale: d.substring(colonIdx + 1).trim(),
        };
      }
      return { summary: d, rationale: null };
    });
  };

  // Build full result
  const fullResult = {
    path: summaryPath,
    one_liner: fm['one-liner'] || null,
    key_files: fm['key-files'] || [],
    tech_added: (fm['tech-stack'] && fm['tech-stack'].added) || [],
    patterns: fm['patterns-established'] || [],
    decisions: parseDecisions(fm['key-decisions']),
    requirements_completed: fm['requirements-completed'] || [],
  };

  // If fields specified, filter to only those fields
  if (fields && fields.length > 0) {
    const filtered = { path: summaryPath };
    for (const field of fields) {
      if (fullResult[field] !== undefined) {
        filtered[field] = fullResult[field];
      }
    }
    output(filtered, raw);
    return;
  }

  output(fullResult, raw);
}

async function cmdWebsearch(query, options, raw) {
  const apiKey = process.env.BRAVE_API_KEY;

  if (!apiKey) {
    // No key = silent skip, agent falls back to built-in WebSearch
    output({ available: false, reason: 'BRAVE_API_KEY not set' }, raw, '');
    return;
  }

  if (!query) {
    output({ available: false, error: 'Query required' }, raw, '');
    return;
  }

  const params = new URLSearchParams({
    q: query,
    count: String(options.limit || 10),
    country: 'us',
    search_lang: 'en',
    text_decorations: 'false'
  });

  if (options.freshness) {
    params.set('freshness', options.freshness);
  }

  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?${params}`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': apiKey
        }
      }
    );

    if (!response.ok) {
      output({ available: false, error: `API error: ${response.status}` }, raw, '');
      return;
    }

    const data = await response.json();

    const results = (data.web?.results || []).map(r => ({
      title: r.title,
      url: r.url,
      description: r.description,
      age: r.age || null
    }));

    output({
      available: true,
      query,
      count: results.length,
      results
    }, raw, results.map(r => `${r.title}\n${r.url}\n${r.description}`).join('\n\n'));
  } catch (err) {
    output({ available: false, error: err.message }, raw, '');
  }
}

function cmdProgressRender(cwd, format, raw) {
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const milestone = getMilestoneInfo(cwd);

  const phases = [];
  let totalPlans = 0;
  let totalSummaries = 0;

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort((a, b) => comparePhaseNum(a, b));

    for (const dir of dirs) {
      const dm = dir.match(/^(\d+(?:\.\d+)*)-?(.*)/);
      const phaseNum = dm ? dm[1] : dir;
      const phaseName = dm && dm[2] ? dm[2].replace(/-/g, ' ') : '';
      const phaseFiles = fs.readdirSync(path.join(phasesDir, dir));
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').length;
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').length;

      totalPlans += plans;
      totalSummaries += summaries;

      let status;
      if (plans === 0) status = 'Pending';
      else if (summaries >= plans) status = 'Complete';
      else if (summaries > 0) status = 'In Progress';
      else status = 'Planned';

      phases.push({ number: phaseNum, name: phaseName, plans, summaries, status });
    }
  } catch {}

  const percent = totalPlans > 0 ? Math.min(100, Math.round((totalSummaries / totalPlans) * 100)) : 0;

  if (format === 'table') {
    // Render markdown table
    const barWidth = 10;
    const filled = Math.round((percent / 100) * barWidth);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
    let out = `# ${milestone.version} ${milestone.name}\n\n`;
    out += `**Progress:** [${bar}] ${totalSummaries}/${totalPlans} plans (${percent}%)\n\n`;
    out += `| Phase | Name | Plans | Status |\n`;
    out += `|-------|------|-------|--------|\n`;
    for (const p of phases) {
      out += `| ${p.number} | ${p.name} | ${p.summaries}/${p.plans} | ${p.status} |\n`;
    }
    output({ rendered: out }, raw, out);
  } else if (format === 'bar') {
    const barWidth = 20;
    const filled = Math.round((percent / 100) * barWidth);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
    const text = `[${bar}] ${totalSummaries}/${totalPlans} plans (${percent}%)`;
    output({ bar: text, percent, completed: totalSummaries, total: totalPlans }, raw, text);
  } else {
    // JSON format
    output({
      milestone_version: milestone.version,
      milestone_name: milestone.name,
      phases,
      total_plans: totalPlans,
      total_summaries: totalSummaries,
      percent,
    }, raw);
  }
}

function cmdTodoComplete(cwd, filename, raw) {
  if (!filename) {
    error('filename required for todo complete');
  }

  const pendingDir = path.join(cwd, '.planning', 'todos', 'pending');
  const completedDir = path.join(cwd, '.planning', 'todos', 'completed');
  const sourcePath = path.join(pendingDir, filename);

  if (!fs.existsSync(sourcePath)) {
    error(`Todo not found: ${filename}`);
  }

  // Ensure completed directory exists
  fs.mkdirSync(completedDir, { recursive: true });

  // Read, add completion timestamp, move
  let content = fs.readFileSync(sourcePath, 'utf-8');
  const today = new Date().toISOString().split('T')[0];
  content = `completed: ${today}\n` + content;

  fs.writeFileSync(path.join(completedDir, filename), content, 'utf-8');
  fs.unlinkSync(sourcePath);

  output({ completed: true, file: filename, date: today }, raw, 'completed');
}

function cmdScaffold(cwd, type, options, raw) {
  const { phase, name } = options;
  const padded = phase ? normalizePhaseName(phase) : '00';
  const today = new Date().toISOString().split('T')[0];

  // Find phase directory
  const phaseInfo = phase ? findPhaseInternal(cwd, phase) : null;
  const phaseDir = phaseInfo ? path.join(cwd, phaseInfo.directory) : null;

  if (phase && !phaseDir && type !== 'phase-dir') {
    error(`Phase ${phase} directory not found`);
  }

  let filePath, content;

  switch (type) {
    case 'context': {
      filePath = path.join(phaseDir, `${padded}-CONTEXT.md`);
      content = `---\nphase: "${padded}"\nname: "${name || phaseInfo?.phase_name || 'Unnamed'}"\ncreated: ${today}\n---\n\n# Phase ${phase}: ${name || phaseInfo?.phase_name || 'Unnamed'} — Context\n\n## Decisions\n\n_Decisions will be captured during /gsd:discuss_phase ${phase}_\n\n## Discretion Areas\n\n_Areas where the executor can use judgment_\n\n## Deferred Ideas\n\n_Ideas to consider later_\n`;
      break;
    }
    case 'uat': {
      filePath = path.join(phaseDir, `${padded}-UAT.md`);
      content = `---\nphase: "${padded}"\nname: "${name || phaseInfo?.phase_name || 'Unnamed'}"\ncreated: ${today}\nstatus: pending\n---\n\n# Phase ${phase}: ${name || phaseInfo?.phase_name || 'Unnamed'} — User Acceptance Testing\n\n## Test Results\n\n| # | Test | Status | Notes |\n|---|------|--------|-------|\n\n## Summary\n\n_Pending UAT_\n`;
      break;
    }
    case 'verification': {
      filePath = path.join(phaseDir, `${padded}-VERIFICATION.md`);
      content = `---\nphase: "${padded}"\nname: "${name || phaseInfo?.phase_name || 'Unnamed'}"\ncreated: ${today}\nstatus: pending\n---\n\n# Phase ${phase}: ${name || phaseInfo?.phase_name || 'Unnamed'} — Verification\n\n## Goal-Backward Verification\n\n**Phase Goal:** [From ROADMAP.md]\n\n## Checks\n\n| # | Requirement | Status | Evidence |\n|---|------------|--------|----------|\n\n## Result\n\n_Pending verification_\n`;
      break;
    }
    case 'phase-dir': {
      if (!phase || !name) {
        error('phase and name required for phase-dir scaffold');
      }
      const slug = generateSlugInternal(name);
      const dirName = `${padded}-${slug}`;
      const phasesParent = path.join(cwd, '.planning', 'phases');
      fs.mkdirSync(phasesParent, { recursive: true });
      const dirPath = path.join(phasesParent, dirName);
      fs.mkdirSync(dirPath, { recursive: true });
      output({ created: true, directory: `.planning/phases/${dirName}`, path: dirPath }, raw, dirPath);
      return;
    }
    default:
      error(`Unknown scaffold type: ${type}. Available: context, uat, verification, phase-dir`);
  }

  if (fs.existsSync(filePath)) {
    output({ created: false, reason: 'already_exists', path: filePath }, raw, 'exists');
    return;
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  const relPath = path.relative(cwd, filePath);
  output({ created: true, path: relPath }, raw, relPath);
}

// ─── List Profiles Command ────────────────────────────────────────────────────────

function showListProfilesHelp() {
  const help = `Usage: gsd-tools list-profiles [--raw]

List all available profiles with their model assignments.

Options:
  --raw    Output as JSON for programmatic use

Examples:
  gsd-tools list-profiles
  gsd-tools list-profiles --raw

Output columns:
  Name      - Profile name
  Source    - global, project, or built-in
  Status    - ACTIVE if currently selected
  Planning  - Model for planning agents
  Execution - Model for execution agents
  Research  - Model for research agents
`;
  process.stdout.write(help);
}

function cmdListProfiles(cwd, raw) {
  // Load config to get active profile info
  const config = loadConfig(cwd);
  const activeCustomProfile = config.model_profile_name;
  const activeLegacyProfile = config.model_profile;
  
  // Load all custom profiles (merged global + project)
  const allProfiles = profiles.loadAllProfiles(cwd);
  
  // Build profile list with source attribution
  const profileList = [];
  
  // Add custom profiles with source tracking
  if (allProfiles.globalLoaded) {
    for (const profile of allProfiles.profiles) {
      // Check if this profile came from global (not overridden by project)
      // Since merge happens, we need to track which profiles were loaded from where
      // Simplified: use the result paths to determine source
      // Actually, loadAllProfiles returns merged profiles. We need to track source during merge.
      // Let's check: if globalPath has profiles that aren't in projectPath, they're global.
      // For simplicity, we'll use a different approach - check if profile exists in project
      const projectResult = profiles.loadProjectProfiles(cwd);
      const projectNames = new Set(projectResult.profiles.map(p => p.name));
      
      // Determine if this profile is from global or project
      let source = 'global';
      if (projectNames.has(profile.name)) {
        source = 'project';
      }
      
      const isActive = profile.name === activeCustomProfile;
      const isLegacyActive = !activeCustomProfile && profile.name === activeLegacyProfile;
      
      profileList.push({
        name: profile.name,
        source: source,
        active: isActive || isLegacyActive,
        agents: {
          planning: profile.agents?.planning?.[0] || '-',
          execution: profile.agents?.execution?.[0] || '-',
          research: profile.agents?.research?.[0] || '-',
        },
      });
    }
  }
  
  // Add built-in legacy profiles
  const legacyProfiles = ['quality', 'balanced', 'budget'];
  for (const legacyName of legacyProfiles) {
    // Get models from MODEL_PROFILES for each category
    const planningAgents = ['gsd-planner', 'gsd-roadmapper'];
    const executionAgents = ['gsd-executor', 'gsd-debugger'];
    const researchAgents = ['gsd-phase-researcher', 'gsd-project-researcher', 'gsd-research-synthesizer', 'gsd-codebase-mapper', 'gsd-verifier', 'gsd-plan-checker', 'gsd-integration-checker'];
    
    // Use first agent in each category to get the model
    const planningModel = MODEL_PROFILES[planningAgents[0]]?.[legacyName] || '-';
    const executionModel = MODEL_PROFILES[executionAgents[0]]?.[legacyName] || '-';
    const researchModel = MODEL_PROFILES[researchAgents[0]]?.[legacyName] || '-';
    
    const isActive = !activeCustomProfile && legacyName === activeLegacyProfile;
    
    profileList.push({
      name: legacyName,
      source: 'built-in',
      active: isActive,
      agents: {
        planning: planningModel,
        execution: executionModel,
        research: researchModel,
      },
    });
  }
  
  if (raw) {
    output({ profiles: profileList }, raw);
    return;
  }
  
  // Human-readable table - write directly to stdout (output() always returns JSON when raw=false)
  const nameWidth = Math.max(10, ...profileList.map(p => p.name.length));
  const sourceWidth = Math.max(8, ...profileList.map(p => p.source.length));
  const planningWidth = Math.max(10, ...profileList.map(p => p.agents.planning.length));
  const executionWidth = Math.max(10, ...profileList.map(p => p.agents.execution.length));
  const researchWidth = Math.max(10, ...profileList.map(p => p.agents.research.length));
  
  const header = [
    'Name'.padEnd(nameWidth),
    'Source'.padEnd(sourceWidth),
    'Status',
    'Planning'.padEnd(planningWidth),
    'Execution'.padEnd(executionWidth),
    'Research'.padEnd(researchWidth),
  ].join('  ');
  
  const separator = [
    '='.repeat(nameWidth),
    '='.repeat(sourceWidth),
    '======',
    '='.repeat(planningWidth),
    '='.repeat(executionWidth),
    '='.repeat(researchWidth),
  ].join('  ');
  
  const rows = profileList.map(p => [
    p.name.padEnd(nameWidth),
    p.source.padEnd(sourceWidth),
    p.active ? 'ACTIVE' : '',
    p.agents.planning.padEnd(planningWidth),
    p.agents.execution.padEnd(executionWidth),
    p.agents.research.padEnd(researchWidth),
  ].join('  '));
  
  const table = [header, separator, ...rows].join('\n');
  process.stdout.write(table + '\n');
}

// ─── View Profile Command ─────────────────────────────────────────────────────────

function showViewProfileHelp() {
  const help = `Usage: gsd-tools view-profile <profile-name> [--raw]

View detailed information about a profile, including which model
each agent will use when this profile is active.

Arguments:
  profile-name  Name of the profile to view

Options:
  --raw         Output as JSON for programmatic use

Examples:
  gsd-tools view-profile my-custom
  gsd-tools view-profile balanced
  gsd-tools view-profile quality --raw

Use "gsd-tools list-profiles" to see all available profiles.
`;
  process.stdout.write(help);
}

function cmdViewProfile(cwd, profileName, raw) {
  // If no profile name, show help
  if (!profileName) {
    showViewProfileHelp();
    return;
  }
  
  // Load config for active profile check
  const config = loadConfig(cwd);
  const activeCustomProfile = config.model_profile_name;
  const activeLegacyProfile = config.model_profile;
  
  // Check if it's a custom profile first
  const customProfile = profileResolution.findCustomProfile(cwd, profileName);
  
  let profileData;
  
  if (customProfile) {
    // It's a custom profile
    const isActive = customProfile.name === activeCustomProfile;
    
    // Determine source
    const projectResult = profiles.loadProjectProfiles(cwd);
    const projectNames = new Set(projectResult.profiles.map(p => p.name));
    const source = projectNames.has(customProfile.name) ? 'project' : 'global';
    
    // Build expanded agents object from CATEGORY_AGENTS
    const agents = {};
    for (const [category, agentList] of Object.entries(profileResolution.CATEGORY_AGENTS)) {
      const model = customProfile.agents?.[category]?.[0] || null;
      if (model) {
        for (const agent of agentList) {
          agents[agent] = model;
        }
      }
    }
    
    profileData = {
      name: customProfile.name,
      active: isActive,
      source: source,
      categories: {
        planning: customProfile.agents?.planning?.[0] || '-',
        execution: customProfile.agents?.execution?.[0] || '-',
        research: customProfile.agents?.research?.[0] || '-',
      },
      agents: agents,
    };
  } else {
    // Check if it's a legacy profile
    const legacyProfiles = ['quality', 'balanced', 'budget'];
    if (!legacyProfiles.includes(profileName)) {
      output({ error: `Profile '${profileName}' not found` }, raw);
      return;
    }
    
    // It's a legacy profile
    const isActive = !activeCustomProfile && profileName === activeLegacyProfile;
    
    // Build categories and agents from MODEL_PROFILES
    const categories = {};
    const agents = {};
    
    for (const [agentType, profileModels] of Object.entries(MODEL_PROFILES)) {
      const model = profileModels[profileName];
      if (model) {
        const category = profileResolution.getAgentCategory(agentType);
        if (category) {
          if (!categories[category]) {
            categories[category] = model;
          }
          agents[agentType] = model;
        }
      }
    }
    
    profileData = {
      name: profileName,
      active: isActive,
      source: 'built-in',
      categories: {
        planning: categories.planning || '-',
        execution: categories.execution || '-',
        research: categories.research || '-',
      },
      agents: agents,
    };
  }
  
  if (raw) {
    output(profileData, raw);
    return;
  }
  
  // Human-readable format - write directly to stdout
  let text = `Profile: ${profileData.name}\n`;
  text += `Source: ${profileData.source}\n`;
  text += `Active: ${profileData.active ? 'Yes' : 'No'}\n\n`;
  
  text += `Categories:\n`;
  text += `  Planning:  ${profileData.categories.planning}\n`;
  text += `  Execution: ${profileData.categories.execution}\n`;
  text += `  Research:  ${profileData.categories.research}\n\n`;
  
  text += `Agents:\n`;
  for (const [agent, model] of Object.entries(profileData.agents)) {
    text += `  ${agent.padEnd(30)} ${model}\n`;
  }
  
  process.stdout.write(text);
}

// ─── Update Profile Command ───────────────────────────────────────────────────────

function showUpdateProfileHelp() {
  const help = `Usage: gsd-tools update-profile <profile-name> [--raw]

Update an existing custom profile's model assignments.

Arguments:
  profile-name  Name of the profile to update (required)

Options:
  --raw         Output as JSON for programmatic use

Examples:
  gsd-tools update-profile my-custom
  gsd-tools update-profile my-custom --raw

Notes:
  - Built-in profiles (quality, balanced, budget) cannot be modified
  - Use "gsd-tools list-profiles" to see available profiles
  - Interactive prompts will ask for new model selections
`;
  process.stdout.write(help);
}

async function cmdUpdateProfile(cwd, profileName, raw) {
  // If no profile name, show help
  if (!profileName) {
    showUpdateProfileHelp();
    return;
  }

  // Check if it's a built-in profile (quality/balanced/budget)
  const builtInProfiles = ['quality', 'balanced', 'budget'];
  if (builtInProfiles.includes(profileName.toLowerCase())) {
    const errorMsg = `Built-in profiles (quality, balanced, budget) cannot be modified. Create a custom profile instead.`;
    if (raw) {
      output({ error: errorMsg }, raw);
    } else {
      error(errorMsg);
    }
    return;
  }

  // Find the custom profile
  const profile = profileResolution.findCustomProfile(cwd, profileName);
  if (!profile) {
    const errorMsg = `Profile '${profileName}' not found. Use 'gsd-tools list-profiles' to see available profiles.`;
    if (raw) {
      output({ error: errorMsg }, raw);
    } else {
      error(errorMsg);
    }
    return;
  }

  // Determine source (global vs project) by checking project storage first
  const projectResult = profiles.loadProjectProfiles(cwd);
  const projectNames = new Set(projectResult.profiles.map(p => p.name));
  const storageLocation = projectNames.has(profileName) ? 'project' : 'global';

  // Display current model assignments
  if (!raw) {
    process.stdout.write(`Updating profile: ${profileName}\n`);
    process.stdout.write(`Source: ${storageLocation}\n\n`);
    process.stdout.write(`Current model assignments:\n`);
    process.stdout.write(`  Planning:  ${profile.agents?.planning?.[0] || '-'}\n`);
    process.stdout.write(`  Execution: ${profile.agents?.execution?.[0] || '-'}\n`);
    process.stdout.write(`  Research:  ${profile.agents?.research?.[0] || '-'}\n\n`);
    process.stdout.write(`Enter new model selections:\n\n`);
  }

  // Detect available models
  const detection = modelDetection.detectAvailableModels(cwd);
  const availableModels = detection.models;
  const modelNames = new Set(availableModels.map(m => m.name));

  // Get new model selections via interactive prompts
  const selections = await interactivePrompts.promptThreeQuestionFlow(availableModels);

  // Build updated profile object
  const updatedProfile = {
    name: profileName,
    agents: {
      planning: selections.planning ? [selections.planning] : [],
      execution: selections.execution ? [selections.execution] : [],
      research: selections.research ? [selections.research] : []
    }
  };

  // Validate profile structure
  const validation = profiles.validateProfile(updatedProfile);
  if (!validation.valid) {
    const errorMsg = 'Invalid profile structure:\n' + validation.errors.join('\n');
    if (raw) {
      output({ error: errorMsg }, raw);
    } else {
      error(errorMsg);
    }
    return;
  }

  // Validate model names against available models
  const missingModels = [];
  const selectedModels = [
    ...updatedProfile.agents.planning,
    ...updatedProfile.agents.execution,
    ...updatedProfile.agents.research
  ];

  for (const modelName of selectedModels) {
    if (!modelNames.has(modelName)) {
      missingModels.push(modelName);
    }
  }

  if (missingModels.length > 0) {
    const errorMsg = `Model(s) not available: ${missingModels.join(', ')}\nAvailable models: ${Array.from(modelNames).join(', ')}`;
    if (raw) {
      output({ error: errorMsg }, raw);
    } else {
      error(errorMsg);
    }
    return;
  }

  // Load profiles from original storage location
  let existingProfiles;
  if (storageLocation === 'global') {
    const loadResult = profiles.loadGlobalProfiles(detection.runtime);
    if (loadResult.errors.length > 0) {
      const errorMsg = 'Failed to load global profiles:\n' + loadResult.errors.join('\n');
      if (raw) {
        output({ error: errorMsg }, raw);
      } else {
        error(errorMsg);
      }
      return;
    }
    existingProfiles = loadResult.profiles;
  } else {
    const loadResult = profiles.loadProjectProfiles(cwd);
    if (loadResult.errors.length > 0) {
      const errorMsg = 'Failed to load project profiles:\n' + loadResult.errors.join('\n');
      if (raw) {
        output({ error: errorMsg }, raw);
      } else {
        error(errorMsg);
      }
      return;
    }
    existingProfiles = loadResult.profiles;
  }

  // Find and update the profile in the array
  const profileIndex = existingProfiles.findIndex(p => p.name === profileName);
  if (profileIndex === -1) {
    const errorMsg = `Profile '${profileName}' not found in ${storageLocation} storage.`;
    if (raw) {
      output({ error: errorMsg }, raw);
    } else {
      error(errorMsg);
    }
    return;
  }

  existingProfiles[profileIndex] = updatedProfile;

  // Save profiles to original storage location
  let saveResult;
  if (storageLocation === 'global') {
    saveResult = profiles.saveGlobalProfiles(detection.runtime, existingProfiles);
  } else {
    saveResult = profiles.saveProjectProfiles(cwd, existingProfiles);
  }

  if (!saveResult.saved) {
    const errorMsg = 'Failed to save profile:\n' + saveResult.errors.join('\n');
    if (raw) {
      output({ error: errorMsg }, raw);
    } else {
      error(errorMsg);
    }
    return;
  }

  // Output success
  const result = {
    updated: true,
    profile: profileName,
    storage: storageLocation,
    path: saveResult.path,
    agents: updatedProfile.agents
  };

  if (raw) {
    output(result, raw);
  } else {
    process.stdout.write(`\nProfile '${profileName}' updated successfully.\n\n`);
    process.stdout.write(`New model assignments:\n`);
    process.stdout.write(`  Planning:  ${updatedProfile.agents.planning?.[0] || '-'}\n`);
    process.stdout.write(`  Execution: ${updatedProfile.agents.execution?.[0] || '-'}\n`);
    process.stdout.write(`  Research:  ${updatedProfile.agents.research?.[0] || '-'}\n`);
  }
}

module.exports = {
  cmdGenerateSlug,
  cmdCurrentTimestamp,
  cmdListTodos,
  cmdVerifyPathExists,
  cmdHistoryDigest,
  cmdResolveModel,
  cmdCommit,
  cmdSummaryExtract,
  cmdWebsearch,
  cmdProgressRender,
  cmdTodoComplete,
  cmdScaffold,
  // Profile commands
  showListProfilesHelp,
  cmdListProfiles,
  showViewProfileHelp,
  cmdViewProfile,
  showUpdateProfileHelp,
  cmdUpdateProfile,
};
