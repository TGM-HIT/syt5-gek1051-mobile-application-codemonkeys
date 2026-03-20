#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

try {
  // Read coverage data
  const coverageFile = './frontend/coverage/coverage-summary.json';
  if (!fs.existsSync(coverageFile)) {
    console.error('Coverage file not found');
    process.exit(1);
  }

  const coverage = require(path.resolve(coverageFile));
  const total = coverage.total;
  
  // Calculate average coverage
  const avgCoverage = Math.round(
    (total.lines.pct + total.branches.pct + total.functions.pct + total.statements.pct) / 4
  );
  
  // Determine color based on coverage
  let color = 'red';
  if (avgCoverage >= 80) color = 'brightgreen';
  else if (avgCoverage >= 70) color = 'green';
  else if (avgCoverage >= 60) color = 'yellow';

  // Read README
  let readme = fs.readFileSync('README.md', 'utf8');

  // Update badges
  readme = readme.replace(
    /!\[Coverage\]\(https:\/\/img\.shields\.io\/badge\/coverage-[^)]*\)/,
    `![Coverage](https://img.shields.io/badge/coverage-${avgCoverage}%25-${color})`
  );

  // Update test badge (from coverage stats)
  const statements = Math.round(total.statements.total);
  readme = readme.replace(
    /!\[Tests\]\(https:\/\/img\.shields\.io\/badge\/tests-[^)]*\)/,
    `![Tests](https://img.shields.io/badge/tests-${statements}%2B-blue)`
  );

  // Update E2E badge status
  const e2eStatus = process.env.E2E_PASSED === 'true' ? '✓-Passing' : 'Pending';
  const e2eColor = process.env.E2E_PASSED === 'true' ? 'brightgreen' : 'blue';
  readme = readme.replace(
    /!\[E2E\]\(https:\/\/img\.shields\.io\/badge\/E2E-[^)]*\)/,
    `![E2E](https://img.shields.io/badge/E2E-${e2eStatus}-${e2eColor})`
  );

  // Write updated README
  fs.writeFileSync('README.md', readme, 'utf8');
  console.log('✓ Badges updated successfully');
  console.log(`  Coverage: ${avgCoverage}% (${color})`);
  console.log(`  Statements: ${statements}+`);
} catch (error) {
  console.error('Error updating badges:', error.message);
  process.exit(1);
}
