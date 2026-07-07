const pool = require('../config/db');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const buscarEstudiante = async (req, res) => {
    const { ci } = req.query;
    if (!ci) return res.status(400).json({ message: 'CI requerido' });

    try {
        const result = await pool.query(
            `SELECT id_estudiante, nombre, apellido, ci, estado
             FROM estudiante WHERE ci = $1 AND estado = 'activo'`,
            [ci.trim()]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Estudiante no encontrado o inactivo' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error al buscar estudiante', error: error.message });
    }
};

const getDeudas = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(`
            SELECT
                d.id_deuda, d.id_estudiante,
                e.nombre || ' ' || e.apellido AS estudiante,
                e.ci AS estudiante_ci,
                d.id_gestion, ga.anio,
                d.id_concepto, cp.nombre_concepto,
                d.monto::text, d.mes,
                d.estado AS estado_deuda,
                d.fecha_generacion,
                p.id_pago,
                p.id_stripe_payment,
                p.monto_pagado::text,
                p.metodo_pago,
                p.estado AS estado_pago,
                p.fecha_pago,
                p.observaciones
            FROM deuda d
            JOIN estudiante e ON e.id_estudiante = d.id_estudiante
            JOIN gestion_academica ga ON ga.id_gestion = d.id_gestion
            JOIN concepto_pago cp ON cp.id_concepto = d.id_concepto
            LEFT JOIN LATERAL (
                SELECT * FROM pago p
                WHERE p.id_deuda = d.id_deuda
                ORDER BY p.fecha_pago DESC
                LIMIT 1
            ) p ON TRUE
            WHERE d.id_estudiante = $1
            ORDER BY d.fecha_generacion DESC
        `, [id]);

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener deudas', error: error.message });
    }
};

const crearPaymentIntent = async (req, res) => {
    const { id_deuda, id_estudiante } = req.body;

    if (!id_deuda || !id_estudiante) {
        return res.status(400).json({ message: 'id_deuda e id_estudiante son requeridos' });
    }

    try {
        const deudaResult = await pool.query(
            `SELECT * FROM deuda WHERE id_deuda = $1 AND id_estudiante = $2 AND estado != 'pagado'`,
            [id_deuda, id_estudiante]
        );
        if (deudaResult.rows.length === 0) {
            return res.status(404).json({ message: 'Deuda no encontrada o ya pagada' });
        }

        const deuda = deudaResult.rows[0];
        const monto = parseFloat(deuda.monto);

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(monto * 100),
            currency: process.env.STRIPE_CURRENCY || 'usd',
            metadata: {
                id_deuda: String(id_deuda),
                id_estudiante: String(id_estudiante),
                sistema: 'EduGestion'
            }
        });

        const pagoResult = await pool.query(`
            INSERT INTO pago (id_deuda, id_estudiante, monto_pagado, metodo_pago, estado, id_stripe_payment)
            VALUES ($1, $2, $3, 'stripe', 'pendiente_validacion', $4)
            RETURNING id_pago
        `, [id_deuda, id_estudiante, monto, paymentIntent.id]);

        res.json({
            clientSecret: paymentIntent.client_secret,
            id_pago: pagoResult.rows[0].id_pago
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al crear PaymentIntent', error: error.message });
    }
};

const verificarPago = async (req, res) => {
    const { id_pago } = req.params;

    try {
        const pagoResult = await pool.query(
            'SELECT * FROM pago WHERE id_pago = $1',
            [id_pago]
        );
        if (pagoResult.rows.length === 0) {
            return res.status(404).json({ message: 'Pago no encontrado' });
        }

        const pago = pagoResult.rows[0];
        let stripeStatus = null;

        if (pago.id_stripe_payment) {
            const pi = await stripe.paymentIntents.retrieve(pago.id_stripe_payment);
            stripeStatus = pi.status;

            if (pi.status === 'succeeded' && pago.estado !== 'completado') {
                await pool.query(
                    `UPDATE pago SET estado = 'completado' WHERE id_pago = $1`,
                    [id_pago]
                );
                // El trigger fn_actualizar_deuda_al_pagar solo reacciona a 'validado'.
                // Para pagos Stripe ('completado') lo hacemos manualmente.
                await pool.query(
                    `UPDATE deuda SET estado = 'pagado' WHERE id_deuda = $1`,
                    [pago.id_deuda]
                );
                pago.estado = 'completado';
            }
        }

        res.json({ pago: { estado: pago.estado }, stripeStatus });
    } catch (error) {
        res.status(500).json({ message: 'Error al verificar pago', error: error.message });
    }
};

module.exports = { buscarEstudiante, getDeudas, crearPaymentIntent, verificarPago };
