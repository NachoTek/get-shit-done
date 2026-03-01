/**
 * Backward Compatibility Tests
 * 
 * Tests that legacy profiles (quality/balanced/budget) still work correctly
 * and that the system maintains compatibility with existing configurations.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  loadConfig,
  resolveModelInternal,
  MODEL_PROFILES,
} = require('../get-shit-done/bin/lib/core.cjs');

const {
  resolveModelEnhanced,
} = require('../get-shit-done/bin/lib/profile-resolution.cjs');

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-backward-compat-test-'));
}

function cleanup(dir) {
  if (dir && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ─── Legacy MODEL_PROFILES ─────────────────────────────────────────────────────

describe('Legacy MODEL_PROFILES', () => {
  describe('quality profile', () => {
    it('returns expected models for gsd-planner', () => {
      const agentModels = MODEL_PROFILES['gsd-planner'];
      assert.ok(agentModels);
      assert.strictEqual(agentModels['quality'], 'opus');
    });

    it('returns expected models for gsd-roadmapper', () => {
      const agentModels = MODEL_PROFILES['gsd-roadmapper'];
      assert.ok(agentModels);
      assert.strictEqual(agentModels['quality'], 'opus');
    });

    it('returns expected models for gsd-executor', () => {
      const agentModels = MODEL_PROFILES['gsd-executor'];
      assert.ok(agentModels);
      assert.strictEqual(agentModels['quality'], 'opus');
    });

    it('returns expected models for research agents', () => {
      const phaseResearcher = MODEL_PROFILES['gsd-phase-researcher'];
      assert.ok(phaseResearcher);
      assert.strictEqual(phaseResearcher['quality'], 'opus');

      const codebaseMapper = MODEL_PROFILES['gsd-codebase-mapper'];
      assert.ok(codebaseMapper);
      assert.strictEqual(codebaseMapper['quality'], 'sonnet');
    });
  });

  describe('balanced profile', () => {
    it('returns expected models for gsd-planner', () => {
      const agentModels = MODEL_PROFILES['gsd-planner'];
      assert.strictEqual(agentModels['balanced'], 'opus');
    });

    it('returns expected models for gsd-roadmapper', () => {
      const agentModels = MODEL_PROFILES['gsd-roadmapper'];
      assert.strictEqual(agentModels['balanced'], 'sonnet');
    });

    it('returns expected models for gsd-executor', () => {
      const agentModels = MODEL_PROFILES['gsd-executor'];
      assert.strictEqual(agentModels['balanced'], 'sonnet');
    });
  });

  describe('budget profile', () => {
    it('returns expected models for gsd-planner', () => {
      const agentModels = MODEL_PROFILES['gsd-planner'];
      assert.strictEqual(agentModels['budget'], 'sonnet');
    });

    it('returns expected models for research agents', () => {
      const synthesizer = MODEL_PROFILES['gsd-research-synthesizer'];
      assert.strictEqual(synthesizer['budget'], 'haiku');

      const verifier = MODEL_PROFILES['gsd-verifier'];
      assert.strictEqual(verifier['budget'], 'haiku');
    });
  });

  describe('unknown agents', () => {
    it('returns undefined for unknown agents', () => {
      const unknownAgent = MODEL_PROFILES['unknown-agent'];
      assert.strictEqual(unknownAgent, undefined);
    });
  });
});

// ─── resolveModelInternal Compatibility ────────────────────────────────────────

describe('resolveModelInternal compatibility', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  function writeConfig(obj) {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify(obj, null, 2)
    );
  }

  it('works with model_profile: quality', () => {
    writeConfig({ model_profile: 'quality' });
    const model = resolveModelInternal(tmpDir, 'gsd-planner');
    assert.strictEqual(model, 'inherit'); // opus normalizes to inherit
  });

  it('works with model_profile: balanced', () => {
    writeConfig({ model_profile: 'balanced' });
    const model = resolveModelInternal(tmpDir, 'gsd-roadmapper');
    assert.strictEqual(model, 'sonnet');
  });

  it('works with model_profile: budget', () => {
    writeConfig({ model_profile: 'budget' });
    const model = resolveModelInternal(tmpDir, 'gsd-codebase-mapper');
    assert.strictEqual(model, 'haiku');
  });

  it('works with model_overrides for individual agents', () => {
    writeConfig({
      model_profile: 'balanced',
      model_overrides: {
        'gsd-planner': 'custom-model',
      },
    });
    const model = resolveModelInternal(tmpDir, 'gsd-planner');
    assert.strictEqual(model, 'custom-model');
  });

  it('opus normalizes to inherit for backward compatibility', () => {
    // Test opus normalization through resolveModelInternal
    writeConfig({
      model_profile: 'quality',
      model_overrides: {
        'gsd-planner': 'opus',
      },
    });
    const model = resolveModelInternal(tmpDir, 'gsd-planner');
    assert.strictEqual(model, 'inherit'); // opus -> inherit
    
    // Test that non-opus models are not normalized
    writeConfig({
      model_profile: 'quality',
      model_overrides: {
        'gsd-planner': 'sonnet',
      },
    });
    const model2 = resolveModelInternal(tmpDir, 'gsd-planner');
    assert.strictEqual(model2, 'sonnet');
  });
});

// ─── Config Structure Compatibility ────────────────────────────────────────────

describe('Config structure compatibility', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  function writeConfig(obj) {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify(obj, null, 2)
    );
  }

  it('loadConfig handles legacy config.json without model_profile_name', () => {
    writeConfig({
      model_profile: 'balanced',
      commit_docs: true,
    });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.model_profile, 'balanced');
    assert.strictEqual(config.model_profile_name, null); // Should default to null
  });

  it('loadConfig handles nested planning.commit_docs format', () => {
    writeConfig({
      model_profile: 'quality',
      planning: {
        commit_docs: false,
      },
    });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.model_profile, 'quality');
    assert.strictEqual(config.commit_docs, false);
  });

  it('loadConfig handles git.branching_strategy format', () => {
    writeConfig({
      model_profile: 'balanced',
      git: {
        branching_strategy: 'feature-branches',
      },
    });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.model_profile, 'balanced');
    assert.strictEqual(config.branching_strategy, 'feature-branches');
  });

  it('loadConfig handles all nested formats together', () => {
    writeConfig({
      model_profile: 'quality',
      planning: {
        commit_docs: false,
        search_gitignored: true,
      },
      git: {
        branching_strategy: 'feature-branches',
        phase_branch_template: 'phase/{phase}',
      },
      workflow: {
        research: false,
        plan_check: true,
        verifier: false,
      },
    });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.model_profile, 'quality');
    assert.strictEqual(config.commit_docs, false);
    assert.strictEqual(config.search_gitignored, true);
    assert.strictEqual(config.branching_strategy, 'feature-branches');
    assert.strictEqual(config.phase_branch_template, 'phase/{phase}');
    assert.strictEqual(config.research, false);
    assert.strictEqual(config.plan_checker, true);
    assert.strictEqual(config.verifier, false);
  });
});

// ─── Resolution Chain Backward Compatibility ───────────────────────────────────

describe('Resolution chain backward compatibility', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  function writeConfig(obj) {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify(obj, null, 2)
    );
  }

  it('resolveModelEnhanced falls back to MODEL_PROFILES when no custom profile', () => {
    writeConfig({
      model_profile: 'quality',
    });
    
    // Should use legacy MODEL_PROFILES
    const model = resolveModelEnhanced(tmpDir, 'gsd-planner');
    assert.strictEqual(model, 'inherit'); // opus normalizes to inherit
  });

  it('custom profile absence does not break existing workflows', () => {
    writeConfig({
      model_profile: 'balanced',
    });
    
    // Even with no custom profiles file, legacy should work
    const model = resolveModelEnhanced(tmpDir, 'gsd-roadmapper');
    assert.strictEqual(model, 'sonnet');
  });

  it('model_overrides takes precedence over legacy profile', () => {
    writeConfig({
      model_profile: 'quality',
      model_overrides: {
        'gsd-planner': 'override-model',
      },
    });
    
    // Override should win over legacy profile
    const model = resolveModelEnhanced(tmpDir, 'gsd-planner');
    assert.strictEqual(model, 'override-model');
  });
});
