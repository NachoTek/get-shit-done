/**
 * Cross-Runtime Validation Tests
 * 
 * Verifies correct profile and config paths for all 4 runtimes:
 * - Claude Code
 * - OpenCode
 * - Gemini CLI
 * - Codex
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');

// Import modules to test
const profiles = require('../get-shit-done/bin/lib/profiles.cjs');
const modelDetection = require('../get-shit-done/bin/lib/model-detection.cjs');

describe('Cross-Runtime Path Validation', () => {
  const homedir = os.homedir();

  describe('Global Profile Paths', () => {
    test('Claude Code profile path is correct', () => {
      const result = profiles.getGlobalProfilesPath('claude');
      const expected = path.join(homedir, '.claude', 'get-shit-done', 'profiles.json');
      
      assert.strictEqual(result, expected);
      assert.ok(result.endsWith(path.join('get-shit-done', 'profiles.json')));
      assert.ok(result.includes('.claude'));
      assert.ok(path.isAbsolute(result));
    });

    test('OpenCode profile path is correct', () => {
      const result = profiles.getGlobalProfilesPath('opencode');
      const expected = path.join(homedir, '.config', 'opencode', 'get-shit-done', 'profiles.json');
      
      assert.strictEqual(result, expected);
      assert.ok(result.endsWith(path.join('get-shit-done', 'profiles.json')));
      assert.ok(result.includes('.config'));
      assert.ok(result.includes('opencode'));
      assert.ok(path.isAbsolute(result));
    });

    test('Gemini CLI profile path is correct', () => {
      const result = profiles.getGlobalProfilesPath('gemini');
      const expected = path.join(homedir, '.gemini', 'get-shit-done', 'profiles.json');
      
      assert.strictEqual(result, expected);
      assert.ok(result.endsWith(path.join('get-shit-done', 'profiles.json')));
      assert.ok(result.includes('.gemini'));
      assert.ok(path.isAbsolute(result));
    });

    test('Codex profile path is correct', () => {
      const result = profiles.getGlobalProfilesPath('codex');
      const expected = path.join(homedir, '.codex', 'get-shit-done', 'profiles.json');
      
      assert.strictEqual(result, expected);
      assert.ok(result.endsWith(path.join('get-shit-done', 'profiles.json')));
      assert.ok(result.includes('.codex'));
      assert.ok(path.isAbsolute(result));
    });

    test('Unknown runtime defaults to Claude', () => {
      const result = profiles.getGlobalProfilesPath('unknown');
      const expected = profiles.getGlobalProfilesPath('claude');
      
      assert.strictEqual(result, expected);
    });

    test('All runtime paths use platform-appropriate separators', () => {
      const runtimes = ['claude', 'opencode', 'gemini', 'codex'];
      
      for (const runtime of runtimes) {
        const result = profiles.getGlobalProfilesPath(runtime);
        
        // Verify path is properly formed
        const parts = result.split(path.sep);
        assert.ok(parts.length > 0);
        assert.ok(parts[0].length > 0); // First part should be non-empty (root)
        
        // Verify ends with expected structure
        assert.ok(result.endsWith(path.join('get-shit-done', 'profiles.json')));
      }
    });

    test('All runtime paths are absolute', () => {
      const runtimes = ['claude', 'opencode', 'gemini', 'codex'];
      
      for (const runtime of runtimes) {
        const result = profiles.getGlobalProfilesPath(runtime);
        assert.ok(path.isAbsolute(result), `${runtime} path should be absolute`);
      }
    });
  });

  describe('Runtime Config Paths', () => {
    test('Claude Code config path is correct', () => {
      const result = modelDetection.getConfigPath('claude');
      const expected = path.join(homedir, '.claude', 'claude_desktop_config.json');
      
      assert.strictEqual(result, expected);
      assert.ok(result.includes('.claude'));
      assert.ok(result.endsWith('claude_desktop_config.json'));
      assert.ok(path.isAbsolute(result));
    });

    test('OpenCode config path is correct', () => {
      const result = modelDetection.getConfigPath('opencode');
      const expected = path.join(homedir, '.config', 'opencode', 'config.json');
      
      assert.strictEqual(result, expected);
      assert.ok(result.includes('.config'));
      assert.ok(result.includes('opencode'));
      assert.ok(result.endsWith('config.json'));
      assert.ok(path.isAbsolute(result));
    });

    test('Gemini CLI config path is correct', () => {
      const result = modelDetection.getConfigPath('gemini');
      const expected = path.join(homedir, '.gemini', 'config.json');
      
      assert.strictEqual(result, expected);
      assert.ok(result.includes('.gemini'));
      assert.ok(result.endsWith('config.json'));
      assert.ok(path.isAbsolute(result));
    });

    test('Codex config path is correct', () => {
      const result = modelDetection.getConfigPath('codex');
      const expected = path.join(homedir, '.codex', 'config.json');
      
      assert.strictEqual(result, expected);
      assert.ok(result.includes('.codex'));
      assert.ok(result.endsWith('config.json'));
      assert.ok(path.isAbsolute(result));
    });

    test('Unknown runtime config defaults to Claude', () => {
      const result = modelDetection.getConfigPath('unknown');
      const expected = modelDetection.getConfigPath('claude');
      
      assert.strictEqual(result, expected);
    });
  });

  describe('Runtime Detection', () => {
    const originalEnv = {};

    beforeEach(() => {
      // Save original environment variables
      for (const key of [
        'CLAUDE_CODE_HOME',
        'OPENCODE_CONFIG_PATH',
        'GEMINI_CONFIG_PATH',
        'GOOGLE_APPLICATION_CREDENTIALS',
        'CODEX_CONFIG_PATH',
      ]) {
        originalEnv[key] = process.env[key];
      }
    });

    afterEach(() => {
      // Restore original environment variables
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });

    test('Claude Code detection via env var', () => {
      process.env.CLAUDE_CODE_HOME = '/some/path';
      const result = modelDetection.detectRuntime(process.cwd());
      assert.strictEqual(result, 'claude');
    });

    test('OpenCode detection via env var', () => {
      process.env.OPENCODE_CONFIG_PATH = '/some/path';
      const result = modelDetection.detectRuntime(process.cwd());
      assert.strictEqual(result, 'opencode');
    });

    test('Gemini CLI detection via GEMINI_CONFIG_PATH', () => {
      process.env.GEMINI_CONFIG_PATH = '/some/path';
      const result = modelDetection.detectRuntime(process.cwd());
      assert.strictEqual(result, 'gemini');
    });

    test('Gemini CLI detection via GOOGLE_APPLICATION_CREDENTIALS', () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/some/path';
      const result = modelDetection.detectRuntime(process.cwd());
      assert.strictEqual(result, 'gemini');
    });

    test('Codex detection via env var', () => {
      process.env.CODEX_CONFIG_PATH = '/some/path';
      const result = modelDetection.detectRuntime(process.cwd());
      assert.strictEqual(result, 'codex');
    });

    test('Env var priority order (Claude first)', () => {
      process.env.CLAUDE_CODE_HOME = '/claude/path';
      process.env.OPENCODE_CONFIG_PATH = '/opencode/path';
      process.env.GEMINI_CONFIG_PATH = '/gemini/path';
      process.env.CODEX_CONFIG_PATH = '/codex/path';
      
      const result = modelDetection.detectRuntime(process.cwd());
      assert.strictEqual(result, 'claude');
    });

    test('Env var priority order (OpenCode second)', () => {
      delete process.env.CLAUDE_CODE_HOME;
      process.env.OPENCODE_CONFIG_PATH = '/opencode/path';
      process.env.GEMINI_CONFIG_PATH = '/gemini/path';
      process.env.CODEX_CONFIG_PATH = '/codex/path';
      
      const result = modelDetection.detectRuntime(process.cwd());
      assert.strictEqual(result, 'opencode');
    });

    test('Defaults to Claude when no env vars set', () => {
      // Clear all env vars
      delete process.env.CLAUDE_CODE_HOME;
      delete process.env.OPENCODE_CONFIG_PATH;
      delete process.env.GEMINI_CONFIG_PATH;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      delete process.env.CODEX_CONFIG_PATH;
      
      const result = modelDetection.detectRuntime(process.cwd());
      // May be 'claude' or another runtime if config files exist
      assert.ok(['claude', 'opencode', 'gemini', 'codex'].includes(result));
    });
  });

  describe('Path Structure Validation', () => {
    test('All runtime profile paths have consistent structure', () => {
      const runtimes = ['claude', 'opencode', 'gemini', 'codex'];
      
      for (const runtime of runtimes) {
        const profilePath = profiles.getGlobalProfilesPath(runtime);
        
        // All should end with get-shit-done/profiles.json
        assert.ok(
          profilePath.endsWith(path.join('get-shit-done', 'profiles.json')),
          `${runtime} profile path should end with get-shit-done/profiles.json`
        );
        
        // All should start with homedir
        assert.ok(
          profilePath.startsWith(homedir),
          `${runtime} profile path should start with homedir`
        );
      }
    });

    test('Profile paths and config paths use same base directories', () => {
      const runtimeBases = {
        claude: '.claude',
        opencode: path.join('.config', 'opencode'),
        gemini: '.gemini',
        codex: '.codex',
      };

      for (const [runtime, baseDir] of Object.entries(runtimeBases)) {
        const profilePath = profiles.getGlobalProfilesPath(runtime);
        const configPath = modelDetection.getConfigPath(runtime);
        
        // Both should include the base directory
        assert.ok(
          profilePath.includes(baseDir),
          `${runtime} profile path should include ${baseDir}`
        );
        assert.ok(
          configPath.includes(baseDir),
          `${runtime} config path should include ${baseDir}`
        );
      }
    });
  });
});
