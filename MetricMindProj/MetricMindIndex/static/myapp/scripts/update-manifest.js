#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const assetRoot = path.join(repoRoot, 'indicatorAssets');
const dashboardPattern = /^dashboard\d+$/;
const defaultDashboard = 'dashboard1';
const defaultLimit = 8;

function sortByDashboardNumber(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function readDirSafe(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true });
}

function listDashboards() {
  return readDirSafe(assetRoot)
    .filter(entry => entry.isDirectory() && dashboardPattern.test(entry.name))
    .map(entry => entry.name)
    .sort(sortByDashboardNumber);
}

function listYamlFiles(dashboard) {
  const dashboardDir = path.join(assetRoot, dashboard);
  return readDirSafe(dashboardDir)
    .filter(entry => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

function validateYamlFile(dashboard, file) {
  const fullPath = path.join(assetRoot, dashboard, file);
  const content = fs.readFileSync(fullPath, 'utf8');
  const errors = [];

  if (!/^metric:\s*$/m.test(content)) {
    errors.push('missing root key "metric:"');
  }
  if (!/^\s{2}name:\s*.+$/m.test(content)) {
    errors.push('missing metric.name');
  }

  return errors.map(error => `${path.relative(repoRoot, fullPath)}: ${error}`);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function main() {
  if (!fs.existsSync(assetRoot)) {
    throw new Error(`indicatorAssets not found: ${assetRoot}`);
  }

  const dashboards = listDashboards();
  if (dashboards.length === 0) {
    throw new Error('No dashboardN directories found under indicatorAssets');
  }

  const validationErrors = [];
  const emptyDashboards = [];
  const dashboardFiles = new Map();

  dashboards.forEach(dashboard => {
    const files = listYamlFiles(dashboard);
    if (files.length === 0) emptyDashboards.push(dashboard);
    dashboardFiles.set(dashboard, files);

    files.forEach(file => {
      validationErrors.push(...validateYamlFile(dashboard, file));
    });
  });

  if (validationErrors.length > 0) {
    console.error('Manifest generation failed. YAML validation errors:');
    validationErrors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
  }

  dashboardFiles.forEach((files, dashboard) => {
    writeJson(path.join(assetRoot, dashboard, 'manifest.json'), { files });
  });

  writeJson(path.join(assetRoot, 'manifest.json'), {
    dashboards,
    defaultDashboard: dashboards.includes(defaultDashboard) ? defaultDashboard : dashboards[0],
    defaultLimit,
  });

  console.log(`Updated indicatorAssets/manifest.json (${dashboards.length} dashboards)`);
  dashboards.forEach(dashboard => {
    const count = dashboardFiles.get(dashboard).length;
    console.log(`- ${dashboard}: ${count} yaml files`);
  });
  if (emptyDashboards.length > 0) {
    console.warn(`Warning: empty dashboards: ${emptyDashboards.join(', ')}`);
  }
}

main();
