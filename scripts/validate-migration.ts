import 'dotenv/config';
import postgres from 'postgres';

interface ValidationRow {
  collection: string;
  jsonCount: number;
  relationalCount: number;
  status: 'MATCH' | 'MISMATCH';
}

const COLLECTIONS: { name: string; filename: string; table: string; isSharded?: boolean }[] = [
  { name: 'config', filename: 'config.json', table: 'config' },
  { name: 'branches', filename: 'branches.json', table: 'branches' },
  { name: 'departments', filename: 'departments.json', table: 'departments' },
  { name: 'roles', filename: 'roles.json', table: 'roles' },
  { name: 'staff', filename: 'staff.json', table: 'staff' },
  { name: 'staff_requirements', filename: 'staff_requirements.json', table: 'staff_requirements' },
  { name: 'attendance', filename: 'attendance.json', table: 'attendance' },
  { name: 'payroll', filename: 'payroll.json', table: 'payroll' },
  { name: 'eod', filename: 'eod.json', table: 'eod' },
  { name: 'expenses', filename: 'expenses.json', table: 'expenses' },
  { name: 'categories', filename: 'categories.json', table: 'categories' },
  { name: 'menu_items', filename: 'menu.json', table: 'menu_items' },
  { name: 'menu_categories', filename: 'menu_categories.json', table: 'menu_categories' },
  { name: 'branch_menu_items', filename: 'branch_menu_items', table: 'branch_menu_items', isSharded: true },
  { name: 'branch_categories', filename: 'branch_categories.json', table: 'branch_categories' },
  { name: 'menu_item_variants', filename: 'menu_item_variants.json', table: 'menu_item_variants' },
  { name: 'menu_price_history', filename: 'menu_price_history.json', table: 'menu_price_history' },
  { name: 'inventory', filename: 'inventory.json', table: 'inventory' },
  { name: 'stock_adjustments', filename: 'stock_adjustments.json', table: 'stock_adjustments' },
  { name: 'vendors', filename: 'vendors.json', table: 'vendors' },
  { name: 'pos_tables', filename: 'pos_tables.json', table: 'pos_tables' },
  { name: 'pos_orders', filename: 'pos_orders.json', table: 'pos_orders' },
  { name: 'pos_kots', filename: 'pos_kots.json', table: 'pos_kots' },
  { name: 'users', filename: 'users.json', table: 'users' },
  { name: 'audit_logs', filename: 'audit_logs.json', table: 'audit_logs' },
  { name: 'advances', filename: 'advances.json', table: 'advances' },
  { name: 'daily_tally', filename: 'daily_tally.json', table: 'daily_tally' },
];

export async function runValidation(): Promise<boolean> {
  const sourceDbUrl = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
  const targetDbUrl = process.env.DATABASE_URL;
  if (!targetDbUrl || !sourceDbUrl) {
    console.error('Error: DATABASE_URL is not set.');
    return false;
  }

  const aivenCert = process.env.AIVEN_CA_CERT;
  const sourceSsl = aivenCert
    ? { rejectUnauthorized: true, ca: aivenCert }
    : (sourceDbUrl.includes('sslmode=require') || sourceDbUrl.includes('netlify.com') || sourceDbUrl.includes('neon.tech') ? 'require' : undefined);
  const targetSsl = targetDbUrl.includes('sslmode=require') ? 'require' : false;

  const sourceSql = postgres(sourceDbUrl, {
    ssl: sourceSsl,
    max: 1,
    connect_timeout: 10,
  });

  const targetSql = postgres(targetDbUrl, {
    ssl: targetSsl,
    max: 1,
    connect_timeout: 10,
  });

  console.log('--- Starting Migration Validation ---');

  const rows: ValidationRow[] = [];
  let allMatched = true;

  try {
    for (const c of COLLECTIONS) {
      let jsonCount = 0;

      if (c.isSharded) {
        const records = await sourceSql<{ filename: string; data: string }[]>`
          SELECT filename, data FROM json_store WHERE filename LIKE 'branch_menu_items%'
        `;
        const ids = new Set<string>();
        for (const r of records) {
          try {
            const arr = JSON.parse(r.data);
            if (Array.isArray(arr)) {
              for (const it of arr) {
                if (it?.id) ids.add(it.id);
              }
            }
          } catch {}
        }
        jsonCount = ids.size;
      } else {
        const records = await sourceSql<{ data: string }[]>`
          SELECT data FROM json_store WHERE filename = ${c.filename} LIMIT 1
        `;
        if (records.length > 0 && records[0].data) {
          try {
            const parsed = JSON.parse(records[0].data);
            jsonCount = Array.isArray(parsed) ? parsed.length : 1;
          } catch {}
        }
      }

      // Count relational table rows
      const countRes = await targetSql<[{ count: string }]>`
        SELECT COUNT(*)::text as count FROM ${targetSql(c.table)}
      `;
      const relationalCount = parseInt(countRes[0]?.count || '0', 10);

      const status: 'MATCH' | 'MISMATCH' = jsonCount === relationalCount ? 'MATCH' : 'MISMATCH';
      if (status === 'MISMATCH') {
        allMatched = false;
      }

      rows.push({
        collection: c.name,
        jsonCount,
        relationalCount,
        status,
      });
    }

    console.table(rows);

    if (allMatched) {
      console.log('✓ All 27 collections match 100% between json_store and relational tables.');
    } else {
      console.error('✗ Validation failed: Mismatch detected between json_store and relational tables.');
    }
  } catch (err) {
    console.error('Validation query error:', err);
    allMatched = false;
  } finally {
    await sourceSql.end();
    await targetSql.end();
  }

  return allMatched;
}

if (require.main === module || process.argv[1]?.endsWith('validate-migration.ts')) {
  runValidation()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((err) => {
      console.error('Fatal validation error:', err);
      process.exit(1);
    });
}

