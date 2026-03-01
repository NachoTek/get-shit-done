/**
 * Profiles — Custom model profile storage
 *
 * Uses Node.js built-ins only. No external dependencies.
 * Follows existing codebase patterns from core.cjs.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Path Helpers ──────────────────────────────────────────────────────────────

/**
 * Get global profiles path for the current runtime
 * @param {string} runtime - 'claude' | 'opencode' | 'gemini' | 'codex'
 * @returns {string} Path to global profiles.json
 */
function getGlobalProfilesPath(runtime = 'claude') {
  const homedir = os.homedir();
  const runtimePaths = {
    claude: path.join(homedir, '.claude', 'get-shit-done', 'profiles.json'),
    opencode: path.join(homedir, '.config', 'opencode', 'get-shit-done', 'profiles.json'),
    gemini: path.join(homedir, '.gemini', 'get-shit-done', 'profiles.json'),
    codex: path.join(homedir, '.codex', 'get-shit-done', 'profiles.json'),
  };
  return runtimePaths[runtime] || runtimePaths.claude;
}

/**
 * Get project profiles path
 * @param {string} cwd - Project root directory
 * @returns {string} Path to project profiles.json
 */
function getProjectProfilesPath(cwd) {
  return path.join(cwd, '.planning', 'profiles.json');
}

// ─── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate a single profile object
 * @param {object} profile - Profile to validate
 * @param {number} index - Index in array (for error messages)
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateProfile(profile, index = 0) {
  const errors = [];
  const prefix = `profiles[${index}]`;

  // Must be an object
  if (!profile || typeof profile !== 'object') {
    return { valid: false, errors: [`${prefix}: must be an object`] };
  }

  // Required: name
  if (!profile.name || typeof profile.name !== 'string') {
    errors.push(`${prefix}.name: required string`);
  } else {
    // Name format: alphanumeric, hyphens, underscores only
    if (!/^[a-zA-Z0-9_-]+$/.test(profile.name)) {
      errors.push(`${prefix}.name: must contain only alphanumeric, hyphens, underscores`);
    }
    // Name length
    if (profile.name.length > 64) {
      errors.push(`${prefix}.name: max 64 characters`);
    }
  }

  // Required: agents
  if (!profile.agents || typeof profile.agents !== 'object') {
    errors.push(`${prefix}.agents: required object with planning, execution, research`);
  } else {
    // Required categories
    const categories = ['planning', 'execution', 'research'];
    for (const cat of categories) {
      if (!Array.isArray(profile.agents[cat])) {
        errors.push(`${prefix}.agents.${cat}: required array`);
      } else {
        // Validate each model string
        for (let i = 0; i < profile.agents[cat].length; i++) {
          const model = profile.agents[cat][i];
          if (typeof model !== 'string' || model.length === 0) {
            errors.push(`${prefix}.agents.${cat}[${i}]: must be non-empty string`);
          } else if (model.length > 128) {
            errors.push(`${prefix}.agents.${cat}[${i}]: max 128 characters`);
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a profiles file structure
 * @param {object} data - Parsed JSON data
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateProfilesFile(data) {
  const errors = [];

  // Must be an object
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['root: must be an object'] };
  }

  // Required: profiles array
  if (!Array.isArray(data.profiles)) {
    return { valid: false, errors: ['profiles: required array'] };
  }

  // Check for duplicate names
  const names = new Set();

  // Validate each profile
  for (let i = 0; i < data.profiles.length; i++) {
    const result = validateProfile(data.profiles[i], i);
    errors.push(...result.errors);

    if (data.profiles[i]?.name) {
      if (names.has(data.profiles[i].name)) {
        errors.push(`profiles[${i}]: duplicate profile name "${data.profiles[i].name}"`);
      }
      names.add(data.profiles[i].name);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── File Operations ────────────────────────────────────────────────────────────

/**
 * Load profiles from a file
 * @param {string} filePath - Path to profiles.json
 * @returns {{ profiles: Array, errors: string[], source: string }}
 */
function loadProfilesFile(filePath) {
  // Return empty if file doesn't exist
  if (!fs.existsSync(filePath)) {
    return { profiles: [], errors: [], source: 'not_found' };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Validate
    const result = validateProfilesFile(data);
    if (!result.valid) {
      return { profiles: [], errors: result.errors, source: 'validation_failed' };
    }

    return { profiles: data.profiles || [], errors: [], source: 'loaded' };
  } catch (err) {
    return {
      profiles: [],
      errors: [`Failed to load ${filePath}: ${err.message}`],
      source: 'error'
    };
  }
}

/**
 * Save profiles to a file with atomic write (temp file + rename)
 * @param {string} filePath - Path to profiles.json
 * @param {Array} profiles - Array of profile objects
 * @returns {{ saved: boolean, errors: string[], path: string }}
 */
function saveProfilesFile(filePath, profiles) {
  // Validate before saving
  const result = validateProfilesFile({ profiles });
  if (!result.valid) {
    return { saved: false, errors: result.errors, path: filePath };
  }

  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write to temp file first (atomic write pattern)
    const tempPath = filePath + '.tmp';
    const content = JSON.stringify({ profiles }, null, 2);

    fs.writeFileSync(tempPath, content, 'utf-8');

    // Rename is atomic on most filesystems
    fs.renameSync(tempPath, filePath);

    return { saved: true, errors: [], path: filePath };
  } catch (err) {
    return {
      saved: false,
      errors: [`Failed to save ${filePath}: ${err.message}`],
      path: filePath
    };
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Load profiles from global storage
 * @param {string} runtime - Runtime identifier
 * @returns {{ profiles: Array, errors: string[], source: string, path: string }}
 */
function loadGlobalProfiles(runtime = 'claude') {
  const filePath = getGlobalProfilesPath(runtime);
  const result = loadProfilesFile(filePath);
  return { ...result, path: filePath };
}

/**
 * Load profiles from project storage
 * @param {string} cwd - Project root directory
 * @returns {{ profiles: Array, errors: string[], source: string, path: string }}
 */
function loadProjectProfiles(cwd) {
  const filePath = getProjectProfilesPath(cwd);
  const result = loadProfilesFile(filePath);
  return { ...result, path: filePath };
}

/**
 * Load and merge profiles from both global and project storage
 * Project profiles with same name override global profiles entirely.
 * @param {string} cwd - Project root directory
 * @param {string} runtime - Runtime identifier
 * @returns {{ profiles: Array, errors: string[], globalPath: string, projectPath: string }}
 */
function loadAllProfiles(cwd, runtime = 'claude') {
  const globalResult = loadGlobalProfiles(runtime);
  const projectResult = loadProjectProfiles(cwd);

  // Merge: project profiles override global with same name
  const merged = mergeProfiles(globalResult.profiles, projectResult.profiles);

  // Collect errors
  const errors = [
    ...globalResult.errors.map(e => `[global] ${e}`),
    ...projectResult.errors.map(e => `[project] ${e}`),
  ];

  return {
    profiles: merged,
    errors,
    globalPath: globalResult.path,
    projectPath: projectResult.path,
    globalLoaded: globalResult.source === 'loaded',
    projectLoaded: projectResult.source === 'loaded',
  };
}

/**
 * Merge global and project profiles
 * Project profiles with same name replace global profiles entirely.
 * @param {Array} globalProfiles - Profiles from global storage
 * @param {Array} projectProfiles - Profiles from project storage
 * @returns {Array} Merged profiles
 */
function mergeProfiles(globalProfiles = [], projectProfiles = []) {
  const global = Array.isArray(globalProfiles) ? globalProfiles : [];
  const project = Array.isArray(projectProfiles) ? projectProfiles : [];

  // Create map from project profiles for O(1) lookup
  const projectMap = new Map(project.map(p => [p.name, p]));

  // Start with global profiles, override with project
  const merged = [];

  // Add global profiles (unless overridden by project)
  for (const gp of global) {
    if (projectMap.has(gp.name)) {
      // Project profile replaces global entirely
      merged.push(projectMap.get(gp.name));
      projectMap.delete(gp.name);
    } else {
      merged.push(gp);
    }
  }

  // Add remaining project-only profiles
  for (const pp of projectMap.values()) {
    merged.push(pp);
  }

  return merged;
}

/**
 * Save profiles to global storage
 * @param {string} runtime - Runtime identifier
 * @param {Array} profiles - Array of profile objects
 * @returns {{ saved: boolean, errors: string[], path: string }}
 */
function saveGlobalProfiles(runtime = 'claude', profiles) {
  const filePath = getGlobalProfilesPath(runtime);
  return saveProfilesFile(filePath, profiles);
}

/**
 * Save profiles to project storage
 * @param {string} cwd - Project root directory
 * @param {Array} profiles - Array of profile objects
 * @returns {{ saved: boolean, errors: string[], path: string }}
 */
function saveProjectProfiles(cwd, profiles) {
  const filePath = getProjectProfilesPath(cwd);
  return saveProfilesFile(filePath, profiles);
}

/**
 * Check if a profile with given name exists
 * @param {string} cwd - Project root directory
 * @param {string} name - Profile name to check
 * @param {string} runtime - Runtime identifier
 * @returns {{ exists: boolean, source: 'global' | 'project' | null }}
 */
function profileExists(cwd, name, runtime = 'claude') {
  const globalResult = loadGlobalProfiles(runtime);
  const projectResult = loadProjectProfiles(cwd);

  const projectNames = new Set(projectResult.profiles.map(p => p.name));
  if (projectNames.has(name)) {
    return { exists: true, source: 'project' };
  }

  const globalNames = new Set(globalResult.profiles.map(p => p.name));
  if (globalNames.has(name)) {
    return { exists: true, source: 'global' };
  }

  return { exists: false, source: null };
}

module.exports = {
  // Path helpers
  getGlobalProfilesPath,
  getProjectProfilesPath,

  // Validation
  validateProfile,
  validateProfilesFile,

  // Load operations
  loadGlobalProfiles,
  loadProjectProfiles,
  loadAllProfiles,

  // Save operations
  saveGlobalProfiles,
  saveProjectProfiles,

  // Merge
  mergeProfiles,

  // Utilities
  profileExists,
};
