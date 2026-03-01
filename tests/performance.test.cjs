/**
 * Performance Benchmark Tests
 * 
 * Verifies system meets <100ms performance targets using perf_hooks.
 * Tests use statistical analysis (avg, p95, max) over multiple iterations.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Import modules to test
const profiles = require('../get-shit-done/bin/lib/profiles.cjs');
const modelDetection = require('../get-shit-done/bin/lib/model-detection.cjs');
const profileResolution = require('../get-shit-done/bin/lib/profile-resolution.cjs');
const core = require('../get-shit-done/bin/lib/core.cjs');

// Test helpers
let tmpDir;

function createTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-perf-test-'));
  
  // Create .planning directory
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  
  // Create minimal config
  const config = {
    model_profile: 'balanced',
    model_overrides: {},
  };
  fs.writeFileSync(
    path.join(planningDir, 'config.json'),
    JSON.stringify(config, null, 2)
  );
  
  return tmpDir;
}

function cleanupTempDir() {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function calculateStats(times) {
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const sorted = [...times].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(times.length * 0.95)];
  const max = sorted[sorted.length - 1];
  const min = sorted[0];
  
  return { avg, p95, max, min };
}

describe('Performance Benchmarks', () => {
  beforeEach(() => {
    createTempDir();
  });

  afterEach(() => {
    cleanupTempDir();
  });

  describe('Profile Resolution Performance', () => {
    test('resolveModelEnhanced completes in <100ms average', () => {
      const iterations = 30;
      const warmupIterations = 5;
      const times = [];

      // Warmup iterations (not measured)
      for (let i = 0; i < warmupIterations; i++) {
        profileResolution.resolveModelEnhanced(tmpDir, 'gsd-executor');
      }

      // Measure iterations
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        profileResolution.resolveModelEnhanced(tmpDir, 'gsd-executor');
        times.push(performance.now() - start);
      }

      const stats = calculateStats(times);
      
      console.log('\nProfile Resolution Performance:');
      console.log(`  Average: ${stats.avg.toFixed(3)}ms`);
      console.log(`  P95: ${stats.p95.toFixed(3)}ms`);
      console.log(`  Max: ${stats.max.toFixed(3)}ms`);
      console.log(`  Min: ${stats.min.toFixed(3)}ms`);

      // Performance targets
      assert.ok(
        stats.avg < 100,
        `Average ${stats.avg.toFixed(3)}ms exceeds 100ms target`
      );
      
      assert.ok(
        stats.max < 150,
        `Max ${stats.max.toFixed(3)}ms exceeds 150ms CI allowance`
      );
    });

    test('resolveModelEnhanced handles all agent types efficiently', () => {
      const agentTypes = [
        'gsd-planner',
        'gsd-executor',
        'gsd-phase-researcher',
        'gsd-verifier',
      ];

      const times = [];

      for (const agentType of agentTypes) {
        const start = performance.now();
        profileResolution.resolveModelEnhanced(tmpDir, agentType);
        times.push(performance.now() - start);
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      
      console.log('\nAll Agent Types Average:', avg.toFixed(3), 'ms');
      
      assert.ok(
        avg < 100,
        `Average across agent types ${avg.toFixed(3)}ms exceeds 100ms target`
      );
    });
  });

  describe('Profile Loading Performance', () => {
    test('loadAllProfiles completes in <50ms average', () => {
      const iterations = 20;
      const times = [];

      // Measure iterations (loadAllProfiles is fast, no warmup needed)
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        profiles.loadAllProfiles(tmpDir);
        times.push(performance.now() - start);
      }

      const stats = calculateStats(times);
      
      console.log('\nProfile Loading Performance:');
      console.log(`  Average: ${stats.avg.toFixed(3)}ms`);
      console.log(`  P95: ${stats.p95.toFixed(3)}ms`);
      console.log(`  Max: ${stats.max.toFixed(3)}ms`);

      assert.ok(
        stats.avg < 50,
        `Average ${stats.avg.toFixed(3)}ms exceeds 50ms target`
      );
    });

    test('loadAllProfiles with profiles file present', () => {
      // Create a profiles file
      const profilesData = {
        profiles: [
          {
            name: 'test-profile',
            agents: {
              planning: ['claude-3-5-sonnet-20241022'],
              execution: ['claude-3-5-sonnet-20241022'],
              research: ['claude-3-5-sonnet-20241022'],
            },
          },
        ],
      };

      fs.writeFileSync(
        path.join(tmpDir, '.planning', 'profiles.json'),
        JSON.stringify(profilesData, null, 2)
      );

      const iterations = 20;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        profiles.loadAllProfiles(tmpDir);
        times.push(performance.now() - start);
      }

      const stats = calculateStats(times);
      
      console.log('\nProfile Loading (with file) Performance:');
      console.log(`  Average: ${stats.avg.toFixed(3)}ms`);

      assert.ok(
        stats.avg < 50,
        `Average ${stats.avg.toFixed(3)}ms exceeds 50ms target`
      );
    });
  });

  describe('Model Detection Performance', () => {
    test('detectAvailableModels completes in <10ms average', () => {
      const iterations = 20;
      const times = [];

      // Measure iterations
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        modelDetection.detectAvailableModels(tmpDir);
        times.push(performance.now() - start);
      }

      const stats = calculateStats(times);
      
      console.log('\nModel Detection Performance:');
      console.log(`  Average: ${stats.avg.toFixed(3)}ms`);
      console.log(`  P95: ${stats.p95.toFixed(3)}ms`);
      console.log(`  Max: ${stats.max.toFixed(3)}ms`);

      assert.ok(
        stats.avg < 10,
        `Average ${stats.avg.toFixed(3)}ms exceeds 10ms target`
      );
    });

    test('Runtime detection is fast', () => {
      const iterations = 50;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        modelDetection.detectRuntime(tmpDir);
        times.push(performance.now() - start);
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      
      console.log('\nRuntime Detection Average:', avg.toFixed(3), 'ms');

      assert.ok(
        avg < 5,
        `Average ${avg.toFixed(3)}ms exceeds 5ms target`
      );
    });
  });

  describe('Combined Workflow Performance', () => {
    test('Full resolution workflow (load + resolve) completes quickly', () => {
      const iterations = 15;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        // Simulate typical workflow
        const loaded = profiles.loadAllProfiles(tmpDir);
        const resolved = profileResolution.resolveModelEnhanced(tmpDir, 'gsd-executor');
        const detected = modelDetection.detectAvailableModels(tmpDir);
        
        times.push(performance.now() - start);
      }

      const stats = calculateStats(times);
      
      console.log('\nFull Workflow Performance:');
      console.log(`  Average: ${stats.avg.toFixed(3)}ms`);
      console.log(`  P95: ${stats.p95.toFixed(3)}ms`);
      console.log(`  Max: ${stats.max.toFixed(3)}ms`);

      // Combined should still be under 150ms
      assert.ok(
        stats.avg < 150,
        `Average ${stats.avg.toFixed(3)}ms exceeds 150ms combined target`
      );
    });
  });
});
