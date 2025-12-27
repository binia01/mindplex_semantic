import { Client } from 'pg';

async function bootstrap() {
    const targetUrl = process.env.DATABASE_URL;

    if (!targetUrl) {
        console.error("DATABASE_URL is missing!");
        process.exit(1);
    }

    const urlObj = new URL(targetUrl);
    const targetDbName = urlObj.pathname.split('/')[1];

    urlObj.pathname = '/mindplex_shared';
    urlObj.searchParams.delete('ssl')
    const maintenanceUrl = urlObj.toString();

    console.log(`Connecting to administrative DB to check for "${targetDbName}"...`);

    const client = new Client({
        connectionString: maintenanceUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const checkRes = await client.query(
            `SELECT 1 FROM pg_database WHERE datname = $1`,
            [targetDbName]
        );

        if (checkRes.rowCount === 0) {
            console.log(`Database "${targetDbName}" missing. Creating it...`);
            await client.query(`CREATE DATABASE "${targetDbName}"`);
            console.log(`Database "${targetDbName}" created successfully!`);
        } else {
            console.log(`Database "${targetDbName}" already exists.`);
        }

    } catch (err) {
        console.error('Bootstrap failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

bootstrap();