import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { readJSON, DB_FILES } from './src/lib/db';

async function main() {
  const users = await readJSON(DB_FILES.USERS);
  console.log(JSON.stringify(users, null, 2));
  process.exit(0);
}

main().catch(console.error);
