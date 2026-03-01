/**
 * Model Detection Unit Tests
 * Tests for model-detection.cjs module - runtime detection, config paths, and model extraction
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  detectRuntime,
  getConfigPath,
  parseProvider,
  extractModelsFromConfig,
  getCommonDefaults,
} = require('../get-shit-done/bin/lib/model-detection.cjs');

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-detection-test-'));
}

function cleanup(dir) {
  if (dir && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function mockEnv(envVars) {
  const original = {};
  for (const [key, value] of Object.entries(envVars)) {
    original[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return () => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

// ─── Runtime Detection ────────────────────────────────────────────────────────

describe('detectRuntime', () => {
  let tempDir;
  let restoreEnv;

  beforeEach(() => {
    tempDir = createTempDir();
    // Clear all runtime env vars
    restoreEnv = mockEnv({
      CLAUDE_CODE_HOME: undefined,
      OPENCODE_CONFIG_PATH: undefined,
      GEMINI_CONFIG_PATH: undefined,
      GOOGLE_APPLICATION_CREDENTIALS: undefined,
      CODEX_CONFIG_PATH: undefined,
    });
  });

  afterEach(() => {
    cleanup(tempDir);
    restoreEnv();
  });

  it('returns claude when CLAUDE_CODE_HOME env var is set', () => {
    const restore = mockEnv({ CLAUDE_CODE_HOME: '/home/user/.claude' });
    const result = detectRuntime(tempDir);
    assert.strictEqual(result, 'claude');
    restore();
  });

  it('returns opencode when OPENCODE_CONFIG_PATH env var is set', () => {
    const restore = mockEnv({ OPENCODE_CONFIG_PATH: '/home/user/.config/opencode/config.json' });
    const result = detectRuntime(tempDir);
    assert.strictEqual(result, 'opencode');
    restore();
  });

  it('returns gemini when GEMINI_CONFIG_PATH env var is set', () => {
    const restore = mockEnv({ GEMINI_CONFIG_PATH: '/home/user/.gemini/config.json' });
    const result = detectRuntime(tempDir);
    assert.strictEqual(result, 'gemini');
    restore();
  });

  it('returns gemini when GOOGLE_APPLICATION_CREDENTIALS env var is set', () => {
    const restore = mockEnv({ GOOGLE_APPLICATION_CREDENTIALS: '/home/user/.config/gcp-creds.json' });
    const result = detectRuntime(tempDir);
    assert.strictEqual(result, 'gemini');
    restore();
  });

  it('returns codex when CODEX_CONFIG_PATH env var is set', () => {
    const restore = mockEnv({ CODEX_CONFIG_PATH: '/home/user/.codex/config.json' });
    const result = detectRuntime(tempDir);
    assert.strictEqual(result, 'codex');
    restore();
  });

  it('falls back to config file existence check', () => {
    // Create a claude config file
    const claudeConfigDir = path.join(os.homedir(), '.claude');
    const claudeConfigPath = path.join(claudeConfigDir, 'claude_desktop_config.json');
    const existed = fs.existsSync(claudeConfigDir);

    if (!existed) {
      fs.mkdirSync(claudeConfigDir, { recursive: true });
    }
    fs.writeFileSync(claudeConfigPath, '{}');

    const result = detectRuntime(tempDir);
    assert.strictEqual(result, 'claude');

    // Cleanup
    if (!existed) {
      fs.rmSync(claudeConfigDir, { recursive: true, force: true });
    } else {
      fs.rmSync(claudeConfigPath, { force: true });
    }
  });

  it('defaults to claude when no indicators found', () => {
    // Clear all env vars and ensure no config files exist
    const result = detectRuntime(tempDir);
    assert.strictEqual(result, 'claude');
  });

  it('prioritizes env vars over config file existence', () => {
    // Create claude config
    const claudeConfigDir = path.join(os.homedir(), '.claude');
    const claudeConfigPath = path.join(claudeConfigDir, 'claude_desktop_config.json');
    const existed = fs.existsSync(claudeConfigDir);

    if (!existed) {
      fs.mkdirSync(claudeConfigDir, { recursive: true });
    }
    fs.writeFileSync(claudeConfigPath, '{}');

    // Set opencode env var (should take priority)
    const restore = mockEnv({ OPENCODE_CONFIG_PATH: '/home/user/.config/opencode/config.json' });
    const result = detectRuntime(tempDir);
    assert.strictEqual(result, 'opencode');
    restore();

    // Cleanup
    if (!existed) {
      fs.rmSync(claudeConfigDir, { recursive: true, force: true });
    } else {
      fs.rmSync(claudeConfigPath, { force: true });
    }
  });
});

// ─── Config Path Resolution ───────────────────────────────────────────────────

describe('getConfigPath', () => {
  it('returns correct path for claude', () => {
    const result = getConfigPath('claude');
    const expected = path.join(os.homedir(), '.claude', 'claude_desktop_config.json');
    assert.strictEqual(result, expected);
  });

  it('returns correct path for opencode', () => {
    const result = getConfigPath('opencode');
    const expected = path.join(os.homedir(), '.config', 'opencode', 'config.json');
    assert.strictEqual(result, expected);
  });

  it('returns correct path for gemini', () => {
    const result = getConfigPath('gemini');
    const expected = path.join(os.homedir(), '.gemini', 'config.json');
    assert.strictEqual(result, expected);
  });

  it('returns correct path for codex', () => {
    const result = getConfigPath('codex');
    const expected = path.join(os.homedir(), '.codex', 'config.json');
    assert.strictEqual(result, expected);
  });

  it('returns claude path for unknown runtime', () => {
    const result = getConfigPath('unknown');
    const expected = path.join(os.homedir(), '.claude', 'claude_desktop_config.json');
    assert.strictEqual(result, expected);
  });
});

// ─── Provider Parsing ─────────────────────────────────────────────────────────

describe('parseProvider', () => {
  describe('anthropic', () => {
    it('returns anthropic for claude-* models', () => {
      assert.strictEqual(parseProvider('claude-3-5-sonnet-20241022'), 'anthropic');
      assert.strictEqual(parseProvider('claude-3-opus-20240229'), 'anthropic');
      assert.strictEqual(parseProvider('claude-2'), 'anthropic');
    });
  });

  describe('openai', () => {
    it('returns openai for gpt-* models', () => {
      assert.strictEqual(parseProvider('gpt-4'), 'openai');
      assert.strictEqual(parseProvider('gpt-3.5-turbo'), 'openai');
      assert.strictEqual(parseProvider('gpt-4o'), 'openai');
    });

    it('returns openai for o1-* models', () => {
      assert.strictEqual(parseProvider('o1-preview'), 'openai');
      assert.strictEqual(parseProvider('o1-mini'), 'openai');
    });

    it('returns openai for o3-* models', () => {
      assert.strictEqual(parseProvider('o3-mini'), 'openai');
    });
  });

  describe('google', () => {
    it('returns google for gemini-* models', () => {
      assert.strictEqual(parseProvider('gemini-2.5-pro'), 'google');
      assert.strictEqual(parseProvider('gemini-2.5-flash'), 'google');
      assert.strictEqual(parseProvider('gemini-1.5-pro'), 'google');
    });
  });

  describe('mistral', () => {
    it('returns mistral for llama-* models', () => {
      assert.strictEqual(parseProvider('llama-3.1-70b'), 'mistral');
    });

    it('returns mistral for mistral-* models', () => {
      assert.strictEqual(parseProvider('mistral-large'), 'mistral');
      assert.strictEqual(parseProvider('mistral-7b'), 'mistral');
    });
  });

  describe('cohere', () => {
    it('returns cohere for command-* models', () => {
      assert.strictEqual(parseProvider('command-r'), 'cohere');
      assert.strictEqual(parseProvider('command-light'), 'cohere');
    });

    it('returns cohere for embed-* models', () => {
      assert.strictEqual(parseProvider('embed-english-v3'), 'cohere');
    });
  });

  describe('provider prefix format', () => {
    it('extracts provider from anthropic/claude-3', () => {
      assert.strictEqual(parseProvider('anthropic/claude-3-5-sonnet'), 'anthropic');
    });

    it('extracts provider from openai/gpt-4', () => {
      assert.strictEqual(parseProvider('openai/gpt-4'), 'openai');
    });

    it('extracts provider from google/gemini-2', () => {
      assert.strictEqual(parseProvider('google/gemini-2.5-pro'), 'google');
    });
  });

  describe('edge cases', () => {
    it('returns other for unknown patterns', () => {
      assert.strictEqual(parseProvider('unknown-model'), 'other');
      assert.strictEqual(parseProvider('random-name'), 'other');
    });

    it('returns other for null/undefined', () => {
      assert.strictEqual(parseProvider(null), 'other');
      assert.strictEqual(parseProvider(undefined), 'other');
    });

    it('handles case-insensitive matching', () => {
      assert.strictEqual(parseProvider('CLAUDE-3-5-SONNET'), 'anthropic');
      assert.strictEqual(parseProvider('GPT-4'), 'openai');
      assert.strictEqual(parseProvider('GEMINI-2.5-PRO'), 'google');
    });
  });
});

// ─── Model Extraction ─────────────────────────────────────────────────────────

describe('extractModelsFromConfig', () => {
  it('extracts from userModelPreferences array', () => {
    const config = {
      userModelPreferences: ['claude-3-5-sonnet', 'gpt-4'],
    };

    const result = extractModelsFromConfig(config, 'claude');
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].name, 'claude-3-5-sonnet');
    assert.strictEqual(result[0].source, 'config');
    assert.strictEqual(result[1].name, 'gpt-4');
  });

  it('extracts from modelPreferences array', () => {
    const config = {
      modelPreferences: ['gemini-2.5-pro', 'gemini-2.5-flash'],
    };

    const result = extractModelsFromConfig(config, 'gemini');
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].name, 'gemini-2.5-pro');
  });

  it('extracts from providerSettings array', () => {
    const config = {
      providerSettings: [
        { model: 'claude-3-5-sonnet' },
        { model: 'claude-3-opus' },
      ],
    };

    const result = extractModelsFromConfig(config, 'claude');
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].name, 'claude-3-5-sonnet');
    assert.strictEqual(result[1].name, 'claude-3-opus');
  });

  it('handles {model: ...} format', () => {
    const config = {
      models: [
        { model: 'claude-3-5-sonnet' },
      ],
    };

    const result = extractModelsFromConfig(config, 'claude');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'claude-3-5-sonnet');
  });

  it('handles {name: ...} format', () => {
    const config = {
      models: [
        { name: 'gpt-4o' },
      ],
    };

    const result = extractModelsFromConfig(config, 'claude');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'gpt-4o');
  });

  it('handles {id: ...} format', () => {
    const config = {
      models: [
        { id: 'gemini-2.5-pro' },
      ],
    };

    const result = extractModelsFromConfig(config, 'claude');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'gemini-2.5-pro');
  });

  it('returns empty array for null/invalid config', () => {
    assert.deepStrictEqual(extractModelsFromConfig(null, 'claude'), []);
    assert.deepStrictEqual(extractModelsFromConfig(undefined, 'claude'), []);
    assert.deepStrictEqual(extractModelsFromConfig('invalid', 'claude'), []);
    assert.deepStrictEqual(extractModelsFromConfig(123, 'claude'), []);
  });

  it('stops at first field with models', () => {
    const config = {
      userModelPreferences: ['model-1'],
      modelPreferences: ['model-2', 'model-3'],
    };

    const result = extractModelsFromConfig(config, 'claude');
    // Should only extract from userModelPreferences (first match)
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'model-1');
  });

  it('extracts from gemini-specific patterns when runtime is gemini', () => {
    const config = {
      vertexAI: {
        models: ['gemini-2.5-pro', 'gemini-2.5-flash'],
      },
    };

    const result = extractModelsFromConfig(config, 'gemini');
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].name, 'gemini-2.5-pro');
  });
});

// ─── Defaults ─────────────────────────────────────────────────────────────────

describe('getCommonDefaults', () => {
  it('returns appropriate defaults for claude', () => {
    const result = getCommonDefaults('claude');
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);

    const names = result.map(m => m.name);
    assert.ok(names.includes('claude-3-5-sonnet-20241022'));
    assert.ok(names.includes('claude-3-5-haiku-20241022'));
    assert.ok(names.includes('claude-3-opus-20240229'));

    // All should have source: 'default'
    for (const model of result) {
      assert.strictEqual(model.source, 'default');
    }
  });

  it('returns appropriate defaults for opencode', () => {
    const result = getCommonDefaults('opencode');
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);

    const names = result.map(m => m.name);
    assert.ok(names.includes('claude-3-5-sonnet-20241022'));
  });

  it('returns appropriate defaults for gemini', () => {
    const result = getCommonDefaults('gemini');
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);

    const names = result.map(m => m.name);
    assert.ok(names.includes('gemini-2.5-pro'));
    assert.ok(names.includes('gemini-2.5-flash'));
    assert.ok(names.includes('gemini-2.0-pro'));
  });

  it('returns appropriate defaults for codex', () => {
    const result = getCommonDefaults('codex');
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);

    const names = result.map(m => m.name);
    assert.ok(names.includes('claude-3-5-sonnet-20241022'));
  });

  it('all defaults include source: default', () => {
    for (const runtime of ['claude', 'opencode', 'gemini', 'codex']) {
      const result = getCommonDefaults(runtime);
      for (const model of result) {
        assert.strictEqual(model.source, 'default', `Runtime ${runtime} failed`);
      }
    }
  });
});
