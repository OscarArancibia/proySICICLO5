const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function runSeeders() {
    const client = await pool.connect();
    try {
        console.log('🔄 Iniciando inserción de datos semilla (seeders)...');

        // 1. Leer archivos de la carpeta de seeders
        const seedersDir = path.join(__dirname, 'seeders');
        if (!fs.existsSync(seedersDir)) {
            console.log('⚠️ Carpeta de seeders no encontrada.');
            return;
        }

        const files = fs.readdirSync(seedersDir)
            .filter(file => file.endsWith('.sql'))
            .sort();

        // 2. Desactivar temporalmente restricciones de llaves foráneas y disparadores para la carga
        console.log('🔒 Desactivando temporalmente restricciones de llaves foráneas (session_replication_role = replica)...');
        await client.query("SET session_replication_role = 'replica';");

        // 3. Ejecutar cada archivo de semillas
        for (const file of files) {
            console.log(`🌱 Ejecutando seeder: ${file}...`);
            const filePath = path.join(seedersDir, file);
            const sql = fs.readFileSync(filePath, 'utf8');

            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query('COMMIT');
                console.log(`✅ Seeder ${file} completado con éxito.`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`❌ Error ejecutando seeder ${file}:`, err.message);
                throw err;
            }
        }

        // 4. Reactivar restricciones de llaves foráneas
        console.log('🔓 Reactivando restricciones de llaves foráneas (session_replication_role = origin)...');
        await client.query("SET session_replication_role = 'origin';");

        console.log('🎉 Todos los seeders se han ejecutado correctamente.');
    } catch (error) {
        // Asegurarse de restaurar el rol en caso de error
        try {
            await client.query("SET session_replication_role = 'origin';");
        } catch (_) {}
        console.error('💥 Proceso de seeding fallido:', error);
        process.exit(1);
    } finally {
        client.release();
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    runSeeders().then(() => process.exit(0));
}

module.exports = runSeeders;
