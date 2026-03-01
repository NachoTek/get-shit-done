/**
 * Profile Resolution — Enhanced model selection with custom profiles
 *
 * Provides a 3-tier resolution chain:
 * 1) Agent override (config.model_overrides)
 * 2) Custom profile (config.model_profile_name)
 * 3) Legacy profile (MODEL_PROFILES fallback)
 */

const profiles = require('./profiles.cjs');
const core = require('./core.cjs');

/**
 * Agent category mapping for custom profiles.
 * Categories align with profile.agents.{planning|execution|research}.
 * Keep this list in sync with RESOLVE-03 requirements.
 * Centralizing the mapping avoids scattered agent lists.
 * @type {Record<string, string[]>}
 */
const CATEGORY_AGENTS = {
  planning: [
    'gsd-planner',
    'gsd-roadmapper',
  ],
  execution: [
    'gsd-executor',
    'gsd-debugger',
  ],
  research: [
    'gsd-phase-researcher',
    'gsd-project-researcher',
    'gsd-research-synthesizer',
    'gsd-codebase-mapper',
    'gsd-verifier',
    'gsd-plan-checker',
    'gsd-integration-checker',
  ],
};

/**
 * Resolve agent category for a given agent type.
 * @param {string} agentType - Agent identifier
 * @returns {string|null} Category name or null if unknown
 */
function getAgentCategory(agentType) {
  for (const [category, agents] of Object.entries(CATEGORY_AGENTS)) {
    if (agents.includes(agentType)) {
      return category;
    }
  }
  return null;
}

/**
 * Normalize legacy model values.
 * The system treats 'opus' as 'inherit' for compatibility.
 * Example: normalizeModelName('opus') -> 'inherit'.
 * @param {string} modelName - Raw model name
 * @returns {string} Normalized model name
 */
function normalizeModelName(modelName) {
  return modelName === 'opus' ? 'inherit' : modelName;
}

/**
 * Find a custom profile by name using merged profile storage.
 *
 * Notes:
 * - Loads global + project profiles and lets project override global.
 * - Logs warnings if any profile load/validation errors are returned.
 * - Returns null if profileName is falsy or lookup fails.
 * @param {string} cwd - Project root directory
 * @param {string} profileName - Profile name to locate
 * @returns {object|null} Profile object or null if not found
 */
function findCustomProfile(cwd, profileName) {
  if (!profileName) return null;

  try {
    const result = profiles.loadAllProfiles(cwd);
    if (result.errors && result.errors.length > 0) {
      console.warn(`Profile loading warnings: ${result.errors.join('; ')}`);
    }

    const profileList = Array.isArray(result.profiles) ? result.profiles : [];
    const found = profileList.find(p => p && p.name === profileName);
    return found || null;
  } catch (err) {
    console.warn(`Profile loading failed: ${err.message}`);
    return null;
  }
}

/**
 * Resolve legacy profiles using core.MODEL_PROFILES.
 * @param {object} config - Loaded configuration
 * @param {string} agentType - Agent identifier
 * @returns {string} Resolved legacy model
 */
function resolveLegacyModel(config, agentType) {
  const profileName = config.model_profile || 'balanced';
  const agentModels = core.MODEL_PROFILES[agentType];
  if (!agentModels) return 'sonnet';

  const resolved = agentModels[profileName] || agentModels['balanced'] || 'sonnet';
  return normalizeModelName(resolved);
}

/**
 * Resolve model with enhanced priority chain.
 *
 * Tier 1: Per-agent override in config.model_overrides.
 * Tier 2: Custom profile lookup when config.model_profile_name is set.
 * Tier 3: Legacy profile mapping in MODEL_PROFILES.
 *
 * This function is intentionally synchronous to match existing
 * resolution behavior and avoid new I/O in the hot path.
 * @param {string} cwd - Project root directory
 * @param {string} agentType - Agent identifier
 * @returns {string} Resolved model name
 */
function resolveModelEnhanced(cwd, agentType) {
  const config = core.loadConfig(cwd);

  const override = config.model_overrides?.[agentType];
  if (override) {
    return normalizeModelName(override);
  }

  if (config.model_profile_name) {
    const category = getAgentCategory(agentType);
    const profile = findCustomProfile(cwd, config.model_profile_name);

    if (profile && category && profile.agents && profile.agents[category]) {
      const models = profile.agents[category];
      if (Array.isArray(models) && models.length > 0) {
        return models[0];
      }
    }
  }

  return resolveLegacyModel(config, agentType);
}

/**
 * Resolve model with transparency details for each tier.
 * @param {string} cwd - Project root directory
 * @param {string} agentType - Agent identifier
 * @returns {{ model: string, resolution: Array<object> }} Resolution output
 */
function resolveModelWithDetails(cwd, agentType) {
  const config = core.loadConfig(cwd);
  const resolutionChain = [];

  const override = config.model_overrides?.[agentType];
  if (override) {
    const model = normalizeModelName(override);
    resolutionChain.push({
      tier: 1,
      source: 'config.model_overrides',
      model,
      reason: 'Per-agent override',
    });
    return { model, resolution: resolutionChain };
  }

  if (config.model_profile_name) {
    const category = getAgentCategory(agentType);
    const profile = findCustomProfile(cwd, config.model_profile_name);

    if (profile && category && profile.agents && profile.agents[category]) {
      const models = profile.agents[category];
      if (Array.isArray(models) && models.length > 0) {
        const model = models[0];
        resolutionChain.push({
          tier: 2,
          source: 'custom_profile',
          profileName: config.model_profile_name,
          category,
          model,
          reason: 'Custom profile match',
        });
        return { model, resolution: resolutionChain };
      }
    }

    resolutionChain.push({
      tier: 2,
      source: 'custom_profile',
      profileName: config.model_profile_name,
      model: null,
      reason: 'Profile or category not found, falling back',
    });
  }

  const legacyProfileName = config.model_profile || 'balanced';
  const agentModels = core.MODEL_PROFILES[agentType];
  const resolved = agentModels?.[legacyProfileName] || agentModels?.['balanced'] || 'sonnet';
  const model = normalizeModelName(resolved);

  resolutionChain.push({
    tier: 3,
    source: 'MODEL_PROFILES',
    profileName: legacyProfileName,
    model,
    reason: 'Legacy profile fallback',
  });

  return { model, resolution: resolutionChain };
}

module.exports = {
  CATEGORY_AGENTS,
  getAgentCategory,
  findCustomProfile,
  resolveModelEnhanced,
  resolveModelWithDetails,
};
