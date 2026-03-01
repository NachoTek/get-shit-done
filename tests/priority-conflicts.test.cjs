/**
 * Priority Conflict Resolution Tests
 * 
 * Tests for profile merge priority, resolution chain, and edge cases.
 * Verifies that project profiles override global profiles and that
 * the 3-tier resolution chain works correctly.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  mergeProfiles,
  loadAllProfiles,
  loadGlobalProfiles,
  saveGlobalProfiles,
  saveProjectProfiles,
} = require('../get-shit-done/bin/lib/profiles.cjs');

const {
  resolveModelEnhanced,
  resolveModelWithDetails,
} = require('../get-shit-done/bin/lib/profile-resolution.cjs');

const { loadConfig } = require('../get-shit-done/bin/lib/core.cjs');

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-priority-test-'));
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

function writeConfig(dir, obj) {
  fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, '.planning', 'config.json'),
    JSON.stringify(obj, null, 2)
  );
}

function writeGlobalProfiles(profiles) {
  const globalPath = path.join(os.homedir(), '.claude', 'get-shit-done', 'profiles.json');
  const dir = path.dirname(globalPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(globalPath, JSON.stringify({ profiles }, null, 2));
  return globalPath;
}

function removeGlobalProfiles() {
  const globalPath = path.join(os.homedir(), '.claude', 'get-shit-done', 'profiles.json');
  if (fs.existsSync(globalPath)) {
    fs.unlinkSync(globalPath);
  }
}

function writeProjectProfiles(dir, profiles) {
  const projectPath = path.join(dir, '.planning', 'profiles.json');
  fs.mkdirSync(path.dirname(projectPath), { recursive: true });
  fs.writeFileSync(projectPath, JSON.stringify({ profiles }, null, 2));
  return projectPath;
}

// ─── Profile Merge Priority ────────────────────────────────────────────────────

describe('mergeProfiles', () => {
  it('project profile replaces global profile with same name (full replacement)', () => {
    const global = [
      { 
        name: 'my-profile', 
        agents: { 
          planning: ['model-a'], 
          execution: ['model-a2'],
          research: ['model-a3']
        } 
      }
    ];
    const project = [
      { 
        name: 'my-profile', 
        agents: { 
          planning: ['model-b'], 
          execution: ['model-c'],
          research: ['model-d']
        } 
      }
    ];
    
    const merged = mergeProfiles(global, project);
    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].agents.planning[0], 'model-b');
    assert.strictEqual(merged[0].agents.execution[0], 'model-c');
    // Ensure it's full replacement, not deep merge
    assert.strictEqual(merged[0].agents.planning.length, 1);
    assert.strictEqual(merged[0].agents.execution.length, 1);
    assert.strictEqual(merged[0].agents.research[0], 'model-d');
  });

  it('non-overlapping profiles from both sources are kept', () => {
    const global = [
      { name: 'global-profile', agents: { planning: ['model-a'], execution: ['model-a2'], research: ['model-a3'] } }
    ];
    const project = [
      { name: 'project-profile', agents: { planning: ['model-b'], execution: ['model-b2'], research: ['model-b3'] } }
    ];
    
    const merged = mergeProfiles(global, project);
    assert.strictEqual(merged.length, 2);
    const names = merged.map(p => p.name);
    assert.ok(names.includes('global-profile'));
    assert.ok(names.includes('project-profile'));
  });

  it('empty global + non-empty project = project profiles only', () => {
    const project = [
      { name: 'project-profile', agents: { planning: ['model-b'], execution: ['model-b2'], research: ['model-b3'] } }
    ];
    
    const merged = mergeProfiles([], project);
    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].name, 'project-profile');
  });

  it('non-empty global + empty project = global profiles only', () => {
    const global = [
      { name: 'global-profile', agents: { planning: ['model-a'], execution: ['model-a2'], research: ['model-a3'] } }
    ];
    
    const merged = mergeProfiles(global, []);
    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].name, 'global-profile');
  });

  it('non-overlapping profiles from both sources are kept', () => {
    const global = [
      { name: 'global-profile', agents: { planning: ['model-a'] } }
    ];
    const project = [
      { name: 'project-profile', agents: { planning: ['model-b'] } }
    ];
    
    const merged = mergeProfiles(global, project);
    assert.strictEqual(merged.length, 2);
    const names = merged.map(p => p.name);
    assert.ok(names.includes('global-profile'));
    assert.ok(names.includes('project-profile'));
  });

  it('empty global + project profiles = empty result', () => {
    const merged = mergeProfiles([], []);
    assert.strictEqual(merged.length, 0);
  });

  it('empty global + non-empty project = project profiles only', () => {
    const project = [
      { name: 'project-profile', agents: { planning: ['model-b'] } }
    ];
    
    const merged = mergeProfiles([], project);
    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].name, 'project-profile');
  });

  it('non-empty global + empty project = global profiles only', () => {
    const global = [
      { name: 'global-profile', agents: { planning: ['model-a'] } }
    ];
    
    const merged = mergeProfiles(global, []);
    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].name, 'global-profile');
  });

  it('handles null/undefined inputs gracefully', () => {
    const merged1 = mergeProfiles(null, []);
    assert.strictEqual(merged1.length, 0);
    
    const merged2 = mergeProfiles(undefined, []);
    assert.strictEqual(merged2.length, 0);
    
    const merged3 = mergeProfiles([], null);
    assert.strictEqual(merged3.length, 0);
    
    const merged4 = mergeProfiles([], undefined);
    assert.strictEqual(merged4.length, 0);
  });
});

// ─── loadAllProfiles Merge Behavior ────────────────────────────────────────────

describe('loadAllProfiles', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
    removeGlobalProfiles();
  });

  afterEach(() => {
    cleanup(tmpDir);
    removeGlobalProfiles();
  });

  it('returns merged profiles with project overriding global', () => {
    writeGlobalProfiles([
      { name: 'shared', agents: { planning: ['global-model'], execution: ['global-exec'], research: ['global-research'] } }
    ]);
    writeProjectProfiles(tmpDir, [
      { name: 'shared', agents: { planning: ['project-model'], execution: ['project-exec'], research: ['project-research'] } }
    ]);
    
    const result = loadAllProfiles(tmpDir);
    assert.strictEqual(result.profiles.length, 1);
    assert.strictEqual(result.profiles[0].agents.planning[0], 'project-model');
  });

  it('returns errors from both sources (prefixed)', () => {
    // Create invalid global profile
    const globalPath = path.join(os.homedir(), '.claude', 'get-shit-done');
    fs.mkdirSync(globalPath, { recursive: true });
    fs.writeFileSync(path.join(globalPath, 'profiles.json'), '{ invalid json');
    
    // Create invalid project profile
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'profiles.json'), '{ invalid json');
    
    const result = loadAllProfiles(tmpDir);
    assert.ok(result.errors.length >= 2);
    assert.ok(result.errors.some(e => e.startsWith('[global]')));
    assert.ok(result.errors.some(e => e.startsWith('[project]')));
  });

  it('returns paths for both global and project locations', () => {
    const result = loadAllProfiles(tmpDir);
    assert.ok(result.globalPath);
    assert.ok(result.projectPath);
    assert.ok(result.globalPath.includes('.claude'));
    assert.ok(result.projectPath.includes('.planning'));
  });

  it('returns globalLoaded and projectLoaded flags', () => {
    // No profiles exist
    let result = loadAllProfiles(tmpDir);
    assert.strictEqual(result.globalLoaded, false);
    assert.strictEqual(result.projectLoaded, false);
    
    // Only project exists
    writeProjectProfiles(tmpDir, [createValidProfile('test')]);
    result = loadAllProfiles(tmpDir);
    assert.strictEqual(result.globalLoaded, false);
    assert.strictEqual(result.projectLoaded, true);
    
    // Both exist
    writeGlobalProfiles([createValidProfile('global-test')]);
    result = loadAllProfiles(tmpDir);
    assert.strictEqual(result.globalLoaded, true);
    assert.strictEqual(result.projectLoaded, true);
  });
});

// ─── Resolution Priority Chain ─────────────────────────────────────────────────

describe('Resolution priority chain', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
    removeGlobalProfiles();
  });

  afterEach(() => {
    cleanup(tmpDir);
    removeGlobalProfiles();
  });

  it('model_overrides > custom profile > legacy profile', () => {
    // Setup: global custom profile, project custom profile, and override
    writeGlobalProfiles([
      {
        name: 'custom',
        agents: { 
          planning: ['global-custom-model'], 
          execution: ['global-exec'],
          research: ['global-research']
        }
      }
    ]);
    
    writeProjectProfiles(tmpDir, [
      {
        name: 'custom',
        agents: { 
          planning: ['project-custom-model'], 
          execution: ['project-exec'],
          research: ['project-research']
        }
      }
    ]);
    
    writeConfig(tmpDir, {
      model_profile: 'balanced',
      model_profile_name: 'custom',
      model_overrides: {
        'gsd-planner': 'override-model'
      }
    });
    
    const model = resolveModelEnhanced(tmpDir, 'gsd-planner');
    assert.strictEqual(model, 'override-model');
  });

  it('custom profile > legacy profile when no override', () => {
    writeProjectProfiles(tmpDir, [
      {
        name: 'custom',
        agents: { 
          planning: ['custom-model'], 
          execution: ['custom-exec'],
          research: ['custom-research']
        }
      }
    ]);
    
    writeConfig(tmpDir, {
      model_profile: 'quality', // Would give 'opus' normally
      model_profile_name: 'custom'
    });
    
    const model = resolveModelEnhanced(tmpDir, 'gsd-planner');
    assert.strictEqual(model, 'custom-model');
  });

  it('legacy profile when no custom profile or override', () => {
    writeConfig(tmpDir, {
      model_profile: 'balanced'
    });
    
    const model = resolveModelEnhanced(tmpDir, 'gsd-roadmapper');
    assert.strictEqual(model, 'sonnet');
  });

  it('each tier tested independently - override tier', () => {
    writeConfig(tmpDir, {
      model_profile: 'quality',
      model_overrides: {
        'gsd-planner': 'override-model'
      }
    });
    
    const model = resolveModelEnhanced(tmpDir, 'gsd-planner');
    assert.strictEqual(model, 'override-model');
  });

  it('each tier tested independently - custom profile tier', () => {
    writeProjectProfiles(tmpDir, [
      {
        name: 'custom',
        agents: { 
          planning: ['custom-model'], 
          execution: ['custom-exec'],
          research: ['custom-research']
        }
      }
    ]);
    
    writeConfig(tmpDir, {
      model_profile: 'quality',
      model_profile_name: 'custom'
    });
    
    const model = resolveModelEnhanced(tmpDir, 'gsd-planner');
    assert.strictEqual(model, 'custom-model');
  });

  it('each tier tested independently - legacy profile tier', () => {
    writeConfig(tmpDir, {
      model_profile: 'budget'
    });
    
    const model = resolveModelEnhanced(tmpDir, 'gsd-codebase-mapper');
    assert.strictEqual(model, 'haiku');
  });
});

// ─── Edge Cases ────────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
    removeGlobalProfiles();
  });

  afterEach(() => {
    cleanup(tmpDir);
    removeGlobalProfiles();
  });

  it('profile exists in both locations with different content', () => {
    writeGlobalProfiles([
      {
        name: 'shared',
        agents: {
          planning: ['global-planning-model'],
          execution: ['global-exec-model'],
          research: ['global-research-model']
        }
      }
    ]);
    
    writeProjectProfiles(tmpDir, [
      {
        name: 'shared',
        agents: {
          planning: ['project-planning-model'],
          execution: ['project-exec-model'],
          research: ['project-research-model']
        }
      }
    ]);
    
    const result = loadAllProfiles(tmpDir);
    assert.strictEqual(result.profiles.length, 1);
    assert.strictEqual(result.profiles[0].agents.planning[0], 'project-planning-model');
    assert.strictEqual(result.profiles[0].agents.execution[0], 'project-exec-model');
    // Project fully replaces global, so research should be from project
    assert.strictEqual(result.profiles[0].agents.research[0], 'project-research-model');
  });

  it('profile deleted from project but exists in global', () => {
    writeGlobalProfiles([
      { name: 'global-only', agents: { planning: ['global-model'], execution: ['global-exec'], research: ['global-research'] } }
    ]);
    
    writeProjectProfiles(tmpDir, [
      { name: 'project-only', agents: { planning: ['project-model'], execution: ['project-exec'], research: ['project-research'] } }
    ]);
    
    const result = loadAllProfiles(tmpDir);
    assert.strictEqual(result.profiles.length, 2);
    const names = result.profiles.map(p => p.name);
    assert.ok(names.includes('global-only'));
    assert.ok(names.includes('project-only'));
  });

  it('profile name collision with legacy profile names (quality, balanced, budget)', () => {
    // User creates a profile named 'quality' which collides with legacy
    writeProjectProfiles(tmpDir, [
      {
        name: 'quality',
        agents: {
          planning: ['custom-quality-planning'],
          execution: ['custom-quality-exec'],
          research: ['custom-quality-research']
        }
      }
    ]);
    
    writeConfig(tmpDir, {
      model_profile: 'quality', // Legacy profile name
      model_profile_name: 'quality' // Custom profile name (collision)
    });
    
    // Custom profile should be used when model_profile_name is set
    const model = resolveModelEnhanced(tmpDir, 'gsd-planner');
    assert.strictEqual(model, 'custom-quality-planning');
  });

  it('invalid profile in one location does not affect the other', () => {
    // Valid global profile
    writeGlobalProfiles([
      { name: 'valid-global', agents: { planning: ['global-model'], execution: ['global-exec'], research: ['global-research'] } }
    ]);
    
    // Invalid project profile
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'profiles.json'),
      '{ "profiles": [invalid] }'
    );
    
    const result = loadAllProfiles(tmpDir);
    
    // Should have errors from project
    assert.ok(result.errors.some(e => e.startsWith('[project]')));
    
    // Global should still load
    assert.strictEqual(result.globalLoaded, true);
    assert.strictEqual(result.projectLoaded, false);
    
    // Merged should include global profile (project failed to load)
    assert.strictEqual(result.profiles.length, 1);
    assert.strictEqual(result.profiles[0].name, 'valid-global');
  });
});

// ─── Atomic Write Safety ───────────────────────────────────────────────────────

describe('Atomic write safety', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
    removeGlobalProfiles();
  });

  it('saveProjectProfiles creates temp file then renames', () => {
    const profiles = [createValidProfile('test')];
    
    const result = saveProjectProfiles(tmpDir, profiles);
    
    assert.strictEqual(result.saved, true);
    assert.strictEqual(result.errors.length, 0);
    
    // File should exist
    const filePath = path.join(tmpDir, '.planning', 'profiles.json');
    assert.ok(fs.existsSync(filePath));
    
    // Temp file should NOT exist (it was renamed)
    assert.ok(!fs.existsSync(filePath + '.tmp'));
    
    // Content should be valid
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    assert.strictEqual(data.profiles.length, 1);
    assert.strictEqual(data.profiles[0].name, 'test');
  });

  it('failed validation does not create/corrupt file', () => {
    const invalidProfile = { name: 'x'.repeat(200) }; // Too long
    
    const result = saveProjectProfiles(tmpDir, [invalidProfile]);
    
    assert.strictEqual(result.saved, false);
    assert.ok(result.errors.length > 0);
    
    // File should NOT exist (validation failed before write)
    const filePath = path.join(tmpDir, '.planning', 'profiles.json');
    assert.ok(!fs.existsSync(filePath));
    assert.ok(!fs.existsSync(filePath + '.tmp'));
  });

  it('directory creation works for nested paths', () => {
    const profiles = [createValidProfile('test')];
    // Use global profiles which creates nested directory structure
    const result = saveGlobalProfiles('claude', profiles);
    
    assert.strictEqual(result.saved, true);
    assert.ok(fs.existsSync(result.path));
    
    // Verify nested directories were created
    const globalDir = path.join(os.homedir(), '.claude', 'get-shit-done');
    assert.ok(fs.existsSync(globalDir));
  });

  it('existing file is safely replaced', () => {
    const profiles1 = [createValidProfile('test1')];
    const profiles2 = [createValidProfile('test2')];
    
    // First save
    let result = saveProjectProfiles(tmpDir, profiles1);
    assert.strictEqual(result.saved, true);
    
    // Verify first content
    const filePath = path.join(tmpDir, '.planning', 'profiles.json');
    let content = fs.readFileSync(filePath, 'utf-8');
    let data = JSON.parse(content);
    assert.strictEqual(data.profiles[0].name, 'test1');
    
    // Second save (replacement)
    result = saveProjectProfiles(tmpDir, profiles2);
    assert.strictEqual(result.saved, true);
    
    // Verify second content
    content = fs.readFileSync(filePath, 'utf-8');
    data = JSON.parse(content);
    assert.strictEqual(data.profiles[0].name, 'test2');
  });
});
