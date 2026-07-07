const pool = require('../config/db');

const getMisDatos = async (req, res) => {
    const id_estudiante = req.usuario.id_estudiante;

    try {
        const result = await pool.query(
            `SELECT id_estudiante, nombre, apellido, ci, fecha_nacimiento, genero, estado, fecha_registro, observaciones
             FROM estudiante WHERE id_estudiante = $1`,
            [id_estudiante]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Estudiante no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener datos', error: error.message });
    }
};

const getMisCalificaciones = async (req, res) => {
    const id_estudiante = req.usuario.id_estudiante;

    try {
        const result = await pool.query(`
            SELECT
                m.id_materia, m.nombre_materia, cs.nombre_campo,
                ae.trimestre, de.nombre_dimension, de.puntaje_maximo,
                ae.id_actividad, ae.nombre_actividad, ae.fecha_actividad,
                cal.nota, cal.observaciones AS obs_calificacion,
                gest.anio, c.paralelo, g.nombre_grado
            FROM calificacion cal
            JOIN actividad_evaluacion ae ON cal.id_actividad = ae.id_actividad
            JOIN dimension_evaluacion de ON ae.id_dimension_eval = de.id_dimension_eval
            JOIN curso_materia cm ON ae.id_curso_materia = cm.id_curso_materia
            JOIN materia m ON cm.id_materia = m.id_materia
            JOIN campo_saber cs ON m.id_campo = cs.id_campo
            JOIN curso c ON cm.id_curso = c.id_curso
            JOIN grado g ON c.id_grado = g.id_grado
            JOIN gestion_academica gest ON c.id_gestion = gest.id_gestion
            WHERE cal.id_estudiante = $1
            ORDER BY gest.anio DESC, ae.trimestre, cs.orden_visualizacion, m.nombre_materia, de.nombre_dimension
        `, [id_estudiante]);

        // Misma estructura que expedienteController
        const calMap = {};
        for (const row of result.rows) {
            const gKey = String(row.anio);
            if (!calMap[gKey]) calMap[gKey] = { anio: row.anio, materias: {} };

            const mKey = row.id_materia;
            if (!calMap[gKey].materias[mKey]) {
                calMap[gKey].materias[mKey] = {
                    id_materia: row.id_materia,
                    nombre_materia: row.nombre_materia,
                    campo: row.nombre_campo,
                    trimestres: {}
                };
            }

            const tKey = row.trimestre;
            if (!calMap[gKey].materias[mKey].trimestres[tKey]) {
                calMap[gKey].materias[mKey].trimestres[tKey] = {};
            }

            const dKey = row.nombre_dimension;
            if (!calMap[gKey].materias[mKey].trimestres[tKey][dKey]) {
                calMap[gKey].materias[mKey].trimestres[tKey][dKey] = {
                    puntaje_maximo: parseFloat(row.puntaje_maximo),
                    actividades: [],
                    total_obtenido: 0
                };
            }

            const nota = parseFloat(row.nota);
            calMap[gKey].materias[mKey].trimestres[tKey][dKey].actividades.push({
                id_actividad: row.id_actividad,
                nombre_actividad: row.nombre_actividad,
                fecha_actividad: row.fecha_actividad,
                nota,
                observaciones: row.obs_calificacion
            });
            calMap[gKey].materias[mKey].trimestres[tKey][dKey].total_obtenido =
                parseFloat((calMap[gKey].materias[mKey].trimestres[tKey][dKey].total_obtenido + nota).toFixed(2));
        }

        const calArray = Object.values(calMap).map(g => ({
            ...g,
            materias: Object.values(g.materias).map(mat => ({
                ...mat,
                trimestres: Object.entries(mat.trimestres).map(([num, dims]) => ({
                    trimestre: parseInt(num),
                    dimensiones: Object.entries(dims).map(([dim, data]) => ({
                        dimension: dim,
                        puntaje_maximo: data.puntaje_maximo,
                        total_obtenido: data.total_obtenido,
                        actividades: data.actividades
                    }))
                }))
            }))
        }));

        res.json(calArray);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener calificaciones', error: error.message });
    }
};

const getMisDeudas = async (req, res) => {
    const id_estudiante = req.usuario.id_estudiante;

    try {
        const result = await pool.query(`
            SELECT
                d.id_deuda, d.id_estudiante, d.id_gestion, ga.anio,
                d.id_concepto, cp.nombre_concepto,
                d.monto::text, d.mes,
                d.estado AS estado_deuda, d.fecha_generacion,
                p.id_pago, p.monto_pagado::text, p.metodo_pago,
                p.estado AS estado_pago, p.fecha_pago, p.observaciones,
                p.id_stripe_payment
            FROM deuda d
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
        `, [id_estudiante]);

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener deudas', error: error.message });
    }
};

const getMisPagos = async (req, res) => {
    const id_estudiante = req.usuario.id_estudiante;

    try {
        const result = await pool.query(`
            SELECT
                p.id_pago, p.id_deuda,
                p.monto_pagado::text, p.metodo_pago,
                p.estado, p.fecha_pago, p.observaciones,
                p.id_stripe_payment,
                d.mes, d.monto::text AS monto_deuda,
                cp.nombre_concepto, ga.anio
            FROM pago p
            JOIN deuda d ON d.id_deuda = p.id_deuda
            JOIN concepto_pago cp ON cp.id_concepto = d.id_concepto
            JOIN gestion_academica ga ON ga.id_gestion = d.id_gestion
            WHERE p.id_estudiante = $1
            ORDER BY p.fecha_pago DESC
        `, [id_estudiante]);

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener pagos', error: error.message });
    }
};

module.exports = { getMisDatos, getMisCalificaciones, getMisDeudas, getMisPagos };
