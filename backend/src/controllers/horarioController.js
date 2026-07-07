const pool = require('../config/db');

const diasValidos = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

const normalizarDia = (dia) => {
    if (!dia) return dia;
    return String(dia)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
};

const getHorarioCurso = async (req, res) => {
    const { id_curso } = req.params;
    try {
        const horario = await pool.query(`
    SELECT h.id_horario, h.dia_semana, h.hora_inicio, h.hora_fin, h.actividad, h.publicado,
           m.id_materia, m.nombre_materia, p.id_profesor, p.nombre || ' ' || p.apellido AS profesor
    FROM horario h
            LEFT JOIN materia m ON h.id_materia = m.id_materia
            LEFT JOIN curso_materia cm ON h.id_curso = cm.id_curso AND h.id_materia = cm.id_materia
            LEFT JOIN profesor p ON cm.id_profesor = p.id_profesor
            WHERE h.id_curso = $1
            ORDER BY 
                CASE h.dia_semana 
                    WHEN 'lunes' THEN 1 WHEN 'martes' THEN 2 WHEN 'miercoles' THEN 3 
                    WHEN 'jueves' THEN 4 WHEN 'viernes' THEN 5 END,
                h.hora_inicio
        `, [id_curso]);
        res.json(horario.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener horario', error: error.message });
    }
};

const createBloqueHorario = async (req, res) => {
    const { id_curso, id_materia, hora_inicio, hora_fin, actividad } = req.body;
    const dia_semana = normalizarDia(req.body.dia_semana);

    if (!id_curso || !dia_semana || !hora_inicio || !hora_fin) {
        return res.status(400).json({ message: 'Curso, dia, hora de inicio y hora de fin son obligatorios.' });
    }

    if (!diasValidos.includes(dia_semana)) {
        return res.status(400).json({ message: 'Dia de semana invalido.' });
    }

    if (hora_inicio >= hora_fin) {
        return res.status(400).json({ message: 'La hora de fin debe ser posterior a la hora de inicio.' });
    }

    try {
        const cursoResult = await pool.query('SELECT id_aula, id_gestion FROM curso WHERE id_curso = $1', [id_curso]);
        if (cursoResult.rows.length === 0) return res.status(404).json({ message: 'Curso no encontrado.' });
        const id_aula = cursoResult.rows[0].id_aula;
        const id_gestion = cursoResult.rows[0].id_gestion;

        const conflictoAula = await pool.query(`
            SELECT h.id_horario, c.id_curso, g.nombre_grado, c.paralelo
            FROM horario h
            JOIN curso c ON h.id_curso = c.id_curso
            JOIN grado g ON c.id_grado = g.id_grado
            WHERE c.id_aula = $1 AND h.dia_semana = $2 
              AND h.hora_inicio < $4 AND h.hora_fin > $3
              AND c.id_gestion = $5
              AND h.id_horario != -1
        `, [id_aula, dia_semana, hora_inicio, hora_fin, id_gestion]);

        if (conflictoAula.rows.length > 0) {
            const c = conflictoAula.rows[0];
            return res.status(409).json({ message: `El Aula ya está ocupada por el Curso ${c.nombre_grado} ${c.paralelo} en ese horario.` });
        }

        if (id_materia) {
            const profMateria = await pool.query('SELECT id_profesor FROM curso_materia WHERE id_curso = $1 AND id_materia = $2', [id_curso, id_materia]);
            if (profMateria.rows.length === 0) {
                return res.status(400).json({ message: 'La materia seleccionada no esta asignada a este curso.' });
            }

            const id_profesor = profMateria.rows[0].id_profesor;
                
            const conflictoProfesor = await pool.query(`
                SELECT h.id_horario, c.id_curso, g.nombre_grado, c.paralelo
                FROM horario h
                JOIN curso c ON h.id_curso = c.id_curso
                JOIN grado g ON c.id_grado = g.id_grado
                JOIN curso_materia cm ON h.id_curso = cm.id_curso AND h.id_materia = cm.id_materia
                WHERE cm.id_profesor = $1 AND h.dia_semana = $2 
                  AND h.hora_inicio < $4 AND h.hora_fin > $3
                  AND c.id_gestion = $5
            `, [id_profesor, dia_semana, hora_inicio, hora_fin, id_gestion]);

            if (conflictoProfesor.rows.length > 0) {
                const c = conflictoProfesor.rows[0];
                return res.status(409).json({ message: `El Profesor ya tiene clase en el Curso ${c.nombre_grado} ${c.paralelo} en ese horario.` });
            }
        }

        const nuevoBloque = await pool.query(
            'INSERT INTO horario (id_curso, id_materia, dia_semana, hora_inicio, hora_fin, actividad) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [id_curso, id_materia || null, dia_semana, hora_inicio, hora_fin, actividad || null]
        );

        res.status(201).json({ message: 'Bloque guardado correctamente', bloque: nuevoBloque.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al guardar el bloque', error: error.message });
    }
};

const deleteBloqueHorario = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM horario WHERE id_horario = $1', [id]);
        res.json({ message: 'Bloque eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar el bloque', error: error.message });
    }
};

const getHorarioProfesor = async (req, res) => {
    const { id_profesor } = req.params;
    try {
        const horario = await pool.query(`
            SELECT h.dia_semana, h.hora_inicio, h.hora_fin, h.publicado, m.nombre_materia, g.nombre_grado, c.paralelo
            FROM horario h
            JOIN curso c ON h.id_curso = c.id_curso
            JOIN grado g ON c.id_grado = g.id_grado
            JOIN curso_materia cm ON h.id_curso = cm.id_curso AND h.id_materia = cm.id_materia
            WHERE cm.id_profesor = $1
            ORDER BY h.dia_semana, h.hora_inicio
        `, [id_profesor]);
        res.json(horario.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener horario', error: error.message });
    }
};

// Horario propio del profesor logueado (sus cursos, materias y bloques de clase)
const getMiHorario = async (req, res) => {
    try {
        const prof = await pool.query(
            'SELECT id_profesor FROM profesor WHERE id_usuario = $1',
            [req.usuario.id]
        );
        if (prof.rows.length === 0) {
            return res.status(404).json({ message: 'No estas vinculado a un profesor.' });
        }
        const idProfesor = prof.rows[0].id_profesor;
        const horario = await pool.query(`
            SELECT h.dia_semana, h.hora_inicio, h.hora_fin, h.actividad,
                   m.nombre_materia, g.nombre_grado, c.paralelo, c.turno
            FROM horario h
            JOIN curso c ON h.id_curso = c.id_curso
            JOIN grado g ON c.id_grado = g.id_grado
            JOIN curso_materia cm ON h.id_curso = cm.id_curso AND h.id_materia = cm.id_materia
            JOIN materia m ON cm.id_materia = m.id_materia
            WHERE cm.id_profesor = $1
            ORDER BY
              CASE h.dia_semana
                WHEN 'lunes' THEN 1 WHEN 'martes' THEN 2 WHEN 'miercoles' THEN 3
                WHEN 'jueves' THEN 4 WHEN 'viernes' THEN 5 ELSE 6 END,
              h.hora_inicio
        `, [idProfesor]);
        res.json(horario.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener tu horario', error: error.message });
    }
};

const editarBloqueHorario = async (req, res) => {
    const { id } = req.params;
    const { id_materia, hora_inicio, hora_fin, actividad } = req.body;
    const dia_semana = req.body.dia_semana ? normalizarDia(req.body.dia_semana) : undefined;

    if (dia_semana && !diasValidos.includes(dia_semana)) {
        return res.status(400).json({ message: 'Dia de semana invalido.' });
    }

    if (hora_inicio && hora_fin && hora_inicio >= hora_fin) {
        return res.status(400).json({ message: 'La hora de fin debe ser posterior a la hora de inicio.' });
    }

    try {
        // Obtener el bloque actual para conocer el id_curso
        const bloqueActual = await pool.query(
            'SELECT id_curso, id_materia FROM horario WHERE id_horario = $1', [id]
        );
        if (bloqueActual.rows.length === 0) {
            return res.status(404).json({ message: 'Bloque horario no encontrado.' });
        }
        const id_curso = bloqueActual.rows[0].id_curso;

        // Validar conflicto de aula (excluyendo el bloque actual)
        const cursoResult = await pool.query('SELECT id_aula, id_gestion FROM curso WHERE id_curso = $1', [id_curso]);
        const id_aula = cursoResult.rows[0].id_aula;
        const id_gestion = cursoResult.rows[0].id_gestion;

        const horaInicioFinal = hora_inicio || (await pool.query('SELECT hora_inicio FROM horario WHERE id_horario = $1', [id])).rows[0].hora_inicio;
        const horaFinFinal = hora_fin || (await pool.query('SELECT hora_fin FROM horario WHERE id_horario = $1', [id])).rows[0].hora_fin;
        const diaSemanaFinal = dia_semana || (await pool.query('SELECT dia_semana FROM horario WHERE id_horario = $1', [id])).rows[0].dia_semana;

        const conflictoAula = await pool.query(`
            SELECT h.id_horario, c.id_curso, g.nombre_grado, c.paralelo
            FROM horario h
            JOIN curso c ON h.id_curso = c.id_curso
            JOIN grado g ON c.id_grado = g.id_grado
            WHERE c.id_aula = $1 AND h.dia_semana = $2
              AND h.hora_inicio < $4 AND h.hora_fin > $3
              AND c.id_gestion = $5
              AND h.id_horario != $6
        `, [id_aula, diaSemanaFinal, horaInicioFinal, horaFinFinal, id_gestion, id]);

        if (conflictoAula.rows.length > 0) {
            const c = conflictoAula.rows[0];
            return res.status(409).json({ message: `El Aula ya está ocupada por el Curso ${c.nombre_grado} ${c.paralelo} en ese horario.` });
        }

        const idMateriaFinal = id_materia !== undefined ? id_materia : bloqueActual.rows[0].id_materia;
        if (idMateriaFinal) {
            const profMateria = await pool.query(
                'SELECT id_profesor FROM curso_materia WHERE id_curso = $1 AND id_materia = $2',
                [id_curso, idMateriaFinal]
            );
            if (profMateria.rows.length === 0) {
                return res.status(400).json({ message: 'La materia seleccionada no esta asignada a este curso.' });
            }

            const id_profesor = profMateria.rows[0].id_profesor;
            const conflictoProfesor = await pool.query(`
                SELECT h.id_horario, c.id_curso, g.nombre_grado, c.paralelo
                FROM horario h
                JOIN curso c ON h.id_curso = c.id_curso
                JOIN grado g ON c.id_grado = g.id_grado
                JOIN curso_materia cm ON h.id_curso = cm.id_curso AND h.id_materia = cm.id_materia
                WHERE cm.id_profesor = $1 AND h.dia_semana = $2
                  AND h.hora_inicio < $4 AND h.hora_fin > $3
                  AND c.id_gestion = $5
                  AND h.id_horario != $6
            `, [id_profesor, diaSemanaFinal, horaInicioFinal, horaFinFinal, id_gestion, id]);

            if (conflictoProfesor.rows.length > 0) {
                const c = conflictoProfesor.rows[0];
                return res.status(409).json({ message: `El Profesor ya tiene clase en el Curso ${c.nombre_grado} ${c.paralelo} en ese horario.` });
            }
        }

        // Construir UPDATE dinámico
        const updates = [];
        const params = [];
        let idx = 1;
        if (id_materia !== undefined) { updates.push(`id_materia = $${idx++}`); params.push(id_materia); }
        if (dia_semana)  { updates.push(`dia_semana = $${idx++}`);  params.push(dia_semana); }
        if (hora_inicio) { updates.push(`hora_inicio = $${idx++}`); params.push(hora_inicio); }
        if (hora_fin)    { updates.push(`hora_fin = $${idx++}`);    params.push(hora_fin); }
        if (actividad !== undefined) { updates.push(`actividad = $${idx++}`); params.push(actividad); }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'No hay campos para actualizar.' });
        }

        params.push(id);
        const updated = await pool.query(
            `UPDATE horario SET ${updates.join(', ')} WHERE id_horario = $${idx} RETURNING *`,
            params
        );

        res.json({ message: 'Bloque horario actualizado correctamente', bloque: updated.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al editar el bloque', error: error.message });
    }
};

const publicarHorario = async (req, res) => {
    const { id_curso } = req.params;
    try {
        const result = await pool.query(
            'UPDATE horario SET publicado = TRUE WHERE id_curso = $1 RETURNING id_horario',
            [id_curso]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No hay bloques de horario para publicar en este curso.' });
        }
        res.json({ message: 'Horario publicado correctamente.', bloques_publicados: result.rows.length });
    } catch (error) {
        res.status(500).json({ message: 'Error al publicar el horario', error: error.message });
    }
};

module.exports = { getHorarioCurso, createBloqueHorario, deleteBloqueHorario, getHorarioProfesor, getMiHorario, editarBloqueHorario, publicarHorario };
