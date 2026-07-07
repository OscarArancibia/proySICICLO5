const pool = require("../config/db");
const { enviarNotificacion } = require("../services/notificacionService");

// =====================================================
// 1. Obtener materias sin cobertura para una licencia
// =====================================================
const obtenerMateriasSinCobertura = async (req, res, next) => {
  try {
    const { idLicencia } = req.params;
    const query = `
        SELECT cm.id_curso_materia, cm.id_curso, cm.id_materia,
               c.paralelo, m.nombre_materia,
               h.dia_semana, h.hora_inicio, h.hora_fin
        FROM curso_materia cm
        JOIN curso c ON cm.id_curso = c.id_curso
        JOIN materia m ON cm.id_materia = m.id_materia
        JOIN horario h ON h.id_curso = cm.id_curso AND h.id_materia = cm.id_materia
        WHERE cm.id_profesor = (SELECT id_profesor FROM licencia_profesor WHERE id_licencia = $1)
          AND cm.id_curso_materia NOT IN (
              SELECT id_curso_materia FROM reemplazo_profesor
              WHERE id_licencia = $1 AND estado = 'activa'
          )
    `;
    const { rows } = await pool.query(query, [idLicencia]);
    res.json({ materias_sin_cobertura: rows });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// 2. Sugerir profesores disponibles para un bloque
// =====================================================
const sugerirSuplentes = async (req, res, next) => {
  try {
    const { idLicencia } = req.params;
    const { dia_semana, hora_inicio, hora_fin } = req.query;
    const query = `
        SELECT p.id_profesor, p.nombre, p.apellido
        FROM profesor p
        WHERE p.estado = true
          AND p.id_profesor != (SELECT id_profesor FROM licencia_profesor WHERE id_licencia = $1)
          AND NOT EXISTS (
              SELECT 1 FROM licencia_profesor l
              WHERE l.id_profesor = p.id_profesor
                AND l.estado = 'aprobada'
                AND l.fecha_inicio <= CURRENT_DATE AND l.fecha_fin >= CURRENT_DATE
          )
          AND NOT EXISTS (
              SELECT 1 FROM curso_materia cm
              JOIN horario h ON h.id_curso = cm.id_curso AND h.id_materia = cm.id_materia
              WHERE cm.id_profesor = p.id_profesor
                AND h.dia_semana = $2
                AND h.hora_inicio < $4 AND h.hora_fin > $3
          )
          AND NOT EXISTS (
              SELECT 1 FROM reemplazo_profesor r
              WHERE r.id_profesor_suplente = p.id_profesor
                AND r.estado = 'activa'
                AND r.fecha_inicio <= CURRENT_DATE AND r.fecha_fin >= CURRENT_DATE
          )
    `;
    const { rows } = await pool.query(query, [
      idLicencia,
      dia_semana,
      hora_inicio,
      hora_fin,
    ]);
    res.json({ suplentes_disponibles: rows });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// 3. Asignar suplente
// =====================================================
const asignarSuplente = async (req, res, next) => {
  try {
    const { idLicencia, idCursoMateria, idProfesorSuplente, observaciones } =
      req.body;
    const idUsuario = req.usuario.id;

    // Validar que la licencia existe y está aprobada
    const licenciaResult = await pool.query(
      `
            SELECT id_profesor, fecha_inicio, fecha_fin
            FROM licencia_profesor
            WHERE id_licencia = $1 AND estado = 'aprobada'
        `,
      [idLicencia],
    );

    if (licenciaResult.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Licencia no encontrada o no aprobada" });
    }

    const licencia = licenciaResult.rows[0];

    // Verificar que el suplente no tenga conflicto de horario con el bloque a cubrir.
    // (los horarios del suplente van por curso_materia -> curso -> horario)
    const horarioResult = await pool.query(
      `
            SELECT 1
            FROM curso_materia cmt
            JOIN horario ht
              ON ht.id_curso = cmt.id_curso AND ht.id_materia = cmt.id_materia
            JOIN curso_materia cms ON cms.id_profesor = $1
            JOIN horario hs
              ON hs.id_curso = cms.id_curso AND hs.id_materia = cms.id_materia
            WHERE cmt.id_curso_materia = $2
              AND hs.dia_semana = ht.dia_semana
              AND hs.hora_inicio < ht.hora_fin
              AND hs.hora_fin > ht.hora_inicio
            LIMIT 1
        `,
      [idProfesorSuplente, idCursoMateria],
    );

    if (horarioResult.rows.length > 0) {
      return res.status(409).json({
        error:
          "El suplente tiene conflicto de horario con el bloque a cubrir (E2)",
      });
    }

    // Insertar asignación
    const insertQuery = `
            INSERT INTO reemplazo_profesor (
                id_licencia, id_profesor_suplente, id_curso_materia,
                fecha_inicio, fecha_fin, observaciones, estado
            ) VALUES ($1, $2, $3, $4, $5, $6, 'activa')
            RETURNING id_reemplazo
        `;
    const result = await pool.query(insertQuery, [
      idLicencia,
      idProfesorSuplente,
      idCursoMateria,
      licencia.fecha_inicio,
      licencia.fecha_fin,
      observaciones || null,
    ]);

    // Notificar al suplente
    const suplenteEmail = await pool.query(
      "SELECT email FROM usuario WHERE id_usuario = (SELECT id_usuario FROM profesor WHERE id_profesor = $1)",
      [idProfesorSuplente],
    );
    if (suplenteEmail.rows[0]?.email) {
      await enviarNotificacion(
        suplenteEmail.rows[0].email,
        "Asignado como profesor suplente",
        `Has sido asignado como profesor suplente del ${licencia.fecha_inicio} al ${licencia.fecha_fin}.`,
        "email",
      );
    }

    // Bitácora
    await pool.query(
      `
            INSERT INTO bitacora (id_usuario, accion, tabla_afectada, id_registro_afectado, descripcion)
            VALUES ($1, 'INSERT', 'reemplazo_profesor', $2, 'Asignación de suplente')
        `,
      [idUsuario, result.rows[0].id_reemplazo],
    );

    res.status(201).json({
      mensaje: "Suplente asignado correctamente",
      id_reemplazo: result.rows[0].id_reemplazo,
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// 4. Cerrar reemplazo (finalizar cobertura)
// =====================================================
const cerrarReemplazo = async (req, res, next) => {
  try {
    const { idReemplazo } = req.params;
    const idUsuario = req.usuario.id;

    // Verificar que el reemplazo existe y está activo
    const reemplazoResult = await pool.query(
      `
            SELECT id_reemplazo, id_profesor_suplente, fecha_inicio, fecha_fin
            FROM reemplazo_profesor
            WHERE id_reemplazo = $1 AND estado = 'activa'
        `,
      [idReemplazo],
    );

    if (reemplazoResult.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Reemplazo no encontrado o no está activo" });
    }

    const reemplazo = reemplazoResult.rows[0];

    // Finalizar cobertura
    await pool.query(
      `UPDATE reemplazo_profesor SET estado = 'finalizada' WHERE id_reemplazo = $1`,
      [idReemplazo],
    );

    // Notificar al suplente
    const suplenteEmail = await pool.query(
      "SELECT email FROM usuario WHERE id_usuario = (SELECT id_usuario FROM profesor WHERE id_profesor = $1)",
      [reemplazo.id_profesor_suplente],
    );
    if (suplenteEmail.rows[0]?.email) {
      await enviarNotificacion(
        suplenteEmail.rows[0].email,
        "Cobertura finalizada",
        `Su cobertura como profesor suplente (del ${reemplazo.fecha_inicio} al ${reemplazo.fecha_fin}) ha finalizado.`,
        "email",
      );
    }

    // Bitácora
    await pool.query(
      `
            INSERT INTO bitacora (id_usuario, accion, tabla_afectada, id_registro_afectado, descripcion)
            VALUES ($1, 'UPDATE', 'reemplazo_profesor', $2, 'Reemplazo finalizado')
        `,
      [idUsuario, idReemplazo],
    );

    res.json({ mensaje: "Reemplazo finalizado correctamente" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  obtenerMateriasSinCobertura,
  sugerirSuplentes,
  asignarSuplente,
  cerrarReemplazo,
};
