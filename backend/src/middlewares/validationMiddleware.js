const pool = require("../config/db");

const validarGestionActiva = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id_gestion, anio, estado 
             FROM gestion_academica 
             WHERE estado = 'activa' 
             LIMIT 1`,
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: "No existe una gestión académica activa",
        code: "NO_ACTIVE_GESTION",
      });
    }

    req.gestionActiva = result.rows[0];
    next();
  } catch (error) {
    console.error("Error validando gestión activa:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

const validarAulaDisponible = async (req, res, next) => {
  const { id_aula, turno } = req.body;
  const id_gestion = req.gestionActiva?.id_gestion;
  const id_curso = req.params.id_curso;

  try {
    let query = `
            SELECT c.id_curso, g.nombre_grado, c.paralelo
            FROM curso c
            JOIN grado g ON c.id_grado = g.id_grado
            WHERE c.id_aula = $1 
            AND c.turno = $2 
            AND c.id_gestion = $3
            AND c.estado = true
        `;
    const params = [id_aula, turno, id_gestion];

    if (id_curso) {
      query += ` AND c.id_curso != $4`;
      params.push(id_curso);
    }

    const result = await pool.query(query, params);

    if (result.rows.length > 0) {
      const cursoExistente = result.rows[0];
      return res.status(409).json({
        error: `El aula ya está ocupada en el turno ${turno} por el curso ${cursoExistente.nombre_grado} ${cursoExistente.paralelo}`,
        code: "AULA_OCCUPIED",
      });
    }

    next();
  } catch (error) {
    console.error("Error validando aula disponible:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

const validarProfesorDisponible = async (req, res, next) => {
  const { id_profesor, turno } = req.body;
  const id_gestion = req.gestionActiva?.id_gestion;
  const id_curso = req.params.id_curso;

  try {
    let query = `
            SELECT c.id_curso, g.nombre_grado, c.paralelo
            FROM curso c
            JOIN grado g ON c.id_grado = g.id_grado
            WHERE c.id_profesor = $1 
            AND c.turno = $2 
            AND c.id_gestion = $3
            AND c.estado = true
        `;
    const params = [id_profesor, turno, id_gestion];

    if (id_curso) {
      query += ` AND c.id_curso != $4`;
      params.push(id_curso);
    }

    const result = await pool.query(query, params);

    if (result.rows.length > 0) {
      const cursoExistente = result.rows[0];
      return res.status(409).json({
        error: `El profesor ya es titular del curso ${cursoExistente.nombre_grado} ${cursoExistente.paralelo} en el turno ${turno}`,
        code: "PROFESOR_OCCUPIED",
      });
    }

    next();
  } catch (error) {
    console.error("Error validando profesor disponible:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

const validarCursoUnico = async (req, res, next) => {
  // ✅ Incluir turno en la desestructuración
  const { id_grado, paralelo, turno } = req.body;
  const id_gestion = req.gestionActiva?.id_gestion;
  const id_curso = req.params.id_curso;

  // Si falta algún dato necesario (en creación deben venir todos)
  if (!id_grado || !paralelo || !turno) {
    return next();
  }

  try {
    let query = `
      SELECT id_curso FROM curso 
      WHERE id_grado = $1 
        AND UPPER(paralelo) = UPPER($2)
        AND id_gestion = $3
        AND turno = $4

    `;
    const params = [id_grado, paralelo, id_gestion, turno];

    if (id_curso) {
      query += ` AND id_curso != $5`;
      params.push(id_curso);
    }

    const result = await pool.query(query, params);

    if (result.rows.length > 0) {
      return res.status(409).json({
        error: `Ya existe un curso con el grado, paralelo ${paralelo} y turno ${turno} en esta gestión`,
        code: "DUPLICATE_COURSE",
      });
    }

    next();
  } catch (error) {
    console.error("Error validando curso único:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

const validarCursoSinInscripciones = async (req, res, next) => {
  const { id_curso } = req.params;
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as total_inscripciones FROM inscripcion WHERE id_curso = $1 AND estado = 'inscrito'`,
      [id_curso],
    );

    if (parseInt(result.rows[0].total_inscripciones) > 0) {
      req.tieneInscripciones = true;
    } else {
      req.tieneInscripciones = false;
    }

    next();
  } catch (error) {
    console.error("Error validando inscripciones:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

const validarMateriaSinCalificaciones = async (req, res, next) => {
  const { id_curso_materia } = req.params;

  try {
    const result = await pool.query(
      `SELECT COUNT(*) as total_calificaciones
             FROM calificacion c
             JOIN actividad_evaluacion ae ON c.id_actividad = ae.id_actividad
             WHERE ae.id_curso_materia = $1`,
      [id_curso_materia],
    );

    if (parseInt(result.rows[0].total_calificaciones) > 0) {
      return res.status(409).json({
        error:
          "No se puede eliminar la materia porque tiene actividades de evaluación o calificaciones registradas",
        code: "MATERIA_HAS_GRADES",
        sugerencia: "Considere desactivar la materia en lugar de eliminarla",
      });
    }

    next();
  } catch (error) {
    console.error("Error validando calificaciones:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

module.exports = {
  validarGestionActiva,
  validarAulaDisponible,
  validarProfesorDisponible,
  validarCursoUnico,
  validarCursoSinInscripciones,
  validarMateriaSinCalificaciones,
};
