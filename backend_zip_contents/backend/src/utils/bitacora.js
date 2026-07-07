const pool = require('../config/db');

const getClientIp = (req) => {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.ip || req.connection?.remoteAddress || null;
};

const registrarBitacora = async ({
    id_usuario = null,
    nombre_modulo = null,
    nombre_permiso = null,
    metodo = null,
    accion,
    tabla_afectada = null,
    id_registro_afectado = null,
    descripcion = null,
    ip_origen = null
}) => {
    try {
        const contexto = await pool.query(`
            SELECT m.id_modulo, f.id_funcionalidad
            FROM modulo m
            LEFT JOIN funcionalidad f ON f.id_modulo = m.id_modulo
            LEFT JOIN permiso p ON p.id_permiso = f.id_permiso
            WHERE ($1::text IS NULL OR m.nombre_modulo = $1)
              AND ($2::text IS NULL OR p.nombre_permiso = $2)
              AND ($3::text IS NULL OR f.metodo = $3)
            ORDER BY f.id_funcionalidad NULLS LAST
            LIMIT 1
        `, [nombre_modulo, nombre_permiso, metodo]);

        const row = contexto.rows[0] || {};

        await pool.query(`
            INSERT INTO bitacora (
                id_usuario, id_modulo, id_funcionalidad, accion,
                tabla_afectada, id_registro_afectado, descripcion, ip_origen
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            id_usuario,
            row.id_modulo || null,
            row.id_funcionalidad || null,
            accion,
            tabla_afectada,
            id_registro_afectado,
            descripcion,
            ip_origen
        ]);
    } catch (error) {
        console.error('Error registrando bitacora:', error.message);
    }
};

module.exports = { registrarBitacora, getClientIp };
