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
    urlObj.searchParams.delete('ssl');
    const maintenanceUrl = urlObj.toString();

    console.log(`Connecting to administrative DB to check for "${targetDbName}"...`);

    const maintenanceClient = new Client({
        connectionString: maintenanceUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await maintenanceClient.connect();

        const checkRes = await maintenanceClient.query(
            `SELECT 1 FROM pg_database WHERE datname = $1`,
            [targetDbName]
        );

        if (checkRes.rowCount === 0) {
            console.log(`Database "${targetDbName}" missing. Creating it...`);
            await maintenanceClient.query(`CREATE DATABASE "${targetDbName}"`);
            console.log(`Database "${targetDbName}" created successfully!`);
        } else {
            console.log(`Database "${targetDbName}" already exists.`);
        }

    } catch (err) {
        console.error('Bootstrap DB creation failed:', err);
        process.exit(1);
    } finally {
        await maintenanceClient.end();
    }

    console.log(`Installing required extensions in "${targetDbName}"...`);

    const targetClient = new Client({
        connectionString: targetUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await targetClient.connect();

        await targetClient.query('CREATE EXTENSION IF NOT EXISTS vector;');

        await targetClient.query('CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;');

        await targetClient.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');

        console.log(`Bootstrap completed successfully!`);

    } catch (err) {
        console.error('Extension installation failed:', err);
        process.exit(1);
    } finally {
        await targetClient.end();
    }
}

bootstrap();