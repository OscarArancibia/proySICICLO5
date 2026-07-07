const pool = require('../config/db');

const inscribirEstudiante = async (req, res) => {
    const { id_estudiante, id_curso, id_gestion } = req.body;

    try {
        const estCheck = await pool.query('SELECT estado FROM estudiante WHERE id_estudiante = $1', [id_estudiante]);
        if (estCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Estudiante no encontrado.' });
        }
        if (estCheck.rows[0].estado !== 'activo') {
            return res.status(400).json({ message: `El estudiante tiene estado '${estCheck.rows[0].estado}'. Debe reactivar el expediente antes de inscribirlo.` });
        }

        const capacidadQuery = await pool.query(`
            SELECT a.capacidad_estudiantes, 
                   (SELECT COUNT(*) FROM inscripcion WHERE id_curso = c.id_curso AND estado = 'inscrito') as inscritos
            FROM curso c JOIN aula a ON c.id_aula = a.id_aula WHERE c.id_curso = $1
        `, [id_curso]);

        const { capacidad_estudiantes, inscritos } = capacidadQuery.rows[0];
        if (parseInt(inscritos) >= parseInt(capacidad_estudiantes)) {
            return res.status(409).json({ message: `El curso ha alcanzado su capacidad máxima (${capacidad_estudiantes} estudiantes). Sugerencia: Busque otro curso del mismo grado.` });
        }

        const unicaCheck = await pool.query(`
            SELECT c.id_curso FROM inscripcion i 
            JOIN curso c ON i.id_curso = c.id_curso 
            WHERE i.id_estudiante = $1 AND c.id_gestion = $2 AND i.estado = 'inscrito'
        `, [id_estudiante, id_gestion]);

        if (unicaCheck.rows.length > 0) {
            return res.status(409).json({ message: 'El estudiante ya está inscrito en un curso de esta gestión activa. Use la opción de trasladar.' });
        }

        const tutoresCheck = await pool.query('SELECT COUNT(*) FROM tutor_estudiante WHERE id_estudiante = $1', [id_estudiante]);
        let advertencia = null;
        if (parseInt(tutoresCheck.rows[0].count) === 0) {
            advertencia = 'El estudiante no tiene tutores registrados. Se recomienda agregarlos para habilitar notificaciones y entrega segura.';
        }

        const inscripcion = await pool.query(
            `INSERT INTO inscripcion (id_estudiante, id_curso, fecha_inscripcion, estado) 
             VALUES ($1, $2, CURRENT_DATE, 'inscrito') RETURNING *`,
            [id_estudiante, id_curso]
        );

        res.status(201).json({ message: 'Inscripción realizada correctamente', inscripcion: inscripcion.rows[0], advertencia });
    } catch (error) {
        res.status(500).json({ message: 'Error al inscribir', error: error.message });
    }
};

const getInscripciones = async (req, res) => {
    const { id_curso, id_estudiante, id_gestion, estado } = req.query;
    try {
        let conditions = ['1=1'];
        let params = [];
        let idx = 1;

        if (id_curso)      { conditions.push(`i.id_curso = $${idx++}`);      params.push(id_curso); }
        if (id_estudiante) { conditions.push(`i.id_estudiante = $${idx++}`); params.push(id_estudiante); }
        if (estado)        { conditions.push(`i.estado = $${idx++}`);        params.push(estado); }
        if (id_gestion)    { conditions.push(`c.id_gestion = $${idx++}`);    params.push(id_gestion); }

        const result = await pool.query(`
            SELECT 
                i.id_inscripcion, i.fecha_inscripcion, i.estado, i.observaciones,
                e.id_estudiante, e.nombre || ' ' || e.apellido AS estudiante,
                e.ci AS estudiante_ci,
                c.id_curso, c.paralelo, c.turno,
                g.nombre_grado, n.nombre_nivel,
                gest.anio
            FROM inscripcion i
            JOIN estudiante e ON i.id_estudiante = e.id_estudiante
            JOIN curso c ON i.id_curso = c.id_curso
            JOIN grado g ON c.id_grado = g.id_grado
            JOIN nivel n ON g.id_nivel = n.id_nivel
            JOIN gestion_academica gest ON c.id_gestion = gest.id_gestion
            WHERE ${conditions.join(' AND ')}
            ORDER BY i.fecha_inscripcion DESC
        `, params);

        res.json({ total: result.rows.length, inscripciones: result.rows });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener inscripciones', error: error.message });
    }
};

const retirarEstudiante = async (req, res) => {
    const { id_inscripcion } = req.params;
    const { estado, motivo } = req.body;

    const estadosValidos = ['retirado', 'trasladado'];
    if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ message: `Estado inválido. Debe ser: ${estadosValidos.join(' | ')}.` });
    }
    if (!motivo) {
        return res.status(400).json({ message: 'Debe especificar el motivo del retiro o traslado.' });
    }

    try {
        const inscCheck = await pool.query(
            'SELECT id_inscripcion, id_curso, id_estudiante, estado FROM inscripcion WHERE id_inscripcion = $1',
            [id_inscripcion]
        );
        if (inscCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Inscripción no encontrada.' });
        }
        if (inscCheck.rows[0].estado !== 'inscrito') {
            return res.status(409).json({ message: `La inscripción ya tiene estado '${inscCheck.rows[0].estado}'.` });
        }

        const updated = await pool.query(
            `UPDATE inscripcion 
             SET estado = $1,
                 observaciones = COALESCE(observaciones, '') || $2
             WHERE id_inscripcion = $3 RETURNING *`,
            [estado, ` | Motivo ${estado}: ${motivo} [${new Date().toLocaleDateString('es-BO')}]`, id_inscripcion]
        );

        res.json({
            message: `Estudiante marcado como '${estado}' correctamente.`,
            inscripcion: updated.rows[0]
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al procesar el retiro', error: error.message });
    }
};

// FA-01 CU13: Trasladar estudiante de curso
const trasladarEstudiante = async (req, res) => {
    const { id_inscripcion } = req.params;
    const { id_curso_destino, motivo } = req.body;

    if (!id_curso_destino) {
        return res.status(400).json({ message: 'Debe especificar el curso destino.' });
    }
    if (!motivo) {
        return res.status(400).json({ message: 'Debe especificar el motivo del traslado.' });
    }

    try {
        const inscCheck = await pool.query(
            `SELECT i.id_inscripcion, i.id_estudiante, i.id_curso, i.estado, c.id_gestion
             FROM inscripcion i JOIN curso c ON i.id_curso = c.id_curso
             WHERE i.id_inscripcion = $1`,
            [id_inscripcion]
        );
        if (inscCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Inscripción no encontrada.' });
        }
        if (inscCheck.rows[0].estado !== 'inscrito') {
            return res.status(409).json({ message: `No se puede trasladar: la inscripción tiene estado '${inscCheck.rows[0].estado}'.` });
        }

        const { id_estudiante, id_gestion } = inscCheck.rows[0];

        const capacidad = await pool.query(`
            SELECT a.capacidad_estudiantes,
                   (SELECT COUNT(*) FROM inscripcion WHERE id_curso = c.id_curso AND estado = 'inscrito') AS inscritos
            FROM curso c JOIN aula a ON c.id_aula = a.id_aula
            WHERE c.id_curso = $1 AND c.id_gestion = $2
        `, [id_curso_destino, id_gestion]);

        if (capacidad.rows.length === 0) {
            return res.status(404).json({ message: 'Curso destino no encontrado en la gestión activa.' });
        }
        const { capacidad_estudiantes, inscritos } = capacidad.rows[0];
        if (parseInt(inscritos) >= parseInt(capacidad_estudiantes)) {
            return res.status(409).json({ message: `El curso destino ha alcanzado su capacidad máxima (${capacidad_estudiantes} estudiantes).` });
        }

        await pool.query(
            `UPDATE inscripcion
             SET estado = 'trasladado',
                 observaciones = COALESCE(observaciones, '') || $1
             WHERE id_inscripcion = $2`,
            [` | Traslado a curso ${id_curso_destino}: ${motivo} [${new Date().toLocaleDateString('es-BO')}]`, id_inscripcion]
        );

        const nueva = await pool.query(
            `INSERT INTO inscripcion (id_estudiante, id_curso, fecha_inscripcion, estado, observaciones)
             VALUES ($1, $2, CURRENT_DATE, 'inscrito', $3) RETURNING *`,
            [id_estudiante, id_curso_destino, `Traslado desde inscripción #${id_inscripcion}: ${motivo}`]
        );

        res.status(201).json({
            message: 'Traslado realizado correctamente.',
            nueva_inscripcion: nueva.rows[0]
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al procesar el traslado', error: error.message });
    }
};

// FA-02 CU13: Inscripción masiva desde CSV
const inscripcionMasivaCsv = async (req, res) => {
    const { id_curso, id_gestion, csv_text } = req.body;

    if (!id_curso || !id_gestion || !csv_text) {
        return res.status(400).json({ message: 'Faltan parámetros: id_curso, id_gestion o csv_text.' });
    }

    const lineas = csv_text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lineas.length <= 1) {
        return res.status(400).json({ message: 'El archivo CSV está vacío o solo contiene encabezados.' });
    }

    const encabezados = lineas.shift().split(',').map(h => h.trim().toLowerCase());
    const ciIndex = encabezados.indexOf('ci');
    if (ciIndex === -1) {
        return res.status(400).json({ message: 'El CSV debe contener una columna llamada "ci" (Carnet de Identidad).' });
    }

    const resultados = { exitosos: [], errores: [] };
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        for (let i = 0; i < lineas.length; i++) {
            const columnas = lineas[i].split(',').map(c => c.trim());
            const ci = columnas[ciIndex];
            if (!ci) continue;

            const estQuery = await client.query(
                'SELECT id_estudiante, nombre, apellido, estado FROM estudiante WHERE ci = $1',
                [ci]
            );
            if (estQuery.rows.length === 0) {
                resultados.errores.push({ fila: i + 2, ci, error: 'Estudiante no encontrado en la base de datos.' });
                continue;
            }

            const estudiante = estQuery.rows[0];
            if (estudiante.estado !== 'activo') {
                resultados.errores.push({ fila: i + 2, ci, error: `El estudiante tiene estado '${estudiante.estado}'. Debe reactivar el expediente.` });
                continue;
            }

            const unicaCheck = await client.query(
                `SELECT c.id_curso FROM inscripcion i
                 JOIN curso c ON i.id_curso = c.id_curso
                 WHERE i.id_estudiante = $1 AND c.id_gestion = $2 AND i.estado = 'inscrito'`,
                [estudiante.id_estudiante, id_gestion]
            );
            if (unicaCheck.rows.length > 0) {
                resultados.errores.push({ fila: i + 2, ci, error: 'El estudiante ya está inscrito en un curso de esta gestión activa.' });
                continue;
            }

            const capacidadQuery = await client.query(
                `SELECT a.capacidad_estudiantes,
                        (SELECT COUNT(*) FROM inscripcion WHERE id_curso = c.id_curso AND estado = 'inscrito') AS inscritos
                 FROM curso c JOIN aula a ON c.id_aula = a.id_aula WHERE c.id_curso = $1`,
                [id_curso]
            );
            const { capacidad_estudiantes, inscritos } = capacidadQuery.rows[0];
            if (parseInt(inscritos) >= parseInt(capacidad_estudiantes)) {
                resultados.errores.push({ fila: i + 2, ci, error: `El curso ha alcanzado su capacidad máxima (${capacidad_estudiantes} estudiantes).` });
                continue;
            }

            const inscripcion = await client.query(
                `INSERT INTO inscripcion (id_estudiante, id_curso, fecha_inscripcion, estado, observaciones)
                 VALUES ($1, $2, CURRENT_DATE, 'inscrito', 'Inscripción Masiva CSV') RETURNING id_inscripcion`,
                [estudiante.id_estudiante, id_curso]
            );
            resultados.exitosos.push({
                ci,
                nombre: `${estudiante.nombre} ${estudiante.apellido}`,
                id_inscripcion: inscripcion.rows[0].id_inscripcion
            });
        }

        await client.query('COMMIT');
        res.status(201).json({
            message: 'Proceso de inscripción masiva finalizado.',
            resumen: {
                total_procesados: lineas.length,
                exitosos: resultados.exitosos.length,
                errores: resultados.errores.length
            },
            resultados
        });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error durante la inscripción masiva', error: error.message });
    } finally {
        client.release();
    }
};

module.exports = { inscribirEstudiante, getInscripciones, retirarEstudiante, trasladarEstudiante, inscripcionMasivaCsv };
