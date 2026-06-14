const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const outPath = path.join(__dirname, 'db', 'seed-data.ts');

const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));

let outContent = `// Automatically generated from local JSON files\n\n`;
outContent += `export const seedData: Record<string, string> = {};\n\n`;

files.forEach(file => {
  const filePath = path.join(dataDir, file);
  try {
    let raw = fs.readFileSync(filePath, 'utf-8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    
    // Parse and stringify to minify and ensure valid JSON
    const parsed = JSON.parse(raw);
    const stringified = JSON.stringify(parsed);
    
    // Escape backticks and dollars if any
    const safeString = stringified.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    
    outContent += `seedData['${file}'] = \`${safeString}\`;\n`;
  } catch(e) {
    console.error(`Skipped ${file}`);
  }
});

fs.writeFileSync(outPath, outContent, 'utf-8');
console.log('Successfully generated db/seed-data.ts');
