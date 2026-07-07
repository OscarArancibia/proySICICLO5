const pool = require('../config/db');

const requierePermiso = (nombrePermiso) => {
    return async (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({ message: 'Acceso denegado. Token requerido.' });
        }

        if (req.usuario.role === 1) {
            return next();
        }

        try {
            const result = await pool.query(`
                SELECT 1
                FROM rol_permiso rp
                JOIN permiso p ON p.id_permiso = rp.id_permiso
                WHERE rp.id_rol = $1
                  AND p.nombre_permiso = $2
                LIMIT 1
            `, [req.usuario.role, nombrePermiso]);

            if (result.rows.length === 0) {
                return res.status(403).json({ message: 'Operación rechazada. No tiene el permiso requerido.' });
            }

            next();
        } catch (error) {
            res.status(500).json({ message: 'Error al validar permisos.', error: error.message });
        }
    };
};

const requiereFuncionalidad = (metodo) => {
    return async (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({ message: 'Acceso denegado. Token requerido.' });
        }

        if (req.usuario.role === 1) {
            return next();
        }

        try {
            const result = await pool.query(`
                SELECT 1
                FROM rol_funcionalidad rf
                JOIN funcionalidad f ON f.id_funcionalidad = rf.id_funcionalidad
                WHERE rf.id_rol = $1
                  AND f.metodo = $2
                  AND f.estado = TRUE
                LIMIT 1
            `, [req.usuario.role, metodo]);

            if (result.rows.length === 0) {
                return res.status(403).json({ message: 'Operación rechazada. No tiene la funcionalidad requerida.' });
            }

            next();
        } catch (error) {
            res.status(500).json({ message: 'Error al validar funcionalidades.', error: error.message });
        }
    };
};

module.exports = { requierePermiso, requiereFuncionalidad };
