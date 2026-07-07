const pool = require('../config/db');
const PDFDocument = require('pdfkit');

// ── Helpers de dibujo ──────────────────────────────────────────────────────────

const COLORS = {
    primary:   '#1a56a4',
    secondary: '#2d6cdf',
    accent:    '#e8f0fe',
    text:      '#1a1a2e',
    muted:     '#6b7280',
    danger:    '#dc2626',
    success:   '#16a34a',
    border:    '#d1d5db',
    white:     '#ffffff',
};

function drawHeader(doc, nombreCompleto, estado) {
    // Banda superior
    doc.rect(0, 0, doc.page.width, 80).fill(COLORS.primary);
    doc.fillColor(COLORS.white)
       .fontSize(20).font('Helvetica-Bold')
       .text('EXPEDIENTE DIGITAL DEL ESTUDIANTE', 40, 22, { align: 'center' });
    doc.fontSize(11).font('Helvetica')
       .text(`Emitido: ${new Date().toLocaleDateString('es-BO', { year: 'numeric', month: 'long', day: 'numeric' })}`, 40, 50, { align: 'center' });

    // Nombre del estudiante
    doc.moveDown(2.5);
    const estadoColor = estado === 'activo' ? COLORS.success : estado === 'retirado' ? COLORS.danger : COLORS.muted;
    doc.fillColor(COLORS.text).fontSize(16).font('Helvetica-Bold')
       .text(nombreCompleto, { continued: false });
    doc.fontSize(10).font('Helvetica').fillColor(estadoColor)
       .text(`Estado: ${estado.toUpperCase()}`, { align: 'left' });
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).strokeColor(COLORS.border).stroke();
    doc.moveDown(0.5);
}

function sectionTitle(doc, title) {
    doc.moveDown(0.4);
    doc.rect(40, doc.y, doc.page.width - 80, 20).fill(COLORS.accent);
    doc.fillColor(COLORS.primary).fontSize(11).font('Helvetica-Bold')
       .text(title, 46, doc.y - 17);
    doc.moveDown(0.6);
}

function field(doc, label, value, opts = {}) {
    const val = value ?? '—';
    doc.fillColor(COLORS.muted).fontSize(8.5).font('Helvetica-Bold').text(label + ': ', { continued: true });
    doc.fillColor(COLORS.text).font('Helvetica').text(String(val), opts);
}

function twoCol(doc, items) {
    const half = Math.ceil(items.length / 2);
    const left = items.slice(0, half);
    const right = items.slice(half);
    const startY = doc.y;
    const midX = doc.page.width / 2;

    left.forEach((item) => { field(doc, item[0], item[1]); });
    const endLeftY = doc.y;

    doc.y = startY;
    right.forEach((item) => {
        doc.fillColor(COLORS.muted).fontSize(8.5).font('Helvetica-Bold')
           .text(item[0] + ': ', midX, doc.y, { continued: true, width: midX - 40 });
        doc.fillColor(COLORS.text).font('Helvetica').text(String(item[1] ?? '—'), { width: midX - 50 });
    });
    doc.y = Math.max(endLeftY, doc.y);
    doc.moveDown(0.3);
}

function tableRow(doc, cols, widths, y, isHeader = false) {
    const x0 = 40;
    let x = x0;
    const rowH = 18;
    if (isHeader) {
        doc.rect(x0, y, widths.reduce((a, b) => a + b, 0), rowH).fill(COLORS.secondary);
    } else {
        doc.rect(x0, y, widths.reduce((a, b) => a + b, 0), rowH).fill(COLORS.white).stroke(COLORS.border);
    }
    cols.forEach((col, i) => {
        doc.fillColor(isHeader ? COLORS.white : COLORS.text)
           .fontSize(8).font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
           .text(String(col ?? '—'), x + 4, y + 4, { width: widths[i] - 8, ellipsis: true });
        x += widths[i];
    });
    return y + rowH;
}

// ── Controller principal ──────────────────────────────────────────────────────

const exportarExpedientePdf = async (req, res) => {
    const { id_estudiante } = req.params;

    try {
        // ── 1. Datos personales
        const personal = await pool.query(
            'SELECT * FROM estudiante WHERE id_estudiante = $1',
            [id_estudiante]
        );
        if (personal.rows.length === 0) {
            return res.status(404).json({ message: 'Estudiante no encontrado.' });
        }
        const est = personal.rows[0];

        // ── 2. Inscripciones
        const inscripciones = await pool.query(`
            SELECT i.id_inscripcion, i.fecha_inscripcion, i.estado, i.observaciones,
                   c.paralelo, c.turno, g.nombre_grado, n.nombre_nivel, gest.anio,
                   p.nombre || ' ' || p.apellido AS profesor
            FROM inscripcion i
            JOIN curso c    ON i.id_curso    = c.id_curso
            JOIN grado g    ON c.id_grado    = g.id_grado
            JOIN nivel n    ON g.id_nivel    = n.id_nivel
            JOIN gestion_academica gest ON c.id_gestion = gest.id_gestion
            JOIN profesor p ON c.id_profesor = p.id_profesor
            WHERE i.id_estudiante = $1
            ORDER BY gest.anio DESC
        `, [id_estudiante]);

        // ── 3. Tutores
        const tutores = await pool.query(`
            SELECT t.nombre, t.apellido, t.ci, t.telefono, t.correo_electronico,
                   te.parentesco, te.autorizado_recoger, te.contacto_emergencia
            FROM tutor t
            JOIN tutor_estudiante te ON t.id_tutor = te.id_tutor
            WHERE te.id_estudiante = $1
            ORDER BY te.autorizado_recoger DESC
        `, [id_estudiante]);

        // ── 4. Asistencias (resumen)
        const asistencias = await pool.query(`
            SELECT
                g.nombre_grado, c.paralelo, gest.anio,
                COUNT(*) FILTER (WHERE a.estado = 'P') AS presentes,
                COUNT(*) FILTER (WHERE a.estado = 'A') AS ausentes,
                COUNT(*) FILTER (WHERE a.estado = 'T') AS tardanzas,
                COUNT(*) FILTER (WHERE a.estado = 'J') AS justificados,
                COUNT(*) AS total
            FROM asistencia a
            JOIN curso c    ON a.id_curso = c.id_curso
            JOIN grado g    ON c.id_grado = g.id_grado
            JOIN gestion_academica gest ON c.id_gestion = gest.id_gestion
            WHERE a.id_estudiante = $1
            GROUP BY g.nombre_grado, c.paralelo, gest.anio
            ORDER BY gest.anio DESC
        `, [id_estudiante]);

        // ── 5. Calificaciones (resumen por materia y trimestre)
        const calificaciones = await pool.query(`
            SELECT
                m.nombre_materia,
                ae.trimestre,
                de.nombre_dimension,
                de.puntaje_maximo,
                SUM(cal.nota) AS total_obtenido,
                gest.anio
            FROM calificacion cal
            JOIN actividad_evaluacion ae ON cal.id_actividad      = ae.id_actividad
            JOIN dimension_evaluacion de ON ae.id_dimension_eval  = de.id_dimension_eval
            JOIN curso_materia cm        ON ae.id_curso_materia   = cm.id_curso_materia
            JOIN materia m              ON cm.id_materia          = m.id_materia
            JOIN curso c                ON cm.id_curso            = c.id_curso
            JOIN gestion_academica gest ON c.id_gestion           = gest.id_gestion
            WHERE cal.id_estudiante = $1
            GROUP BY m.nombre_materia, ae.trimestre, de.nombre_dimension, de.puntaje_maximo, gest.anio
            ORDER BY gest.anio DESC, m.nombre_materia, ae.trimestre, de.nombre_dimension
        `, [id_estudiante]);

        // ── Construir PDF ──────────────────────────────────────────────────
        const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=expediente_${id_estudiante}_${est.apellido}.pdf`);
        doc.pipe(res);

        const nombreCompleto = `${est.nombre} ${est.apellido}`;
        drawHeader(doc, nombreCompleto, est.estado);

        // ─── Sección: Datos Personales ─────────────────────────────────────
        sectionTitle(doc, '📋 DATOS PERSONALES');
        twoCol(doc, [
            ['Nombre', est.nombre],
            ['CI', est.ci || 'No registrado'],
            ['Apellido', est.apellido],
            ['Género', est.genero],
            ['Fecha de Nacimiento', est.fecha_nacimiento
                ? new Date(est.fecha_nacimiento).toLocaleDateString('es-BO') : '—'],
            ['Edad', est.edad ? `${est.edad} años` : '—'],
        ]);
        if (est.observaciones) {
            field(doc, 'Observaciones', est.observaciones);
            doc.moveDown(0.3);
        }

        // ─── Sección: Tutores ──────────────────────────────────────────────
        sectionTitle(doc, '👨‍👩‍👧 TUTORES VINCULADOS');
        if (tutores.rows.length === 0) {
            doc.fillColor(COLORS.muted).fontSize(9).text('Sin tutores registrados.');
        } else {
            const tW = [120, 80, 100, 110, 90, 65];
            let ty = doc.y;
            ty = tableRow(doc, ['Nombre', 'CI', 'Parentesco', 'Teléfono', 'Correo', 'Autorizado'], tW, ty, true);
            tutores.rows.forEach((t) => {
                if (ty > doc.page.height - 80) { doc.addPage(); ty = 60; }
                ty = tableRow(doc, [
                    `${t.nombre} ${t.apellido}`,
                    t.ci,
                    t.parentesco,
                    t.telefono || '—',
                    t.correo_electronico || '—',
                    t.autorizado_recoger ? 'Sí' : 'No'
                ], tW, ty);
            });
            doc.y = ty + 6;
        }

        // ─── Sección: Inscripciones ────────────────────────────────────────
        sectionTitle(doc, '📚 HISTORIAL DE INSCRIPCIONES');
        if (inscripciones.rows.length === 0) {
            doc.fillColor(COLORS.muted).fontSize(9).text('Sin inscripciones registradas.');
        } else {
            const iW = [45, 100, 50, 55, 65, 100, 90];
            let iy = doc.y;
            iy = tableRow(doc, ['Gestión', 'Grado', 'Paralelo', 'Turno', 'Estado', 'Profesor', 'Fecha Inscr.'], iW, iy, true);
            inscripciones.rows.forEach((ins) => {
                if (iy > doc.page.height - 80) { doc.addPage(); iy = 60; }
                iy = tableRow(doc, [
                    ins.anio,
                    `${ins.nombre_nivel} – ${ins.nombre_grado}`,
                    ins.paralelo,
                    ins.turno,
                    ins.estado,
                    ins.profesor,
                    ins.fecha_inscripcion
                        ? new Date(ins.fecha_inscripcion).toLocaleDateString('es-BO') : '—'
                ], iW, iy);
            });
            doc.y = iy + 6;
        }

        // ─── Sección: Asistencias ──────────────────────────────────────────
        sectionTitle(doc, '📅 RESUMEN DE ASISTENCIAS');
        if (asistencias.rows.length === 0) {
            doc.fillColor(COLORS.muted).fontSize(9).text('Sin registros de asistencia.');
        } else {
            const aW = [45, 100, 55, 60, 60, 65, 60, 70];
            let ay = doc.y;
            ay = tableRow(doc, ['Gestión', 'Grado', 'Paralelo', 'Total días', 'Presentes', 'Ausentes', 'Tardanzas', '% Asistencia'], aW, ay, true);
            asistencias.rows.forEach((a) => {
                const pct = a.total > 0 ? ((parseInt(a.presentes) / parseInt(a.total)) * 100).toFixed(1) : '0.0';
                if (ay > doc.page.height - 80) { doc.addPage(); ay = 60; }
                ay = tableRow(doc, [
                    a.anio, `${a.nombre_grado}`, a.paralelo,
                    a.total, a.presentes, a.ausentes, a.tardanzas,
                    `${pct}%`
                ], aW, ay);
            });
            doc.y = ay + 6;
        }

        // ─── Sección: Calificaciones ───────────────────────────────────────
        if (calificaciones.rows.length > 0) {
            doc.addPage();
            sectionTitle(doc, '🎓 CALIFICACIONES POR MATERIA Y TRIMESTRE');
            const cW = [140, 45, 95, 75, 70];
            let cy = doc.y;
            cy = tableRow(doc, ['Materia', 'Trim.', 'Dimensión', 'Puntaje Máx.', 'Obtenido'], cW, cy, true);
            calificaciones.rows.forEach((c) => {
                if (cy > doc.page.height - 60) { doc.addPage(); cy = 60; }
                cy = tableRow(doc, [
                    c.nombre_materia,
                    `T${c.trimestre}`,
                    c.nombre_dimension,
                    parseFloat(c.puntaje_maximo).toFixed(2),
                    parseFloat(c.total_obtenido).toFixed(2)
                ], cW, cy);
            });
            doc.y = cy + 6;
        }

        // ─── Pie de página en todas las páginas ────────────────────────────
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            doc.fillColor(COLORS.muted).fontSize(7.5)
               .text(
                   `Página ${i + 1} de ${pages.count}  |  ${nombreCompleto}  |  Sistema de Gestión Educativa`,
                   40, doc.page.height - 30,
                   { align: 'center', width: doc.page.width - 80 }
               );
        }

        doc.end();

    } catch (error) {
        res.status(500).json({ message: 'Error al generar el PDF del expediente', error: error.message });
    }
};

module.exports = { exportarExpedientePdf };
