const pool = require("../config/db");
const { registrarBitacora, getClientIp } = require("../utils/bitacora");

const buscarInasistencia = async (req, res) => {
  const { id_estudiante, fecha } = req.query;

  if (!id_estudiante || !fecha) {
    return res
      .status(400)
      .json({ message: "El estudiante y la fecha son obligatorios" });
  }

  try {
    const result = await pool.query(
      `
            SELECT a.id_asistencia, a.id_estudiante, a.id_curso, a.fecha,
                   a.estado, a.observaciones,
                   e.nombre || ' ' || e.apellido AS estudiante,
                   c.paralelo, g.nombre_grado, n.nombre_nivel
            FROM asistencia a
            JOIN estudiante e ON e.id_estudiante = a.id_estudiante
            JOIN curso c ON c.id_curso = a.id_curso
            JOIN grado g ON g.id_grado = c.id_grado
            JOIN nivel n ON n.id_nivel = g.id_nivel
            WHERE a.id_estudiante = $1
              AND a.fecha = $2::date
              AND a.estado = 'A'
        `,
      [id_estudiante, fecha],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "No se encontro inasistencia registrada para esa fecha",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al buscar inasistencia", error: error.message });
  }
};

const registrarJustificacion = async (req, res) => {
  const {
    id_asistencia,
    id_estudiante,
    id_curso,
    fecha,
    motivo,
    documento_referencia,
    observaciones,
  } = req.body;

  if (!id_asistencia || !motivo) {
    return res
      .status(400)
      .json({ message: "La asistencia y el motivo son obligatorios" });
  }

  const client = await pool.connect();

  try {
    const asistencia = await client.query(
      "SELECT id_estudiante, id_curso, fecha, estado FROM asistencia WHERE id_asistencia = $1",
      [id_asistencia],
    );

    if (asistencia.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Registro de asistencia no encontrado" });
    }

    if (asistencia.rows[0].estado === "J") {
      return res
        .status(409)
        .json({ message: "Esta inasistencia ya fue justificada" });
    }

    if (asistencia.rows[0].estado !== "A") {
      return res.status(400).json({
        message: "Solo se pueden justificar registros con estado Ausente (A)",
      });
    }

    const justificacionExistente = await client.query(
      "SELECT id_justificacion, estado FROM justificacion WHERE id_asistencia = $1",
      [id_asistencia],
    );

    if (justificacionExistente.rows.length > 0) {
      return res.status(409).json({
        message: `Ya existe una justificacion para esta asistencia en estado: ${justificacionExistente.rows[0].estado}`,
      });
    }

    await client.query("BEGIN");

    const saved = await client.query(
      `
            INSERT INTO justificacion (
                id_asistencia, id_estudiante, id_curso, fecha, motivo,
                documento_referencia, observaciones, estado, id_usuario_solicitante
            )
            VALUES ($1, $2, $3, $4::date, $5, $6, $7, 'pendiente', $8)
            RETURNING *
        `,
      [
        id_asistencia,
        asistencia.rows[0].id_estudiante,
        asistencia.rows[0].id_curso,
        asistencia.rows[0].fecha,
        motivo,
        documento_referencia || null,
        observaciones || null,
        req.usuario.id,
      ],
    );

    await client.query("COMMIT");

    await registrarBitacora({
      id_usuario: req.usuario.id,
      nombre_modulo: "justificaciones",
      nombre_permiso: "gestionar_justificaciones",
      metodo: "POST /api/justificaciones",
      accion: "REGISTRAR_JUSTIFICACION",
      tabla_afectada: "justificacion",
      id_registro_afectado: saved.rows[0].id_justificacion,
      descripcion: `Justificación registrada para asistencia ${id_asistencia}: ${motivo}`,
      ip_origen: getClientIp(req),
    });
    res.status(201).json({
      message: "Justificacion registrada correctamente",
      justificacion: saved.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({
      message: "Error al registrar justificacion",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const listarPendientes = async (_req, res) => {
  try {
    const result = await pool.query(`
            SELECT j.id_justificacion, j.id_asistencia, j.fecha, j.motivo,
                   j.documento_referencia, j.observaciones, j.fecha_solicitud,
                   e.id_estudiante, e.nombre || ' ' || e.apellido AS estudiante,
                   e.ci AS estudiante_ci,
                   c.id_curso, c.paralelo, g.nombre_grado, n.nombre_nivel,
                   u.username AS solicitante
            FROM justificacion j
            JOIN estudiante e ON e.id_estudiante = j.id_estudiante
            JOIN curso c ON c.id_curso = j.id_curso
            JOIN grado g ON g.id_grado = c.id_grado
            JOIN nivel n ON n.id_nivel = g.id_nivel
            JOIN usuario u ON u.id_usuario = j.id_usuario_solicitante
            WHERE j.estado = 'pendiente'
            ORDER BY j.fecha_solicitud DESC
        `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      message: "Error al listar justificaciones pendientes",
      error: error.message,
    });
  }
};

const resolverJustificacion = async (req, res) => {
  const { id } = req.params;
  const { estado, observaciones } = req.body;

  if (!estado || !["aprobada", "rechazada"].includes(estado)) {
    return res
      .status(400)
      .json({ message: "El estado debe ser aprobada o rechazada" });
  }

  const client = await pool.connect();

  try {
    const check = await client.query(
      "SELECT id_justificacion, estado FROM justificacion WHERE id_justificacion = $1",
      [id],
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ message: "Justificacion no encontrada" });
    }

    if (check.rows[0].estado !== "pendiente") {
      return res.status(400).json({
        message: `La justificacion ya fue ${check.rows[0].estado}. Solo se pueden resolver justificaciones pendientes.`,
      });
    }

    await client.query("BEGIN");

    const result = await client.query(
      `
            UPDATE justificacion
            SET estado = $1,
                id_usuario_revisor = $2,
                fecha_resolucion = NOW(),
                observaciones = CASE
                    WHEN $3::text IS NOT NULL THEN
                        COALESCE(observaciones, '') ||
                        CASE WHEN observaciones IS NOT NULL AND observaciones != '' THEN ' | ' ELSE '' END ||
                        $3
                    ELSE observaciones
                END
            WHERE id_justificacion = $4
            RETURNING *
        `,
      [estado, req.usuario.id, observaciones || null, id],
    );

    if (estado === "aprobada") {
      await client.query(
        "UPDATE asistencia SET estado = $1 WHERE id_asistencia = $2",
        ["J", result.rows[0].id_asistencia],
      );
    }

    await client.query("COMMIT");

    const mensaje =
      estado === "aprobada"
        ? "Justificacion aprobada correctamente. La asistencia se ha actualizado a Justificado (J)."
        : "Justificacion rechazada. La asistencia mantiene su estado original.";

    res.json({ message: mensaje, justificacion: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({
      message: "Error al resolver justificacion",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const listarJustificaciones = async (req, res) => {
  const { id_estudiante, estado, fecha_desde, fecha_hasta } = req.query;

  try {
    const conditions = ["1=1"];
    const params = [];
    let idx = 1;

    if (id_estudiante) {
      conditions.push(`j.id_estudiante = $${idx++}`);
      params.push(id_estudiante);
    }
    if (estado) {
      conditions.push(`j.estado = $${idx++}`);
      params.push(estado);
    }
    if (fecha_desde) {
      conditions.push(`j.fecha >= $${idx++}::date`);
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      conditions.push(`j.fecha <= $${idx++}::date`);
      params.push(fecha_hasta);
    }

    const result = await pool.query(
      `
            SELECT j.*,
                   e.nombre || ' ' || e.apellido AS estudiante,
                   e.ci AS estudiante_ci,
                   c.paralelo, g.nombre_grado, n.nombre_nivel,
                   u_sol.username AS solicitante,
                   u_rev.username AS revisor
            FROM justificacion j
            JOIN estudiante e ON e.id_estudiante = j.id_estudiante
            JOIN curso c ON c.id_curso = j.id_curso
            JOIN grado g ON g.id_grado = c.id_grado
            JOIN nivel n ON n.id_nivel = g.id_nivel
            JOIN usuario u_sol ON u_sol.id_usuario = j.id_usuario_solicitante
            LEFT JOIN usuario u_rev ON u_rev.id_usuario = j.id_usuario_revisor
            WHERE ${conditions.join(" AND ")}
            ORDER BY j.fecha_solicitud DESC
        `,
      params,
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      message: "Error al listar justificaciones",
      error: error.message,
    });
  }
};

module.exports = {
  buscarInasistencia,
  registrarJustificacion,
  listarPendientes,
  resolverJustificacion,
  listarJustificaciones,
};
