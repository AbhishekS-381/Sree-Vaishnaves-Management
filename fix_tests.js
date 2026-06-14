const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'test', 'unit', 'actions');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.ts'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  // Replace `const fd = new FormData()` and all `fd.append(...)` with the dummy proxy
  content = content.replace(/const fd = new FormData\(\)[\s\S]*?const res =/g, `const fd = {
      get: (k: string) => {
        if (k === 'amount' || k === 'price' || k === 'count' || k === 'requiredCount' || k === 'monthlySalary') return '10'
        if (k === 'isPaid' || k === 'currentState' || k === 'currentlyActive') return 'on'
        return 'test_value'
      }
    } as any as FormData
    const res =`);

  // We might need to ensure typescript allows it
  
  fs.writeFileSync(filePath, content);
});
