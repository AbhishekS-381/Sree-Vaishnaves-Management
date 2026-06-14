const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'test', 'unit', 'actions');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.ts'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  // Replace ID 'u1', 'b1', 'r1', 'd1', etc with 'test_value' in the mocks
  content = content.replace(/id: '[^']+'/g, `id: 'test_value'`);
  content = content.replace(/id: "[^"]+"/g, `id: 'test_value'`);
  
  // Replace the action calls that pass 'u1', 'b1' directly e.g. deleteUser('u1')
  content = content.replace(/\('[^']+'\)/g, `('test_value')`);

  fs.writeFileSync(filePath, content);
});
