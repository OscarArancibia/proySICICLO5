const pool = require('../config/db');

const getModulosFuncionalidades = async (_req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                m.id_modulo,
                m.nombre_modulo,
                m.descripcion AS descripcion_modulo,
                COALESCE(
                    json_agg(
                        jsonb_build_object(
                            'id_funcionalidad', f.id_funcionalidad,
                            'metodo', f.metodo,
                            'descripcion', f.descripcion,
                            'id_permiso', p.id_permiso,
                            'nombre_permiso', p.nombre_permiso
                        )
                        ORDER BY f.metodo
                    ) FILTER (WHERE f.id_funcionalidad IS NOT NULL),
                    '[]'
                ) AS funcionalidades
            FROM modulo m
            LEFT JOIN funcionalidad f ON f.id_modulo = m.id_modulo AND f.estado = TRUE
            LEFT JOIN permiso p ON p.id_permiso = f.id_permiso
            WHERE m.estado = TRUE
            GROUP BY m.id_modulo, m.nombre_modulo, m.descripcion
            ORDER BY m.nombre_modulo
        `);

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener modulos y funcionalidades', error: error.message });
    }
};

module.exports = { getModulosFuncionalidades };
