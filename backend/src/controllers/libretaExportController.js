const pool = require('../config/db');
const PDFDocument = require('pdfkit');

const COLORS = {
    primary:   '#103f7a',
    secondary: '#1f5fae',
    accent:    '#f0f4f9',
    text:      '#111111',
    muted:     '#555555',
    border:    '#999999',
    white:     '#ffffff',
    lightGray: '#fcfcfc'
};

/**
 * Helper to fetch all necessary report card data.
 */
const obtenerDatosExportacion = async (id) => {
    // 1. Fetch cabecera of the requested libreta
    const cabRes = await pool.query(`
        SELECT 
            le.id_libreta, le.trimestre, le.estado, le.observaciones, 
            le.fecha_generacion, le.fecha_remision, le.fecha_aprobacion, le.promedio_general, le.id_gestion, le.id_curso, le.id_estudiante,
            e.nombre AS est_nombre, e.apellido AS est_apellido, e.ci AS est_ci, e.rude AS est_rude,
            c.paralelo AS curso_paralelo, c.turno AS curso_turno,
            g.nombre_grado,
            n.nombre_nivel,
            ga.anio AS gestion_anio,
            COALESCE(p_rev.nombre || ' ' || p_rev.apellido, u_rev.username) AS revisado_por_prof,
            COALESCE(p_apr.nombre || ' ' || p_apr.apellido, u_apr.username) AS aprobado_por_dir
        FROM libreta_emitida le
        JOIN estudiante e ON le.id_estudiante = e.id_estudiante
        JOIN curso c ON le.id_curso = c.id_curso
        JOIN grado g ON c.id_grado = g.id_grado
        JOIN nivel n ON g.id_nivel = n.id_nivel
        JOIN gestion_academica ga ON le.id_gestion = ga.id_gestion
        LEFT JOIN usuario u_rev ON le.id_usuario_remitente = u_rev.id_usuario
        LEFT JOIN profesor p_rev ON u_rev.id_usuario = p_rev.id_usuario
        LEFT JOIN usuario u_apr ON le.id_usuario_aprobador = u_apr.id_usuario
        LEFT JOIN profesor p_apr ON u_apr.id_usuario = p_apr.id_usuario
        WHERE le.id_libreta = $1
        LIMIT 1
    `, [id]);

    if (cabRes.rows.length === 0) {
        return null;
    }

    const cab = cabRes.rows[0];

    // 2. Fetch aggregated grades for all trimestres for this student/course/gestion
    const gradesRes = await pool.query(`
        SELECT 
            m.id_materia,
            m.nombre_materia,
            cs.nombre_campo,
            cs.orden_visualizacion,
            MAX(CASE WHEN le.trimestre = 1 THEN ld.nota_primer_trimestre END) AS t1_nota,
            MAX(CASE WHEN le.trimestre = 2 THEN ld.nota_segundo_trimestre END) AS t2_nota,
            MAX(CASE WHEN le.trimestre = 3 THEN ld.nota_tercer_trimestre END) AS t3_nota,
            MAX(CASE WHEN le.trimestre = 3 THEN ld.promedio_anual END) AS promedio_anual,
            MAX(CASE WHEN le.trimestre = 3 THEN ld.promedio_literal END) AS promedio_literal
        FROM libreta_emitida le
        JOIN libreta_detalle ld ON le.id_libreta = ld.id_libreta
        JOIN materia m ON ld.id_materia = m.id_materia
        LEFT JOIN campo_saber cs ON m.id_campo = cs.id_campo
        WHERE le.id_estudiante = $1 AND le.id_curso = $2 AND le.id_gestion = $3
          AND le.estado IN ('PENDIENTE_REVISION', 'PENDIENTE_APROBACION', 'APROBADA', 'entregada')
        GROUP BY m.id_materia, m.nombre_materia, cs.nombre_campo, cs.orden_visualizacion
        ORDER BY cs.orden_visualizacion NULLS LAST, m.nombre_materia
    `, [cab.id_estudiante, cab.id_curso, cab.id_gestion]);

    return {
        cab,
        grades: gradesRes.rows
    };
};

const exportarLibretaPdf = async (req, res) => {
    const { id } = req.params;

    try {
        const data = await obtenerDatosExportacion(id);
        if (!data) {
            return res.status(404).json({ message: 'La libreta solicitada no existe.' });
        }

        const { cab, grades } = data;

        // 3. Build PDF (Explicitly layout: 'portrait')
        const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'portrait', bufferPages: true });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=libreta_${cab.est_apellido}_${cab.trimestre}.pdf`);
        doc.pipe(res);

        // A nice double border frame around the page
        const drawPageBorder = () => {
            doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).strokeColor(COLORS.primary).lineWidth(2).stroke();
            doc.rect(23, 23, doc.page.width - 46, doc.page.height - 46).strokeColor(COLORS.secondary).lineWidth(0.5).stroke();
        };
        drawPageBorder();

        // Stamp Watermark if not approved
        if (cab.estado !== 'APROBADA') {
            doc.save();
            doc.fillColor('#dddddd').fontSize(45).font('Helvetica-Bold');
            doc.translate(doc.page.width / 2, doc.page.height / 2);
            doc.rotate(-45);
            doc.text('VISTA PREVIA - BORRADOR', -280, -20, { align: 'center', width: 560 });
            doc.fontSize(18).text('PENDIENTE DE APROBACIÓN POR DIRECCIÓN', -280, 40, { align: 'center', width: 560 });
            doc.restore();
        }

        // --- Member Header ---
        doc.fillColor(COLORS.primary)
           .fontSize(10).font('Helvetica-Bold')
           .text('UNIDAD EDUCATIVA FAUSTO MEDRANO SANDOVAL "A"', 40, 35, { align: 'center' });
        doc.fontSize(8).font('Helvetica')
           .text('MINISTERIO DE EDUCACIÓN - ESTADO PLURINACIONAL DE BOLIVIA', 40, 48, { align: 'center' });
        doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.secondary)
           .text('LIBRETA ESCOLAR DE CALIFICACIONES', 40, 62, { align: 'center' });
        doc.fontSize(9).font('Helvetica-Oblique').fillColor(COLORS.text)
           .text(`Gestión Académica: ${cab.gestion_anio} | Nivel: ${cab.nombre_nivel}`, 40, 77, { align: 'center' });

        doc.moveTo(40, 92).lineTo(doc.page.width - 40, 92).strokeColor(COLORS.border).lineWidth(1).stroke();

        // --- Student Profile Card ---
        let profileY = 100;
        doc.fillColor(COLORS.text).fontSize(9).font('Helvetica-Bold');
        
        doc.text('Estudiante:', 45, profileY);
        doc.font('Helvetica').text(`${cab.est_apellido}, ${cab.est_nombre}`, 115, profileY);

        doc.font('Helvetica-Bold').text('R.U.D.E.:', 340, profileY);
        doc.font('Helvetica').text(cab.est_rude || 'No Registrado', 410, profileY);

        profileY += 15;
        doc.font('Helvetica-Bold').text('C.I. Estudiante:', 45, profileY);
        doc.font('Helvetica').text(cab.est_ci || 'No Registrado', 115, profileY);

        doc.font('Helvetica-Bold').text('Curso/Grado:', 340, profileY);
        doc.font('Helvetica').text(`${cab.nombre_grado} "${cab.curso_paralelo}"`, 410, profileY);

        profileY += 15;
        doc.font('Helvetica-Bold').text('Turno / Paralelo:', 45, profileY);
        doc.font('Helvetica').text(`${cab.curso_turno} / ${cab.curso_paralelo}`, 115, profileY);

        doc.font('Helvetica-Bold').text('Estado Actual:', 340, profileY);
        const stateColor = cab.estado === 'APROBADA' ? COLORS.primary : COLORS.muted;
        doc.fillColor(stateColor).font('Helvetica-Bold').text(cab.estado, 410, profileY);

        doc.moveTo(40, profileY + 15).lineTo(doc.page.width - 40, profileY + 15).strokeColor(COLORS.border).lineWidth(1).stroke();

        // --- Grades Table ---
        let tableY = profileY + 25;
        const colWidths = [190, 50, 50, 50, 55, 120];
        const colHeaders = [
            'CAMPOS DE SABERES Y ÁREAS CURRICULARES', 
            '1º TRIM', 
            '2º TRIM', 
            '3º TRIM', 
            'PROM ANUAL', 
            'VALORACIÓN CUALITATIVA'
        ];

        // Draw Table Header
        let x = 40;
        doc.rect(40, tableY, colWidths.reduce((a, b) => a + b, 0), 22).fill(COLORS.primary);
        colHeaders.forEach((header, idx) => {
            doc.fillColor(COLORS.white).fontSize(7).font('Helvetica-Bold')
               .text(header, x + 4, tableY + 7, { width: colWidths[idx] - 8, align: idx > 0 && idx < 5 ? 'center' : 'left' });
            x += colWidths[idx];
        });

        tableY += 22;

        let currentCampo = '';
        grades.forEach((row) => {
            // Draw Campo header if changed
            if (row.nombre_campo !== currentCampo) {
                currentCampo = row.nombre_campo || 'OTRAS ÁREAS';
                doc.rect(40, tableY, colWidths.reduce((a, b) => a + b, 0), 16).fill(COLORS.accent);
                doc.fillColor(COLORS.secondary).fontSize(7.5).font('Helvetica-Bold')
                   .text(currentCampo.toUpperCase(), 45, tableY + 5);
                tableY += 16;
            }

            // Draw Materia Row
            doc.rect(40, tableY, colWidths.reduce((a, b) => a + b, 0), 18).fill(COLORS.lightGray).stroke(COLORS.border);
            
            x = 40;
            // Area Curricular (Materia)
            doc.fillColor(COLORS.text).fontSize(7.5).font('Helvetica')
               .text(row.nombre_materia, x + 4, tableY + 5, { width: colWidths[0] - 8, ellipsis: true });
            x += colWidths[0];

            // T1
            const t1Text = row.t1_nota ? Math.round(row.t1_nota).toString() : '—';
            doc.text(t1Text, x, tableY + 5, { width: colWidths[1], align: 'center' });
            x += colWidths[1];

            // T2
            const t2Text = row.t2_nota ? Math.round(row.t2_nota).toString() : '—';
            doc.text(t2Text, x, tableY + 5, { width: colWidths[2], align: 'center' });
            x += colWidths[2];

            // T3
            const t3Text = row.t3_nota ? Math.round(row.t3_nota).toString() : '—';
            doc.text(t3Text, x, tableY + 5, { width: colWidths[3], align: 'center' });
            x += colWidths[3];

            // Promedio Anual
            const promText = row.promedio_anual ? Math.round(row.promedio_anual).toString() : '—';
            doc.text(promText, x, tableY + 5, { width: colWidths[4], align: 'center' });
            x += colWidths[4];

            // Promedio Literal
            const literalText = row.promedio_literal || (row.t3_nota ? '—' : '—');
            doc.fontSize(6.5).text(literalText.toUpperCase(), x + 4, tableY + 5, { width: colWidths[5] - 8, ellipsis: true });

            tableY += 18;
        });

        // Add Observations Block
        tableY += 15;
        doc.rect(40, tableY, doc.page.width - 80, 50).strokeColor(COLORS.border).stroke();
        doc.fillColor(COLORS.secondary).fontSize(8).font('Helvetica-Bold')
           .text(' OBSERVACIONES Y ACCIONES DE APOYO PEDAGÓGICO:', 45, tableY + 5);
        
        const obsContent = cab.observaciones || 'Sin observaciones académicas registradas por el profesor titular.';
        doc.fillColor(COLORS.text).fontSize(8).font('Helvetica')
           .text(obsContent, 45, tableY + 18, { width: doc.page.width - 90, height: 28 });

        // Add General Average row
        tableY += 58;
        doc.fillColor(COLORS.muted).fontSize(8.5).font('Helvetica-Bold')
           .text(`Promedio Trimestral de Calificaciones (Cuantitativo): ${cab.promedio_general || '0.00'}`, 40, tableY);

        // Signatures area at bottom
        let signY = doc.page.height - 110;
        doc.moveTo(60, signY).lineTo(220, signY).strokeColor(COLORS.border).stroke();
        doc.moveTo(doc.page.width - 220, signY).lineTo(doc.page.width - 60, signY).strokeColor(COLORS.border).stroke();

        doc.fillColor(COLORS.text).fontSize(8).font('Helvetica-Bold');
        doc.text('Firma Profesor(a) Titular', 60, signY + 5, { width: 160, align: 'center' });
        doc.text('Firma Director(a)', doc.page.width - 220, signY + 5, { width: 160, align: 'center' });

        doc.fontSize(7).font('Helvetica').fillColor(COLORS.muted);
        doc.text(cab.revisado_por_prof ? `Revisado por: ${cab.revisado_por_prof}` : 'Revisado por: Docente de Curso', 60, signY + 18, { width: 160, align: 'center' });
        doc.text(cab.aprobado_por_dir ? `Aprobado por: ${cab.aprobado_por_dir}` : 'Aprobado por: Dirección General', doc.page.width - 220, signY + 18, { width: 160, align: 'center' });

        // Document verification string
        doc.fontSize(6).fillColor(COLORS.muted).text(
            `Documento digital de carácter informativo. Generado: ${new Date(cab.fecha_generacion).toLocaleString('es-BO')}.` +
            (cab.fecha_aprobacion ? ` Aprobación definitiva: ${new Date(cab.fecha_aprobacion).toLocaleString('es-BO')}.` : ''),
            40, doc.page.height - 35, { align: 'center', width: doc.page.width - 80 }
        );

        doc.end();

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al exportar el PDF de la libreta', error: error.message });
    }
};

const exportarLibretaCsv = async (req, res) => {
    const { id } = req.params;

    try {
        const data = await obtenerDatosExportacion(id);
        if (!data) {
            return res.status(404).json({ message: 'La libreta solicitada no existe.' });
        }

        const { cab, grades } = data;

        // UTF-8 BOM for Microsoft Excel compatibility
        let csv = '\uFEFF';

        // Institutional headers
        csv += `"UNIDAD EDUCATIVA FAUSTO MEDRANO SANDOVAL 'A'"\n`;
        csv += `"MINISTERIO DE EDUCACIÓN - ESTADO PLURINACIONAL DE BOLIVIA"\n`;
        csv += `"LIBRETA ESCOLAR DE CALIFICACIONES"\n\n`;

        // Profile card information
        csv += `"ESTUDIANTE:","${cab.est_apellido}, ${cab.est_nombre}","R.U.D.E.:","${cab.est_rude || 'No Registrado'}"\n`;
        csv += `"C.I. ESTUDIANTE:","${cab.est_ci || 'No Registrado'}","CURSO/GRADO:","${cab.nombre_grado} '${cab.curso_paralelo}'"\n`;
        csv += `"TURNO:","${cab.curso_turno}","TRIMESTRE:","${cab.trimestre}º Trimestre"\n`;
        csv += `"ESTADO:","${cab.estado}","PROMEDIO GENERAL:","${cab.promedio_general || '0.00'}"\n\n`;

        // Table headers
        csv += `"CAMPOS DE SABERES Y ÁREAS CURRICULARES","1º TRIMESTRE","2º TRIMESTRE","3º TRIMESTRE","PROMEDIO ANUAL","VALORACIÓN CUALITATIVA"\n`;

        let currentCampo = '';
        grades.forEach((row) => {
            if (row.nombre_campo !== currentCampo) {
                currentCampo = row.nombre_campo || 'OTRAS ÁREAS';
                csv += `"${currentCampo.toUpperCase()}","","","","",""\n`;
            }

            const t1 = row.t1_nota ? Math.round(row.t1_nota) : '';
            const t2 = row.t2_nota ? Math.round(row.t2_nota) : '';
            const t3 = row.t3_nota ? Math.round(row.t3_nota) : '';
            const prom = row.promedio_anual ? Math.round(row.promedio_anual) : '';
            const literal = row.promedio_literal || '';

            csv += `"${row.nombre_materia}","${t1}","${t2}","${t3}","${prom}","${literal.toUpperCase()}"\n`;
        });

        // Observations and verification info
        csv += `\n"OBSERVACIONES Y ACCIONES DE APOYO PEDAGÓGICO:"\n`;
        csv += `"${cab.observaciones || 'Sin observaciones académicas registradas por el profesor titular.'}"\n\n`;

        csv += `"PROFESOR(A) TITULAR:","${cab.revisado_por_prof || 'Docente de Curso'}"\n`;
        csv += `"DIRECTOR(A):","${cab.aprobado_por_dir || 'Dirección General'}"\n\n`;

        csv += `"Documento digital de carácter informativo. Generado: ${new Date(cab.fecha_generacion).toLocaleString('es-BO')}.` +
               (cab.fecha_aprobacion ? ` Aprobación definitiva: ${new Date(cab.fecha_aprobacion).toLocaleString('es-BO')}.` : '') + `"\n`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=libreta_${cab.est_apellido}_T${cab.trimestre}.csv`);
        res.send(csv);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al exportar el CSV de la libreta', error: error.message });
    }
};

const exportarLibretaWord = async (req, res) => {
    const { id } = req.params;

    try {
        const data = await obtenerDatosExportacion(id);
        if (!data) {
            return res.status(404).json({ message: 'La libreta solicitada no existe.' });
        }

        const { cab, grades } = data;

        // Build elegant Word HTML document that represents the report card
        let html = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<title>Libreta Escolar de Calificaciones - ${cab.est_apellido}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
    @page {
        size: 8.27in 11.69in; /* A4 size in inches */
        margin: 0.8in 0.8in 0.8in 0.8in;
    }
    body {
        font-family: 'Segoe UI', Arial, sans-serif;
        color: #111111;
        line-height: 1.2;
    }
    .header {
        text-align: center;
        margin-bottom: 20px;
    }
    .header h1 {
        color: #103f7a;
        font-size: 14pt;
        margin: 0 0 4px 0;
        font-weight: bold;
    }
    .header h2 {
        color: #1f5fae;
        font-size: 11pt;
        margin: 0 0 4px 0;
        font-weight: bold;
    }
    .header p {
        color: #555555;
        font-size: 8.5pt;
        margin: 0;
    }
    .profile-card {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
        background-color: #fcfcfc;
        border: 1px solid #999999;
    }
    .profile-card td {
        padding: 6px 10px;
        font-size: 9pt;
        vertical-align: middle;
        border: none;
    }
    .profile-card td.label {
        font-weight: bold;
        color: #555555;
        width: 18%;
    }
    .profile-card td.value {
        width: 32%;
        color: #111111;
    }
    .divider {
        border-top: 1px solid #999999;
        margin: 15px 0;
    }
    .grades-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
    }
    .grades-table th {
        background-color: #103f7a;
        color: #ffffff;
        font-size: 8pt;
        font-weight: bold;
        border: 1px solid #999999;
        padding: 8px 6px;
        text-align: center;
    }
    .grades-table td {
        border: 1px solid #999999;
        padding: 6px;
        font-size: 8pt;
        vertical-align: middle;
    }
    .grades-table tr.campo-row {
        background-color: #f0f4f9;
    }
    .grades-table tr.campo-row td {
        font-weight: bold;
        color: #1f5fae;
        font-size: 8.5pt;
        padding: 6px;
    }
    .center {
        text-align: center;
    }
    .bold {
        font-weight: bold;
    }
    .obs-box {
        width: 100%;
        border: 1px solid #999999;
        background-color: #fcfcfc;
        margin-bottom: 20px;
    }
    .obs-box td {
        padding: 10px;
        font-size: 8.5pt;
    }
    .obs-title {
        font-weight: bold;
        color: #1f5fae;
        margin-bottom: 4px;
    }
    .obs-text {
        font-style: italic;
        color: #333333;
    }
    .average-text {
        font-size: 9pt;
        font-weight: bold;
        color: #555555;
        margin-bottom: 25px;
    }
    .signatures-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 30px;
    }
    .signatures-table td {
        text-align: center;
        font-size: 8.5pt;
        width: 45%;
        padding-top: 40px;
    }
    .signatures-table td.signature-line {
        border-top: 1px dashed #999999;
    }
    .footer-text {
        text-align: center;
        font-size: 7pt;
        color: #777777;
        margin-top: 40px;
    }
</style>
</head>
<body>
    <div class="header">
        <h1>UNIDAD EDUCATIVA FAUSTO MEDRANO SANDOVAL "A"</h1>
        <h2>MINISTERIO DE EDUCACIÓN - ESTADO PLURINACIONAL DE BOLIVIA</h2>
        <h2 style="font-size:12pt; color:#103f7a; margin-top:8px;">LIBRETA ESCOLAR DE CALIFICACIONES</h2>
        <p><b>Gestión Académica:</b> ${cab.gestion_anio} | <b>Nivel:</b> ${cab.nombre_nivel}</p>
    </div>

    <table class="profile-card">
        <tr>
            <td class="label">Estudiante:</td>
            <td class="value">${cab.est_apellido}, ${cab.est_nombre}</td>
            <td class="label">R.U.D.E.:</td>
            <td class="value">${cab.est_rude || 'No Registrado'}</td>
        </tr>
        <tr>
            <td class="label">C.I. Estudiante:</td>
            <td class="value">${cab.est_ci || 'No Registrado'}</td>
            <td class="label">Curso/Grado:</td>
            <td class="value">${cab.nombre_grado} "${cab.curso_paralelo}"</td>
        </tr>
        <tr>
            <td class="label">Turno / Paralelo:</td>
            <td class="value">${cab.curso_turno} / ${cab.curso_paralelo}</td>
            <td class="label">Estado Actual:</td>
            <td class="value"><b>${cab.estado}</b></td>
        </tr>
    </table>

    <table class="grades-table">
        <thead>
            <tr>
                <th style="text-align: left; width: 40%;">CAMPOS DE SABERES Y ÁREAS CURRICULARES</th>
                <th style="width: 10%;">1º TRIM</th>
                <th style="width: 10%;">2º TRIM</th>
                <th style="width: 10%;">3º TRIM</th>
                <th style="width: 10%;">PROM ANUAL</th>
                <th style="text-align: left; width: 20%;">VALORACIÓN CUALITATIVA</th>
            </tr>
        </thead>
        <tbody>
`;

        let currentCampo = '';
        grades.forEach((row) => {
            if (row.nombre_campo !== currentCampo) {
                currentCampo = row.nombre_campo || 'OTRAS ÁREAS';
                html += `
                    <tr class="campo-row">
                        <td colspan="6">${currentCampo.toUpperCase()}</td>
                    </tr>
                `;
            }

            const t1 = row.t1_nota ? Math.round(row.t1_nota) : '—';
            const t2 = row.t2_nota ? Math.round(row.t2_nota) : '—';
            const t3 = row.t3_nota ? Math.round(row.t3_nota) : '—';
            const prom = row.promedio_anual ? Math.round(row.promedio_anual) : '—';
            const literal = row.promedio_literal || '—';

            html += `
                <tr>
                    <td>${row.nombre_materia}</td>
                    <td class="center">${t1}</td>
                    <td class="center">${t2}</td>
                    <td class="center">${t3}</td>
                    <td class="center bold">${prom}</td>
                    <td>${literal.toUpperCase()}</td>
                </tr>
            `;
        });

        html += `
        </tbody>
    </table>

    <table class="obs-box">
        <tr>
            <td>
                <div class="obs-title">OBSERVACIONES Y ACCIONES DE APOYO PEDAGÓGICO:</div>
                <div class="obs-text">${cab.observaciones || 'Sin observaciones académicas registradas por el profesor titular.'}</div>
            </td>
        </tr>
    </table>

    <div class="average-text">
        Promedio Trimestral de Calificaciones (Cuantitativo): ${cab.promedio_general || '0.00'}
    </div>

    <table class="signatures-table">
        <tr>
            <td class="signature-line" style="width: 45%;">
                <b>Firma Profesor(a) Titular</b><br>
                <span style="font-size: 7.5pt; color: #555555;">${cab.revisado_por_prof ? 'Revisado por: ' + cab.revisado_por_prof : 'Revisado por: Docente de Curso'}</span>
            </td>
            <td style="width: 10%;">&nbsp;</td>
            <td class="signature-line" style="width: 45%;">
                <b>Firma Director(a)</b><br>
                <span style="font-size: 7.5pt; color: #555555;">${cab.aprobado_por_dir ? 'Aprobado por: ' + cab.aprobado_por_dir : 'Aprobado por: Dirección General'}</span>
            </td>
        </tr>
    </table>

    <div class="footer-text">
        Documento digital de carácter informativo. Generado: ${new Date(cab.fecha_generacion).toLocaleString('es-BO')}.
        ${cab.fecha_aprobacion ? ' Aprobación definitiva: ' + new Date(cab.fecha_aprobacion).toLocaleString('es-BO') + '.' : ''}
    </div>
</body>
</html>
`;

        res.setHeader('Content-Type', 'application/msword');
        res.setHeader('Content-Disposition', `attachment; filename=libreta_${cab.est_apellido}_T${cab.trimestre}.doc`);
        res.send(html);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al exportar el Word de la libreta', error: error.message });
    }
};

module.exports = { 
    exportarLibretaPdf,
    exportarLibretaCsv,
    exportarLibretaWord
};
