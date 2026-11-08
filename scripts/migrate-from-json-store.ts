import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';

interface MigrationResult {
  collection: string;
  read: number;
  inserted: number;
  skipped: number;
  error?: string;
}

// Phase 0: Environment validation
function validateEnv() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
  const targetUrl = process.env.DATABASE_URL;

  if (!sourceUrl || !targetUrl) {
    console.error('Error: DATABASE_URL (and optional SOURCE_DATABASE_URL) must be set in environment.');
    process.exit(1);
  }

  const aivenCert = process.env.AIVEN_CA_CERT;
  return { sourceUrl, targetUrl, aivenCert };
}

function parseDate(val: any): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export async function runMigration(): Promise<boolean> {
  const { sourceUrl, targetUrl, aivenCert } = validateEnv();

  const sourceSsl = aivenCert
    ? { rejectUnauthorized: true, ca: aivenCert }
    : (sourceUrl.includes('sslmode=require') || sourceUrl.includes('netlify.com') || sourceUrl.includes('neon.tech') ? 'require' : undefined);
  const targetSsl = targetUrl.includes('sslmode=require') ? 'require' : false;

  const sourceSql = postgres(sourceUrl, {
    ssl: sourceSsl,
    max: 1,
    connect_timeout: 10,
  });

  const targetSql = postgres(targetUrl, {
    ssl: targetSsl,
    max: 2,
    connect_timeout: 10,
  });

  const targetDb = drizzle({ client: targetSql, schema });

  const backupDir = path.join(process.cwd(), 'migration-backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log('--- Phase 1: Fetching JSON store and creating local backups ---');
  let jsonStoreRows: { filename: string; data: string }[] = [];
  try {
    jsonStoreRows = await sourceSql`SELECT filename, data FROM json_store`;
    console.log(`Fetched ${jsonStoreRows.length} files from json_store.`);
  } catch (err) {
    console.error('Failed to read from json_store:', err);
    await sourceSql.end();
    await targetSql.end();
    return false;
  }

  const fileMap = new Map<string, any[]>();

  for (const row of jsonStoreRows) {
    try {
      const backupPath = path.join(backupDir, row.filename);
      fs.writeFileSync(backupPath, row.data, 'utf8');

      const parsed = JSON.parse(row.data);
      fileMap.set(row.filename, Array.isArray(parsed) ? parsed : [parsed]);
    } catch (parseErr) {
      console.error(`Failed to parse/backup ${row.filename}:`, parseErr);
    }
  }

  console.log('--- Phase 2 & 3: Transforming and upserting into relational tables ---');

  const results: MigrationResult[] = [];

  // Helper to migrate single table with id upsert
  async function migrateCollection(
    collectionName: string,
    filename: string,
    table: any,
    transformFn: (item: any) => any,
    conflictTarget: any = table.id
  ) {
    const items = fileMap.get(filename) || [];
    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
      try {
        const transformed = transformFn(item);
        if (!transformed) {
          skipped++;
          continue;
        }

        await targetDb
          .insert(table)
          .values(transformed)
          .onConflictDoUpdate({
            target: conflictTarget,
            set: transformed,
          });
        inserted++;
      } catch (insertErr) {
        console.error(`Error inserting into ${collectionName} [id: ${item?.id}]:`, insertErr);
        skipped++;
      }
    }

    results.push({ collection: collectionName, read: items.length, inserted, skipped });
  }

  // 1. Config
  const configItems = fileMap.get('config.json') || [];
  let configInserted = 0;
  let configSkipped = 0;
  for (const item of configItems) {
    try {
      const row = {
        id: 'global',
        attendance: Boolean(item.attendance),
        payroll: Boolean(item.payroll),
        vendors: Boolean(item.vendors),
        inventory: Boolean(item.inventory),
        menu: item.menu !== undefined ? Boolean(item.menu) : true,
        reports: Boolean(item.reports),
        pos: item.pos !== undefined ? Boolean(item.pos) : true,
        posDefaultGstPercent: Number(item.posDefaultGstPercent) || 5,
      };
      await targetDb
        .insert(schema.config)
        .values(row)
        .onConflictDoUpdate({
          target: schema.config.id,
          set: row,
        });
      configInserted++;
    } catch (e) {
      console.error('Error inserting config:', e);
      configSkipped++;
    }
  }
  results.push({ collection: 'config', read: configItems.length, inserted: configInserted, skipped: configSkipped });

  // 2. Branches
  await migrateCollection('branches', 'branches.json', schema.branches, (b) => ({
    id: b.id,
    name: b.name,
    address: b.address || null,
    phone: b.phone || null,
    status: b.status || 'operational',
    internalStartTime: b.internalStartTime || null,
    internalEndTime: b.internalEndTime || null,
    customerStartTime: b.customerStartTime || null,
    customerEndTime: b.customerEndTime || null,
    isActive: b.isActive !== undefined ? Boolean(b.isActive) : true,
    deletedAt: parseDate(b.deletedAt),
  }));

  // 3. Departments
  await migrateCollection('departments', 'departments.json', schema.departments, (d) => ({
    id: d.id,
    name: d.name,
    isActive: d.isActive !== undefined ? Boolean(d.isActive) : true,
    deletedAt: parseDate(d.deletedAt),
  }));

  // 4. Roles
  await migrateCollection('roles', 'roles.json', schema.roles, (r) => ({
    id: r.id,
    name: r.name,
    isChef: Boolean(r.isChef),
    departmentIds: r.departmentIds || [],
    isActive: r.isActive !== undefined ? Boolean(r.isActive) : true,
    deletedAt: parseDate(r.deletedAt),
  }));

  // 5. Staff
  await migrateCollection('staff', 'staff.json', schema.staff, (s) => ({
    id: s.id,
    name: s.name,
    branchId: s.branchId,
    departmentId: s.departmentId,
    roleId: s.roleId,
    phone: s.phone,
    label: s.label || null,
    monthlySalary: Number(s.monthlySalary) || 0,
    isActive: s.isActive !== undefined ? Boolean(s.isActive) : true,
    joinedAt: s.joinedAt || null,
    exitDate: s.exitDate || null,
    shiftType: s.shiftType || null,
    positionId: s.positionId || null,
    positionIndex: s.positionIndex !== undefined ? Number(s.positionIndex) : null,
    deletedAt: parseDate(s.deletedAt),
  }));

  // 6. Staff Requirements
  await migrateCollection('staff_requirements', 'staff_requirements.json', schema.staffRequirements, (sr) => ({
    id: sr.id,
    branchId: sr.branchId,
    departmentId: sr.departmentId,
    roleId: sr.roleId,
    positionId: sr.positionId || null,
    name: sr.name || null,
    requiredCount: sr.requiredCount !== undefined ? Number(sr.requiredCount) : 1,
    shiftType: sr.shiftType || null,
    specialtyId: sr.specialtyId || null,
    defaultSalary: sr.defaultSalary !== undefined && sr.defaultSalary !== null ? Number(sr.defaultSalary) : null,
    startTime: sr.startTime || null,
    endTime: sr.endTime || null,
    responsibility: sr.responsibility || null,
    schedules: sr.schedules || null,
    isActive: sr.isActive !== undefined ? Boolean(sr.isActive) : true,
  }));

  // 7. Attendance
  await migrateCollection('attendance', 'attendance.json', schema.attendance, (a) => ({
    id: a.id,
    branchId: a.branchId,
    date: a.date,
    records: a.records || [],
    createdAt: parseDate(a.createdAt) || new Date(),
    updatedAt: parseDate(a.updatedAt) || new Date(),
  }));

  // 8. Payroll
  await migrateCollection('payroll', 'payroll.json', schema.payroll, (p) => ({
    id: p.id,
    staffId: p.staffId,
    branchId: p.branchId || null,
    name: p.name,
    month: Number(p.month),
    year: Number(p.year),
    monthlySalary: Number(p.monthlySalary) || 0,
    daysWorked: Number(p.daysWorked) || 0,
    advances: Number(p.advances) || 0,
    payableAmount: Number(p.payableAmount) || 0,
    status: p.status || 'PENDING',
    notes: p.notes || null,
    paidAt: parseDate(p.paidAt),
  }));

  // 9. EOD
  await migrateCollection('eod', 'eod.json', schema.eod, (e) => ({
    id: e.id,
    branchId: e.branchId,
    date: e.date,
    income: e.income || {},
    openingFloat: (e.openingFloat !== undefined && e.openingFloat !== null) ? Number(e.openingFloat) : null,
    actualClosingFloat: (e.actualClosingFloat !== undefined && e.actualClosingFloat !== null) ? Number(e.actualClosingFloat) : null,
    notes: e.notes || null,
    status: e.status || 'submitted',
    billing: e.billing || null,
    ops: e.ops || null,
    createdAt: parseDate(e.createdAt) || new Date(),
    updatedAt: parseDate(e.updatedAt) || new Date(),
  }));

  // 10. Expenses
  await migrateCollection('expenses', 'expenses.json', schema.expenses, (ex) => ({
    id: ex.id,
    branchId: ex.branchId,
    amount: Number(ex.amount) || 0,
    categoryId: ex.categoryId,
    source: ex.source || 'manual',
    date: ex.date,
    notes: ex.notes || null,
    isPaid: Boolean(ex.isPaid),
    createdAt: parseDate(ex.createdAt) || new Date(),
  }));

  // 11. Categories
  await migrateCollection('categories', 'categories.json', schema.categories, (c) => ({
    id: c.id,
    name: c.name,
    color: c.color || null,
    isActive: c.isActive !== undefined ? Boolean(c.isActive) : true,
    deletedAt: parseDate(c.deletedAt),
  }));

  // 12. Menu Items
  await migrateCollection('menu_items', 'menu.json', schema.menuItems, (m) => {
    let basePrice = Number(m.basePrice);
    if (!basePrice || isNaN(basePrice)) {
      for (const [filename, shardItems] of fileMap.entries()) {
        if (filename.startsWith('branch_menu_items') && Array.isArray(shardItems)) {
          const found = shardItems.find((b: any) => b.menuItemId === m.id && b.price != null);
          if (found && found.price != null) {
            basePrice = Number(found.price);
            break;
          }
        }
      }
    }
    if (!basePrice || isNaN(basePrice)) basePrice = 0;

    return {
      id: m.id,
      name: m.name,
      categoryId: m.categoryId,
      basePrice,
      sortOrder: Number(m.sortOrder) || 0,
      isActive: m.isActive !== undefined ? Boolean(m.isActive) : true,
      description: m.description || null,
      imageUrl: m.imageUrl || null,
      costPrice: (m.costPrice !== undefined && m.costPrice !== null) ? Number(m.costPrice) : null,
      dietary: m.dietary || null,
      spiceLevel: (m.spiceLevel !== undefined && m.spiceLevel !== null) ? Number(m.spiceLevel) : null,
      allergens: m.allergens || null,
      isSignature: Boolean(m.isSignature),
      prepTimeMins: (m.prepTimeMins !== undefined && m.prepTimeMins !== null) ? Number(m.prepTimeMins) : null,
      availability: m.availability || null,
      createdAt: parseDate(m.createdAt) || new Date(),
      updatedAt: parseDate(m.updatedAt) || new Date(),
      deletedAt: parseDate(m.deletedAt),
    };
  });

  // 13. Menu Categories
  await migrateCollection('menu_categories', 'menu_categories.json', schema.menuCategories, (mc) => ({
    id: mc.id,
    name: mc.name,
    sortOrder: Number(mc.sortOrder) || 0,
    isActive: mc.isActive !== undefined ? Boolean(mc.isActive) : true,
    deletedAt: parseDate(mc.deletedAt),
  }));

  // 14. Branch Menu Items (Handle shards: branch_menu_items.json first, then branch_menu_items_*.json)
  const bmiShards = Array.from(fileMap.keys())
    .filter((k) => k.startsWith('branch_menu_items'))
    .sort((a, b) => {
      if (a === 'branch_menu_items.json') return -1;
      if (b === 'branch_menu_items.json') return 1;
      return a.localeCompare(b);
    });

  let bmiTotalRead = 0;
  let bmiInserted = 0;
  let bmiSkipped = 0;

  for (const filename of bmiShards) {
    const shardItems = fileMap.get(filename) || [];
    bmiTotalRead += shardItems.length;

    for (const item of shardItems) {
      try {
        const row = {
          id: item.id,
          branchId: item.branchId,
          menuItemId: item.menuItemId,
          variantId: item.variantId || null,
          price: (item.price !== undefined && item.price !== null) ? Number(item.price) : null,
          isAvailable: item.isAvailable !== undefined ? Boolean(item.isAvailable) : true,
        };
        await targetDb
          .insert(schema.branchMenuItems)
          .values(row)
          .onConflictDoUpdate({
            target: schema.branchMenuItems.id,
            set: row,
          });
        bmiInserted++;
      } catch (err) {
        console.error(`Error inserting branchMenuItem [id: ${item?.id}]:`, err);
        bmiSkipped++;
      }
    }
  }
  results.push({ collection: 'branch_menu_items', read: bmiTotalRead, inserted: bmiInserted, skipped: bmiSkipped });

  // 15. Branch Categories
  await migrateCollection('branch_categories', 'branch_categories.json', schema.branchCategories, (bc) => ({
    id: bc.id,
    branchId: bc.branchId,
    categoryId: bc.categoryId,
    isAvailable: bc.isAvailable !== undefined ? Boolean(bc.isAvailable) : true,
  }));

  // 16. Menu Item Variants
  await migrateCollection('menu_item_variants', 'menu_item_variants.json', schema.menuItemVariants, (v) => ({
    id: v.id,
    menuItemId: v.menuItemId,
    name: v.name,
    basePrice: Number(v.basePrice) || 0,
    sortOrder: Number(v.sortOrder) || 0,
    isActive: v.isActive !== undefined ? Boolean(v.isActive) : true,
    deletedAt: parseDate(v.deletedAt),
  }));

  // 17. Menu Price History
  await migrateCollection('menu_price_history', 'menu_price_history.json', schema.menuPriceHistory, (mph) => ({
    id: mph.id,
    menuItemId: mph.menuItemId,
    variantId: mph.variantId || null,
    branchId: mph.branchId || null,
    scope: mph.scope || 'global',
    oldPrice: mph.oldPrice !== null && mph.oldPrice !== undefined ? Number(mph.oldPrice) : null,
    newPrice: mph.newPrice !== null && mph.newPrice !== undefined ? Number(mph.newPrice) : null,
    changedBy: mph.changedBy || 'system',
    changedByName: mph.changedByName || mph.changedBy || 'Admin',
    changedAt: parseDate(mph.changedAt) || parseDate(mph.effectiveDate) || new Date(),
  }));

  // 18. Inventory
  await migrateCollection('inventory', 'inventory.json', schema.inventory, (inv) => ({
    id: inv.id,
    branchId: inv.branchId,
    name: inv.name,
    unit: inv.unit || 'unit',
    currentQuantity: Number(inv.currentQuantity ?? inv.currentStock) || 0,
    threshold: Number(inv.threshold ?? inv.minThreshold) || 0,
    updatedAt: parseDate(inv.updatedAt) || parseDate(inv.createdAt) || new Date(),
    isActive: inv.isActive !== undefined ? Boolean(inv.isActive) : true,
    deletedAt: parseDate(inv.deletedAt),
  }));

  // 19. Stock Adjustments
  await migrateCollection('stock_adjustments', 'stock_adjustments.json', schema.stockAdjustments, (sa) => ({
    id: sa.id,
    itemId: sa.itemId,
    branchId: sa.branchId,
    type: sa.type,
    quantity: Number(sa.quantity) || 0,
    costPerUnit: Number(sa.costPerUnit) || 0,
    reason: sa.reason || '',
    date: sa.date,
    createdAt: parseDate(sa.createdAt) || new Date(),
  }));

  // 20. Vendors
  await migrateCollection('vendors', 'vendors.json', schema.vendors, (v) => ({
    id: v.id,
    branchId: v.branchId,
    name: v.name,
    phone: v.phone || null,
    email: v.email || null,
    address: v.address || null,
    notes: v.notes || null,
    isActive: v.isActive !== undefined ? Boolean(v.isActive) : true,
    createdAt: parseDate(v.createdAt) || new Date(),
    updatedAt: parseDate(v.updatedAt) || new Date(),
    deletedAt: parseDate(v.deletedAt),
  }));

  // 21. POS Tables
  await migrateCollection('pos_tables', 'pos_tables.json', schema.posTables, (pt) => ({
    id: pt.id,
    branchId: pt.branchId,
    name: pt.name,
    isActive: pt.isActive !== undefined ? Boolean(pt.isActive) : true,
    createdAt: parseDate(pt.createdAt) || new Date(),
    updatedAt: parseDate(pt.updatedAt) || new Date(),
    deletedAt: parseDate(pt.deletedAt),
  }));

  // 22. POS Orders
  await migrateCollection('pos_orders', 'pos_orders.json', schema.posOrders, (po) => ({
    id: po.id,
    branchId: po.branchId,
    orderType: po.orderType,
    tableId: po.tableId || null,
    takeawayNumber: po.takeawayNumber || null,
    status: po.status,
    date: po.date,
    covers: (po.covers !== undefined && po.covers !== null) ? Number(po.covers) : null,
    openedBy: po.openedBy,
    items: po.items || [],
    kotCount: Number(po.kotCount) || 0,
    bill: po.bill || null,
    payment: po.payment || null,
    void: po.void || null,
    notes: po.notes || null,
    createdAt: parseDate(po.createdAt) || new Date(),
    updatedAt: parseDate(po.updatedAt) || new Date(),
  }));

  // 23. POS KOTs
  await migrateCollection('pos_kots', 'pos_kots.json', schema.posKots, (pk) => ({
    id: pk.id,
    branchId: pk.branchId,
    orderId: pk.orderId,
    kotNumber: Number(pk.kotNumber) || 1,
    items: pk.items || [],
    status: pk.status || 'pending',
    firedBy: pk.firedBy,
    firedAt: parseDate(pk.firedAt) || new Date(),
    updatedAt: parseDate(pk.updatedAt) || new Date(),
  }));

  // 24. Users
  await migrateCollection('users', 'users.json', schema.users, (u) => ({
    id: u.id,
    name: u.name,
    password: u.password || null,
    role: u.role,
    branchId: u.branchId || null,
    isActive: u.isActive !== undefined ? Boolean(u.isActive) : true,
    deletedAt: parseDate(u.deletedAt),
  }));

  // 25. Audit Logs
  await migrateCollection('audit_logs', 'audit_logs.json', schema.auditLogs, (al) => ({
    id: al.id,
    timestamp: parseDate(al.timestamp) || new Date(),
    userId: al.userId,
    userName: al.userName,
    action: al.action,
    entityType: al.entityType,
    entityId: al.entityId || null,
    details: al.details || '',
  }));

  // 26. Advances
  await migrateCollection('advances', 'advances.json', schema.advances, (adv) => ({
    id: adv.id,
    staffId: adv.staffId,
    branchId: adv.branchId,
    amount: Number(adv.amount) || 0,
    date: adv.date,
    notes: adv.notes || null,
    createdAt: parseDate(adv.createdAt) || new Date(),
  }));

  // 27. Daily Tally
  await migrateCollection('daily_tally', 'daily_tally.json', schema.dailyTally, (dt) => ({
    id: dt.id,
    branchId: dt.branchId,
    date: dt.date,
    data: dt.data || {},
    createdAt: parseDate(dt.createdAt) || new Date(),
  }));

  console.log('--- Phase 4: Migration Summary Report ---');
  console.table(results);

  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);

  await sourceSql.end();
  await targetSql.end();

  if (totalSkipped > 0) {
    console.error(`Migration completed with ${totalSkipped} skipped record(s).`);
    return false;
  }

  console.log('Migration completed successfully with zero skips!');
  return true;
}

if (require.main === module || process.argv[1]?.endsWith('migrate-from-json-store.ts')) {
  runMigration()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((err) => {
      console.error('Fatal migration error:', err);
      process.exit(1);
    });
}

