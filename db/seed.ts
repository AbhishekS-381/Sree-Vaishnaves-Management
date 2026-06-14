import { db } from './index';
import { jsonStore } from './schema';
import { seedData } from './seed-data';

async function seed() {
  console.log('Starting database seed...');
  
  for (const [filename, dataString] of Object.entries(seedData)) {
    try {
      await db.insert(jsonStore)
        .values({ filename, data: dataString })
        .onConflictDoNothing({ target: jsonStore.filename });
      console.log(`Seeded ${filename}`);
    } catch (error) {
      console.error(`Failed to seed ${filename}:`, error);
    }
  }
  
  console.log('Database seeding completed successfully!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('Unhandled seeding error:', error);
  process.exit(1);
});
