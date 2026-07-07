const pool = require("../config/db");
const transporter = require("../config/mailer"); // 👈 servicio de correo configurado

// GET /api/estado-cuenta/estudiantes?q=...
const buscarEstudiantes = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim() === "") {
      return res
        .status(400)
        .json({ error: "Debe proporcionar un término de búsqueda" });
    }

    const searchTerm = `%${q.trim()}%`;

    const query = `
      SELECT id_estudiante, nombre, apellido, ci, id_curso, paralelo, nombre_grado
      FROM (
        SELECT DISTINCT ON (e.id_estudiante)
               e.id_estudiante, e.nombre, e.apellido, e.ci,
               c.id_curso, c.paralelo, g.nombre_grado
        FROM estudiante e
        LEFT JOIN inscripcion i ON e.id_estudiante = i.id_estudiante AND i.estado = 'inscrito'
        LEFT JOIN curso c ON i.id_curso = c.id_curso
        LEFT JOIN grado g ON c.id_grado = g.id_grado
        WHERE e.estado = 'activo'
          AND (
            e.nombre ILIKE $1 OR
            e.apellido ILIKE $1 OR
            e.ci ILIKE $1 OR
            c.paralelo ILIKE $1 OR
            g.nombre_grado ILIKE $1
          )
        ORDER BY e.id_estudiante, i.id_inscripcion DESC NULLS LAST
      ) sub
      ORDER BY apellido, nombre
      LIMIT 20
    `;
    const { rows } = await pool.query(query, [searchTerm]);
    res.json({ estudiantes: rows });
  } catch (error) {
    next(error);
  }
};

// GET /api/estado-cuenta/:idEstudiante
const obtenerEstadoCuenta = async (req, res, next) => {
  try {
    const idEstudiante = parseInt(req.params.idEstudiante);
    if (isNaN(idEstudiante)) {
      return res.status(400).json({ error: "ID de estudiante inválido" });
    }

    // 1. Datos del estudiante
    const estudianteQuery = `
      SELECT id_estudiante, nombre, apellido, ci, fecha_nacimiento, genero, estado
      FROM estudiante
      WHERE id_estudiante = $1
    `;
    const estudianteResult = await pool.query(estudianteQuery, [idEstudiante]);
    if (estudianteResult.rows.length === 0) {
      return res.status(404).json({ error: "Estudiante no encontrado (E1)" });
    }
    const estudiante = estudianteResult.rows[0];

    // 2. Deudas del estudiante
    const deudasQuery = `
      SELECT d.id_deuda, d.monto, d.mes, d.estado AS estado_deuda,
             d.fecha_generacion,
             c.nombre_concepto, c.descripcion AS concepto_desc,
             g.anio
      FROM deuda d
      JOIN concepto_pago c ON d.id_concepto = c.id_concepto
      JOIN gestion_academica g ON d.id_gestion = g.id_gestion
      WHERE d.id_estudiante = $1
      ORDER BY g.anio DESC, d.mes DESC
    `;
    const deudasResult = await pool.query(deudasQuery, [idEstudiante]);

    // 3. Pagos realizados
    const pagosQuery = `
      SELECT p.id_pago, p.monto_pagado, p.metodo_pago, p.estado AS estado_pago,
             p.fecha_pago, p.observaciones,
             c.numero_comprobante, c.archivo_pdf_url
      FROM pago p
      LEFT JOIN comprobante c ON p.id_pago = c.id_pago
      WHERE p.id_estudiante = $1
        AND p.estado IN ('validado', 'completado')
      ORDER BY p.fecha_pago DESC
    `;
    const pagosResult = await pool.query(pagosQuery, [idEstudiante]);

    // 4. Saldo pendiente
    const saldoQuery = `
      SELECT COALESCE(SUM(monto), 0) AS total_pendiente
      FROM deuda
      WHERE id_estudiante = $1
        AND estado IN ('pendiente', 'mora')
    `;
    const saldoResult = await pool.query(saldoQuery, [idEstudiante]);
    const saldoPendiente = parseFloat(saldoResult.rows[0].total_pendiente) || 0;

    // 5. Tutores vinculados
    const tutoresQuery = `
      SELECT t.id_tutor, t.nombre, t.apellido, t.correo_electronico, t.telefono,
             te.parentesco, te.contacto_emergencia, te.autorizado_recoger
      FROM tutor t
      JOIN tutor_estudiante te ON t.id_tutor = te.id_tutor
      WHERE te.id_estudiante = $1
    `;
    const tutoresResult = await pool.query(tutoresQuery, [idEstudiante]);

    res.json({
      estudiante,
      deudas: deudasResult.rows,
      pagos: pagosResult.rows,
      saldo_pendiente: saldoPendiente,
      tutores: tutoresResult.rows,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/estado-cuenta/:idEstudiante/recordatorio
const enviarRecordatorio = async (req, res, next) => {
  try {
    const idEstudiante = parseInt(req.params.idEstudiante);
    if (isNaN(idEstudiante)) {
      return res.status(400).json({ error: "ID de estudiante inválido" });
    }

    const { id_tutor } = req.body;

    // Obtener datos del estudiante
    const estudianteQuery = `
      SELECT nombre, apellido, ci FROM estudiante WHERE id_estudiante = $1
    `;
    const estudianteResult = await pool.query(estudianteQuery, [idEstudiante]);
    if (estudianteResult.rows.length === 0) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }
    const estudiante = estudianteResult.rows[0];

    // Obtener tutor(es) con correo
    let tutoresQuery = `
      SELECT t.id_tutor, t.nombre, t.apellido, t.correo_electronico
      FROM tutor t
      JOIN tutor_estudiante te ON t.id_tutor = te.id_tutor
      WHERE te.id_estudiante = $1
        AND t.correo_electronico IS NOT NULL
        AND t.correo_electronico != ''
    `;
    const params = [idEstudiante];
    if (id_tutor) {
      tutoresQuery += " AND t.id_tutor = $2";
      params.push(id_tutor);
    }
    const tutoresResult = await pool.query(tutoresQuery, params);

    if (tutoresResult.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Tutor sin información de contacto (E3)" });
    }

    const tutor = tutoresResult.rows[0];

    // Calcular deuda pendiente
    const deudaQuery = `
      SELECT SUM(monto) AS total
      FROM deuda
      WHERE id_estudiante = $1 AND estado IN ('pendiente', 'mora')
    `;
    const deudaResult = await pool.query(deudaQuery, [idEstudiante]);
    const totalPendiente = parseFloat(deudaResult.rows[0].total) || 0;

    // Construir mensaje
    const asunto = `Recordatorio de pago - ${estudiante.nombre} ${estudiante.apellido}`;
    const mensaje = `
      Estimado/a ${tutor.nombre} ${tutor.apellido},
      
      Le recordamos que el(la) estudiante ${estudiante.nombre} ${estudiante.apellido} (CI: ${estudiante.ci}) 
      tiene un saldo pendiente de ${totalPendiente.toFixed(2)} Bs.
      
      Por favor, regularice su situación a la brevedad.
      
      Gracias,
      Colegio - Administración
    `;

    // Enviar correo usando el transporter importado
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: tutor.correo_electronico,
        subject: asunto,
        text: mensaje,
      });
    } catch (mailError) {
      console.error("Error enviando correo:", mailError);
      return res
        .status(500)
        .json({ error: "Error en el envío de notificación (E4)" });
    }

    // Registrar en aviso y notificacion
    const avisoQuery = `
      INSERT INTO aviso (titulo, contenido, id_usuario, destinatario_tipo, id_curso_destino, estado)
      VALUES ($1, $2, $3, 'individual', NULL, 'enviado')
      RETURNING id_aviso
    `;
    const avisoResult = await pool.query(avisoQuery, [
      asunto,
      mensaje,
      req.usuario.id,
    ]);
    const idAviso = avisoResult.rows[0].id_aviso;

    const notificacionQuery = `
      INSERT INTO notificacion (id_aviso, id_tutor, canal, estado_envio, fecha_envio)
      VALUES ($1, $2, 'email', 'enviado', NOW())
    `;
    await pool.query(notificacionQuery, [idAviso, tutor.id_tutor]);

    res.json({
      mensaje: "Recordatorio enviado correctamente",
      tutor: {
        id: tutor.id_tutor,
        nombre: tutor.nombre,
        email: tutor.correo_electronico,
      },
      saldo_pendiente: totalPendiente,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  buscarEstudiantes,
  obtenerEstadoCuenta,
  enviarRecordatorio,
};
