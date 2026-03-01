/**
 * Profile Storage Unit Tests
 * Tests for profiles.cjs module - profile load, save, merge, and validation
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  getGlobalProfilesPath,
  getProjectProfilesPath,
  validateProfile,
  validateProfilesFile,
  loadGlobalProfiles,
  loadProjectProfiles,
  loadAllProfiles,
  saveGlobalProfiles,
  saveProjectProfiles,
  mergeProfiles,
} = require('../get-shit-done/bin/lib/profiles.cjs');

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-profiles-test-'));
}

function cleanup(dir) {
  if (dir && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function createValidProfile(name = 'test-profile') {
  return {
    name,
    agents: {
      planning: ['claude-3-5-sonnet-20241022'],
      execution: ['claude-3-5-haiku-20241022'],
      research: ['claude-3-opus-20240229'],
    },
  };
}

// ─── Path Helpers ─────────────────────────────────────────────────────────────

describe('Path Helpers', () => {
  it('getGlobalProfilesPath returns correct path for claude runtime', () => {
    const result = getGlobalProfilesPath('claude');
    const expected = path.join(os.homedir(), '.claude', 'get-shit-done', 'profiles.json');
    assert.strictEqual(result, expected);
  });

  it('getGlobalProfilesPath returns correct path for opencode runtime', () => {
    const result = getGlobalProfilesPath('opencode');
    const expected = path.join(os.homedir(), '.config', 'opencode', 'get-shit-done', 'profiles.json');
    assert.strictEqual(result, expected);
  });

  it('getGlobalProfilesPath returns correct path for gemini runtime', () => {
    const result = getGlobalProfilesPath('gemini');
    const expected = path.join(os.homedir(), '.gemini', 'get-shit-done', 'profiles.json');
    assert.strictEqual(result, expected);
  });

  it('getGlobalProfilesPath returns correct path for codex runtime', () => {
    const result = getGlobalProfilesPath('codex');
    const expected = path.join(os.homedir(), '.codex', 'get-shit-done', 'profiles.json');
    assert.strictEqual(result, expected);
  });

  it('getProjectProfilesPath returns .planning/profiles.json', () => {
    const cwd = '/test/project';
    const result = getProjectProfilesPath(cwd);
    assert.strictEqual(result, path.join(cwd, '.planning', 'profiles.json'));
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

describe('validateProfile', () => {
  it('accepts valid profile with name and agents object', () => {
    const profile = createValidProfile();
    const result = validateProfile(profile);
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.errors, []);
  });

  it('rejects missing name', () => {
    const profile = { agents: { planning: [], execution: [], research: [] } };
    const result = validateProfile(profile);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('.name: required string')));
  });

  it('rejects invalid name format with special chars', () => {
    const profile = createValidProfile('invalid@name!');
    const result = validateProfile(profile);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('must contain only alphanumeric')));
  });

  it('rejects name longer than 64 characters', () => {
    const longName = 'a'.repeat(65);
    const profile = createValidProfile(longName);
    const result = validateProfile(profile);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('max 64 characters')));
  });

  it('accepts name with hyphens and underscores', () => {
    const profile = createValidProfile('my-profile_name');
    const result = validateProfile(profile);
    assert.strictEqual(result.valid, true);
  });

  it('rejects missing agents object', () => {
    const profile = { name: 'test' };
    const result = validateProfile(profile);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('.agents: required object')));
  });

  it('rejects missing planning category array', () => {
    const profile = {
      name: 'test',
      agents: { execution: [], research: [] },
    };
    const result = validateProfile(profile);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('.agents.planning: required array')));
  });

  it('rejects missing execution category array', () => {
    const profile = {
      name: 'test',
      agents: { planning: [], research: [] },
    };
    const result = validateProfile(profile);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('.agents.execution: required array')));
  });

  it('rejects missing research category array', () => {
    const profile = {
      name: 'test',
      agents: { planning: [], execution: [] },
    };
    const result = validateProfile(profile);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('.agents.research: required array')));
  });

  it('rejects empty model string', () => {
    const profile = {
      name: 'test',
      agents: {
        planning: [''],
        execution: [],
        research: [],
      },
    };
    const result = validateProfile(profile);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('must be non-empty string')));
  });

  it('rejects model name longer than 128 characters', () => {
    const longModel = 'a'.repeat(129);
    const profile = {
      name: 'test',
      agents: {
        planning: [longModel],
        execution: [],
        research: [],
      },
    };
    const result = validateProfile(profile);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('max 128 characters')));
  });
});

describe('validateProfilesFile', () => {
  it('rejects non-array profiles field', () => {
    const data = { profiles: 'not-an-array' };
    const result = validateProfilesFile(data);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('profiles: required array')));
  });

  it('detects duplicate profile names', () => {
    const data = {
      profiles: [createValidProfile('duplicate'), createValidProfile('duplicate')],
    };
    const result = validateProfilesFile(data);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('duplicate profile name')));
  });

  it('accepts valid profiles file structure', () => {
    const data = {
      profiles: [createValidProfile('profile1'), createValidProfile('profile2')],
    };
    const result = validateProfilesFile(data);
    assert.strictEqual(result.valid, true);
  });
});

// ─── Load Operations ──────────────────────────────────────────────────────────

describe('loadProjectProfiles', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanup(tempDir);
  });

  it('returns empty array for non-existent file', () => {
    const result = loadProjectProfiles(tempDir);
    assert.deepStrictEqual(result.profiles, []);
    assert.deepStrictEqual(result.errors, []);
    assert.strictEqual(result.source, 'not_found');
  });

  it('parses valid JSON correctly', () => {
    const projectPath = getProjectProfilesPath(tempDir);
    fs.mkdirSync(path.dirname(projectPath), { recursive: true });
    const profiles = [createValidProfile('test1'), createValidProfile('test2')];
    fs.writeFileSync(projectPath, JSON.stringify({ profiles }, null, 2));

    const result = loadProjectProfiles(tempDir);
    assert.strictEqual(result.profiles.length, 2);
    assert.strictEqual(result.profiles[0].name, 'test1');
    assert.strictEqual(result.profiles[1].name, 'test2');
    assert.strictEqual(result.source, 'loaded');
  });

  it('returns errors for invalid JSON', () => {
    const projectPath = getProjectProfilesPath(tempDir);
    fs.mkdirSync(path.dirname(projectPath), { recursive: true });
    fs.writeFileSync(projectPath, '{ invalid json }');

    const result = loadProjectProfiles(tempDir);
    assert.deepStrictEqual(result.profiles, []);
    assert.ok(result.errors.length > 0);
    assert.strictEqual(result.source, 'error');
  });

  it('returns errors for validation failures', () => {
    const projectPath = getProjectProfilesPath(tempDir);
    fs.mkdirSync(path.dirname(projectPath), { recursive: true });
    const invalidData = {
      profiles: [{ name: 'invalid@name!' }],
    };
    fs.writeFileSync(projectPath, JSON.stringify(invalidData));

    const result = loadProjectProfiles(tempDir);
    assert.deepStrictEqual(result.profiles, []);
    assert.ok(result.errors.length > 0);
    assert.strictEqual(result.source, 'validation_failed');
  });
});

describe('loadGlobalProfiles and loadProjectProfiles', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanup(tempDir);
  });

  it('loadGlobalProfiles wraps loadProfilesFile correctly', () => {
    const runtime = 'claude';
    const globalPath = getGlobalProfilesPath(runtime);
    const globalDir = path.dirname(globalPath);

    // Create test file in global location
    fs.mkdirSync(globalDir, { recursive: true });
    const profiles = [createValidProfile('global-test')];
    fs.writeFileSync(globalPath, JSON.stringify({ profiles }, null, 2));

    const result = loadGlobalProfiles(runtime);
    assert.strictEqual(result.profiles.length, 1);
    assert.strictEqual(result.profiles[0].name, 'global-test');
    assert.strictEqual(result.path, globalPath);

    // Cleanup global test file
    fs.rmSync(globalDir, { recursive: true, force: true });
  });

  it('loadProjectProfiles wraps loadProfilesFile correctly', () => {
    const projectPath = getProjectProfilesPath(tempDir);
    const profiles = [createValidProfile('project-test')];
    fs.mkdirSync(path.dirname(projectPath), { recursive: true });
    fs.writeFileSync(projectPath, JSON.stringify({ profiles }, null, 2));

    const result = loadProjectProfiles(tempDir);
    assert.strictEqual(result.profiles.length, 1);
    assert.strictEqual(result.profiles[0].name, 'project-test');
    assert.strictEqual(result.path, projectPath);
  });

  it('loadAllProfiles merges global and project profiles', () => {
    const runtime = 'claude';
    const globalPath = getGlobalProfilesPath(runtime);
    const globalDir = path.dirname(globalPath);
    const projectPath = getProjectProfilesPath(tempDir);

    // Create global profile
    fs.mkdirSync(globalDir, { recursive: true });
    const globalProfiles = [createValidProfile('global-only'), createValidProfile('shared')];
    fs.writeFileSync(globalPath, JSON.stringify({ profiles: globalProfiles }, null, 2));

    // Create project profile
    fs.mkdirSync(path.dirname(projectPath), { recursive: true });
    const projectProfiles = [createValidProfile('shared'), createValidProfile('project-only')];
    fs.writeFileSync(projectPath, JSON.stringify({ profiles: projectProfiles }, null, 2));

    const result = loadAllProfiles(tempDir, runtime);

    // Should have 3 profiles: global-only, shared (from project), project-only
    assert.strictEqual(result.profiles.length, 3);
    const names = result.profiles.map(p => p.name).sort();
    assert.deepStrictEqual(names, ['global-only', 'project-only', 'shared']);

    // Cleanup global test file
    fs.rmSync(globalDir, { recursive: true, force: true });
  });
});

// ─── Merge Logic ──────────────────────────────────────────────────────────────

describe('mergeProfiles', () => {
  it('returns empty array for empty inputs', () => {
    const result = mergeProfiles([], []);
    assert.deepStrictEqual(result, []);
  });

  it('combines non-overlapping profiles', () => {
    const global = [createValidProfile('global1'), createValidProfile('global2')];
    const project = [createValidProfile('project1')];

    const result = mergeProfiles(global, project);
    assert.strictEqual(result.length, 3);
    const names = result.map(p => p.name).sort();
    assert.deepStrictEqual(names, ['global1', 'global2', 'project1']);
  });

  it('lets project profile override global with same name (entire replacement)', () => {
    const global = [
      {
        name: 'shared',
        agents: {
          planning: ['global-model-1'],
          execution: ['global-model-2'],
          research: ['global-model-3'],
        },
      },
    ];

    const project = [
      {
        name: 'shared',
        agents: {
          planning: ['project-model-1'],
          execution: ['project-model-2'],
          research: ['project-model-3'],
        },
      },
    ];

    const result = mergeProfiles(global, project);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'shared');
    // Project model should replace global model entirely
    assert.strictEqual(result[0].agents.planning[0], 'project-model-1');
    assert.strictEqual(result[0].agents.execution[0], 'project-model-2');
    assert.strictEqual(result[0].agents.research[0], 'project-model-3');
  });

  it('handles null/undefined inputs gracefully', () => {
    const result1 = mergeProfiles(null, []);
    assert.deepStrictEqual(result1, []);

    const result2 = mergeProfiles([], null);
    assert.deepStrictEqual(result2, []);

    const result3 = mergeProfiles(null, null);
    assert.deepStrictEqual(result3, []);
  });
});

// ─── Save Operations ───────────────────────────────────────────────────────────

describe('saveProjectProfiles', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanup(tempDir);
  });

  it('creates directory if needed', () => {
    const profiles = [createValidProfile('test')];

    const result = saveProjectProfiles(tempDir, profiles);
    assert.strictEqual(result.saved, true);
    const expectedPath = getProjectProfilesPath(tempDir);
    assert.ok(fs.existsSync(path.dirname(expectedPath)));
    assert.ok(fs.existsSync(expectedPath));
  });

  it('writes valid JSON', () => {
    const profiles = [createValidProfile('test1'), createValidProfile('test2')];

    const result = saveProjectProfiles(tempDir, profiles);
    assert.strictEqual(result.saved, true);

    const projectPath = getProjectProfilesPath(tempDir);
    const content = fs.readFileSync(projectPath, 'utf-8');
    const data = JSON.parse(content);
    assert.strictEqual(data.profiles.length, 2);
    assert.strictEqual(data.profiles[0].name, 'test1');
  });

  it('validates before saving and rejects invalid', () => {
    const invalidProfiles = [{ name: 'invalid@name!' }];

    const result = saveProjectProfiles(tempDir, invalidProfiles);
    assert.strictEqual(result.saved, false);
    assert.ok(result.errors.length > 0);
    const projectPath = getProjectProfilesPath(tempDir);
    assert.ok(!fs.existsSync(projectPath));
  });

  it('uses atomic write pattern (temp file + rename)', () => {
    const profiles = [createValidProfile('test')];

    const result = saveProjectProfiles(tempDir, profiles);
    assert.strictEqual(result.saved, true);

    const projectPath = getProjectProfilesPath(tempDir);
    // File should exist
    assert.ok(fs.existsSync(projectPath));

    // Temp file should NOT exist after save
    assert.ok(!fs.existsSync(projectPath + '.tmp'));
  });

  it('returns path in result', () => {
    const profiles = [createValidProfile('test')];

    const result = saveProjectProfiles(tempDir, profiles);
    const expectedPath = getProjectProfilesPath(tempDir);
    assert.strictEqual(result.path, expectedPath);
  });
});
