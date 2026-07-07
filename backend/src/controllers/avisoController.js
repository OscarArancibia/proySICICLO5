const pool = require("../config/db");

// GET /api/avisos
// Listar avisos (con filtros opcionales)
const listarAvisos = async (req, res, next) => {
  try {
    const { estado, tipo } = req.query;
    let query = `
      SELECT a.id_aviso, a.titulo, a.contenido, a.destinatario_tipo, 
             a.id_curso_destino, a.id_estudiante_destino, a.estado, 
             a.fecha_envio, u.username as publicado_por
      FROM aviso a
      JOIN usuario u ON a.id_usuario = u.id_usuario
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (estado) {
      query += ` AND a.estado = $${paramIndex}`;
      params.push(estado);
      paramIndex++;
    }

    if (tipo) {
      query += ` AND a.destinatario_tipo = $${paramIndex}`;
      params.push(tipo);
      paramIndex++;
    }

    query += ` ORDER BY a.fecha_envio DESC`;

    const { rows } = await pool.query(query, params);
    res.json({ avisos: rows });
  } catch (error) {
    next(error);
  }
};

// POST /api/avisos
// Publicar un nuevo aviso
const publicarAviso = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      titulo,
      contenido,
      destinatario_tipo,
      id_curso_destino,
      id_estudiante_destino,
    } = req.body;
    const idUsuario = req.usuario.id;
    const rol = req.usuario.nombre_rol;

    // Validar rol (solo Director o Profesor)
    if (!["Director", "Profesor"].includes(rol)) {
      return res
        .status(403)
        .json({ error: "Solo directores o profesores pueden publicar avisos" });
    }

    // E1. Validar campos obligatorios
    if (!titulo || !titulo.trim()) {
      return res
        .status(400)
        .json({ error: "Debe completar todos los campos obligatorios. (E1)" });
    }
    if (!contenido || !contenido.trim()) {
      return res
        .status(400)
        .json({ error: "Debe completar todos los campos obligatorios. (E1)" });
    }
    if (
      !destinatario_tipo ||
      !["todos", "por_curso", "individual"].includes(destinatario_tipo)
    ) {
      return res
        .status(400)
        .json({ error: "Debe completar todos los campos obligatorios. (E1)" });
    }

    // E2. Validar destinatario según tipo
    let estudiantesDestino = [];
    let cursoValido = null;
    let estudianteValido = null;

    // Iniciar transacción
    await client.query("BEGIN");

    if (destinatario_tipo === "por_curso") {
      if (!id_curso_destino) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: 'Debe especificar un curso para el tipo "por_curso" (E1)',
        });
      }
      // Verificar que el curso existe
      const cursoResult = await client.query(
        "SELECT id_curso FROM curso WHERE id_curso = $1",
        [id_curso_destino],
      );
      if (cursoResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ error: "El destinatario seleccionado no es válido. (E2)" });
      }

      // El Profesor solo puede enviar a cursos que tenga asignados
      // (titular o con materia asignada). El Director no tiene restricción.
      if (rol === "Profesor") {
        const accesoResult = await client.query(
          `
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
        `,
          [idUsuario, id_curso_destino],
        );
        if (accesoResult.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            error: "Solo puedes enviar avisos a tus cursos asignados",
          });
        }
      }

      cursoValido = id_curso_destino;

      // Obtener estudiantes activos e inscritos en ese curso
      const estudiantesResult = await client.query(
        `
        SELECT e.id_estudiante
        FROM estudiante e
        JOIN inscripcion i ON e.id_estudiante = i.id_estudiante
        WHERE i.id_curso = $1
          AND i.estado = 'inscrito'
          AND e.estado = 'activo'
      `,
        [id_curso_destino],
      );
      estudiantesDestino = estudiantesResult.rows.map(
        (row) => row.id_estudiante,
      );
    } else if (destinatario_tipo === "individual") {
      if (!id_estudiante_destino) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error:
            'Debe especificar un estudiante para el tipo "individual" (E1)',
        });
      }
      // Verificar que el estudiante existe y está activo
      const estudianteResult = await client.query(
        "SELECT id_estudiante FROM estudiante WHERE id_estudiante = $1 AND estado = $2",
        [id_estudiante_destino, "activo"],
      );
      if (estudianteResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ error: "El destinatario seleccionado no es válido. (E2)" });
      }

      // El Profesor solo puede dirigirse a estudiantes inscritos en sus cursos.
      if (rol === "Profesor") {
        const enMisCursos = await client.query(
          `
          SELECT 1
          FROM inscripcion i
          WHERE i.id_estudiante = $2
            AND i.estado = 'inscrito'
            AND (
              i.id_curso IN (
                SELECT c.id_curso FROM curso c
                JOIN profesor p ON p.id_profesor = c.id_profesor
                WHERE p.id_usuario = $1
              )
              OR i.id_curso IN (
                SELECT cm.id_curso FROM curso_materia cm
                JOIN profesor p ON p.id_profesor = cm.id_profesor
                WHERE p.id_usuario = $1
              )
            )
          LIMIT 1
        `,
          [idUsuario, id_estudiante_destino],
        );
        if (enMisCursos.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            error: "Solo puedes enviar avisos a estudiantes de tus cursos",
          });
        }
      }

      estudianteValido = id_estudiante_destino;
      estudiantesDestino = [id_estudiante_destino];
    } else {
      // 'todos' — reservado al Director
      if (rol === "Profesor") {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error: "Solo el Director puede enviar avisos a todos los estudiantes",
        });
      }

      // Obtener todos los estudiantes activos
      const estudiantesResult = await client.query(
        "SELECT id_estudiante FROM estudiante WHERE estado = $1",
        ["activo"],
      );
      estudiantesDestino = estudiantesResult.rows.map(
        (row) => row.id_estudiante,
      );
    }

    // Si no hay estudiantes destino (curso sin estudiantes o todos vacío), igual se publica
    // pero no se generan notificaciones

    // Registrar el aviso
    const avisoResult = await client.query(
      `
      INSERT INTO aviso (titulo, contenido, id_usuario, destinatario_tipo, 
                         id_curso_destino, id_estudiante_destino, estado, fecha_envio)
      VALUES ($1, $2, $3, $4, $5, $6, 'enviado', NOW())
      RETURNING id_aviso
    `,
      [
        titulo.trim(),
        contenido.trim(),
        idUsuario,
        destinatario_tipo,
        cursoValido,
        estudianteValido,
      ],
    );

    const idAviso = avisoResult.rows[0].id_aviso;

    // Generar notificaciones para los tutores de los estudiantes destino
    let notificacionesCreadas = 0;
    let notificacionesFallidas = 0;
    let erroresDetalle = [];

    if (estudiantesDestino.length > 0) {
      // Obtener todos los tutores de esos estudiantes (con autorizado_recoger = true? o todos)
      // Según el CU, la notificación va al panel del estudiante, pero puede ser al tutor.
      // Usaremos los tutores vinculados (todos o solo los autorizados)
      const tutoresResult = await client.query(
        `
        SELECT DISTINCT te.id_tutor
        FROM tutor_estudiante te
        WHERE te.id_estudiante = ANY($1::int[])
      `,
        [estudiantesDestino],
      );

      const tutoresIds = tutoresResult.rows.map((row) => row.id_tutor);

      if (tutoresIds.length > 0) {
        for (const idTutor of tutoresIds) {
          try {
            // Savepoint por iteración: si el INSERT falla, podemos volver a
            // este punto sin abortar toda la transacción y seguir con el resto.
            await client.query("SAVEPOINT sp_notif");
            await client.query(
              `
              INSERT INTO notificacion (id_aviso, id_tutor, canal, estado_envio, fecha_envio)
              VALUES ($1, $2, 'panel', 'enviado', NOW())
            `,
              [idAviso, idTutor],
            );
            await client.query("RELEASE SAVEPOINT sp_notif");
            notificacionesCreadas++;
          } catch (err) {
            // Recupera la transacción al estado del savepoint (la deja usable)
            await client.query("ROLLBACK TO SAVEPOINT sp_notif");
            notificacionesFallidas++;
            erroresDetalle.push(`Tutor ${idTutor}: ${err.message}`);
            await client.query(
              `
              INSERT INTO bitacora (id_usuario, accion, tabla_afectada, id_registro_afectado, descripcion, ip_origen)
              VALUES ($1, 'ERROR', 'notificacion', $2, $3, $4)
            `,
              [
                idUsuario,
                idAviso,
                `Error al generar notificación para tutor ${idTutor}: ${err.message}`,
                req.ip,
              ],
            );
          }
        }
      }
    }

    let mensaje = "Aviso publicado correctamente";
    if (notificacionesFallidas > 0) {
      mensaje =
        "El aviso fue publicado, pero algunas notificaciones no pudieron generarse. (E3)";
      await client.query(
        `
        INSERT INTO bitacora (id_usuario, accion, tabla_afectada, id_registro_afectado, descripcion, ip_origen)
        VALUES ($1, 'ADVERTENCIA', 'notificacion', $2, $3, $4)
      `,
        [
          idUsuario,
          idAviso,
          `Fallo la generación de ${notificacionesFallidas} notificaciones. Detalles: ${erroresDetalle.join("; ")}`,
          req.ip,
        ],
      );
    } else {
      await client.query(
        `
        INSERT INTO bitacora (id_usuario, accion, tabla_afectada, id_registro_afectado, descripcion, ip_origen)
        VALUES ($1, 'INSERT', 'aviso', $2, $3, $4)
      `,
        [
          idUsuario,
          idAviso,
          `Aviso publicado: "${titulo.trim()}" para ${destinatario_tipo}`,
          req.ip,
        ],
      );
    }

    // Confirmar transacción
    await client.query("COMMIT");

    res.status(201).json({
      mensaje: mensaje,
      aviso: {
        id: idAviso,
        titulo: titulo.trim(),
        contenido: contenido.trim(),
        destinatario_tipo,
        destinatarios: estudiantesDestino.length,
        notificaciones_creadas: notificacionesCreadas,
        notificaciones_fallidas: notificacionesFallidas,
        fecha_envio: new Date().toISOString(),
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error en publicarAviso:", error);
    next(error);
  } finally {
    client.release();
  }
};

const obtenerAvisosPanel = async (req, res, next) => {
  try {
    const idUsuario = req.usuario.id;

    // Obtener el estudiante vinculado al usuario
    const estudianteResult = await pool.query(
      "SELECT id_estudiante FROM estudiante WHERE id_usuario = $1",
      [idUsuario],
    );
    if (estudianteResult.rows.length === 0) {
      return res.status(404).json({
        error: "No se encontró un estudiante asociado a este usuario",
      });
    }
    const idEstudiante = estudianteResult.rows[0].id_estudiante;

    // Obtener cursos del estudiante
    const cursosResult = await pool.query(
      "SELECT id_curso FROM inscripcion WHERE id_estudiante = $1 AND estado = $2",
      [idEstudiante, "inscrito"],
    );
    const cursosIds = cursosResult.rows.map((row) => row.id_curso);

    // Consultar avisos visibles para el estudiante
    let query = `
      SELECT a.id_aviso, a.titulo, a.contenido, a.fecha_envio,
             u.username as publicado_por
      FROM aviso a
      JOIN usuario u ON a.id_usuario = u.id_usuario
      WHERE a.estado = 'enviado'
        AND (
          a.destinatario_tipo = 'todos'
          OR (a.destinatario_tipo = 'por_curso' AND a.id_curso_destino = ANY($1::int[]))
          OR (a.destinatario_tipo = 'individual' AND a.id_estudiante_destino = $2)
        )
      ORDER BY a.fecha_envio DESC
    `;
    const { rows } = await pool.query(query, [cursosIds, idEstudiante]);

    res.json({ avisos: rows });
  } catch (error) {
    next(error);
  }
};

// GET /api/avisos/mis-estudiantes
// Estudiantes disponibles como destinatarios "individual":
//   - Profesor: solo los inscritos en sus cursos asignados.
//   - Director: todos los estudiantes activos.
const listarMisEstudiantes = async (req, res, next) => {
  try {
    const { nombre_rol, id } = req.usuario;

    if (!["Director", "Profesor"].includes(nombre_rol)) {
      return res
        .status(403)
        .json({ error: "No tienes permiso para listar estudiantes" });
    }

    let query;
    let params;
    if (nombre_rol === "Profesor") {
      query = `
        SELECT DISTINCT e.id_estudiante, e.nombre, e.apellido, e.ci
        FROM estudiante e
        JOIN inscripcion i
          ON i.id_estudiante = e.id_estudiante AND i.estado = 'inscrito'
        WHERE e.estado = 'activo'
          AND (
            i.id_curso IN (
              SELECT c.id_curso FROM curso c
              JOIN profesor p ON p.id_profesor = c.id_profesor
              WHERE p.id_usuario = $1
            )
            OR i.id_curso IN (
              SELECT cm.id_curso FROM curso_materia cm
              JOIN profesor p ON p.id_profesor = cm.id_profesor
              WHERE p.id_usuario = $1
            )
          )
        ORDER BY e.apellido, e.nombre
      `;
      params = [id];
    } else {
      query = `
        SELECT id_estudiante, nombre, apellido, ci
        FROM estudiante
        WHERE estado = 'activo'
        ORDER BY apellido, nombre
      `;
      params = [];
    }

    const { rows: estudiantes } = await pool.query(query, params);
    res.json({ estudiantes });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listarAvisos,
  publicarAviso,
  obtenerAvisosPanel,
  listarMisEstudiantes,
};
