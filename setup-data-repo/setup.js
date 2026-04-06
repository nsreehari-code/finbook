#!/usr/bin/env node
// setup-data-repo — Initialize a new finbook-data repository
// Usage: node setup-data-repo/setup.js <target-path> [options]
//   --name <repo-name>   Name for the repo (default: finbook-data)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help')) {
  console.log(`
Usage: node setup-data-repo/setup.js <target-path> [--name <repo-name>]

Creates a new finbook-data repository at <target-path> with:
  - DB/finbook.json        (empty database with config)
  - kb/knowledge.json      (empty knowledge base)
  - threads/               (batch processing directory)
  - .github/copilot-instructions.md  (AI steward brain)
  - .github/agents/kb-curator.agent.md
  - README.md

Example:
  node setup-data-repo/setup.js ../my-finbook-data
  node setup-data-repo/setup.js C:\\Users\\me\\repos\\family-finance --name family-finance
`);
  process.exit(0);
}

const targetPath = path.resolve(args[0]);
const nameIdx = args.indexOf('--name');
const repoName = nameIdx !== -1 && args[nameIdx + 1] ? args[nameIdx + 1] : path.basename(targetPath);

if (fs.existsSync(targetPath) && fs.readdirSync(targetPath).length > 0) {
  console.error(`Error: ${targetPath} already exists and is not empty.`);
  process.exit(1);
}

const templatesDir = path.join(__dirname, 'templates');

// Copy templates recursively
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log(`Creating finbook-data repo at: ${targetPath}`);

// Copy all templates
copyDir(templatesDir, targetPath);

// Create threads directory with .gitkeep
const threadsDir = path.join(targetPath, 'threads');
fs.mkdirSync(threadsDir, { recursive: true });
fs.writeFileSync(path.join(threadsDir, '.gitkeep'), '');

// Initialize git repo
execSync('git init', { cwd: targetPath, stdio: 'pipe' });
execSync('git add -A', { cwd: targetPath, stdio: 'pipe' });
execSync(`git commit -m "Initialize ${repoName} — empty finbook-data repo"`, { cwd: targetPath, stdio: 'pipe' });

console.log(`
Done! Repository initialized at: ${targetPath}

Next steps:
  1. Point finbook's server-config.json to this repo:
     { "repos": [{ "id": "${repoName}", "name": "${repoName}", "path": "<relative-path-to-repo>" }] }

  2. Add accounts to DB/finbook.json:
     { "AccountCode": "Rambo", "FullName": "Ram Babu P", ... }

  3. Start the finbook server and connect to this repo
`);
