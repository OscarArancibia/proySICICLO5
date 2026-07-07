const pool = require('../config/db');

const getBitacora = async (req, res) => {
    const {
        search,
        accion,
        id_usuario,
        id_modulo,
        fecha_desde,
        fecha_hasta,
        limit = 100
    } = req.query;

    try {
        const conditions = ['1=1'];
        const params = [];
        let idx = 1;

        if (search) {
            conditions.push(`(
                b.descripcion ILIKE $${idx}
                OR b.tabla_afectada ILIKE $${idx}
                OR u.username ILIKE $${idx}
                OR m.nombre_modulo ILIKE $${idx}
                OR f.metodo ILIKE $${idx}
            )`);
            params.push(`%${search}%`);
            idx++;
        }

        if (accion) {
            conditions.push(`b.accion = $${idx++}`);
            params.push(accion);
        }

        if (id_usuario) {
            conditions.push(`b.id_usuario = $${idx++}`);
            params.push(id_usuario);
        }

        if (id_modulo) {
            conditions.push(`b.id_modulo = $${idx++}`);
            params.push(id_modulo);
        }

        if (fecha_desde) {
            conditions.push(`b.fecha_hora >= $${idx++}`);
            params.push(fecha_desde);
        }

        if (fecha_hasta) {
            conditions.push(`b.fecha_hora < ($${idx++}::date + INTERVAL '1 day')`);
            params.push(fecha_hasta);
        }

        const maxRows = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
        params.push(maxRows);

        const result = await pool.query(`
            SELECT
                b.id_bitacora,
                b.id_usuario,
                u.username,
                b.id_modulo,
                m.nombre_modulo,
                b.id_funcionalidad,
                f.metodo,
                b.accion,
                b.tabla_afectada,
                b.id_registro_afectado,
                b.descripcion,
                b.fecha_hora,
                b.ip_origen
            FROM bitacora b
            LEFT JOIN usuario u ON u.id_usuario = b.id_usuario
            LEFT JOIN modulo m ON m.id_modulo = b.id_modulo
            LEFT JOIN funcionalidad f ON f.id_funcionalidad = b.id_funcionalidad
            WHERE ${conditions.join(' AND ')}
            ORDER BY b.fecha_hora DESC, b.id_bitacora DESC
            LIMIT $${idx}
        `, params);

        res.json({ total: result.rows.length, bitacora: result.rows });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener la bitacora', error: error.message });
    }
};

const getBitacoraFiltros = async (_req, res) => {
    try {
        const [acciones, modulos, usuarios] = await Promise.all([
            pool.query('SELECT DISTINCT accion FROM bitacora ORDER BY accion'),
            pool.query('SELECT id_modulo, nombre_modulo FROM modulo WHERE estado = TRUE ORDER BY nombre_modulo'),
            pool.query('SELECT id_usuario, username FROM usuario ORDER BY username')
        ]);

        res.json({
            acciones: acciones.rows.map(row => row.accion),
            modulos: modulos.rows,
            usuarios: usuarios.rows
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener filtros de bitacora', error: error.message });
    }
};

module.exports = { getBitacora, getBitacoraFiltros };
