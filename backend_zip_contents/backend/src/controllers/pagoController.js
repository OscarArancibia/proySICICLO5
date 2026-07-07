const pool = require('../config/db');
const { registrarBitacora, getClientIp } = require('../utils/bitacora');

const getConceptos = async (_req, res) => {
    try {
        const result = await pool.query('SELECT * FROM concepto_pago ORDER BY nombre_concepto');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener conceptos de pago', error: error.message });
    }
};

const createConcepto = async (req, res) => {
    const { nombre_concepto, descripcion } = req.body;

    if (!nombre_concepto) {
        return res.status(400).json({ message: 'El nombre del concepto es obligatorio' });
    }

    try {
        const result = await pool.query(`
            INSERT INTO concepto_pago (nombre_concepto, descripcion)
            VALUES ($1, $2)
            ON CONFLICT (nombre_concepto)
            DO UPDATE SET descripcion = EXCLUDED.descripcion
            RETURNING *
        `, [nombre_concepto, descripcion || null]);

        res.status(201).json({ message: 'Concepto guardado correctamente', concepto: result.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al guardar concepto', error: error.message });
    }
};

const getDeudas = async (req, res) => {
    const { search, estado, id_estudiante, id_gestion } = req.query;

    try {
        const conditions = [];
        const params = [];
        let idx = 1;

        if (search) {
            conditions.push(`(e.nombre || ' ' || e.apellido ILIKE $${idx} OR e.ci ILIKE $${idx} OR cp.nombre_concepto ILIKE $${idx})`);
            params.push(`%${search}%`);
            idx++;
        }
        if (estado) {
            conditions.push(`d.estado = $${idx++}`);
            params.push(estado);
        }
        if (id_estudiante) {
            conditions.push(`d.id_estudiante = $${idx++}`);
            params.push(id_estudiante);
        }
        if (id_gestion) {
            conditions.push(`d.id_gestion = $${idx++}`);
            params.push(id_gestion);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const result = await pool.query(`
            SELECT
                d.id_deuda,
                d.id_estudiante,
                e.nombre || ' ' || e.apellido AS estudiante,
                e.ci AS estudiante_ci,
                d.id_gestion,
                ga.anio,
                d.id_concepto,
                cp.nombre_concepto,
                d.monto,
                d.mes,
                d.estado AS estado_deuda,
                d.fecha_generacion,
                p.id_pago,
                p.monto_pagado,
                p.metodo_pago,
                p.estado AS estado_pago,
                p.fecha_pago,
                p.observaciones
            FROM deuda d
            JOIN estudiante e ON e.id_estudiante = d.id_estudiante
            JOIN gestion_academica ga ON ga.id_gestion = d.id_gestion
            JOIN concepto_pago cp ON cp.id_concepto = d.id_concepto
            LEFT JOIN LATERAL (
                SELECT *
                FROM pago p
                WHERE p.id_deuda = d.id_deuda
                ORDER BY p.fecha_pago DESC
                LIMIT 1
            ) p ON TRUE
            ${where}
            ORDER BY d.fecha_generacion DESC, e.apellido, e.nombre
        `, params);

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener deudas', error: error.message });
    }
};

const createDeuda = async (req, res) => {
    const { id_estudiante, id_gestion, id_concepto, monto, mes } = req.body;

    if (!id_estudiante || !id_gestion || !id_concepto || !monto || !mes) {
        return res.status(400).json({ message: 'Estudiante, gestion, concepto, monto y mes son obligatorios' });
    }

    try {
        const result = await pool.query(`
            INSERT INTO deuda (id_estudiante, id_gestion, id_concepto, monto, mes)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [id_estudiante, id_gestion, id_concepto, Number(monto), mes]);

        res.status(201).json({ message: 'Deuda generada correctamente', deuda: result.rows[0] });
    } catch (error) {
        const status = error.code === '23505' ? 409 : 500;
        res.status(status).json({ message: 'Error al generar deuda', error: error.message });
    }
};

const registrarPago = async (req, res) => {
    const { id_deuda, monto_pagado, metodo_pago, estado = 'validado', comprobante_url, observaciones } = req.body;

    if (!id_deuda || !monto_pagado || !metodo_pago) {
        return res.status(400).json({ message: 'Deuda, monto y metodo de pago son obligatorios' });
    }

    try {
        const deuda = await pool.query('SELECT id_estudiante FROM deuda WHERE id_deuda = $1', [id_deuda]);
        if (deuda.rows.length === 0) {
            return res.status(404).json({ message: 'Deuda no encontrada' });
        }

        const result = await pool.query(`
            INSERT INTO pago (
                id_deuda, id_estudiante, monto_pagado, metodo_pago,
                comprobante_url, estado, id_usuario_registro, observaciones
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            id_deuda,
            deuda.rows[0].id_estudiante,
            Number(monto_pagado),
            metodo_pago,
            comprobante_url || null,
            estado,
            req.usuario.id,
            observaciones || null
        ]);

        await registrarBitacora({
            id_usuario: req.usuario.id,
            nombre_modulo: 'pagos',
            nombre_permiso: 'gestionar_pagos',
            metodo: 'POST /api/pagos',
            accion: 'REGISTRAR_PAGO',
            tabla_afectada: 'pago',
            id_registro_afectado: result.rows[0].id_pago,
            descripcion: `Registro de pago para deuda ${id_deuda}`,
            ip_origen: getClientIp(req)
        });

        res.status(201).json({ message: 'Pago registrado correctamente', pago: result.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al registrar pago', error: error.message });
    }
};

const validarPago = async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;

    if (!['validado', 'rechazado', 'pendiente_validacion'].includes(estado)) {
        return res.status(400).json({ message: 'Estado de pago invalido' });
    }

    try {
        const result = await pool.query(
            'UPDATE pago SET estado = $1 WHERE id_pago = $2 RETURNING *',
            [estado, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Pago no encontrado' });
        }

        res.json({ message: 'Pago actualizado correctamente', pago: result.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar pago', error: error.message });
    }
};

module.exports = { getConceptos, createConcepto, getDeudas, createDeuda, registrarPago, validarPago };
