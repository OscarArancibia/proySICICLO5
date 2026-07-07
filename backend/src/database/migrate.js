const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function runMigrations() {
    const client = await pool.connect();
    try {
        console.log('🔄 Iniciando migraciones de base de datos...');

        // 1. Crear la tabla de registro de migraciones si no existe
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                name VARCHAR(255) PRIMARY KEY,
                run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Obtener migraciones ya ejecutadas
        const { rows } = await client.query('SELECT name FROM schema_migrations;');
        const runMigrations = new Set(rows.map(r => r.name));

        // 3. Leer archivos de la carpeta de migraciones
        const migrationsDir = path.join(__dirname, 'migrations');
        if (!fs.existsSync(migrationsDir)) {
            console.log('⚠️ Carpeta de migraciones no encontrada.');
            return;
        }

        const files = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();

        // 4. Ejecutar las migraciones faltantes
        for (const file of files) {
            if (runMigrations.has(file)) {
                console.log(`🔹 Migración ${file} ya fue ejecutada anteriormente. Saltando...`);
                continue;
            }

            console.log(`🚀 Ejecutando migración: ${file}...`);
            const filePath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(filePath, 'utf8');

            // Ejecutar en una transacción para evitar inconsistencias en caso de error
            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (name) VALUES ($1);', [file]);
                await client.query('COMMIT');
                console.log(`✅ Migración ${file} ejecutada con éxito.`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`❌ Error ejecutando migración ${file}:`, err.message);
                throw err;
            }
        }

        console.log('🎉 Todas las migraciones se han procesado correctamente.');
    } catch (error) {
        console.error('💥 Proceso de migración fallido:', error);
        process.exit(1);
    } finally {
        client.release();
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    runMigrations().then(() => process.exit(0));
}

module.exports = runMigrations;
