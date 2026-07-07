const pool = require("../config/db");

// ========== Obtener materias disponibles para asignar (CU09 paso 2-3) ==========
const obtenerMateriasDisponibles = async (req, res) => {
  const { id_curso } = req.params;

  try {
    // Obtener información del curso (nivel, grado, profesor titular)
    const cursoInfo = await pool.query(
      `SELECT 
                c.id_curso,
                c.id_grado,
                c.id_profesor AS profesor_titular_id,
                p.nombre || ' ' || p.apellido AS profesor_titular_nombre,
                g.id_nivel,
                n.nombre_nivel
             FROM curso c
             JOIN grado g ON c.id_grado = g.id_grado
             JOIN nivel n ON g.id_nivel = n.id_nivel
             JOIN profesor p ON c.id_profesor = p.id_profesor
             WHERE c.id_curso = $1`,
      [id_curso],
    );

    if (cursoInfo.rows.length === 0) {
      return res.status(404).json({ error: "Curso no encontrado" });
    }

    const curso = cursoInfo.rows[0];
    // ✅ CORREGIDO: Primaria ahora es id_nivel = 2
    const esPrimaria = curso.id_nivel === 2;
    const esInicial = curso.id_nivel === 1;
    const esKinder = curso.id_nivel === 8;

    const profesorTitular = {
      id_profesor: curso.profesor_titular_id,
      nombre_completo: curso.profesor_titular_nombre,
    };

    // Obtener materias ya asignadas
    const materiasAsignadas = await pool.query(
      `SELECT 
                cm.id_curso_materia,
                m.id_materia,
                m.nombre_materia,
                p.id_profesor,
                p.nombre || ' ' || p.apellido AS nombre_profesor
             FROM curso_materia cm
             JOIN materia m ON cm.id_materia = m.id_materia
             JOIN profesor p ON cm.id_profesor = p.id_profesor
             WHERE cm.id_curso = $1
             ORDER BY m.nombre_materia`,
      [id_curso],
    );

    // Obtener materias disponibles agrupadas por Campo de Saber
    // ✅ CORREGIDO: Usa esPrimaria para filtrar materias que aplican a Primaria
    const materiasDisponibles = await pool.query(
      `SELECT 
                cs.id_campo,
                cs.nombre_campo,
                cs.orden_visualizacion,
                m.id_materia,
                m.nombre_materia,
                m.descripcion,
                m.aplica_primaria
             FROM materia m
             JOIN campo_saber cs ON m.id_campo = cs.id_campo
             WHERE m.estado = true
             AND (m.aplica_primaria = true OR $1 = false)
             AND NOT EXISTS (
                 SELECT 1 FROM curso_materia cm 
                 WHERE cm.id_curso = $2 AND cm.id_materia = m.id_materia
             )
             ORDER BY cs.orden_visualizacion, m.nombre_materia`,
      [esPrimaria, id_curso],
    );

    // Obtener todos los profesores activos para los selectores
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

    // Agrupar materias disponibles por campo de saber
    const materiasPorCampo = {};
    for (const materia of materiasDisponibles.rows) {
      if (!materiasPorCampo[materia.id_campo]) {
        materiasPorCampo[materia.id_campo] = {
          id_campo: materia.id_campo,
          nombre_campo: materia.nombre_campo,
          orden: materia.orden_visualizacion,
          materias: [],
        };
      }
      materiasPorCampo[materia.id_campo].materias.push({
        id_materia: materia.id_materia,
        nombre_materia: materia.nombre_materia,
        descripcion: materia.descripcion,
        profesor_sugerido: profesorTitular.id_profesor,
      });
    }

    // Flat list of available materias for frontend compatibility
    const disponiblesFlat = materiasDisponibles.rows.map((m) => ({
      id_materia: m.id_materia,
      nombre_materia: m.nombre_materia,
      nombre_campo: m.nombre_campo,
    }));

    res.json({
      curso: {
        id_curso: curso.id_curso,
        nombre_completo: `${curso.nombre_nivel} - Grado ${curso.id_grado}`,
        nivel: curso.nombre_nivel,
        profesor_titular: profesorTitular,
      },
      // Frontend-compatible keys
      asignadas: materiasAsignadas.rows,
      disponibles: disponiblesFlat,
      // Extended keys (grouped)
      materias_asignadas: materiasAsignadas.rows,
      materias_disponibles_agrupadas: Object.values(materiasPorCampo).sort(
        (a, b) => a.orden - b.orden,
      ),
      catalogo_profesores: profesores.rows,
    });
  } catch (error) {
    console.error("Error en obtenerMateriasDisponibles:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ========== Asignar materias a curso ==========
const asignarMaterias = async (req, res) => {
  const { id_curso } = req.params;
  // Accept both 'asignaciones' (backend native) and 'materias' (frontend compat)
  const asignaciones = req.body.asignaciones || req.body.materias || [];

  try {
    // Validar que el curso existe
    const cursoCheck = await pool.query(
      "SELECT id_curso FROM curso WHERE id_curso = $1",
      [id_curso],
    );
    if (cursoCheck.rows.length === 0) {
      return res.status(404).json({ error: "Curso no encontrado" });
    }

    if (!asignaciones || asignaciones.length === 0) {
      return res
        .status(400)
        .json({ error: "Debe asignar al menos una materia" });
    }

    const resultados = [];
    const errores = [];

    for (const asignacion of asignaciones) {
      const { id_materia, id_profesor } = asignacion;

      // Validar que la materia existe
      const materiaCheck = await pool.query(
        "SELECT id_materia, nombre_materia FROM materia WHERE id_materia = $1 AND estado = true",
        [id_materia],
      );
      if (materiaCheck.rows.length === 0) {
        errores.push(
          `La materia con ID ${id_materia} no existe o está inactiva`,
        );
        continue;
      }

      // Validar que el profesor existe
      const profesorCheck = await pool.query(
        `SELECT p.id_profesor FROM profesor p
                 JOIN usuario u ON p.id_usuario = u.id_usuario
                 WHERE p.id_profesor = $1 AND u.estado = true`,
        [id_profesor],
      );
      if (profesorCheck.rows.length === 0) {
        errores.push(
          `El profesor con ID ${id_profesor} no existe o está inactivo`,
        );
        continue;
      }

      // Verificar si ya existe la asignación
      const existenteCheck = await pool.query(
        `SELECT id_curso_materia FROM curso_materia 
                 WHERE id_curso = $1 AND id_materia = $2`,
        [id_curso, id_materia],
      );

      if (existenteCheck.rows.length > 0) {
        errores.push(
          `La materia "${materiaCheck.rows[0].nombre_materia}" ya está asignada a este curso`,
        );
        continue;
      }

      // Insertar la asignación
      const result = await pool.query(
        `INSERT INTO curso_materia (id_curso, id_materia, id_profesor)
                 VALUES ($1, $2, $3)
                 RETURNING id_curso_materia`,
        [id_curso, id_materia, id_profesor],
      );

      resultados.push({
        id_curso_materia: result.rows[0].id_curso_materia,
        id_materia,
        nombre_materia: materiaCheck.rows[0].nombre_materia,
        id_profesor,
      });
    }

    const mensaje =
      resultados.length > 0
        ? `${resultados.length} materias asignadas correctamente${errores.length > 0 ? `, ${errores.length} errores` : ""}`
        : "No se pudo asignar ninguna materia";

    res.status(201).json({
      message: mensaje,
      asignaciones_exitosas: resultados,
      ...(errores.length > 0 && { errores }),
    });
  } catch (error) {
    console.error("Error en asignarMaterias:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ========== Cambiar profesor de una materia (FA-01) ==========
const cambiarProfesorMateria = async (req, res) => {
  const { id_curso_materia } = req.params;
  const { id_profesor } = req.body;

  try {
    // Validar que la asignación existe
    const asignacionCheck = await pool.query(
      `SELECT cm.id_curso_materia, m.nombre_materia 
             FROM curso_materia cm
             JOIN materia m ON cm.id_materia = m.id_materia
             WHERE cm.id_curso_materia = $1`,
      [id_curso_materia],
    );
    if (asignacionCheck.rows.length === 0) {
      return res.status(404).json({ error: "Asignación no encontrada" });
    }

    // Validar profesor
    const profesorCheck = await pool.query(
      `SELECT p.id_profesor, p.nombre, p.apellido 
             FROM profesor p
             JOIN usuario u ON p.id_usuario = u.id_usuario
             WHERE p.id_profesor = $1 AND u.estado = true`,
      [id_profesor],
    );
    if (profesorCheck.rows.length === 0) {
      return res.status(400).json({ error: "Profesor no válido o inactivo" });
    }

    // Actualizar
    await pool.query(
      "UPDATE curso_materia SET id_profesor = $1 WHERE id_curso_materia = $2",
      [id_profesor, id_curso_materia],
    );

    res.json({
      message: "Profesor actualizado correctamente",
      materia: asignacionCheck.rows[0].nombre_materia,
      nuevo_profesor: `${profesorCheck.rows[0].nombre} ${profesorCheck.rows[0].apellido}`,
    });
  } catch (error) {
    console.error("Error en cambiarProfesorMateria:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ========== Eliminar asignación de materia (FA-02) ==========
const eliminarAsignacionMateria = async (req, res) => {
  const { id_curso_materia } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM curso_materia WHERE id_curso_materia = $1 RETURNING id_curso_materia",
      [id_curso_materia],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "La asignación no existe" });
    }

    res.json({ message: "Asignación eliminada correctamente" });
  } catch (error) {
    console.error("Error en eliminarAsignacionMateria:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ========== Cargar plantilla por nivel (FA-03) ==========
const cargarPlantillaMateriasPorNivel = async (req, res) => {
  const { id_curso } = req.params;

  try {
    // Obtener información del curso
    const cursoInfo = await pool.query(
      `SELECT c.id_curso, c.id_profesor, g.id_nivel
             FROM curso c
             JOIN grado g ON c.id_grado = g.id_grado
             WHERE c.id_curso = $1`,
      [id_curso],
    );

    if (cursoInfo.rows.length === 0) {
      return res.status(404).json({ error: "Curso no encontrado" });
    }

    const curso = cursoInfo.rows[0];
    // ✅ CORREGIDO: Primaria ahora es id_nivel = 2
    const esPrimaria = curso.id_nivel === 2;
    const profesorTitular = curso.id_profesor;

    // Obtener materias del nivel
    const materiasPlantilla = await pool.query(
      `SELECT m.id_materia, m.nombre_materia
             FROM materia m
             WHERE m.estado = true
             AND (m.aplica_primaria = true OR $1 = false)
             AND NOT EXISTS (
                 SELECT 1 FROM curso_materia cm 
                 WHERE cm.id_curso = $2 AND cm.id_materia = m.id_materia
             )
             ORDER BY m.nombre_materia`,
      [esPrimaria, id_curso],
    );

    const asignaciones = [];
    for (const materia of materiasPlantilla.rows) {
      const result = await pool.query(
        `INSERT INTO curso_materia (id_curso, id_materia, id_profesor)
                 VALUES ($1, $2, $3)
                 RETURNING id_curso_materia`,
        [id_curso, materia.id_materia, profesorTitular],
      );
      asignaciones.push({
        id_curso_materia: result.rows[0].id_curso_materia,
        id_materia: materia.id_materia,
        nombre_materia: materia.nombre_materia,
      });
    }

    res.status(201).json({
      message: `Plantilla cargada: ${asignaciones.length} materias asignadas con el profesor titular`,
      asignaciones: asignaciones,
    });
  } catch (error) {
    console.error("Error en cargarPlantillaMateriasPorNivel:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

module.exports = {
  obtenerMateriasDisponibles,
  asignarMaterias,
  cambiarProfesorMateria,
  eliminarAsignacionMateria,
  cargarPlantillaMateriasPorNivel,
};
