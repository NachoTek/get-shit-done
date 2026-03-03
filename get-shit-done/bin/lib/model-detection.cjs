/**
 * Model Detection — Auto-detect available models from runtime configuration
 *
 * Uses Node.js built-ins only. No external dependencies.
 * Follows existing codebase patterns from profiles.cjs and core.cjs.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Runtime Detection ──────────────────────────────────────────────────────

/**
 * Detect which runtime is active
 * @param {string} cwd - Current working directory (unused, for future expansion)
 * @returns {string} Runtime identifier: 'claude' | 'opencode' | 'gemini' | 'codex'
 */
function detectRuntime(cwd) {
  const env = process.env;

  // Check environment variables first
  if (env.CLAUDE_CODE_HOME) return 'claude';
  if (env.OPENCODE_CONFIG_PATH) return 'opencode';
  if (env.GEMINI_CONFIG_PATH || env.GOOGLE_APPLICATION_CREDENTIALS) return 'gemini';
  if (env.CODEX_CONFIG_PATH) return 'codex';

  // Check if opencode command is available
  try {
    const { execSync } = require('child_process');
    execSync('opencode --version', { stdio: 'ignore', timeout: 1000 });
    return 'opencode';
  } catch (err) {
    // opencode command not available
  }

  // Fall back to checking config file existence
  const homedir = os.homedir();

  const runtimeConfigs = [
    { name: 'claude', path: path.join(homedir, '.claude', 'claude_desktop_config.json') },
    { name: 'opencode', path: path.join(homedir, '.config', 'opencode', 'config.json') },
    { name: 'gemini', path: path.join(homedir, '.gemini', 'config.json') },
    { name: 'gemini', path: path.join(homedir, '.config', 'gemini-cli', 'config.json') },
    { name: 'codex', path: path.join(homedir, '.codex', 'config.json') },
  ];

  for (const runtime of runtimeConfigs) {
    if (fs.existsSync(runtime.path)) {
      return runtime.name;
    }
  }

  // Default to claude
  return 'claude';
}

/**
 * Get config file path for runtime
 * @param {string} runtime - Runtime identifier
 * @returns {string} Path to runtime config file
 */
function getConfigPath(runtime) {
  const homedir = os.homedir();
  const configPaths = {
    claude: path.join(homedir, '.claude', 'claude_desktop_config.json'),
    opencode: path.join(homedir, '.config', 'opencode', 'config.json'),
    gemini: path.join(homedir, '.gemini', 'config.json'),
    codex: path.join(homedir, '.codex', 'config.json'),
  };
  return configPaths[runtime] || configPaths.claude;
}

// ─── Model Extraction ────────────────────────────────────────────────────────

/**
 * Extract models from runtime configuration
 * @param {object} config - Parsed runtime config object
 * @param {string} runtime - Runtime identifier
 * @returns {Array<{ name: string, source: string }>} Array of model objects
 */
function extractModelsFromConfig(config, runtime) {
  if (!config || typeof config !== 'object') {
    return [];
  }

  const models = [];

  // Helper to extract from array field
  const extractFromArray = (fieldPath) => {
    const parts = fieldPath.split('.');
    let current = config;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }
    return Array.isArray(current) ? current : null;
  };

  // Common patterns for claude/opencode/codex
  const commonFields = [
    'userModelPreferences',
    'modelPreferences',
    'providerSettings',
    'models',
  ];

  for (const field of commonFields) {
    const modelArray = extractFromArray(field);
    if (modelArray) {
      for (const item of modelArray) {
        if (typeof item === 'string') {
          models.push({ name: item, source: 'config' });
        } else if (item && typeof item === 'object' && item.model) {
          models.push({ name: item.model, source: 'config' });
        } else if (item && typeof item === 'object' && item.name) {
          models.push({ name: item.name, source: 'config' });
        } else if (item && typeof item === 'object' && item.id) {
          models.push({ name: item.id, source: 'config' });
        }
      }
      // If we found models in one field, stop searching
      if (models.length > 0) {
        break;
      }
    }
  }

  // Gemini-specific patterns
  if (runtime === 'gemini') {
    const geminiFields = [
      'vertexAI.models',
      'google.models',
      'models',
    ];

    for (const field of geminiFields) {
      const modelArray = extractFromArray(field);
      if (modelArray) {
        for (const item of modelArray) {
          if (typeof item === 'string') {
            models.push({ name: item, source: 'config' });
          } else if (item && typeof item === 'object' && item.model) {
            models.push({ name: item.model, source: 'config' });
          } else if (item && typeof item === 'object' && item.name) {
            models.push({ name: item.name, source: 'config' });
          }
        }
        if (models.length > 0) {
          break;
        }
      }
    }
  }

  return models;
}

/**
 * Get opencode models by querying the opencode CLI
 * @returns {Array<{ name: string, source: string }>} Array of model objects
 */
function getOpencodeModels() {
  try {
    const { execSync } = require('child_process');
    const output = execSync('opencode models', { encoding: 'utf-8', timeout: 5000 });
    const lines = output.trim().split('\n');
    
    return lines
      .filter(line => line.trim() && !line.includes('Error:'))
      .map(line => {
        const modelName = line.trim();
        return { name: modelName, source: 'opencode-cli' };
      });
  } catch (err) {
    // Fallback to common opencode models if command fails
    return [
      { name: 'zai-coding-plan/glm-5', source: 'default' },
      { name: 'zai-coding-plan/glm-4.7-flash', source: 'default' },
      { name: 'openai/gpt-5.1-codex', source: 'default' },
    ];
  }
}

/**
 * Get common default models for runtime
 * @param {string} runtime - Runtime identifier
 * @returns {Array<{ name: string, source: string }>} Array of default model objects
 */
function getCommonDefaults(runtime) {
  // For opencode, query actual available models
  if (runtime === 'opencode') {
    return getOpencodeModels();
  }
  
  const defaults = {
    claude: [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ],
    gemini: [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.0-pro',
    ],
    codex: [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ],
  };

  const modelNames = defaults[runtime] || defaults.claude;
  return modelNames.map(name => ({ name, source: 'default' }));
}

// ─── Provider Parsing ─────────────────────────────────────────────────────────

/**
 * Infer provider from model name
 * @param {string} modelName - Model name to parse
 * @returns {string} Provider: 'anthropic' | 'openai' | 'google' | 'mistral' | 'cohere' | 'other'
 */
function parseProvider(modelName) {
  if (!modelName || typeof modelName !== 'string') {
    return 'other';
  }

  const name = modelName.toLowerCase().trim();

  // If contains '/', split and use first part
  if (name.includes('/')) {
    const provider = name.split('/')[0];
    const knownProviders = ['anthropic', 'openai', 'google', 'mistral', 'cohere'];
    if (knownProviders.includes(provider)) {
      return provider;
    }
    return provider || 'other';
  }

  // Prefix matching
  if (name.startsWith('claude-')) {
    return 'anthropic';
  }
  if (name.startsWith('gpt-') || name.startsWith('o1-') || name.startsWith('o3-')) {
    return 'openai';
  }
  if (name.startsWith('gemini-')) {
    return 'google';
  }
  if (name.startsWith('llama-') || name.startsWith('mistral-')) {
    return 'mistral';
  }
  if (name.startsWith('command-') || name.startsWith('embed-')) {
    return 'cohere';
  }

  return 'other';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect available models from runtime configuration
 * @param {string} cwd - Current working directory
 * @returns {{ runtime: string, models: Array<{ name: string, provider: string, confidence: string, source: string }> }}
 */
function detectAvailableModels(cwd) {
  const runtime = detectRuntime(cwd);
  const configPath = getConfigPath(runtime);
  let models = [];

  // Try to read and parse config
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);
      models = extractModelsFromConfig(config, runtime);
    } catch (err) {
      // Silently fail on parse errors, fall back to defaults
      models = [];
    }
  }

  // Use defaults if no models found
  if (models.length === 0) {
    models = getCommonDefaults(runtime);
  }

  // Enrich models with provider and confidence
  const enriched = models.map(model => {
    const provider = parseProvider(model.name);
    const confidence = model.source === 'config' ? 'high' : 'low';
    return {
      name: model.name,
      provider,
      confidence,
      source: model.source,
    };
  });

  return {
    runtime,
    models: enriched,
  };
}

module.exports = {
  // Runtime detection
  detectRuntime,
  getConfigPath,

  // Model extraction
  extractModelsFromConfig,
  getCommonDefaults,

  // Provider parsing
  parseProvider,

  // Public API
  detectAvailableModels,
};
