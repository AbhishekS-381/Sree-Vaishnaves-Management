import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';

async function main() {
  const dbDir = path.resolve(process.cwd(), '.local-db');
  const pg = new EmbeddedPostgres({
    databaseDir: dbDir,
    port: 5432,
    user: 'postgres',
    password: 'password',
    persistent: true,
  });

  try {
    console.log('[local-db] Initializing cluster if needed...');
    await pg.initialise().catch((err: any) => {
      // If already initialized, ignore error
      if (!err?.message?.includes('already exists') && !err?.message?.includes('Directory not empty')) {
        console.log('[local-db] Note during init:', err?.message || err);
      }
    });

    console.log('[local-db] Starting local PostgreSQL on port 5432...');
    await pg.start();
    console.log('[local-db] PostgreSQL server is UP and listening on port 5432.');

    try {
      await pg.createDatabase('restaurant_db');
      console.log('[local-db] Database "restaurant_db" created or already exists.');
    } catch {
      console.log('[local-db] Database "restaurant_db" ready.');
    }

    console.log('[local-db] Local database is ready to accept connections.');
    console.log('[local-db] Connection URL: postgresql://postgres:password@localhost:5432/restaurant_db');

    // Keep process alive
    const keepAlive = setInterval(() => {}, 1000 * 60 * 60);

    const shutdown = async () => {
      console.log('[local-db] Stopping PostgreSQL...');
      clearInterval(keepAlive);
      try {
        await pg.stop();
        console.log('[local-db] PostgreSQL stopped cleanly.');
      } catch (e) {
        console.error('[local-db] Error during stop:', e);
      }
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('[local-db] Fatal error:', error);
    process.exit(1);
  }
}

main();

