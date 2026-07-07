const pool = require('../config/db');

const getRoles = async (req, res) => {
    try {
        const query = `
            SELECT r.id_rol, r.nombre_rol, r.descripcion, r.estado, 
                   COUNT(DISTINCT rp.id_permiso) as cantidad_permisos,
                   COUNT(DISTINCT rf.id_funcionalidad) as cantidad_funcionalidades
            FROM rol r
            LEFT JOIN rol_permiso rp ON r.id_rol = rp.id_rol
            LEFT JOIN rol_funcionalidad rf ON r.id_rol = rf.id_rol
            GROUP BY r.id_rol
            ORDER BY r.id_rol ASC
        `;

        const result = await pool.query(query);

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener el listado de los roles', error: error.message });
    }
}

const getPermissions = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                p.id_permiso,
                p.nombre_permiso,
                p.descripcion,
                COALESCE(m.nombre_modulo, 'general') AS modulo,
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'id_funcionalidad', f.id_funcionalidad,
                            'metodo', f.metodo,
                            'descripcion', f.descripcion
                        )
                    ) FILTER (WHERE f.id_funcionalidad IS NOT NULL),
                    '[]'
                ) AS funcionalidades
            FROM permiso p
            LEFT JOIN funcionalidad f ON f.id_permiso = p.id_permiso AND f.estado = TRUE
            LEFT JOIN modulo m ON m.id_modulo = f.id_modulo AND m.estado = TRUE
            GROUP BY p.id_permiso, p.nombre_permiso, p.descripcion, m.nombre_modulo
            ORDER BY modulo, p.nombre_permiso
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener el listado de permisos.', error: error.message });
    }
}

const createRole = async (req, res) => {
    const { nombre_rol, descripcion, permisos = [], funcionalidades = [] } = req.body;
    const tienePermisos = Array.isArray(permisos) && permisos.length > 0;
    const tieneFuncionalidades = Array.isArray(funcionalidades) && funcionalidades.length > 0;

    if (!nombre_rol || (!tienePermisos && !tieneFuncionalidades)) {
        return res.status(400).json({ message: 'El nombre del rol y la lista de funcionalidades son obligatorios.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const roleResult = await client.query(
            'INSERT INTO rol (nombre_rol, descripcion) VALUES ($1, $2) RETURNING id_rol',
            [nombre_rol, descripcion]
        );
        const newRoleId = roleResult.rows[0].id_rol;

        let permisosUnicos = [];
        let funcionalidadesUnicas = [];

        if (tieneFuncionalidades) {
            funcionalidadesUnicas = [...new Set(funcionalidades.map(Number))].filter(Number.isInteger);

            if (funcionalidadesUnicas.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'La lista de funcionalidades no es válida.' });
            }

            const funcionalidadesResult = await client.query(
                `SELECT id_funcionalidad, id_permiso
                 FROM funcionalidad
                 WHERE estado = TRUE
                   AND id_funcionalidad = ANY($1::int[])`,
                [funcionalidadesUnicas]
            );

            if (funcionalidadesResult.rows.length !== funcionalidadesUnicas.length) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Una o más funcionalidades no existen o están inactivas.' });
            }

            permisosUnicos = [...new Set(funcionalidadesResult.rows.map(row => row.id_permiso))];

            for (const funcionalidadId of funcionalidadesUnicas) {
                await client.query(
                    'INSERT INTO rol_funcionalidad (id_rol, id_funcionalidad) VALUES ($1, $2)',
                    [newRoleId, funcionalidadId]
                );
            }
        } else {
            permisosUnicos = [...new Set(permisos.map(Number))].filter(Number.isInteger);

            if (permisosUnicos.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'La lista de permisos no es válida.' });
            }

            const funcionalidadesResult = await client.query(
                `SELECT id_funcionalidad
                 FROM funcionalidad
                 WHERE estado = TRUE
                   AND id_permiso = ANY($1::int[])`,
                [permisosUnicos]
            );

            funcionalidadesUnicas = funcionalidadesResult.rows.map(row => row.id_funcionalidad);

            for (const funcionalidadId of funcionalidadesUnicas) {
                await client.query(
                    'INSERT INTO rol_funcionalidad (id_rol, id_funcionalidad) VALUES ($1, $2)',
                    [newRoleId, funcionalidadId]
                );
            }
        }

        for (const permisoId of permisosUnicos) {
            await client.query(
                'INSERT INTO rol_permiso (id_rol, id_permiso) VALUES ($1, $2)',
                [newRoleId, permisoId]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Rol creado correctamente.', id_rol: newRoleId });
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
            return res.status(400).json({ message: 'El nombre del rol ya está en uso.' });
        }

        res.status(500).json({ message: 'Error al crear el nuevo rol.', error: error.message });
    } finally {
        client.release();
    }
}

const deleteRole = async (req, res) => {
    const { id } = req.params;

    try {
        const userCheck = await pool.query(
            'SELECT COUNT(*) FROM usuario WHERE id_rol = $1 AND estado = TRUE',
            [id]
        );

        if (parseInt(userCheck.rows[0].count) > 0) {
            return res.status(400).json({
                message: 'No se puede eliminar el rol porque hay usuarios activos asociados. Desactive el rol o cambie el rol de los usuarios primero.'
            });
        }

        const deleteResult = await pool.query('DELETE FROM rol WHERE id_rol = $1 RETURNING *', [id]);

        if (deleteResult.rows.length === 0) {
            return res.status(404).json({ message: 'Rol no encontrado.' });
        }

        res.json({ message: 'Rol eliminado correctamente.' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar el rol.', error: error.message });
    }
}

module.exports = { getRoles, getPermissions, createRole, deleteRole };
