const fs = require('fs');
const filePath = 'create-e2e-dir.js';
const content = fs.readFileSync(filePath, 'utf8');

// Find the end of valid testFiles object - the }; marker
const validEndMarker = '\n};\n';
const validEndIdx = content.indexOf(validEndMarker);
if (validEndIdx === -1) { 
  console.error('ERROR: Could not find }; marker'); 
  process.exit(1); 
}

const validContent = content.substring(0, validEndIdx + validEndMarker.length);

// Append correct processing loop (no escaped backticks)
const footer = `
console.log('\\nCreating E2E test files...');
let fileCount = 0;

for (const [filename, content] of Object.entries(testFiles)) {
  const filepath = path.join(e2eDir, filename);
  fs.writeFileSync(filepath, content, 'utf8');
  console.log('✓ Created: ' + filename);
  fileCount++;
}

console.log('\\n✓ Successfully created ' + fileCount + ' E2E test files!\\n');
`;

fs.writeFileSync(filePath, validContent + footer, 'utf8');
console.log('✓ Fixed! Valid content length: ' + validContent.length);
