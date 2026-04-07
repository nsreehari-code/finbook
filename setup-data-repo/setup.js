#!/usr/bin/env node
// setup-data-repo — Initialize or update a finbook-data repository
// Usage: node setup-data-repo/setup.js <target-path> [options]
//   --name <repo-name>   Name for the repo (default: finbook-data)
//   --update             Update templates in an existing repo (skip data files)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help')) {
  console.log(`
Usage: node setup-data-repo/setup.js <target-path> [--name <repo-name>] [--update]

Modes:
  (default)   Create a new finbook-data repository from templates
  --update    Update infrastructure files in an existing repo (agents,
              copilot-instructions, .gitignore, README) without touching
              user data (DB/, kb/, threads/)

Creates / updates:
  - .github/copilot-instructions.md   (AI steward orchestrator)
  - .github/agents/*.agent.md         (subagent definitions)
  - .gitignore
  - README.md
  - DB/finbook.json        (new repo only — empty database with config)
  - kb/knowledge.json      (new repo only — empty knowledge base)
  - threads/               (new repo only — batch processing directory)

Example:
  node setup-data-repo/setup.js ../my-finbook-data
  node setup-data-repo/setup.js ../existing-finbook-data --update
  node setup-data-repo/setup.js C:\\Users\\me\\repos\\family-finance --name family-finance
`);
  process.exit(0);
}

const targetPath = path.resolve(args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--name'));
const nameIdx = args.indexOf('--name');
const repoName = nameIdx !== -1 && args[nameIdx + 1] ? args[nameIdx + 1] : path.basename(targetPath);
const isUpdate = args.includes('--update');

const templatesDir = path.join(__dirname, 'templates');

// Files that are safe to overwrite on update (infrastructure, not user data)
const INFRA_PATHS = [
  '.github',
  '.gitignore',
  'README.md',
];

// Copy a directory recursively
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

// Copy only infrastructure files from templates into target
function updateInfra(templatesDir, targetPath) {
  let updated = 0;
  for (const relPath of INFRA_PATHS) {
    const src = path.join(templatesDir, relPath);
    const dest = path.join(targetPath, relPath);
    if (!fs.existsSync(src)) continue;
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      copyDir(src, dest);
      console.log(`  updated ${relPath}/`);
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      console.log(`  updated ${relPath}`);
    }
    updated++;
  }
  return updated;
}

function git(cmd, cwd) {
  return execSync(`git ${cmd}`, { cwd, stdio: 'pipe', encoding: 'utf8' }).trim();
}

if (isUpdate) {
  // --- Update mode ---
  if (!fs.existsSync(targetPath)) {
    console.error(`Error: ${targetPath} does not exist. Use without --update to create a new repo.`);
    process.exit(1);
  }

  // 1. Remember current branch
  const originalBranch = git('rev-parse --abbrev-ref HEAD', targetPath);
  const onMain = originalBranch === 'main';
  console.log(`Current branch: ${originalBranch}`);

  // 2. Stash uncommitted changes (if any)
  const stashOutput = git('stash push -m "setup-update: auto-stash"', targetPath);
  const didStash = !stashOutput.includes('No local changes');
  if (didStash) console.log('Stashed uncommitted changes.');

  try {
    // 3. Checkout main
    if (!onMain) {
      git('checkout main', targetPath);
      console.log('Checked out main.');
    }

    // 4. Update infra files
    console.log(`Updating templates in: ${targetPath}`);
    const count = updateInfra(templatesDir, targetPath);

    // 5. Commit (only if there are changes)
    const status = git('status --porcelain', targetPath);
    if (status) {
      git('add -A', targetPath);
      git('commit -m "Update infrastructure templates from finbook"', targetPath);
      console.log('Committed template updates on main.');
    } else {
      console.log('No changes to commit — templates already up to date.');
    }

    // 6. Switch back to original branch
    if (!onMain) {
      git(`checkout ${originalBranch}`, targetPath);
      console.log(`Switched back to ${originalBranch}.`);

      // 7. Rebase onto main
      git('rebase main', targetPath);
      console.log(`Rebased ${originalBranch} onto main.`);
    }

    // 8. Stash pop
    if (didStash) {
      git('stash pop', targetPath);
      console.log('Restored stashed changes.');
    }

    console.log(`\nDone — updated ${count} infrastructure path(s). Data files (DB/, kb/) were not touched.`);
  } catch (err) {
    console.error(`\nError during update: ${err.message}`);
    console.error('You may need to resolve conflicts manually.');
    if (didStash) console.error('Your stashed changes are still in git stash.');
    process.exit(1);
  }
} else {
  // --- New repo mode ---
  if (fs.existsSync(targetPath) && fs.readdirSync(targetPath).length > 0) {
    console.error(`Error: ${targetPath} already exists and is not empty. Use --update to sync templates.`);
    process.exit(1);
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
}
