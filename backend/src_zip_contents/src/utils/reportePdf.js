const PDFDocument = require('pdfkit');

// ── Paleta institucional (alineada con pdfController.js) ───────────────────────
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
    zebra:     '#f3f6fc',
};

const MARGIN = 40;

function drawHeader(doc, titulo, subtitulo) {
    doc.rect(0, 0, doc.page.width, 86).fill(COLORS.primary);
    doc.fillColor(COLORS.white)
        .fontSize(11).font('Helvetica-Bold')
        .text('UNIDAD EDUCATIVA FAUSTO MEDRANO SANDOVAL "A"', MARGIN, 16, { align: 'center', width: doc.page.width - 2 * MARGIN });
    doc.fontSize(17).font('Helvetica-Bold')
        .text(titulo, MARGIN, 34, { align: 'center', width: doc.page.width - 2 * MARGIN });
    doc.fontSize(9).font('Helvetica')
        .text(
            `${subtitulo ? subtitulo + '  |  ' : ''}Emitido: ${new Date().toLocaleString('es-BO', { dateStyle: 'long', timeStyle: 'short' })}`,
            MARGIN, 62, { align: 'center', width: doc.page.width - 2 * MARGIN },
        );
    doc.y = 100;
    doc.x = MARGIN;
}

function filtrosBanner(doc, filtros) {
    const items = Object.entries(filtros || {}).filter(([, v]) => v !== null && v !== undefined && v !== '');
    if (items.length === 0) return;
    const texto = items.map(([k, v]) => `${k}: ${v}`).join('     ');
    const h = 18;
    doc.rect(MARGIN, doc.y, doc.page.width - 2 * MARGIN, h).fill(COLORS.accent);
    doc.fillColor(COLORS.primary).fontSize(8.5).font('Helvetica-Bold')
        .text(texto, MARGIN + 6, doc.y + 5, { width: doc.page.width - 2 * MARGIN - 12, ellipsis: true });
    doc.y += h + 8;
    doc.x = MARGIN;
}

function sectionTitle(doc, title) {
    ensureSpace(doc, 34);
    doc.moveDown(0.3);
    doc.rect(MARGIN, doc.y, doc.page.width - 2 * MARGIN, 20).fill(COLORS.accent);
    doc.fillColor(COLORS.primary).fontSize(11).font('Helvetica-Bold')
        .text(title, MARGIN + 6, doc.y + 5);
    doc.y += 26;
    doc.x = MARGIN;
}

function ensureSpace(doc, needed) {
    if (doc.y + needed > doc.page.height - 46) {
        doc.addPage();
        doc.y = MARGIN;
        doc.x = MARGIN;
    }
}

// columnas: [{ header, key, width(0..1 fracción o px), align }]
function table(doc, columnas, filas) {
    const usableW = doc.page.width - 2 * MARGIN;
    // resolver anchos: fracciones (<=1) se escalan al ancho usable
    const totalFrac = columnas.reduce((a, c) => a + (c.width <= 1 ? c.width : 0), 0);
    const fixed = columnas.reduce((a, c) => a + (c.width > 1 ? c.width : 0), 0);
    const widths = columnas.map((c) =>
        c.width <= 1 ? Math.floor((c.width / (totalFrac || 1)) * (usableW - fixed)) : c.width,
    );

    const rowH = 18;
    const drawRow = (cols, y, opts = {}) => {
        const { isHeader = false, zebra = false } = opts;
        let x = MARGIN;
        if (isHeader) doc.rect(MARGIN, y, usableW, rowH).fill(COLORS.secondary);
        else if (zebra) doc.rect(MARGIN, y, usableW, rowH).fill(COLORS.zebra);
        cols.forEach((col, i) => {
            doc.fillColor(isHeader ? COLORS.white : COLORS.text)
                .fontSize(8).font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
                .text(col === null || col === undefined || col === '' ? '—' : String(col),
                    x + 4, y + 5,
                    { width: widths[i] - 8, ellipsis: true, align: columnas[i].align || 'left' });
            x += widths[i];
        });
        return y + rowH;
    };

    const drawHeaderRow = () => {
        ensureSpace(doc, rowH);
        doc.y = drawRow(columnas.map((c) => c.header), doc.y, { isHeader: true });
    };

    drawHeaderRow();
    filas.forEach((fila, idx) => {
        if (doc.y + rowH > doc.page.height - 46) {
            doc.addPage();
            doc.y = MARGIN;
            doc.x = MARGIN;
            drawHeaderRow();
        }
        doc.y = drawRow(columnas.map((c) => fila[c.key]), doc.y, { zebra: idx % 2 === 1 });
    });
    // borde inferior
    doc.moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y).strokeColor(COLORS.border).stroke();
    doc.y += 10;
    doc.x = MARGIN;
}

// items: [[label, value], ...] en dos columnas (estadísticas)
function statsGrid(doc, items) {
    const usableW = doc.page.width - 2 * MARGIN;
    const colW = usableW / 2;
    const cardH = 30;
    let i = 0;
    while (i < items.length) {
        ensureSpace(doc, cardH + 4);
        const rowY = doc.y;
        for (let c = 0; c < 2 && i < items.length; c++, i++) {
            const [label, value] = items[i];
            const x = MARGIN + c * colW;
            doc.rect(x + 2, rowY, colW - 4, cardH).fill(COLORS.zebra).stroke(COLORS.border);
            doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica-Bold')
                .text(String(label).toUpperCase(), x + 8, rowY + 5, { width: colW - 16 });
            doc.fillColor(COLORS.primary).fontSize(13).font('Helvetica-Bold')
                .text(String(value), x + 8, rowY + 15, { width: colW - 16 });
        }
        doc.y = rowY + cardH + 4;
        doc.x = MARGIN;
    }
    doc.y += 6;
}

function texto(doc, contenido) {
    ensureSpace(doc, 20);
    doc.fillColor(COLORS.text).fontSize(9.5).font('Helvetica')
        .text(contenido, MARGIN, doc.y, { width: doc.page.width - 2 * MARGIN });
    doc.y += 6;
    doc.x = MARGIN;
}

function footer(doc) {
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fillColor(COLORS.muted).fontSize(7.5).font('Helvetica')
            .text(
                `Página ${i + 1} de ${pages.count}  |  Sistema de Gestión Educativa – U.E. Fausto Medrano Sandoval "A"`,
                MARGIN, doc.page.height - 30,
                { align: 'center', width: doc.page.width - 2 * MARGIN },
            );
    }
}

/**
 * Construye y transmite un PDF de reporte al response.
 * @param {object} res  Express response
 * @param {object} cfg
 *   - filename: string
 *   - titulo: string
 *   - subtitulo?: string
 *   - filtros?: Record<string,string>   (banner de filtros aplicados)
 *   - secciones: Array<
 *        { tipo: 'tabla', titulo?, columnas, filas } |
 *        { tipo: 'stats', titulo?, items } |
 *        { tipo: 'texto', titulo?, contenido }
 *     >
 */
function generarReportePdf(res, cfg) {
    const doc = new PDFDocument({ margin: MARGIN, size: 'A4', bufferPages: true, layout: cfg.landscape ? 'landscape' : 'portrait' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${cfg.filename}`);
    doc.pipe(res);

    drawHeader(doc, cfg.titulo, cfg.subtitulo);
    filtrosBanner(doc, cfg.filtros);

    (cfg.secciones || []).forEach((sec) => {
        if (sec.titulo) sectionTitle(doc, sec.titulo);
        if (sec.tipo === 'tabla') table(doc, sec.columnas, sec.filas);
        else if (sec.tipo === 'stats') statsGrid(doc, sec.items);
        else if (sec.tipo === 'texto') texto(doc, sec.contenido);
    });

    footer(doc);
    doc.end();
}

module.exports = { generarReportePdf, COLORS };
