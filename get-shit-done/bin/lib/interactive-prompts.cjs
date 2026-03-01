/**
 * Interactive Prompts — CLI prompts for model selection in profile creation
 *
 * Uses Node.js built-ins only (readline module). No external dependencies.
 * Follows existing codebase patterns from model-detection.cjs and profiles.cjs.
 */

const readline = require('readline');

// ─── Provider Display Names ────────────────────────────────────────────────────

/**
 * Map provider code to display name
 * @param {string} provider - Provider code: 'anthropic' | 'openai' | 'google' | 'mistral' | 'cohere' | 'other'
 * @returns {string} Display name for provider
 */
function getProviderDisplayName(provider) {
  const displayNames = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    mistral: 'Mistral AI',
    cohere: 'Cohere',
    other: 'Other',
  };
  return displayNames[provider] || provider;
}

// ─── Readline Interface Helpers ───────────────────────────────────────────────

/**
 * Create readline interface with consistent configuration
 * @returns {readline.Interface} Readline interface
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Close readline interface cleanly
 * @param {readline.Interface} rl - Readline interface to close
 */
function closeReadlineInterface(rl) {
  if (rl) {
    try {
      rl.close();
    } catch (err) {
      // Silently ignore close errors
    }
  }
}

// ─── Model Display ─────────────────────────────────────────────────────────────

/**
 * Display models grouped by provider with numbered options
 * @param {Array<{ name: string, provider: string, confidence: string, source: string }>} models - Array of model objects
 * @returns {Array<{ name: string, provider: string, number: number }>} Flat array of models with option numbers
 */
function displayModelsGrouped(models) {
  if (!Array.isArray(models) || models.length === 0) {
    console.log('No models available.\n');
    return [];
  }

  // Group models by provider
  const grouped = {};
  for (const model of models) {
    const provider = model.provider || 'other';
    if (!grouped[provider]) {
      grouped[provider] = [];
    }
    grouped[provider].push(model);
  }

  // Sort providers alphabetically
  const sortedProviders = Object.keys(grouped).sort((a, b) => {
    const nameA = getProviderDisplayName(a);
    const nameB = getProviderDisplayName(b);
    return nameA.localeCompare(nameB);
  });

  // Display models with numbering
  let optionNumber = 1;
  const flatList = [];

  for (const provider of sortedProviders) {
    const displayName = getProviderDisplayName(provider);
    const providerModels = grouped[provider].sort((a, b) => a.name.localeCompare(b.name));

    console.log(`${displayName} (${providerModels.length} model${providerModels.length > 1 ? 's' : ''})`);

    for (const model of providerModels) {
      console.log(`  [${optionNumber}] ${model.name}`);
      flatList.push({
        name: model.name,
        provider: model.provider,
        number: optionNumber,
      });
      optionNumber++;
    }

    console.log('');
  }

  return flatList;
}

// ─── Model Selection Prompt ───────────────────────────────────────────────────

/**
 * Prompt user to select one model for a category
 * @param {string} category - Category name (e.g., 'Planning', 'Execution', 'Research')
 * @param {Array<{ name: string, provider: string, confidence: string, source: string }>} models - Array of model objects
 * @returns {{ name: string, source: string }} Selected model object
 */
function promptModelSelection(category, models) {
  const rl = createReadlineInterface();

  return new Promise((resolve) => {
    const flatList = displayModelsGrouped(models);
    const maxAttempts = 3;
    let attempts = 0;

    const promptUser = () => {
      attempts++;
      const prompt = `Select ${category} model [1-${flatList.length} or 'custom']: `;

      rl.question(prompt, (input) => {
        const trimmed = input.trim();

        // Check for 'custom' entry
        if (trimmed.toLowerCase() === 'custom') {
          promptCustomModel(category, rl)
            .then((customModel) => {
              closeReadlineInterface(rl);
              resolve(customModel);
            })
            .catch(() => {
              closeReadlineInterface(rl);
              resolve({ name: '', source: 'manual' });
            });
          return;
        }

        // Validate numeric input
        const number = parseInt(trimmed, 10);
        if (isNaN(number) || number < 1 || number > flatList.length) {
          if (attempts < maxAttempts) {
            console.log(`Invalid input. Please enter a number between 1 and ${flatList.length}, or 'custom'.\n`);
            promptUser();
          } else {
            console.log('Maximum attempts reached. Proceeding with empty selection.\n');
            closeReadlineInterface(rl);
            resolve({ name: '', source: 'manual' });
          }
          return;
        }

        // Valid selection
        const selected = flatList[number - 1];
        console.log(`  Selected: ${selected.name}\n`);
        closeReadlineInterface(rl);
        resolve({
          name: selected.name,
          source: 'auto',
        });
      });
    };

    promptUser();
  });
}

/**
 * Prompt user for custom model name
 * @param {string} category - Category name
 * @param {readline.Interface} rl - Readline interface
 * @returns {Promise<{ name: string, source: string }>} Custom model object
 */
function promptCustomModel(category, rl) {
  return new Promise((resolve) => {
    const maxAttempts = 3;
    let attempts = 0;

    const promptUser = () => {
      attempts++;
      rl.question(`Enter ${category} model name: `, (input) => {
        const trimmed = input.trim();

        // Validate: non-empty, max 128 chars
        if (!trimmed || trimmed.length === 0) {
          if (attempts < maxAttempts) {
            console.log('Model name cannot be empty. Please try again.\n');
            promptUser();
          } else {
            console.log('Maximum attempts reached. Proceeding with empty selection.\n');
            resolve({ name: '', source: 'manual' });
          }
          return;
        }

        if (trimmed.length > 128) {
          if (attempts < maxAttempts) {
            console.log('Model name must be 128 characters or less. Please try again.\n');
            promptUser();
          } else {
            console.log('Maximum attempts reached. Proceeding with empty selection.\n');
            resolve({ name: '', source: 'manual' });
          }
          return;
        }

        console.log(`  Selected: ${trimmed}\n`);
        resolve({
          name: trimmed,
          source: 'manual',
        });
      });
    };

    promptUser();
  });
}

// ─── Three Question Flow ───────────────────────────────────────────────────────

/**
 * Full interactive flow for profile creation
 * Collects model selections for Planning, Execution, and Research categories
 * @param {Array<{ name: string, provider: string, confidence: string, source: string }>} models - Array of model objects from detectAvailableModels()
 * @returns {{ planning: string, execution: string, research: string }} Object with selected model names
 */
async function promptThreeQuestionFlow(models) {
  const result = {
    planning: '',
    execution: '',
    research: '',
  };

  try {
    console.log('');

    // Prompt for Planning model
    const planning = await promptModelSelection('Planning', models);
    result.planning = planning.name;

    // Prompt for Execution model
    const execution = await promptModelSelection('Execution', models);
    result.execution = execution.name;

    // Prompt for Research model
    const research = await promptModelSelection('Research', models);
    result.research = research.name;

    return result;
  } catch (err) {
    console.error('Error during model selection:', err.message);
    return result;
  }
}

module.exports = {
  // Display functions
  displayModelsGrouped,

  // Prompt functions
  promptModelSelection,
  promptThreeQuestionFlow,

  // Helper functions
  getProviderDisplayName,
  createReadlineInterface,
  closeReadlineInterface,
};
