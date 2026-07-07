// src/services/cronJobs.js
const cron = require("node-cron");
const pool = require("../config/db");
const transporter = require("../config/mailer");

// Función para enviar recordatorios de citas
const enviarRecordatoriosCitas = async () => {
  try {
    console.log("⏰ Ejecutando cron: Envío de recordatorios de citas...");

    // 1. Obtener citas confirmadas para mañana
    const query = `
            SELECT 
                c.id_cita,
                c.motivo,
                ha.dia_semana,
                ha.hora_inicio,
                ha.hora_fin,
                ha.modalidad,
                ha.enlace_videollamada,
                p.nombre AS profesor_nombre,
                p.apellido AS profesor_apellido,
                up.email AS profesor_email,
                t.nombre AS tutor_nombre,
                t.apellido AS tutor_apellido,
                t.correo_electronico AS tutor_email,
                e.nombre AS estudiante_nombre,
                e.apellido AS estudiante_apellido
            FROM cita c
            JOIN horario_atencion ha ON c.id_horario_atencion = ha.id_horario_atencion
            JOIN profesor p ON c.id_profesor = p.id_profesor
            LEFT JOIN usuario up ON p.id_usuario = up.id_usuario
            JOIN tutor t ON c.id_tutor = t.id_tutor
            JOIN estudiante e ON c.id_estudiante = e.id_estudiante
            WHERE c.estado = 'confirmada'
              AND c.fecha_cita = CURRENT_DATE + 1
              AND NOT EXISTS (
                  SELECT 1 FROM notificacion n
                  WHERE n.id_cita = c.id_cita
                    AND n.estado_envio = 'enviado'
              )
        `;
    const { rows: citas } = await pool.query(query);

    if (citas.length === 0) {
      console.log("📭 No hay recordatorios pendientes para hoy.");
      return;
    }

    console.log(`📨 Enviando ${citas.length} recordatorios...`);

    // 2. Enviar correos para cada cita
    for (const cita of citas) {
      try {
        // Correo para el tutor
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: cita.tutor_email,
          subject: `Recordatorio de cita con ${cita.profesor_nombre} ${cita.profesor_apellido}`,
          html: `
                        <h2>Recordatorio de cita</h2>
                        <p>Estimado/a <strong>${cita.tutor_nombre} ${cita.tutor_apellido}</strong>,</p>
                        <p>Le recordamos que tiene una cita programada con el profesor <strong>${cita.profesor_nombre} ${cita.profesor_apellido}</strong> para mañana.</p>
                        <p><strong>Detalles:</strong></p>
                        <ul>
                            <li><strong>Estudiante:</strong> ${cita.estudiante_nombre} ${cita.estudiante_apellido}</li>
                            <li><strong>Día:</strong> ${cita.dia_semana}</li>
                            <li><strong>Hora:</strong> ${cita.hora_inicio} - ${cita.hora_fin}</li>
                            <li><strong>Modalidad:</strong> ${cita.modalidad}</li>
                            ${cita.enlace_videollamada ? `<li><strong>Enlace virtual:</strong> <a href="${cita.enlace_videollamada}">${cita.enlace_videollamada}</a></li>` : ""}
                            <li><strong>Motivo:</strong> ${cita.motivo}</li>
                        </ul>
                        <p>Por favor, confirme su asistencia o cancele con al menos 2 horas de anticipación.</p>
                        <p>Saludos,<br>Colegio - Sistema de Gestión</p>
                    `,
        });

        // Correo para el profesor
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: cita.profesor_email,
          subject: `Recordatorio de cita con ${cita.tutor_nombre} ${cita.tutor_apellido}`,
          html: `
                        <h2>Recordatorio de cita</h2>
                        <p>Estimado/a <strong>${cita.profesor_nombre} ${cita.profesor_apellido}</strong>,</p>
                        <p>Le recordamos que tiene una cita programada con el tutor <strong>${cita.tutor_nombre} ${cita.tutor_apellido}</strong> para mañana.</p>
                        <p><strong>Detalles:</strong></p>
                        <ul>
                            <li><strong>Estudiante:</strong> ${cita.estudiante_nombre} ${cita.estudiante_apellido}</li>
                            <li><strong>Día:</strong> ${cita.dia_semana}</li>
                            <li><strong>Hora:</strong> ${cita.hora_inicio} - ${cita.hora_fin}</li>
                            <li><strong>Modalidad:</strong> ${cita.modalidad}</li>
                            ${cita.enlace_videollamada ? `<li><strong>Enlace virtual:</strong> <a href="${cita.enlace_videollamada}">${cita.enlace_videollamada}</a></li>` : ""}
                            <li><strong>Motivo:</strong> ${cita.motivo}</li>
                        </ul>
                        <p>Saludos,<br>Colegio - Sistema de Gestión</p>
                    `,
        });

        // Registrar la notificación en la base de datos
        await pool.query(
          `
                    INSERT INTO notificacion (id_aviso, id_tutor, id_cita, canal, estado_envio, fecha_envio)
                    VALUES (NULL, $1, $2, 'email', 'enviado', NOW())
                `,
          [cita.id_tutor, cita.id_cita],
        );

        console.log(`✅ Recordatorio enviado para cita ID ${cita.id_cita}`);
      } catch (error) {
        console.error(
          `❌ Error al enviar recordatorio para cita ${cita.id_cita}:`,
          error.message,
        );
        // Registrar el error en bitácora
        await pool.query(`
                    INSERT INTO bitacora (id_usuario, accion, tabla_afectada, descripcion)
                    VALUES (NULL, 'SISTEMA', 'cita', 'Error al enviar recordatorio de cita ID ${cita.id_cita}: ${error.message}')
                `);
      }
    }

    console.log("✅ Proceso de recordatorios completado.");
  } catch (error) {
    console.error("❌ Error en el cron job de recordatorios:", error);
  }
};

// Función para actualizar citas vencidas
const actualizarCitasVencidas = async () => {
  try {
    console.log("⏰ Ejecutando cron: Actualización de citas vencidas...");

    const query = `
            UPDATE cita
            SET estado = 'realizada'
            WHERE estado = 'confirmada'
              AND EXISTS (
                  SELECT 1 FROM horario_atencion ha
                  WHERE ha.id_horario_atencion = cita.id_horario_atencion
                    AND (
                      cita.fecha_cita < CURRENT_DATE
                      OR (cita.fecha_cita = CURRENT_DATE AND ha.hora_fin < NOW()::TIME)
                    )
              )
            RETURNING id_cita
        `;
    const { rows } = await pool.query(query);

    if (rows.length > 0) {
      console.log(`✅ ${rows.length} citas actualizadas a "realizada".`);
    }
  } catch (error) {
    console.error("❌ Error al actualizar citas vencidas:", error);
  }
};

// Programar los cron jobs
const iniciarCronJobs = () => {
  // Todos los días a las 8:00 AM y 8:00 PM
  cron.schedule("0 8,20 * * *", async () => {
    await enviarRecordatoriosCitas();
  });

  // Todos los días a la medianoche (actualizar citas vencidas del día anterior)
  cron.schedule("0 0 * * *", async () => {
    await actualizarCitasVencidas();
  });

  console.log("🕒 Cron jobs iniciados:");
  console.log("  - Recordatorios: 8:00 AM y 8:00 PM");
  console.log("  - Actualización de citas vencidas: 12:00 AM");
};

module.exports = {
  iniciarCronJobs,
  enviarRecordatoriosCitas,
  actualizarCitasVencidas,
};
