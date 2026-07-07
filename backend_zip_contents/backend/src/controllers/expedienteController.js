const pool = require('../config/db');

const consultarExpediente = async (req, res) => {
    const { id_estudiante } = req.params;
    const rolUsuario = req.usuario.role;
    // Roles: 1=SuperUsuario, 2=Director, 3=Profesor, 4=Administrativo(Secretaria)

    try {
        // ── 1. Datos personales ─────────────────────────────────────────────
        const personalData = await pool.query(
            'SELECT * FROM estudiante WHERE id_estudiante = $1',
            [id_estudiante]
        );
        if (personalData.rows.length === 0) {
            return res.status(404).json({ message: 'Estudiante no encontrado' });
        }

        // ── 2. Tutores vinculados ───────────────────────────────────────────
        const tutoresData = await pool.query(`
            SELECT t.id_tutor, t.nombre, t.apellido, t.ci, t.genero,
                   t.telefono, t.correo_electronico, t.direccion,
                   te.parentesco, te.autorizado_recoger, te.contacto_emergencia
            FROM tutor t
            JOIN tutor_estudiante te ON t.id_tutor = te.id_tutor
            WHERE te.id_estudiante = $1
            ORDER BY te.autorizado_recoger DESC, t.apellido
        `, [id_estudiante]);

        // ── 3. Historial de inscripciones ───────────────────────────────────
        const inscripcionesData = await pool.query(`
            SELECT i.id_inscripcion, i.fecha_inscripcion, i.estado, i.observaciones,
                   c.id_curso, c.paralelo, c.turno,
                   g.nombre_grado, n.nombre_nivel,
                   gest.id_gestion, gest.anio,
                   p.nombre || ' ' || p.apellido AS profesor_titular
            FROM inscripcion i
            JOIN curso c ON i.id_curso = c.id_curso
            JOIN grado g ON c.id_grado = g.id_grado
            JOIN nivel n ON g.id_nivel = n.id_nivel
            JOIN gestion_academica gest ON c.id_gestion = gest.id_gestion
            JOIN profesor p ON c.id_profesor = p.id_profesor
            WHERE i.id_estudiante = $1
            ORDER BY gest.anio DESC, i.fecha_inscripcion DESC
        `, [id_estudiante]);

        // ── 4. Calificaciones por materia, dimensión y trimestre ────────────
        // Acceso: todos los roles (Profesor ve solo su curso activo)
        const calificacionesData = await pool.query(`
            SELECT
                m.id_materia,
                m.nombre_materia,
                cs.nombre_campo,
                ae.trimestre,
                de.nombre_dimension,
                de.puntaje_maximo,
                ae.id_actividad,
                ae.nombre_actividad,
                ae.fecha_actividad,
                cal.nota,
                cal.observaciones AS obs_calificacion,
                gest.anio,
                c.paralelo,
                g.nombre_grado
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

        // Estructurar calificaciones: { gestion: { materia: { trimestre: { dimension: [actividades] } } } }
        const calificacionesEstructuradas = {};
        for (const row of calificacionesData.rows) {
            const gKey = `${row.anio}`;
            if (!calificacionesEstructuradas[gKey]) {
                calificacionesEstructuradas[gKey] = {
                    anio: row.anio,
                    materias: {}
                };
            }
            const mKey = row.id_materia;
            if (!calificacionesEstructuradas[gKey].materias[mKey]) {
                calificacionesEstructuradas[gKey].materias[mKey] = {
                    id_materia: row.id_materia,
                    nombre_materia: row.nombre_materia,
                    campo: row.nombre_campo,
                    trimestres: {}
                };
            }
            const tKey = row.trimestre;
            if (!calificacionesEstructuradas[gKey].materias[mKey].trimestres[tKey]) {
                calificacionesEstructuradas[gKey].materias[mKey].trimestres[tKey] = {};
            }
            const dKey = row.nombre_dimension;
            if (!calificacionesEstructuradas[gKey].materias[mKey].trimestres[tKey][dKey]) {
                calificacionesEstructuradas[gKey].materias[mKey].trimestres[tKey][dKey] = {
                    puntaje_maximo: parseFloat(row.puntaje_maximo),
                    actividades: [],
                    total_obtenido: 0
                };
            }
            const nota = parseFloat(row.nota);
            calificacionesEstructuradas[gKey].materias[mKey].trimestres[tKey][dKey].actividades.push({
                id_actividad: row.id_actividad,
                nombre_actividad: row.nombre_actividad,
                fecha_actividad: row.fecha_actividad,
                nota,
                observaciones: row.obs_calificacion
            });
            calificacionesEstructuradas[gKey].materias[mKey].trimestres[tKey][dKey].total_obtenido =
                parseFloat((calificacionesEstructuradas[gKey].materias[mKey].trimestres[tKey][dKey].total_obtenido + nota).toFixed(2));
        }
        // Convertir objetos anidados a arrays para serialización limpia
        const calificacionesArray = Object.values(calificacionesEstructuradas).map(g => ({
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

        // ── 5. Asistencias del período activo ───────────────────────────────
        // Solo Admin, Director, Secretaria (4) y el propio Profesor del curso
        let asistencias = [];
        const asistenciasData = await pool.query(`
            SELECT
                a.fecha,
                a.estado AS estado_asistencia,
                a.observaciones AS obs_asistencia,
                c.id_curso, c.paralelo, c.turno,
                g.nombre_grado,
                gest.anio,
                COUNT(*) OVER (PARTITION BY a.id_curso, a.fecha) AS total_dia
            FROM asistencia a
            JOIN curso c ON a.id_curso = c.id_curso
            JOIN grado g ON c.id_grado = g.id_grado
            JOIN gestion_academica gest ON c.id_gestion = gest.id_gestion
            WHERE a.id_estudiante = $1
            ORDER BY gest.anio DESC, a.fecha DESC
        `, [id_estudiante]);

        // Calcular resumen de asistencia para cada inscripción activa
        const resumenAsistencia = {};
        for (const row of asistenciasData.rows) {
            const cKey = row.id_curso;
            if (!resumenAsistencia[cKey]) {
                resumenAsistencia[cKey] = {
                    id_curso: row.id_curso,
                    nombre_grado: row.nombre_grado,
                    paralelo: row.paralelo,
                    anio: row.anio,
                    total_dias: 0,
                    presentes: 0,
                    ausentes: 0,
                    tardanzas: 0,
                    justificados: 0,
                    licencias: 0,
                    detalle: []
                };
            }
            resumenAsistencia[cKey].total_dias++;
            switch (row.estado_asistencia) {
                case 'P': resumenAsistencia[cKey].presentes++;   break;
                case 'A': resumenAsistencia[cKey].ausentes++;    break;
                case 'T': resumenAsistencia[cKey].tardanzas++;   break;
                case 'J': resumenAsistencia[cKey].justificados++; break;
                case 'L': resumenAsistencia[cKey].licencias++;   break;
            }
            resumenAsistencia[cKey].detalle.push({
                fecha: row.fecha,
                estado: row.estado_asistencia,
                observaciones: row.obs_asistencia
            });
        }
        asistencias = Object.values(resumenAsistencia).map(r => ({
            ...r,
            porcentaje_asistencia: r.total_dias > 0
                ? parseFloat(((r.presentes / r.total_dias) * 100).toFixed(1))
                : 0,
            alerta_inasistencia: r.total_dias > 0
                ? (r.presentes / r.total_dias) < 0.80
                : false
        }));

        // ── 6. Pagos (solo Admin, Director, Secretaria) ─────────────────────
        let pagos = [];
        if (rolUsuario === 1 || rolUsuario === 2 || rolUsuario === 4) {
            const pagosData = await pool.query(`
                SELECT
                    d.id_deuda, d.monto AS monto_deuda, d.mes, d.estado AS estado_deuda,
                    d.fecha_generacion, cp.nombre_concepto,
                    p.id_pago, p.monto_pagado, p.metodo_pago,
                    p.estado AS estado_pago, p.fecha_pago,
                    comp.numero_comprobante, comp.archivo_pdf_url
                FROM deuda d
                JOIN concepto_pago cp ON d.id_concepto = cp.id_concepto
                LEFT JOIN pago p ON p.id_deuda = d.id_deuda
                LEFT JOIN comprobante comp ON comp.id_pago = p.id_pago
                WHERE d.id_estudiante = $1
                ORDER BY d.fecha_generacion DESC
            `, [id_estudiante]);
            pagos = pagosData.rows;
        }

        // ── 7. Armar respuesta final ────────────────────────────────────────
        res.json({
            datos_personales: personalData.rows[0],
            tutores: tutoresData.rows,
            inscripciones: inscripcionesData.rows,
            calificaciones: calificacionesArray,
            asistencias,
            pagos
        });

    } catch (error) {
        res.status(500).json({ message: 'Error al generar el expediente digital', error: error.message });
    }
};

module.exports = { consultarExpediente };
