const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'test', 'unit', 'actions');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.ts'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  // Replace await cb([{id: 'test_value'}]) or similar
  content = content.replace(/await cb\(\[\{[^}]+\}\]\)/g, `await cb([{id: 'test_value', name: 'test_value', username: 'test_value', password: 'test_value', role: 'test_value', branchId: 'test_value', departmentId: 'test_value', categoryId: 'test_value', isPaid: false, amount: 10, count: 10, requiredCount: 10, monthlySalary: 10, date: 'test_value', staffId: 'test_value', status: 'test_value', isActive: true, isAvailable: true}])`);

  // Same for readJSON mock
  content = content.replace(/readJSON: vi\.fn\(\)\.mockResolvedValue\(\[\]\)/g, `readJSON: vi.fn().mockResolvedValue([{id: 'test_value', name: 'test_value', username: 'test_value', password: 'test_value', role: 'test_value', branchId: 'test_value', departmentId: 'test_value', categoryId: 'test_value', isPaid: false, amount: 10, count: 10, requiredCount: 10, monthlySalary: 10, date: 'test_value', staffId: 'test_value', status: 'test_value', isActive: true, isAvailable: true}])`);

  fs.writeFileSync(filePath, content);
});
