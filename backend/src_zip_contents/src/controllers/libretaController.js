const pool = require('../config/db');
const { registrarBitacora, getClientIp } = require('../utils/bitacora');

function numeroALiteral(n) {
    if (n === 0) return 'cero';
    if (n === 100) return 'cien';
    const unidades = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    const decenas = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const especiales = {
        11: 'once', 12: 'doce', 13: 'trece', 14: 'catorce', 15: 'quince',
        16: 'dieciséis', 17: 'diecisiete', 18: 'dieciocho', 19: 'diecinueve',
        21: 'veintiuno', 22: 'veintidós', 23: 'veintitrés', 24: 'veinticuatro',
        25: 'veinticinco', 26: 'veintiséis', 27: 'veintidós', 28: 'veintiocho', 29: 'veintinueve'
    };
    if (especiales[n]) return especiales[n];
    const d = Math.floor(n / 10);
    const u = n % 10;
    if (d === 2 && u > 0) return 'veinti' + unidades[u];
    if (u === 0) return decenas[d];
    return decenas[d] + ' y ' + unidades[u];
}

const ValidarCalificacionesService = async (id_estudiante, id_curso, id_gestion, trimestre) => {
    const insc = await pool.query(
        "SELECT id_inscripcion FROM inscripcion WHERE id_estudiante = $1 AND id_curso = $2 AND estado = 'inscrito' LIMIT 1",
        [id_estudiante, id_curso]
    );
    if (insc.rows.length === 0) {
        return { valido: false, error: 'El estudiante no se encuentra inscrito activamente en el curso seleccionado.' };
    }

    const materias = await pool.query(
        "SELECT cm.id_curso_materia, m.id_materia, m.nombre_materia FROM curso_materia cm JOIN materia m ON cm.id_materia = m.id_materia WHERE cm.id_curso = $1 AND m.estado = true",
        [id_curso]
    );
    if (materias.rows.length === 0) {
        return { valido: false, error: 'El curso seleccionado no tiene materias asignadas.' };
    }

    const dims = await pool.query(
        "SELECT id_dimension_eval, nombre_dimension, puntaje_maximo FROM dimension_evaluacion WHERE id_gestion = $1 ORDER BY id_dimension_eval",
        [id_gestion]
    );
    if (dims.rows.length === 0) {
        return { valido: false, error: 'No se encuentran configuradas las dimensiones de evaluación para la gestión.' };
    }

    const pendientes = [];
    for (const mat of materias.rows) {
        for (const dim of dims.rows) {
            const acts = await pool.query(
                "SELECT id_actividad, nombre_actividad FROM actividad_evaluacion WHERE id_curso_materia = $1 AND id_dimension_eval = $2 AND trimestre = $3",
                [mat.id_curso_materia, dim.id_dimension_eval, trimestre]
            );
            if (acts.rows.length === 0) {
                pendientes.push({
                    materia: mat.nombre_materia,
                    dimension: dim.nombre_dimension,
                    trimestre,
                    motivo: 'Sin actividades evaluativas configuradas.'
                });
                continue;
            }
            for (const act of acts.rows) {
                const cal = await pool.query(
                    "SELECT nota FROM calificacion WHERE id_actividad = $1 AND id_estudiante = $2 LIMIT 1",
                    [act.id_actividad, id_estudiante]
                );
                if (cal.rows.length === 0) {
                    pendientes.push({
                        materia: mat.nombre_materia,
                        dimension: dim.nombre_dimension,
                        trimestre,
                        evaluacion_pendiente: act.nombre_actividad,
                        motivo: 'Falta calificar la actividad.'
                    });
                }
            }
        }
    }

    if (pendientes.length > 0) {
        return { valido: false, pendientes };
    }
    return { valido: true, id_inscripcion: insc.rows[0].id_inscripcion };
};

const validarCalificaciones = async (req, res) => {
    const { id_estudiante, id_curso, id_gestion, trimestre } = req.query;

    if (!id_estudiante || !id_curso || !id_gestion || !trimestre) {
        return res.status(400).json({ message: 'Los parámetros id_estudiante, id_curso, id_gestion y trimestre son requeridos.' });
    }

    try {
        const val = await ValidarCalificacionesService(
            Number(id_estudiante), Number(id_curso), Number(id_gestion), Number(trimestre)
        );

        if (!val.valido) {
            if (val.error) return res.status(400).json({ message: val.error });
            return res.status(200).json({
                valido: false,
                message: 'No se puede generar la libreta porque existen calificaciones incompletas.',
                pendientes: val.pendientes
            });
        }

        res.json({ valido: true, message: 'Calificaciones completas y consistentes.' });
    } catch (error) {
        res.status(500).json({ message: 'Error al verificar calificaciones.', error: error.message });
    }
};

const generarLibreta = async (req, res) => {
    const { id_estudiante, id_curso, id_gestion, trimestre } = req.body;

    if (!id_estudiante || !id_curso || !id_gestion || !trimestre) {
        return res.status(400).json({ message: 'Los campos id_estudiante, id_curso, id_gestion y trimestre son obligatorios.' });
    }

    try {
        // E2: Already generated check
        const exist = await pool.query(
            "SELECT id_libreta, estado FROM libreta_emitida WHERE id_estudiante = $1 AND id_curso = $2 AND id_gestion = $3 AND trimestre = $4 LIMIT 1",
            [id_estudiante, id_curso, id_gestion, trimestre]
        );
        if (exist.rows.length > 0) {
            return res.status(409).json({
                code: 'E2',
                message: 'La libreta del estudiante ya fue generada para la gestión y trimestre seleccionados.',
                id_libreta: exist.rows[0].id_libreta,
                estado: exist.rows[0].estado
            });
        }

        // E1: Grades completeness check
        const val = await ValidarCalificacionesService(
            Number(id_estudiante), Number(id_curso), Number(id_gestion), Number(trimestre)
        );
        if (!val.valido) {
            return res.status(400).json({
                code: 'E1',
                message: val.error || 'No se puede generar la libreta porque existen calificaciones incompletas.',
                pendientes: val.pendientes
            });
        }

        // Fetch preceding trimestres' grades from already approved or generated libretas
        const prevLibretas = await pool.query(`
            SELECT id_libreta, trimestre FROM libreta_emitida 
            WHERE id_estudiante = $1 AND id_curso = $2 AND id_gestion = $3 AND estado IN ('APROBADA', 'entregada')
        `, [id_estudiante, id_curso, id_gestion]);

        const prevGrades = {}; // id_materia -> { t1, t2 }
        for (const prev of prevLibretas.rows) {
            const prevDets = await pool.query(`
                SELECT id_materia, nota_primer_trimestre, nota_segundo_trimestre, nota_tercer_trimestre 
                FROM libreta_detalle 
                WHERE id_libreta = $1
            `, [prev.id_libreta]);
            for (const det of prevDets.rows) {
                if (!prevGrades[det.id_materia]) {
                    prevGrades[det.id_materia] = {};
                }
                if (prev.trimestre === 1) {
                    prevGrades[det.id_materia].t1 = parseFloat(det.nota_primer_trimestre);
                }
                if (prev.trimestre === 2) {
                    prevGrades[det.id_materia].t2 = parseFloat(det.nota_segundo_trimestre);
                }
            }
        }

        const materias = await pool.query(`
            SELECT cm.id_curso_materia, m.id_materia, m.nombre_materia, m.id_campo, cs.nombre_campo, cs.orden_visualizacion
            FROM curso_materia cm 
            JOIN materia m ON cm.id_materia = m.id_materia 
            LEFT JOIN campo_saber cs ON m.id_campo = cs.id_campo 
            WHERE cm.id_curso = $1 AND m.estado = true
        `, [id_curso]);

        const dims = await pool.query(
            "SELECT id_dimension_eval, nombre_dimension, puntaje_maximo FROM dimension_evaluacion WHERE id_gestion = $1 ORDER BY id_dimension_eval",
            [id_gestion]
        );

        const client = await pool.connect();
        try {
            await client.query("BEGIN");

            // Insert cabecera
            const lib = await client.query(`
                INSERT INTO libreta_emitida (
                    id_estudiante, id_curso, id_gestion, trimestre, estado, 
                    id_usuario_generador, fecha_generacion, id_inscripcion, version, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, 'PENDIENTE_REVISION', $5, NOW(), $6, 1, NOW(), NOW())
                RETURNING id_libreta
            `, [id_estudiante, id_curso, id_gestion, trimestre, req.usuario.id, val.id_inscripcion]);

            const id_libreta = lib.rows[0].id_libreta;
            let sumAllFinals = 0;
            let countMaterias = 0;

            // Calculate & insert detail records
            for (const mat of materias.rows) {
                let noteSer = 0;
                let noteSaber = 0;
                let noteHacer = 0;
                let noteAuto = 0;

                for (const dim of dims.rows) {
                    const resAvg = await client.query(`
                        SELECT COALESCE(AVG(c.nota), 0) AS promedio
                        FROM calificacion c
                        JOIN actividad_evaluacion ae ON c.id_actividad = ae.id_actividad
                        WHERE ae.id_curso_materia = $1 AND ae.id_dimension_eval = $2 AND ae.trimestre = $3 AND c.id_estudiante = $4
                    `, [mat.id_curso_materia, dim.id_dimension_eval, trimestre, id_estudiante]);

                    const avg = parseFloat(resAvg.rows[0].promedio);
                    if (dim.nombre_dimension === 'Ser') noteSer = avg;
                    else if (dim.nombre_dimension === 'Saber') noteSaber = avg;
                    else if (dim.nombre_dimension === 'Hacer') noteHacer = avg;
                    else if (dim.nombre_dimension === 'Autoevaluacion') noteAuto = avg;
                }

                const noteFinal = Math.round(noteSer + noteSaber + noteHacer + noteAuto);
                sumAllFinals += noteFinal;
                countMaterias++;

                let t1_val = null;
                let t2_val = null;
                let t3_val = null;
                let promedioAnual = null;
                let promedioLiteral = numeroALiteral(noteFinal);

                if (trimestre === 1) {
                    t1_val = noteFinal;
                } else if (trimestre === 2) {
                    t1_val = prevGrades[mat.id_materia]?.t1 || null;
                    t2_val = noteFinal;
                } else if (trimestre === 3) {
                    t1_val = prevGrades[mat.id_materia]?.t1 || null;
                    t2_val = prevGrades[mat.id_materia]?.t2 || null;
                    t3_val = noteFinal;
                    if (t1_val !== null && t2_val !== null) {
                        promedioAnual = Math.round((t1_val + t2_val + t3_val) / 3);
                        promedioLiteral = numeroALiteral(promedioAnual);
                    }
                }

                const det = await client.query(`
                    INSERT INTO libreta_detalle (
                        id_libreta, id_materia, nombre_materia_historico, id_campo, nombre_campo_historico,
                        nota_primer_trimestre, nota_segundo_trimestre, nota_tercer_trimestre,
                        promedio_anual, promedio_literal, created_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
                    RETURNING id_libreta_detalle
                `, [
                    id_libreta, 
                    mat.id_materia, 
                    mat.nombre_materia, 
                    mat.id_campo, 
                    mat.nombre_campo || 'General',
                    t1_val, 
                    t2_val, 
                    t3_val,
                    promedioAnual, 
                    promedioLiteral
                ]);

                const id_libreta_detalle = det.rows[0].id_libreta_detalle;

                // Save details in libreta_dimension
                for (const dim of dims.rows) {
                    let valDim = 0;
                    if (dim.nombre_dimension === 'Ser') valDim = noteSer;
                    else if (dim.nombre_dimension === 'Saber') valDim = noteSaber;
                    else if (dim.nombre_dimension === 'Hacer') valDim = noteHacer;
                    else if (dim.nombre_dimension === 'Autoevaluacion') valDim = noteAuto;

                    await client.query(`
                        INSERT INTO libreta_dimension (
                            id_libreta_detalle, id_dimension_eval, nombre_dimension_historico,
                            trimestre, calificacion, ponderacion, created_at, updated_at
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                    `, [
                        id_libreta_detalle,
                        dim.id_dimension_eval,
                        dim.nombre_dimension,
                        trimestre,
                        valDim,
                        parseFloat(dim.puntaje_maximo)
                    ]);
                }
            }

            // Update average on cabecera
            const avgGeneral = countMaterias > 0 ? (sumAllFinals / countMaterias).toFixed(2) : 0;
            await client.query(`
                UPDATE libreta_emitida 
                SET promedio_general = $1
                WHERE id_libreta = $2
            `, [avgGeneral, id_libreta]);

            await client.query("COMMIT");

            // Audit
            await registrarBitacora({
                id_usuario: req.usuario.id,
                nombre_modulo: 'evaluaciones',
                nombre_permiso: 'generar_libretas',
                metodo: 'POST /api/libretas/generar',
                accion: 'INSERT',
                tabla_afectada: 'libreta_emitida',
                id_registro_afectado: id_libreta,
                descripcion: `Generación de libreta para estudiante ${id_estudiante} (Trimestre ${trimestre}, Gestión ${id_gestion})`,
                ip_origen: getClientIp(req)
            });

            res.status(201).json({
                message: 'Libreta generada exitosamente.',
                id_libreta,
                estado: 'PENDIENTE_REVISION'
            });

        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }

    } catch (error) {
        res.status(500).json({
            code: 'E5',
            message: 'No fue posible generar la libreta. Intente nuevamente.',
            error: error.message
        });
    }
};

const remitirLibreta = async (req, res) => {
    const { id } = req.params;
    const { observacion } = req.body;

    try {
        const lib = await pool.query(
            "SELECT id_libreta, estado FROM libreta_emitida WHERE id_libreta = $1 LIMIT 1",
            [id]
        );
        if (lib.rows.length === 0) {
            return res.status(404).json({ message: 'La libreta solicitada no existe.' });
        }
        const l = lib.rows[0];
        if (l.estado !== 'PENDIENTE_REVISION') {
            return res.status(400).json({ message: `No se puede remitir una libreta en estado ${l.estado}. Debe estar PENDIENTE_REVISION.` });
        }

        await pool.query(`
            UPDATE libreta_emitida
            SET estado = 'PENDIENTE_APROBACION', 
                id_usuario_remitente = $1, 
                fecha_remision = NOW(), 
                observaciones = $2,
                updated_at = NOW()
            WHERE id_libreta = $3
        `, [req.usuario.id, observacion || null, id]);

        await registrarBitacora({
            id_usuario: req.usuario.id,
            nombre_modulo: 'evaluaciones',
            nombre_permiso: 'revisar_libretas',
            metodo: `POST /api/libretas/${id}/remitir`,
            accion: 'UPDATE',
            tabla_afectada: 'libreta_emitida',
            id_registro_afectado: Number(id),
            descripcion: `Profesor remitió libreta ${id} a aprobación.`,
            ip_origen: getClientIp(req)
        });

        res.json({ message: 'Libreta revisada y remitida al Director.', id_libreta: Number(id), estado: 'PENDIENTE_APROBACION' });

    } catch (error) {
        res.status(500).json({ message: 'Error al remitir la libreta.', error: error.message });
    }
};

const aprobarLibreta = async (req, res) => {
    const { id } = req.params;

    try {
        const lib = await pool.query(
            "SELECT id_libreta, estado FROM libreta_emitida WHERE id_libreta = $1 LIMIT 1",
            [id]
        );
        if (lib.rows.length === 0) {
            return res.status(404).json({ message: 'La libreta solicitada no existe.' });
        }
        const l = lib.rows[0];
        if (l.estado === 'APROBADA') {
            return res.status(409).json({
                code: 'E3',
                message: 'La libreta ya fue aprobada anteriormente.'
            });
        }
        if (l.estado !== 'PENDIENTE_APROBACION') {
            return res.status(400).json({ message: `No se puede aprobar una libreta en estado ${l.estado}. Debe estar PENDIENTE_APROBACION.` });
        }

        await pool.query(`
            UPDATE libreta_emitida
            SET estado = 'APROBADA', 
                id_usuario_aprobador = $1, 
                fecha_aprobacion = NOW(), 
                archivo_pdf_url = $2,
                updated_at = NOW()
            WHERE id_libreta = $3
        `, [req.usuario.id, `/api/libretas/${id}/pdf`, id]);

        await registrarBitacora({
            id_usuario: req.usuario.id,
            nombre_modulo: 'evaluaciones',
            nombre_permiso: 'aprobar_libretas',
            metodo: `POST /api/libretas/${id}/aprobar`,
            accion: 'APROBACION',
            tabla_afectada: 'libreta_emitida',
            id_registro_afectado: Number(id),
            descripcion: `Director aprobó la libreta ${id}.`,
            ip_origen: getClientIp(req)
        });

        res.json({ message: 'Libreta aprobada de forma definitiva.', id_libreta: Number(id), estado: 'APROBADA' });

    } catch (error) {
        res.status(500).json({ message: 'Error al aprobar la libreta.', error: error.message });
    }
};

const listarLibretas = async (req, res) => {
    const { id_gestion, trimestre, id_curso, estado, page = 1, limit = 10 } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const conds = [];
    const params = [];

    const addCond = (sql, val) => {
        if (val !== undefined && val !== null && val !== '') {
            params.push(val);
            conds.push(sql.replace('?', `$${params.length}`));
        }
    };

    if (req.usuario.role === 3) {
        try {
            const profRes = await pool.query(
                "SELECT id_profesor FROM public.profesor WHERE id_usuario = $1 LIMIT 1",
                [req.usuario.id]
            );
            if (profRes.rows.length === 0) {
                return res.status(403).json({ message: 'Usuario no vinculado a un registro docente.' });
            }
            const id_profesor = profRes.rows[0].id_profesor;
            const cursosRes = await pool.query(
                "SELECT id_curso FROM public.curso WHERE id_profesor = $1 AND estado = true",
                [id_profesor]
            );
            if (cursosRes.rows.length === 0) {
                return res.json({ total: 0, page: Number(page), limit: Number(limit), pages: 0, data: [] });
            }
            const idsCursos = cursosRes.rows.map(r => r.id_curso);
            const placeholders = idsCursos.map((_, i) => {
                params.push(idsCursos[i]);
                return `$${params.length}`;
            }).join(', ');
            conds.push(`le.id_curso IN (${placeholders})`);
        } catch (err) {
            return res.status(500).json({ message: 'Error al filtrar cursos del docente.', error: err.message });
        }
    }

    addCond('le.id_gestion = ?', id_gestion);
    addCond('le.trimestre = ?', trimestre);
    addCond('le.id_curso = ?', id_curso);
    addCond('le.estado = ?', estado);

    const whereClause = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';

    try {
        const countQuery = `
            SELECT COUNT(*) AS total
            FROM libreta_emitida le
            ${whereClause}
        `;
        const countRes = await pool.query(countQuery, params);
        const total = parseInt(countRes.rows[0].total);

        params.push(Number(limit), offset);
        const limitParam = `$${params.length - 1}`;
        const offsetParam = `$${params.length}`;

        const dataQuery = `
            SELECT 
                le.id_libreta, le.trimestre, le.estado, le.fecha_generacion, le.observaciones,
                le.fecha_remision, le.fecha_aprobacion, le.promedio_general, le.archivo_pdf_url,
                e.nombre AS est_nombre, e.apellido AS est_apellido,
                c.paralelo AS curso_paralelo,
                g.nombre_grado,
                ga.anio AS gestion_anio,
                COALESCE(p_rev.nombre || ' ' || p_rev.apellido, u_rev.username) AS revisado_por_prof,
                COALESCE(p_apr.nombre || ' ' || p_apr.apellido, u_apr.username) AS aprobado_por_dir
            FROM libreta_emitida le
            JOIN estudiante e ON le.id_estudiante = e.id_estudiante
            JOIN curso c ON le.id_curso = c.id_curso
            JOIN grado g ON c.id_grado = g.id_grado
            JOIN gestion_academica ga ON le.id_gestion = ga.id_gestion
            LEFT JOIN usuario u_rev ON le.id_usuario_remitente = u_rev.id_usuario
            LEFT JOIN profesor p_rev ON u_rev.id_usuario = p_rev.id_usuario
            LEFT JOIN usuario u_apr ON le.id_usuario_aprobador = u_apr.id_usuario
            LEFT JOIN profesor p_apr ON u_apr.id_usuario = p_apr.id_usuario
            ${whereClause}
            ORDER BY ga.anio DESC, le.trimestre DESC, e.apellido, e.nombre
            LIMIT ${limitParam} OFFSET ${offsetParam}
        `;

        const dataRes = await pool.query(dataQuery, params);

        res.json({
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit)),
            data: dataRes.rows
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al listar libretas.', error: error.message });
    }
};

const obtenerLibretaPorId = async (req, res) => {
    const { id } = req.params;

    try {
        const cabRes = await pool.query(`
            SELECT 
                le.id_libreta, le.trimestre, le.estado, le.observaciones, 
                le.fecha_generacion, le.fecha_remision, le.fecha_aprobacion, le.promedio_general, le.archivo_pdf_url,
                e.nombre AS est_nombre, e.apellido AS est_apellido, e.ci AS est_ci, e.rude AS est_rude, e.id_estudiante,
                c.paralelo AS curso_paralelo, c.turno AS curso_turno, c.id_curso,
                g.nombre_grado,
                n.nombre_nivel,
                ga.anio AS gestion_anio, ga.id_gestion,
                COALESCE(p_rev.nombre || ' ' || p_rev.apellido, u_rev.username) AS revisado_por_prof,
                COALESCE(p_apr.nombre || ' ' || p_apr.apellido, u_apr.username) AS aprobado_por_dir
            FROM libreta_emitida le
            JOIN estudiante e ON le.id_estudiante = e.id_estudiante
            JOIN curso c ON le.id_curso = c.id_curso
            JOIN grado g ON c.id_grado = g.id_grado
            JOIN nivel n ON g.id_nivel = n.id_nivel
            JOIN gestion_academica ga ON le.id_gestion = ga.id_gestion
            LEFT JOIN usuario u_rev ON le.id_usuario_remitente = u_rev.id_usuario
            LEFT JOIN profesor p_rev ON u_rev.id_usuario = p_rev.id_usuario
            LEFT JOIN usuario u_apr ON le.id_usuario_aprobador = u_apr.id_usuario
            LEFT JOIN profesor p_apr ON u_apr.id_usuario = p_apr.id_usuario
            WHERE le.id_libreta = $1
            LIMIT 1
        `, [id]);

        if (cabRes.rows.length === 0) {
            return res.status(404).json({ message: 'La libreta solicitada no existe.' });
        }

        const cabecera = cabRes.rows[0];

        const detRes = await pool.query(`
            SELECT 
                ld.id_libreta_detalle,
                ld.id_materia,
                ld.nombre_materia_historico AS nombre_materia,
                ld.id_campo,
                ld.nombre_campo_historico AS nombre_campo,
                COALESCE(ld.nota_primer_trimestre, (
                    SELECT ld2.nota_primer_trimestre 
                    FROM libreta_detalle ld2
                    JOIN libreta_emitida le2 ON ld2.id_libreta = le2.id_libreta
                    WHERE le2.id_estudiante = le.id_estudiante 
                      AND le2.id_curso = le.id_curso 
                      AND le2.id_gestion = le.id_gestion 
                      AND le2.trimestre = 1 
                      AND ld2.id_materia = ld.id_materia
                      AND le2.estado IN ('PENDIENTE_REVISION', 'PENDIENTE_APROBACION', 'APROBADA', 'entregada')
                    LIMIT 1
                )) AS nota_primer_trimestre,
                COALESCE(ld.nota_segundo_trimestre, (
                    SELECT ld2.nota_segundo_trimestre 
                    FROM libreta_detalle ld2
                    JOIN libreta_emitida le2 ON ld2.id_libreta = le2.id_libreta
                    WHERE le2.id_estudiante = le.id_estudiante 
                      AND le2.id_curso = le.id_curso 
                      AND le2.id_gestion = le.id_gestion 
                      AND le2.trimestre = 2 
                      AND ld2.id_materia = ld.id_materia
                      AND le2.estado IN ('PENDIENTE_REVISION', 'PENDIENTE_APROBACION', 'APROBADA', 'entregada')
                    LIMIT 1
                )) AS nota_segundo_trimestre,
                COALESCE(ld.nota_tercer_trimestre, (
                    SELECT ld2.nota_tercer_trimestre 
                    FROM libreta_detalle ld2
                    JOIN libreta_emitida le2 ON ld2.id_libreta = le2.id_libreta
                    WHERE le2.id_estudiante = le.id_estudiante 
                      AND le2.id_curso = le.id_curso 
                      AND le2.id_gestion = le.id_gestion 
                      AND le2.trimestre = 3 
                      AND ld2.id_materia = ld.id_materia
                      AND le2.estado IN ('PENDIENTE_REVISION', 'PENDIENTE_APROBACION', 'APROBADA', 'entregada')
                    LIMIT 1
                )) AS nota_tercer_trimestre,
                COALESCE(ld.promedio_anual, (
                    SELECT ld2.promedio_anual 
                    FROM libreta_detalle ld2
                    JOIN libreta_emitida le2 ON ld2.id_libreta = le2.id_libreta
                    WHERE le2.id_estudiante = le.id_estudiante 
                      AND le2.id_curso = le.id_curso 
                      AND le2.id_gestion = le.id_gestion 
                      AND le2.trimestre = 3 
                      AND ld2.id_materia = ld.id_materia
                      AND le2.estado IN ('PENDIENTE_REVISION', 'PENDIENTE_APROBACION', 'APROBADA', 'entregada')
                    LIMIT 1
                )) AS promedio_anual,
                COALESCE(ld.promedio_literal, (
                    SELECT ld2.promedio_literal 
                    FROM libreta_detalle ld2
                    JOIN libreta_emitida le2 ON ld2.id_libreta = le2.id_libreta
                    WHERE le2.id_estudiante = le.id_estudiante 
                      AND le2.id_curso = le.id_curso 
                      AND le2.id_gestion = le.id_gestion 
                      AND le2.trimestre = 3 
                      AND ld2.id_materia = ld.id_materia
                      AND le2.estado IN ('PENDIENTE_REVISION', 'PENDIENTE_APROBACION', 'APROBADA', 'entregada')
                    LIMIT 1
                )) AS promedio_literal,
                ld.observacion,
                MAX(CASE WHEN ld_dim.nombre_dimension_historico = 'Ser' THEN ld_dim.calificacion END) AS nota_ser,
                MAX(CASE WHEN ld_dim.nombre_dimension_historico = 'Saber' THEN ld_dim.calificacion END) AS nota_saber,
                MAX(CASE WHEN ld_dim.nombre_dimension_historico = 'Hacer' THEN ld_dim.calificacion END) AS nota_hacer,
                MAX(CASE WHEN ld_dim.nombre_dimension_historico = 'Autoevaluacion' THEN ld_dim.calificacion END) AS nota_autoevaluacion
            FROM libreta_detalle ld
            JOIN libreta_emitida le ON ld.id_libreta = le.id_libreta
            LEFT JOIN libreta_dimension ld_dim ON ld.id_libreta_detalle = ld_dim.id_libreta_detalle
            WHERE ld.id_libreta = $1
            GROUP BY ld.id_libreta_detalle, ld.id_materia, ld.nombre_materia_historico, ld.id_campo, ld.nombre_campo_historico, 
                     ld.nota_primer_trimestre, ld.nota_segundo_trimestre, ld.nota_tercer_trimestre, 
                     ld.promedio_anual, ld.promedio_literal, ld.observacion, ld.orden,
                     le.id_estudiante, le.id_curso, le.id_gestion
            ORDER BY ld.orden NULLS LAST, ld.nombre_materia_historico
        `, [id]);

        res.json({
            cabecera,
            detalles: detRes.rows
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener el detalle de la libreta.', error: error.message });
    }
};

module.exports = {
    validarCalificaciones,
    generarLibreta,
    remitirLibreta,
    aprobarLibreta,
    listarLibretas,
    obtenerLibretaPorId
};
