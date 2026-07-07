const pool = require("../config/db");

// GET /api/cursos/:idCurso/estudiantes
const listarEstudiantes = async (req, res, next) => {
  try {
    const idCurso = parseInt(req.params.idCurso);
    if (isNaN(idCurso)) {
      return res.status(400).json({ error: "ID de curso inválido" });
    }

    const { nombre_rol, id } = req.usuario;

    // Solo profesores y docentes
    if (!["Profesor", "Docente"].includes(nombre_rol)) {
      return res
        .status(403)
        .json({ error: "No tienes permiso para listar estudiantes" });
    }

    // Verificar que el profesor/docente tenga acceso a este curso.
    // El token trae id_usuario; se mapea a su id_profesor vía la tabla profesor.
    const accesoQuery = `
      SELECT 1
      FROM curso c
      JOIN profesor p ON p.id_profesor = c.id_profesor
      WHERE p.id_usuario = $1 AND c.id_curso = $2
      UNION
      SELECT 1
      FROM curso_materia cm
      JOIN profesor p ON p.id_profesor = cm.id_profesor
      WHERE p.id_usuario = $1 AND cm.id_curso = $2
      LIMIT 1
    `;
    const accesoResult = await pool.query(accesoQuery, [id, idCurso]);
    if (accesoResult.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "No tienes permiso para ver este curso" });
    }

    // Obtener estudiantes activos e inscritos
    const estudiantesQuery = `
      SELECT e.id_estudiante, e.nombre, e.apellido, e.ci
      FROM estudiante e
      JOIN inscripcion i ON e.id_estudiante = i.id_estudiante
      WHERE i.id_curso = $1
        AND i.estado = 'inscrito'
        AND e.estado = 'activo'
      ORDER BY e.apellido, e.nombre
    `;
    const { rows: estudiantes } = await pool.query(estudiantesQuery, [idCurso]);

    res.json({ estudiantes });
  } catch (error) {
    next(error);
  }
};

// GET /api/estudiantes/:idEstudiante/tutores-autorizados
const listarTutoresAutorizados = async (req, res, next) => {
  try {
    const idEstudiante = parseInt(req.params.idEstudiante);
    if (isNaN(idEstudiante)) {
      return res.status(400).json({ error: "ID de estudiante inválido" });
    }

    // Solo profesores y docentes
    if (!["Profesor", "Docente"].includes(req.usuario.nombre_rol)) {
      return res
        .status(403)
        .json({ error: "No tienes permiso para consultar tutores" });
    }

    const query = `
      SELECT t.id_tutor, t.nombre, t.apellido, t.ci, te.parentesco
      FROM tutor t
      JOIN tutor_estudiante te ON t.id_tutor = te.id_tutor
      WHERE te.id_estudiante = $1
        AND te.autorizado_recoger = true
    `;
    const { rows: tutores } = await pool.query(query, [idEstudiante]);

    if (tutores.length === 0) {
      return res.status(404).json({
        error: "El estudiante no tiene tutores autorizados registrados (E2)",
      });
    }

    res.json({ tutores });
  } catch (error) {
    next(error);
  }
};

// POST /api/entregas
const registrar = async (req, res, next) => {
  try {
    const { id_estudiante, id_tutor, observaciones } = req.body;
    const { nombre_rol, id } = req.usuario;

    // Validar campos obligatorios
    if (!id_estudiante || !id_tutor) {
      return res.status(400).json({
        error: "Faltan campos obligatorios: id_estudiante, id_tutor",
      });
    }

    // 1. Verificar rol (solo Profesor o Docente)
    if (!["Profesor", "Docente"].includes(nombre_rol)) {
      return res.status(403).json({
        error: "Solo profesores o docentes pueden registrar entregas",
      });
    }

    // 2. Verificar que el estudiante esté en un curso que imparte
    // (mapeando id_usuario -> id_profesor vía la tabla profesor).
    const checkQuery = `
      SELECT 1
      FROM inscripcion i
      WHERE i.id_estudiante = $2
        AND (
          i.id_curso IN (
            SELECT c.id_curso
            FROM curso c
            JOIN profesor p ON p.id_profesor = c.id_profesor
            WHERE p.id_usuario = $1
          )
          OR i.id_curso IN (
            SELECT cm.id_curso
            FROM curso_materia cm
            JOIN profesor p ON p.id_profesor = cm.id_profesor
            WHERE p.id_usuario = $1
          )
        )
      LIMIT 1
    `;
    const result = await pool.query(checkQuery, [id, parseInt(id_estudiante)]);
    if (result.rows.length === 0) {
      return res.status(403).json({
        error: "No tienes permiso para registrar la entrega de este estudiante",
      });
    }

    // 3. Insertar la entrega (el trigger valida autorización del tutor)
    const insertQuery = `
      INSERT INTO entrega_estudiante (id_estudiante, id_tutor, id_usuario_supervisor, observaciones)
      VALUES ($1, $2, $3, $4)
      RETURNING id_entrega, fecha_hora_entrega
    `;
    const { rows } = await pool.query(insertQuery, [
      parseInt(id_estudiante),
      parseInt(id_tutor),
      id,
      observaciones || null,
    ]);

    const entrega = rows[0];
    res.status(201).json({
      mensaje: "Entrega registrada correctamente",
      entrega: {
        id_entrega: entrega.id_entrega,
        fecha_hora_entrega: entrega.fecha_hora_entrega,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/entregas/mis-cursos
// Devuelve solo los cursos a cargo del profesor/docente logueado
// (como titular o con alguna materia asignada).
const listarMisCursos = async (req, res, next) => {
  try {
    const { nombre_rol, id } = req.usuario;

    // Solo profesores y docentes
    if (!["Profesor", "Docente"].includes(nombre_rol)) {
      return res
        .status(403)
        .json({ error: "No tienes permiso para ver cursos de entrega" });
    }

    const query = `
      SELECT
        c.id_curso,
        c.paralelo,
        c.turno,
        g.nombre_grado,
        n.nombre_nivel,
        gest.anio
      FROM curso c
      JOIN grado g ON c.id_grado = g.id_grado
      JOIN nivel n ON g.id_nivel = n.id_nivel
      JOIN gestion_academica gest ON c.id_gestion = gest.id_gestion
      WHERE c.estado = true
        AND (
          c.id_profesor IN (
            SELECT id_profesor FROM profesor WHERE id_usuario = $1
          )
          OR c.id_curso IN (
            SELECT cm.id_curso
            FROM curso_materia cm
            JOIN profesor p ON p.id_profesor = cm.id_profesor
            WHERE p.id_usuario = $1
          )
        )
      ORDER BY n.nombre_nivel, g.nombre_grado, c.paralelo
    `;
    const { rows: cursos } = await pool.query(query, [id]);

    res.json({ cursos });
  } catch (error) {
    next(error);
  }
};

const listarEntregasCurso = async (req, res, next) => {
  try {
    const idCurso = parseInt(req.params.idCurso);
    if (isNaN(idCurso)) {
      return res.status(400).json({ error: "ID de curso inválido" });
    }

    const { nombre_rol, id } = req.usuario;

    // Solo profesores y docentes
    if (!["Profesor", "Docente"].includes(nombre_rol)) {
      return res
        .status(403)
        .json({ error: "No tienes permiso para ver entregas" });
    }

    // Verificar acceso al curso (id_usuario -> id_profesor)
    const accesoQuery = `
      SELECT 1
      FROM curso c
      JOIN profesor p ON p.id_profesor = c.id_profesor
      WHERE p.id_usuario = $1 AND c.id_curso = $2
      UNION
      SELECT 1
      FROM curso_materia cm
      JOIN profesor p ON p.id_profesor = cm.id_profesor
      WHERE p.id_usuario = $1 AND cm.id_curso = $2
      LIMIT 1
    `;
    const acceso = await pool.query(accesoQuery, [id, idCurso]);
    if (acceso.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "No tienes permiso para ver este curso" });
    }

    const query = `
      SELECT
        ee.id_entrega,
        ee.id_estudiante,
        ee.id_tutor,
        ee.fecha_hora_entrega,
        ee.observaciones,
        t.nombre AS tutor_nombre,
        t.apellido AS tutor_apellido,
        te.parentesco
      FROM entrega_estudiante ee
      JOIN inscripcion i
        ON i.id_estudiante = ee.id_estudiante
        AND i.id_curso = $1
        AND i.estado = 'inscrito'
      JOIN tutor t ON t.id_tutor = ee.id_tutor
      LEFT JOIN tutor_estudiante te
        ON te.id_tutor = ee.id_tutor AND te.id_estudiante = ee.id_estudiante
      WHERE ee.fecha_hora_entrega::date = CURRENT_DATE
      ORDER BY ee.fecha_hora_entrega DESC
    `;
    const { rows: entregas } = await pool.query(query, [idCurso]);

    res.json({ entregas });
  } catch (error) {
    next(error);
  }
};

const listarTodas = async (req, res, next) => {
  try {
    const { nombre_rol } = req.usuario;

    // Solo roles administrativos
    if (!["SuperUsuario", "Director", "Administrativo"].includes(nombre_rol)) {
      return res
        .status(403)
        .json({ error: "No tienes permiso para ver el listado de entregas" });
    }

    const { fecha } = req.query;
    const params = [];
    let filtroFecha = "";
    if (fecha) {
      params.push(fecha);
      filtroFecha = `WHERE ee.fecha_hora_entrega::date = $1`;
    }

    const query = `
      SELECT
        ee.id_entrega,
        ee.fecha_hora_entrega,
        ee.observaciones,
        e.id_estudiante,
        e.nombre AS estudiante_nombre,
        e.apellido AS estudiante_apellido,
        e.ci AS estudiante_ci,
        t.id_tutor,
        t.nombre AS tutor_nombre,
        t.apellido AS tutor_apellido,
        te.parentesco,
        u.id_usuario AS id_docente,
        u.username AS docente_username,
        ps.nombre AS docente_nombre,
        ps.apellido AS docente_apellido,
        c.id_curso,
        g.nombre_grado,
        c.paralelo,
        c.turno
      FROM entrega_estudiante ee
      JOIN estudiante e ON e.id_estudiante = ee.id_estudiante
      JOIN tutor t ON t.id_tutor = ee.id_tutor
      LEFT JOIN tutor_estudiante te
        ON te.id_tutor = ee.id_tutor AND te.id_estudiante = ee.id_estudiante
      JOIN usuario u ON u.id_usuario = ee.id_usuario_supervisor
      LEFT JOIN profesor ps ON ps.id_usuario = ee.id_usuario_supervisor
      LEFT JOIN inscripcion i
        ON i.id_estudiante = ee.id_estudiante AND i.estado = 'inscrito'
      LEFT JOIN curso c ON c.id_curso = i.id_curso
      LEFT JOIN grado g ON g.id_grado = c.id_grado
      ${filtroFecha}
      ORDER BY ee.fecha_hora_entrega DESC
    `;
    const { rows: entregas } = await pool.query(query, params);

    res.json({ entregas });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listarEstudiantes,
  listarTutoresAutorizados,
  registrar,
  listarMisCursos,
  listarEntregasCurso,
  listarTodas,
};
