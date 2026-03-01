/**
 * Profile Resolution Unit Tests
 * Tests for profile-resolution.cjs module - category mapping, normalization, and resolution chain
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  getAgentCategory,
  findCustomProfile,
  resolveModelEnhanced,
  resolveModelWithDetails,
  CATEGORY_AGENTS,
} = require('../get-shit-done/bin/lib/profile-resolution.cjs');

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-resolution-test-'));
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

function createTestProfilesFile(dir, profiles) {
  const profilesPath = path.join(dir, '.planning', 'profiles.json');
  fs.mkdirSync(path.dirname(profilesPath), { recursive: true });
  fs.writeFileSync(profilesPath, JSON.stringify({ profiles }, null, 2));
  return profilesPath;
}

// ─── Category Mapping ─────────────────────────────────────────────────────────

describe('getAgentCategory', () => {
  describe('planning agents', () => {
    it('returns planning for gsd-planner', () => {
      assert.strictEqual(getAgentCategory('gsd-planner'), 'planning');
    });

    it('returns planning for gsd-roadmapper', () => {
      assert.strictEqual(getAgentCategory('gsd-roadmapper'), 'planning');
    });
  });

  describe('execution agents', () => {
    it('returns execution for gsd-executor', () => {
      assert.strictEqual(getAgentCategory('gsd-executor'), 'execution');
    });

    it('returns execution for gsd-debugger', () => {
      assert.strictEqual(getAgentCategory('gsd-debugger'), 'execution');
    });
  });

  describe('research agents', () => {
    it('returns research for gsd-phase-researcher', () => {
      assert.strictEqual(getAgentCategory('gsd-phase-researcher'), 'research');
    });

    it('returns research for gsd-project-researcher', () => {
      assert.strictEqual(getAgentCategory('gsd-project-researcher'), 'research');
    });

    it('returns research for gsd-research-synthesizer', () => {
      assert.strictEqual(getAgentCategory('gsd-research-synthesizer'), 'research');
    });

    it('returns research for gsd-codebase-mapper', () => {
      assert.strictEqual(getAgentCategory('gsd-codebase-mapper'), 'research');
    });

    it('returns research for gsd-verifier', () => {
      assert.strictEqual(getAgentCategory('gsd-verifier'), 'research');
    });

    it('returns research for gsd-plan-checker', () => {
      assert.strictEqual(getAgentCategory('gsd-plan-checker'), 'research');
    });

    it('returns research for gsd-integration-checker', () => {
      assert.strictEqual(getAgentCategory('gsd-integration-checker'), 'research');
    });
  });

  it('returns null for unknown agent types', () => {
    assert.strictEqual(getAgentCategory('unknown-agent'), null);
    assert.strictEqual(getAgentCategory('random'), null);
    assert.strictEqual(getAgentCategory(''), null);
  });
});

// ─── Custom Profile Lookup ────────────────────────────────────────────────────

describe('findCustomProfile', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanup(tempDir);
  });

  it('returns null for falsy profileName', () => {
    assert.strictEqual(findCustomProfile(tempDir, null), null);
    assert.strictEqual(findCustomProfile(tempDir, undefined), null);
    assert.strictEqual(findCustomProfile(tempDir, ''), null);
  });

  it('returns profile object when found in loaded profiles', () => {
    const profile = createValidProfile('test-profile');
    createTestProfilesFile(tempDir, [profile]);

    const result = findCustomProfile(tempDir, 'test-profile');
    assert.ok(result);
    assert.strictEqual(result.name, 'test-profile');
    assert.deepStrictEqual(result.agents, profile.agents);
  });

  it('returns null when profile not found', () => {
    createTestProfilesFile(tempDir, [createValidProfile('other-profile')]);

    const result = findCustomProfile(tempDir, 'nonexistent');
    assert.strictEqual(result, null);
  });

  it('loads project profiles that override global', () => {
    const globalProfile = createValidProfile('shared');
    globalProfile.agents.planning = ['global-model'];

    const projectProfile = createValidProfile('shared');
    projectProfile.agents.planning = ['project-model'];

    // Create global profile
    const globalPath = path.join(os.homedir(), '.claude', 'get-shit-done', 'profiles.json');
    const globalDir = path.dirname(globalPath);
    fs.mkdirSync(globalDir, { recursive: true });
    fs.writeFileSync(globalPath, JSON.stringify({ profiles: [globalProfile] }, null, 2));

    // Create project profile
    createTestProfilesFile(tempDir, [projectProfile]);

    const result = findCustomProfile(tempDir, 'shared');
    assert.ok(result);
    // Project should override global
    assert.strictEqual(result.agents.planning[0], 'project-model');

    // Cleanup global
    fs.rmSync(globalDir, { recursive: true, force: true });
  });
});

// ─── Resolution Chain (resolveModelEnhanced) ──────────────────────────────────

describe('resolveModelEnhanced', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir();
    // Create minimal .planning structure
    fs.mkdirSync(path.join(tempDir, '.planning'), { recursive: true });
  });

  afterEach(() => {
    cleanup(tempDir);
  });

  it('Tier 1: model_overrides takes highest priority', () => {
    const config = {
      model_overrides: {
        'gsd-planner': 'override-model',
      },
      model_profile_name: 'custom-profile',
      model_profile: 'balanced',
    };

    // Create config file
    fs.writeFileSync(
      path.join(tempDir, '.planning', 'config.json'),
      JSON.stringify(config, null, 2)
    );

    // Create custom profile (should be ignored due to override)
    createTestProfilesFile(tempDir, [
      {
        name: 'custom-profile',
        agents: {
          planning: ['custom-model'],
          execution: ['custom-exec'],
          research: ['custom-research'],
        },
      },
    ]);

    const result = resolveModelEnhanced(tempDir, 'gsd-planner');
    assert.strictEqual(result, 'override-model');
  });

  it('Tier 2: custom profile is used when no override', () => {
    const config = {
      model_profile_name: 'custom-profile',
      model_profile: 'balanced',
    };

    fs.writeFileSync(
      path.join(tempDir, '.planning', 'config.json'),
      JSON.stringify(config, null, 2)
    );

    createTestProfilesFile(tempDir, [
      {
        name: 'custom-profile',
        agents: {
          planning: ['custom-planning-model'],
          execution: ['custom-exec-model'],
          research: ['custom-research-model'],
        },
      },
    ]);

    const result = resolveModelEnhanced(tempDir, 'gsd-planner');
    assert.strictEqual(result, 'custom-planning-model');
  });

  it('Tier 2: uses correct category within custom profile', () => {
    const config = {
      model_profile_name: 'custom-profile',
    };

    fs.writeFileSync(
      path.join(tempDir, '.planning', 'config.json'),
      JSON.stringify(config, null, 2)
    );

    createTestProfilesFile(tempDir, [
      {
        name: 'custom-profile',
        agents: {
          planning: ['planning-model'],
          execution: ['execution-model'],
          research: ['research-model'],
        },
      },
    ]);

    assert.strictEqual(resolveModelEnhanced(tempDir, 'gsd-planner'), 'planning-model');
    assert.strictEqual(resolveModelEnhanced(tempDir, 'gsd-executor'), 'execution-model');
    assert.strictEqual(resolveModelEnhanced(tempDir, 'gsd-verifier'), 'research-model');
  });

  it('Tier 3: falls back to legacy MODEL_PROFILES when no custom profile', () => {
    const config = {
      model_profile: 'balanced',
    };

    fs.writeFileSync(
      path.join(tempDir, '.planning', 'config.json'),
      JSON.stringify(config, null, 2)
    );

    const result = resolveModelEnhanced(tempDir, 'gsd-planner');
    // Should use legacy MODEL_PROFILES from core.cjs
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
  });

  it('falls back to legacy when custom profile category is empty', () => {
    const config = {
      model_profile_name: 'empty-profile',
      model_profile: 'budget',
    };

    fs.writeFileSync(
      path.join(tempDir, '.planning', 'config.json'),
      JSON.stringify(config, null, 2)
    );

    createTestProfilesFile(tempDir, [
      {
        name: 'empty-profile',
        agents: {
          planning: [], // Empty array
          execution: ['exec-model'],
          research: ['research-model'],
        },
      },
    ]);

    const result = resolveModelEnhanced(tempDir, 'gsd-planner');
    // Should fall back to legacy since planning category is empty
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
  });

  it('normalizes opus to inherit in override', () => {
    const config = {
      model_overrides: {
        'gsd-planner': 'opus',
      },
    };

    fs.writeFileSync(
      path.join(tempDir, '.planning', 'config.json'),
      JSON.stringify(config, null, 2)
    );

    const result = resolveModelEnhanced(tempDir, 'gsd-planner');
    assert.strictEqual(result, 'inherit');
  });
});

// ─── Transparency Details (resolveModelWithDetails) ───────────────────────────

describe('resolveModelWithDetails', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir();
    fs.mkdirSync(path.join(tempDir, '.planning'), { recursive: true });
  });

  afterEach(() => {
    cleanup(tempDir);
  });

  it('returns resolution chain array with tier, source, model, reason', () => {
    const config = {
      model_overrides: {
        'gsd-planner': 'override-model',
      },
    };

    fs.writeFileSync(
      path.join(tempDir, '.planning', 'config.json'),
      JSON.stringify(config, null, 2)
    );

    const result = resolveModelWithDetails(tempDir, 'gsd-planner');

    assert.ok(result.model);
    assert.ok(Array.isArray(result.resolution));
    assert.ok(result.resolution.length > 0);

    const entry = result.resolution[0];
    assert.ok(entry.tier !== undefined);
    assert.ok(entry.source);
    assert.ok(entry.model);
    assert.ok(entry.reason);
  });

  it('Tier 1 entry includes source: config.model_overrides', () => {
    const config = {
      model_overrides: {
        'gsd-planner': 'override-model',
      },
    };

    fs.writeFileSync(
      path.join(tempDir, '.planning', 'config.json'),
      JSON.stringify(config, null, 2)
    );

    const result = resolveModelWithDetails(tempDir, 'gsd-planner');

    assert.strictEqual(result.resolution.length, 1);
    assert.strictEqual(result.resolution[0].tier, 1);
    assert.strictEqual(result.resolution[0].source, 'config.model_overrides');
    assert.strictEqual(result.resolution[0].model, 'override-model');
    assert.strictEqual(result.resolution[0].reason, 'Per-agent override');
  });

  it('Tier 2 entry includes profileName and category', () => {
    const config = {
      model_profile_name: 'custom-profile',
    };

    fs.writeFileSync(
      path.join(tempDir, '.planning', 'config.json'),
      JSON.stringify(config, null, 2)
    );

    createTestProfilesFile(tempDir, [
      {
        name: 'custom-profile',
        agents: {
          planning: ['custom-model'],
          execution: [],
          research: [],
        },
      },
    ]);

    const result = resolveModelWithDetails(tempDir, 'gsd-planner');

    assert.strictEqual(result.resolution.length, 1);
    assert.strictEqual(result.resolution[0].tier, 2);
    assert.strictEqual(result.resolution[0].source, 'custom_profile');
    assert.strictEqual(result.resolution[0].profileName, 'custom-profile');
    assert.strictEqual(result.resolution[0].category, 'planning');
    assert.strictEqual(result.resolution[0].model, 'custom-model');
  });

  it('Tier 3 entry includes source: MODEL_PROFILES', () => {
    const config = {
      model_profile: 'budget',
    };

    fs.writeFileSync(
      path.join(tempDir, '.planning', 'config.json'),
      JSON.stringify(config, null, 2)
    );

    const result = resolveModelWithDetails(tempDir, 'gsd-planner');

    assert.strictEqual(result.resolution[0].tier, 3);
    assert.strictEqual(result.resolution[0].source, 'MODEL_PROFILES');
    assert.ok(result.resolution[0].model);
    assert.ok(result.resolution[0].profileName);
  });

  it('Tier 2 shows fallback when category not found', () => {
    const config = {
      model_profile_name: 'incomplete-profile',
    };

    fs.writeFileSync(
      path.join(tempDir, '.planning', 'config.json'),
      JSON.stringify(config, null, 2)
    );

    createTestProfilesFile(tempDir, [
      {
        name: 'incomplete-profile',
        agents: {
          planning: [], // Empty
          execution: ['exec-model'],
          research: [],
        },
      },
    ]);

    const result = resolveModelWithDetails(tempDir, 'gsd-planner');

    // Should have Tier 2 (failed) and Tier 3 (fallback)
    assert.ok(result.resolution.length >= 1);

    // Last entry should be Tier 3 fallback
    const lastEntry = result.resolution[result.resolution.length - 1];
    assert.strictEqual(lastEntry.tier, 3);
    assert.strictEqual(lastEntry.source, 'MODEL_PROFILES');
  });
});

// ─── Category Constants Verification ───────────────────────────────────────────

describe('CATEGORY_AGENTS constant', () => {
  it('contains all planning agents', () => {
    assert.ok(CATEGORY_AGENTS.planning.includes('gsd-planner'));
    assert.ok(CATEGORY_AGENTS.planning.includes('gsd-roadmapper'));
  });

  it('contains all execution agents', () => {
    assert.ok(CATEGORY_AGENTS.execution.includes('gsd-executor'));
    assert.ok(CATEGORY_AGENTS.execution.includes('gsd-debugger'));
  });

  it('contains all research agents', () => {
    assert.ok(CATEGORY_AGENTS.research.includes('gsd-phase-researcher'));
    assert.ok(CATEGORY_AGENTS.research.includes('gsd-project-researcher'));
    assert.ok(CATEGORY_AGENTS.research.includes('gsd-research-synthesizer'));
    assert.ok(CATEGORY_AGENTS.research.includes('gsd-codebase-mapper'));
    assert.ok(CATEGORY_AGENTS.research.includes('gsd-verifier'));
    assert.ok(CATEGORY_AGENTS.research.includes('gsd-plan-checker'));
    assert.ok(CATEGORY_AGENTS.research.includes('gsd-integration-checker'));
  });
});
