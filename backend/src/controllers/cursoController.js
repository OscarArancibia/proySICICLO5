const pool = require("../config/db");

const validarProfesorUnico = async (
  id_profesor,
  id_gestion,
  turno,
  id_curso_omitir = null,
) => {
  let query = `
        SELECT id_curso, paralelo, g.nombre_grado
        FROM curso c
        JOIN grado g ON c.id_grado = g.id_grado
        WHERE id_profesor = $1 AND id_gestion = $2 AND turno = $3
    `;
  const params = [id_profesor, id_gestion, turno];
  if (id_curso_omitir) {
    query += ` AND id_curso != $4`;
    params.push(id_curso_omitir);
  }
  const result = await pool.query(query, params);
  if (result.rows.length > 0) {
    const cursoExistente = result.rows[0];
    throw new Error(
      `El profesor ya es titular del curso ${cursoExistente.nombre_grado} ${cursoExistente.paralelo} en el turno ${turno}`,
    );
  }
};

// ========== CU08: Crear Curso ==========
const crearCurso = async (req, res) => {
  const { id_grado, paralelo, id_aula, id_profesor, turno } = req.body;

  // Usar la gestión activa ya obtenida por el middleware
  const id_gestion = req.gestionActiva.id_gestion;

  try {
    await validarProfesorUnico(id_profesor, id_gestion, turno);

    const result = await pool.query(
      `INSERT INTO curso (id_grado, paralelo, id_aula, id_gestion, id_profesor, turno, estado)
             VALUES ($1, UPPER($2), $3, $4, $5, $6, true)
             RETURNING id_curso`,
      [id_grado, paralelo, id_aula, id_gestion, id_profesor, turno],
    );

    const cursoId = result.rows[0].id_curso;

    const cursoCompleto = await pool.query(
      `SELECT 
                c.id_curso,
                c.paralelo,
                c.turno,
                g.id_grado,
                g.nombre_grado,
                n.id_nivel,
                n.nombre_nivel,
                a.id_aula,
                a.numero_aula,
                a.capacidad_estudiantes,
                p.id_profesor,
                p.nombre || ' ' || p.apellido AS profesor_titular,
                p.ci AS profesor_ci,
                gest.id_gestion,
                gest.anio
             FROM curso c
             JOIN grado g ON c.id_grado = g.id_grado
             JOIN nivel n ON g.id_nivel = n.id_nivel
             JOIN aula a ON c.id_aula = a.id_aula
             JOIN profesor p ON c.id_profesor = p.id_profesor
             JOIN gestion_academica gest ON c.id_gestion = gest.id_gestion
             WHERE c.id_curso = $1`,
      [cursoId],
    );

    res.status(201).json({
      message: "Curso creado correctamente",
      curso: cursoCompleto.rows[0],
      nextSteps: {
        asignarMaterias: `/api/cursos/${cursoId}/materias`,
        inscribirEstudiantes: `/api/cursos/${cursoId}/inscripciones`,
      },
    });
  } catch (error) {
    console.error("Error en crearCurso:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

const obtenerDatosFormularioCurso = async (req, res) => {
  try {
    const gestionActiva = await pool.query(
      `SELECT id_gestion, anio FROM gestion_academica 
             WHERE estado = 'activa' LIMIT 1`,
    );

    const niveles = await pool.query(
      `SELECT id_nivel, nombre_nivel, monto_mensualidad 
             FROM nivel 
             ORDER BY id_nivel`,
    );

    const grados = await pool.query(
      `SELECT g.id_grado, g.nombre_grado, g.id_nivel, n.nombre_nivel
             FROM grado g
             JOIN nivel n ON g.id_nivel = n.id_nivel
             ORDER BY n.id_nivel, g.id_grado`,
    );

    const aulas = await pool.query(
      `SELECT 
                a.id_aula, 
                a.numero_aula, 
                a.capacidad_estudiantes,
                a.descripcion,
                CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM curso c 
                        WHERE c.id_aula = a.id_aula 
                        AND c.id_gestion = $1
                        AND c.estado = true
                    ) THEN 'ocupado'
                    ELSE 'disponible'
                END as estado
             FROM aula a
             ORDER BY a.numero_aula`,
      [gestionActiva.rows[0]?.id_gestion || 0],
    );

    const profesores = await pool.query(
      `SELECT 
                p.id_profesor, 
                p.nombre, 
                p.apellido, 
                p.ci,
                p.profesion
             FROM profesor p
             JOIN usuario u ON p.id_usuario = u.id_usuario
             WHERE u.estado = true
             ORDER BY p.apellido, p.nombre`,
    );

    res.json({
      gestion_activa: gestionActiva.rows[0] || null,
      niveles: niveles.rows,
      grados: grados.rows,
      aulas: aulas.rows,
      profesores: profesores.rows,
      turnos: ["Mañana", "Tarde"],
    });
  } catch (error) {
    console.error("Error en obtenerDatosFormularioCurso:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

const obtenerCursos = async (req, res) => {
  const { id_gestion, id_grado, id_nivel, activo } = req.query;

  try {
    let query = `
            SELECT 
                c.id_curso,
                c.paralelo,
                c.turno,
                c.estado as curso_estado,
                g.id_grado,
                g.nombre_grado,
                n.id_nivel,
                n.nombre_nivel,
                a.id_aula,
                a.numero_aula,
                a.capacidad_estudiantes,
                p.id_profesor,
                p.nombre || ' ' || p.apellido AS profesor_titular,
                gest.id_gestion,
                gest.anio,
                gest.estado AS estado_gestion,
                COUNT(DISTINCT i.id_estudiante) AS total_estudiantes,
                COUNT(DISTINCT cm.id_materia) AS total_materias
            FROM curso c
            JOIN grado g ON c.id_grado = g.id_grado
            JOIN nivel n ON g.id_nivel = n.id_nivel
            JOIN aula a ON c.id_aula = a.id_aula
            JOIN profesor p ON c.id_profesor = p.id_profesor
            JOIN gestion_academica gest ON c.id_gestion = gest.id_gestion
            LEFT JOIN inscripcion i ON c.id_curso = i.id_curso AND i.estado = 'inscrito'
            LEFT JOIN curso_materia cm ON c.id_curso = cm.id_curso
            WHERE 1=1
        `;

    const params = [];
    let paramIndex = 1;

    if (id_gestion) {
      query += ` AND c.id_gestion = $${paramIndex++}`;
      params.push(id_gestion);
    }
    if (id_grado) {
      query += ` AND c.id_grado = $${paramIndex++}`;
      params.push(id_grado);
    }
    if (id_nivel) {
      query += ` AND n.id_nivel = $${paramIndex++}`;
      params.push(id_nivel);
    }
    if (activo === "true") {
      query += ` AND c.estado = true`;
    }

    query += ` GROUP BY c.id_curso, g.id_grado, g.nombre_grado, n.id_nivel, n.nombre_nivel,
                          a.id_aula, a.numero_aula, a.capacidad_estudiantes,
                          p.id_profesor, p.nombre, p.apellido, gest.id_gestion, gest.anio, gest.estado
                   ORDER BY n.id_nivel, g.nombre_grado, c.paralelo`;

    const result = await pool.query(query, params);
    res.json({
      total: result.rows.length,
      cursos: result.rows,
    });
  } catch (error) {
    console.error("Error en obtenerCursos:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ========== Obtener detalle de un curso específico ==========
const obtenerCursoPorId = async (req, res) => {
  const { id_curso } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
                c.id_curso,
                c.paralelo,
                c.turno,
                c.estado as curso_estado,
                g.id_grado,
                g.nombre_grado,
                n.id_nivel,
                n.nombre_nivel,
                n.monto_mensualidad,
                a.id_aula,
                a.numero_aula,
                a.capacidad_estudiantes,
                a.descripcion AS aula_descripcion,
                p.id_profesor,
                p.nombre AS profesor_nombre,
                p.apellido AS profesor_apellido,
                p.ci AS profesor_ci,
                p.profesion,
                gest.id_gestion,
                gest.anio,
                gest.estado AS gestion_estado,
                COUNT(DISTINCT i.id_estudiante) AS total_estudiantes
            FROM curso c
            JOIN grado g ON c.id_grado = g.id_grado
            JOIN nivel n ON g.id_nivel = n.id_nivel
            JOIN aula a ON c.id_aula = a.id_aula
            JOIN profesor p ON c.id_profesor = p.id_profesor
            JOIN gestion_academica gest ON c.id_gestion = gest.id_gestion
            LEFT JOIN inscripcion i ON c.id_curso = i.id_curso AND i.estado = 'inscrito'
            WHERE c.id_curso = $1
            GROUP BY c.id_curso, g.id_grado, g.nombre_grado, n.id_nivel, n.nombre_nivel,
                     a.id_aula, a.numero_aula, a.descripcion, p.id_profesor, p.nombre, 
                     p.apellido, p.ci, p.profesion, gest.id_gestion, gest.anio, gest.estado`,
      [id_curso],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Curso no encontrado" });
    }

    res.json({ curso: result.rows[0] });
  } catch (error) {
    console.error("Error en obtenerCursoPorId:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ========== Editar curso (FA-02) ==========
const editarCurso = async (req, res) => {
  const { id_curso } = req.params;
  const { id_aula, turno, id_profesor } = req.body;

  // Verificar si el middleware ya validó que no hay inscripciones
  const tieneInscripciones = req.tieneInscripciones || false;

  try {
    const cursoActual = await pool.query(
      `SELECT id_gestion, turno FROM curso WHERE id_curso = $1`,
      [id_curso],
    );
    if (cursoActual.rows.length === 0) {
      return res.status(404).json({ error: "Curso no encontrado" });
    }
    const { id_gestion, turno: turnoActual } = cursoActual.rows[0];

    if (id_profesor) {
      const turnoFinal = turno || turnoActual;
      await validarProfesorUnico(id_profesor, id_gestion, turnoFinal, id_curso);
    }

    let query = "UPDATE curso SET ";
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (tieneInscripciones) {
      if (id_aula) {
        updates.push(`id_aula = $${paramIndex++}`);
        params.push(id_aula);
      }
      if (turno) {
        updates.push(`turno = $${paramIndex++}`);
        params.push(turno);
      }
    } else {
      // Edición completa (sin inscripciones)
      if (id_aula) {
        updates.push(`id_aula = $${paramIndex++}`);
        params.push(id_aula);
      }
      if (turno) {
        updates.push(`turno = $${paramIndex++}`);
        params.push(turno);
      }
      if (id_profesor) {
        updates.push(`id_profesor = $${paramIndex++}`);
        params.push(id_profesor);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No hay campos para actualizar" });
    }

    params.push(id_curso);
    query +=
      updates.join(", ") +
      ` WHERE id_curso = $${paramIndex} RETURNING id_curso`;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Curso no encontrado" });
    }

    res.json({
      message: tieneInscripciones
        ? "Curso actualizado correctamente (campos restringidos por inscripciones activas)"
        : "Curso actualizado correctamente",
      campos_editados: updates,
    });
  } catch (error) {
    console.error("Error en editarCurso:", error);
    if (error.message.includes("El profesor ya es titular")) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ========== Duplicar curso (FA-01) ==========
const duplicarCurso = async (req, res) => {
  const { id_curso } = req.params;

  try {
    // Obtener el curso original
    const cursoOriginal = await pool.query(
      `SELECT id_grado, id_aula, id_gestion, turno 
             FROM curso 
             WHERE id_curso = $1`,
      [id_curso],
    );

    if (cursoOriginal.rows.length === 0) {
      return res.status(404).json({ error: "Curso original no encontrado" });
    }

    const original = cursoOriginal.rows[0];

    const result = await pool.query(
      `INSERT INTO curso (id_grado, paralelo, id_aula, id_gestion, id_profesor, turno, estado)
             VALUES ($1, '', $2, $3, NULL, $4, true)
             RETURNING id_curso`,
      [
        original.id_grado,
        original.id_aula,
        original.id_gestion,
        original.turno,
      ],
    );

    const nuevoCursoId = result.rows[0].id_curso;

    res.status(201).json({
      message:
        "Curso duplicado correctamente. Complete el paralelo y asigne un profesor titular.",
      nuevo_curso_id: nuevoCursoId,
      datos_precargados: {
        id_grado: original.id_grado,
        id_aula: original.id_aula,
        turno: original.turno,
        id_gestion: original.id_gestion,
      },
    });
  } catch (error) {
    console.error("Error en duplicarCurso:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

const eliminarCurso = async (req, res) => {
  const { id_curso } = req.params;

  try {
    // Verificar inscripciones
    const inscripcionesCheck = await pool.query(
      `SELECT COUNT(*) as total FROM inscripcion WHERE id_curso = $1 AND estado = 'inscrito'`,
      [id_curso],
    );

    if (parseInt(inscripcionesCheck.rows[0].total) > 0) {
      return res.status(409).json({
        error:
          "No se puede eliminar el curso porque tiene inscripciones activas",
        code: "COURSE_HAS_INSCRIPTIONS",
      });
    }

    // Verificar asignación de materias
    const materiasCheck = await pool.query(
      `SELECT COUNT(*) as total FROM curso_materia WHERE id_curso = $1`,
      [id_curso],
    );

    if (parseInt(materiasCheck.rows[0].total) > 0) {
      return res.status(409).json({
        error: "No se puede eliminar el curso porque tiene materias asignadas",
        code: "COURSE_HAS_SUBJECTS",
      });
    }

    await pool.query("UPDATE curso SET estado = false WHERE id_curso = $1", [
      id_curso,
    ]);

    res.json({ message: "Curso desactivado correctamente" });
  } catch (error) {
    console.error("Error en eliminarCurso:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

const activarCurso = async (req, res) => {
  const { id_curso } = req.params;

  try {
    const result = await pool.query(
      "UPDATE curso SET estado = true WHERE id_curso = $1 RETURNING id_curso",
      [id_curso],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Curso no encontrado" });
    }

    res.json({ message: "Curso activado correctamente" });
  } catch (error) {
    console.error("Error en activarCurso:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

module.exports = {
  crearCurso,
  obtenerDatosFormularioCurso,
  obtenerCursos,
  obtenerCursoPorId,
  editarCurso,
  duplicarCurso,
  eliminarCurso,
  activarCurso,
};
