import 'dotenv/config'
import postgres from 'postgres'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const sql = postgres(DATABASE_URL, { max: 1 })

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function stripPrefix(val: string | null | undefined): string | null {
  if (val === null || val === undefined) return null
  if (val === 'u_owner_default') return '00000000-0000-0000-0000-000000000002'
  if (val === 'global') return '00000000-0000-0000-0000-000000000001'
  if (val === '__orphan') return '00000000-0000-0000-0000-000000000003'
  if (UUID_REGEX.test(val)) return val.toLowerCase()
  const idx = val.indexOf('_')
  if (idx !== -1) {
    const candidate = val.slice(idx + 1)
    if (UUID_REGEX.test(candidate)) return candidate.toLowerCase()
  }
  return val
}

async function main() {
  console.log('=== Starting UUID Migration on PostgreSQL database ===')

  await sql.begin(async (trx) => {
    // 1. Update data in all tables:
    console.log('1. Updating table IDs and FKs to clean UUIDs...')

    // branches
    console.log('  Updating branches...')
    const branches = await trx`SELECT pk, id FROM branches`
    for (const b of branches) {
      const newId = stripPrefix(b.id)
      await trx`UPDATE branches SET id = ${newId} WHERE pk = ${b.pk}`
    }

    // departments
    console.log('  Updating departments...')
    const departments = await trx`SELECT pk, id FROM departments`
    for (const d of departments) {
      await trx`UPDATE departments SET id = ${stripPrefix(d.id)} WHERE pk = ${d.pk}`
    }

    // roles
    console.log('  Updating roles...')
    const roles = await trx`SELECT pk, id, department_ids FROM roles`
    for (const r of roles) {
      let deptIds = r.department_ids
      if (Array.isArray(deptIds)) {
        deptIds = deptIds.map((d: string) => stripPrefix(d))
      }
      await trx`UPDATE roles SET id = ${stripPrefix(r.id)}, department_ids = ${JSON.stringify(deptIds)}::jsonb WHERE pk = ${r.pk}`
    }

    // categories (expense categories)
    console.log('  Updating categories...')
    const categories = await trx`SELECT pk, id FROM categories`
    for (const c of categories) {
      await trx`UPDATE categories SET id = ${stripPrefix(c.id)} WHERE pk = ${c.pk}`
    }

    // menu_categories
    console.log('  Updating menu_categories...')
    const menuCats = await trx`SELECT pk, id FROM menu_categories`
    for (const mc of menuCats) {
      await trx`UPDATE menu_categories SET id = ${stripPrefix(mc.id)} WHERE pk = ${mc.pk}`
    }

    // menu_items
    console.log('  Updating menu_items...')
    const menuItems = await trx`SELECT pk, id, category_id FROM menu_items`
    for (const mi of menuItems) {
      await trx`UPDATE menu_items SET id = ${stripPrefix(mi.id)}, category_id = ${stripPrefix(mi.category_id)} WHERE pk = ${mi.pk}`
    }

    // menu_item_variants
    console.log('  Updating menu_item_variants...')
    const variants = await trx`SELECT pk, id, menu_item_id FROM menu_item_variants`
    for (const v of variants) {
      await trx`UPDATE menu_item_variants SET id = ${stripPrefix(v.id)}, menu_item_id = ${stripPrefix(v.menu_item_id)} WHERE pk = ${v.pk}`
    }

    // branch_menu_items
    console.log('  Updating branch_menu_items...')
    const bmis = await trx`SELECT pk, id, branch_id, menu_item_id, variant_id FROM branch_menu_items`
    for (const b of bmis) {
      await trx`UPDATE branch_menu_items SET 
        id = ${stripPrefix(b.id)},
        branch_id = ${stripPrefix(b.branch_id)},
        menu_item_id = ${stripPrefix(b.menu_item_id)},
        variant_id = ${b.variant_id ? stripPrefix(b.variant_id) : null}
        WHERE pk = ${b.pk}`
    }

    // branch_categories
    console.log('  Updating branch_categories...')
    const bcats = await trx`SELECT pk, id, branch_id, category_id FROM branch_categories`
    for (const bc of bcats) {
      await trx`UPDATE branch_categories SET 
        id = ${stripPrefix(bc.id)},
        branch_id = ${stripPrefix(bc.branch_id)},
        category_id = ${stripPrefix(bc.category_id)}
        WHERE pk = ${bc.pk}`
    }

    // menu_price_history
    console.log('  Updating menu_price_history...')
    const mph = await trx`SELECT pk, id, menu_item_id, variant_id, branch_id FROM menu_price_history`
    for (const m of mph) {
      await trx`UPDATE menu_price_history SET 
        id = ${stripPrefix(m.id)},
        menu_item_id = ${stripPrefix(m.menu_item_id)},
        variant_id = ${m.variant_id ? stripPrefix(m.variant_id) : null},
        branch_id = ${m.branch_id ? stripPrefix(m.branch_id) : null}
        WHERE pk = ${m.pk}`
    }

    // staff
    console.log('  Updating staff...')
    const staff = await trx`SELECT pk, id, branch_id, department_id, role_id, specialty_id, position_id FROM staff`
    for (const s of staff) {
      await trx`UPDATE staff SET 
        id = ${stripPrefix(s.id)},
        branch_id = ${stripPrefix(s.branch_id)},
        department_id = ${stripPrefix(s.department_id)},
        role_id = ${stripPrefix(s.role_id)},
        specialty_id = ${s.specialty_id ? stripPrefix(s.specialty_id) : null},
        position_id = ${s.position_id ? stripPrefix(s.position_id) : null}
        WHERE pk = ${s.pk}`
    }

    // staff_requirements
    console.log('  Updating staff_requirements...')
    const reqs = await trx`SELECT pk, id, branch_id, department_id, role_id, position_id, specialty_id FROM staff_requirements`
    for (const r of reqs) {
      await trx`UPDATE staff_requirements SET 
        id = ${stripPrefix(r.id)},
        branch_id = ${stripPrefix(r.branch_id)},
        department_id = ${stripPrefix(r.department_id)},
        role_id = ${stripPrefix(r.role_id)},
        position_id = ${r.position_id ? stripPrefix(r.position_id) : null},
        specialty_id = ${r.specialty_id ? stripPrefix(r.specialty_id) : null}
        WHERE pk = ${r.pk}`
    }

    // attendance
    console.log('  Updating attendance...')
    const att = await trx`SELECT pk, id, staff_id, branch_id FROM attendance`
    for (const a of att) {
      await trx`UPDATE attendance SET 
        id = ${stripPrefix(a.id)},
        staff_id = ${stripPrefix(a.staff_id)},
        branch_id = ${stripPrefix(a.branch_id)}
        WHERE pk = ${a.pk}`
    }

    // payroll
    console.log('  Updating payroll...')
    const pay = await trx`SELECT pk, id, staff_id, branch_id FROM payroll`
    for (const p of pay) {
      await trx`UPDATE payroll SET 
        id = ${stripPrefix(p.id)},
        staff_id = ${stripPrefix(p.staff_id)},
        branch_id = ${p.branch_id ? stripPrefix(p.branch_id) : null}
        WHERE pk = ${p.pk}`
    }

    // eod
    console.log('  Updating eod...')
    const eods = await trx`SELECT pk, id, branch_id FROM eod`
    for (const e of eods) {
      await trx`UPDATE eod SET 
        id = ${stripPrefix(e.id)},
        branch_id = ${stripPrefix(e.branch_id)}
        WHERE pk = ${e.pk}`
    }

    // expenses
    console.log('  Updating expenses...')
    const exps = await trx`SELECT pk, id, branch_id, category_id FROM expenses`
    for (const ex of exps) {
      await trx`UPDATE expenses SET 
        id = ${stripPrefix(ex.id)},
        branch_id = ${stripPrefix(ex.branch_id)},
        category_id = ${stripPrefix(ex.category_id)}
        WHERE pk = ${ex.pk}`
    }

    // inventory
    console.log('  Updating inventory...')
    const inv = await trx`SELECT pk, id, branch_id FROM inventory`
    for (const i of inv) {
      await trx`UPDATE inventory SET 
        id = ${stripPrefix(i.id)},
        branch_id = ${stripPrefix(i.branch_id)}
        WHERE pk = ${i.pk}`
    }

    // stock_adjustments
    console.log('  Updating stock_adjustments...')
    const stAdj = await trx`SELECT pk, id, item_id, branch_id FROM stock_adjustments`
    for (const sa of stAdj) {
      await trx`UPDATE stock_adjustments SET 
        id = ${stripPrefix(sa.id)},
        item_id = ${stripPrefix(sa.item_id)},
        branch_id = ${stripPrefix(sa.branch_id)}
        WHERE pk = ${sa.pk}`
    }

    // vendors
    console.log('  Updating vendors...')
    const vens = await trx`SELECT pk, id, branch_id FROM vendors`
    for (const v of vens) {
      await trx`UPDATE vendors SET 
        id = ${stripPrefix(v.id)},
        branch_id = ${stripPrefix(v.branch_id)}
        WHERE pk = ${v.pk}`
    }

    // pos_tables
    console.log('  Updating pos_tables...')
    const ptbls = await trx`SELECT pk, id, branch_id FROM pos_tables`
    for (const pt of ptbls) {
      await trx`UPDATE pos_tables SET 
        id = ${stripPrefix(pt.id)},
        branch_id = ${stripPrefix(pt.branch_id)}
        WHERE pk = ${pt.pk}`
    }

    // pos_orders
    console.log('  Updating pos_orders...')
    const pords = await trx`SELECT pk, id, branch_id, table_id, items, void, opened_by FROM pos_orders`
    for (const po of pords) {
      let items = po.items
      if (Array.isArray(items)) {
        items = items.map((it: any) => ({
          ...it,
          id: stripPrefix(it.id),
          menuItemId: stripPrefix(it.menuItemId),
          variantId: it.variantId ? stripPrefix(it.variantId) : undefined,
        }))
      }
      let voidObj = po.void
      if (voidObj && typeof voidObj === 'object') {
        voidObj = {
          ...voidObj,
          voidedBy: stripPrefix(voidObj.voidedBy),
        }
      }
      await trx`UPDATE pos_orders SET 
        id = ${stripPrefix(po.id)},
        branch_id = ${stripPrefix(po.branch_id)},
        table_id = ${po.table_id ? stripPrefix(po.table_id) : null},
        opened_by = ${stripPrefix(po.opened_by) || po.opened_by},
        items = ${JSON.stringify(items)}::jsonb,
        void = ${voidObj ? JSON.stringify(voidObj) : null}::jsonb
        WHERE pk = ${po.pk}`
    }

    // pos_kots
    console.log('  Updating pos_kots...')
    const pkots = await trx`SELECT pk, id, order_id, branch_id, items, fired_by FROM pos_kots`
    for (const pk of pkots) {
      let items = pk.items
      if (Array.isArray(items)) {
        items = items.map((it: any) => ({
          ...it,
          menuItemId: it.menuItemId ? stripPrefix(it.menuItemId) : it.menuItemId,
          variantId: it.variantId ? stripPrefix(it.variantId) : undefined,
        }))
      }
      await trx`UPDATE pos_kots SET 
        id = ${stripPrefix(pk.id)},
        order_id = ${stripPrefix(pk.order_id)},
        branch_id = ${stripPrefix(pk.branch_id)},
        fired_by = ${stripPrefix(pk.fired_by) || pk.fired_by},
        items = ${JSON.stringify(items)}::jsonb
        WHERE pk = ${pk.pk}`
    }

    // config
    console.log('  Updating config...')
    await trx`UPDATE config SET id = '00000000-0000-0000-0000-000000000001' WHERE id = 'global'`

    // users
    console.log('  Updating users...')
    const users = await trx`SELECT pk, id, branch_id FROM users`
    for (const u of users) {
      await trx`UPDATE users SET 
        id = ${stripPrefix(u.id)},
        branch_id = ${u.branch_id ? stripPrefix(u.branch_id) : null}
        WHERE pk = ${u.pk}`
    }

    // audit_logs
    console.log('  Updating audit_logs...')
    const logs = await trx`SELECT pk, id, user_id, entity_id FROM audit_logs`
    for (const l of logs) {
      await trx`UPDATE audit_logs SET 
        id = ${stripPrefix(l.id)},
        user_id = ${l.user_id === 'system' ? 'system' : (stripPrefix(l.user_id) || l.user_id)},
        entity_id = ${l.entity_id ? stripPrefix(l.entity_id) : null}
        WHERE pk = ${l.pk}`
    }

    // advances
    console.log('  Updating advances...')
    const advs = await trx`SELECT pk, id, staff_id, branch_id FROM advances`
    for (const a of advs) {
      await trx`UPDATE advances SET 
        id = ${stripPrefix(a.id)},
        staff_id = ${stripPrefix(a.staff_id)},
        branch_id = ${stripPrefix(a.branch_id)}
        WHERE pk = ${a.pk}`
    }

    // daily_tally
    console.log('  Updating daily_tally...')
    const dt = await trx`SELECT pk, id, branch_id FROM daily_tally`
    for (const d of dt) {
      await trx`UPDATE daily_tally SET 
        id = ${stripPrefix(d.id)},
        branch_id = ${stripPrefix(d.branch_id)}
        WHERE pk = ${d.pk}`
    }

    console.log('All table data successfully converted to clean UUIDs.')

    // 2. ALTER COLUMNS TO UUID TYPE
    console.log('2. Altering PostgreSQL column types to UUID...')

    const alterStatements = [
      // branches
      `ALTER TABLE branches ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid();`,
      // departments
      `ALTER TABLE departments ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid();`,
      // roles
      `ALTER TABLE roles ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid();`,
      // categories
      `ALTER TABLE categories ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid();`,
      // menu_categories
      `ALTER TABLE menu_categories ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid();`,
      // menu_items
      `ALTER TABLE menu_items ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN category_id TYPE uuid USING category_id::uuid;`,
      // menu_item_variants
      `ALTER TABLE menu_item_variants ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN menu_item_id TYPE uuid USING menu_item_id::uuid;`,
      // branch_menu_items
      `ALTER TABLE branch_menu_items ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN branch_id TYPE uuid USING branch_id::uuid, ALTER COLUMN menu_item_id TYPE uuid USING menu_item_id::uuid, ALTER COLUMN variant_id TYPE uuid USING variant_id::uuid;`,
      // branch_categories
      `ALTER TABLE branch_categories ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN branch_id TYPE uuid USING branch_id::uuid, ALTER COLUMN category_id TYPE uuid USING category_id::uuid;`,
      // menu_price_history
      `ALTER TABLE menu_price_history ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN menu_item_id TYPE uuid USING menu_item_id::uuid, ALTER COLUMN variant_id TYPE uuid USING variant_id::uuid, ALTER COLUMN branch_id TYPE uuid USING branch_id::uuid;`,
      // staff
      `ALTER TABLE staff ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN branch_id TYPE uuid USING branch_id::uuid, ALTER COLUMN department_id TYPE uuid USING department_id::uuid, ALTER COLUMN role_id TYPE uuid USING role_id::uuid, ALTER COLUMN specialty_id TYPE uuid USING specialty_id::uuid, ALTER COLUMN position_id TYPE uuid USING position_id::uuid;`,
      // staff_requirements
      `ALTER TABLE staff_requirements ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN branch_id TYPE uuid USING branch_id::uuid, ALTER COLUMN department_id TYPE uuid USING department_id::uuid, ALTER COLUMN role_id TYPE uuid USING role_id::uuid, ALTER COLUMN position_id TYPE uuid USING position_id::uuid, ALTER COLUMN specialty_id TYPE uuid USING specialty_id::uuid;`,
      // attendance
      `ALTER TABLE attendance ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN staff_id TYPE uuid USING staff_id::uuid, ALTER COLUMN branch_id TYPE uuid USING branch_id::uuid;`,
      // payroll
      `ALTER TABLE payroll ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN staff_id TYPE uuid USING staff_id::uuid, ALTER COLUMN branch_id TYPE uuid USING branch_id::uuid;`,
      // eod
      `ALTER TABLE eod ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN branch_id TYPE uuid USING branch_id::uuid;`,
      // expenses
      `ALTER TABLE expenses ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN branch_id TYPE uuid USING branch_id::uuid, ALTER COLUMN category_id TYPE uuid USING category_id::uuid;`,
      // inventory
      `ALTER TABLE inventory ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN branch_id TYPE uuid USING branch_id::uuid;`,
      // stock_adjustments
      `ALTER TABLE stock_adjustments ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN item_id TYPE uuid USING item_id::uuid, ALTER COLUMN branch_id TYPE uuid USING branch_id::uuid;`,
      // vendors
      `ALTER TABLE vendors ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN branch_id TYPE uuid USING branch_id::uuid;`,
      // pos_tables
      `ALTER TABLE pos_tables ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN branch_id TYPE uuid USING branch_id::uuid;`,
      // pos_orders
      `ALTER TABLE pos_orders ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN branch_id TYPE uuid USING branch_id::uuid, ALTER COLUMN table_id TYPE uuid USING table_id::uuid;`,
      // pos_kots
      `ALTER TABLE pos_kots ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN order_id TYPE uuid USING order_id::uuid, ALTER COLUMN branch_id TYPE uuid USING branch_id::uuid;`,
      // config
      `ALTER TABLE config ALTER COLUMN id DROP DEFAULT, ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;`,
      // users
      `ALTER TABLE users ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN branch_id TYPE uuid USING branch_id::uuid;`,
      // audit_logs
      `ALTER TABLE audit_logs ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid();`,
      // advances
      `ALTER TABLE advances ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN staff_id TYPE uuid USING staff_id::uuid, ALTER COLUMN branch_id TYPE uuid USING branch_id::uuid;`,
      // daily_tally
      `ALTER TABLE daily_tally ALTER COLUMN id TYPE uuid USING id::uuid, ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN branch_id TYPE uuid USING branch_id::uuid;`,
    ]

    for (const stmt of alterStatements) {
      console.log(`  Executing: ${stmt.slice(0, 50)}...`)
      await trx.unsafe(stmt)
    }

    console.log('All column types successfully altered to UUID!')
  })

  // 3. Verify in information_schema
  console.log('3. Verifying column types in PostgreSQL information_schema...')
  const cols = await sql`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND (column_name = 'id' OR column_name LIKE '%_id')
      AND table_name NOT IN ('json_store', 'rate_limit')
    ORDER BY table_name, column_name;
  `
  console.log(`Found ${cols.length} ID/FK columns across tables:`)
  let allUuid = true
  for (const c of cols) {
    if (c.data_type !== 'uuid') {
      console.log(`  WARNING: ${c.table_name}.${c.column_name} is ${c.data_type}`)
      allUuid = false
    }
  }
  if (allUuid) {
    console.log(`All ${cols.length} ID and foreign key columns are verified PostgreSQL UUID!`)
  }

  await sql.end()
  console.log('=== UUID Migration Complete Successfully! ===')
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})

