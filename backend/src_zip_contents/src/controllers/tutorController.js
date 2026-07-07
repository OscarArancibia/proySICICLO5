const pool = require('../config/db');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d+$/;

const normalizeOptionalEmail = (email) => {
    if (email === undefined || email === null || String(email).trim() === '') {
        return null;
    }
    return String(email).trim().toLowerCase();
};

const validarCorreoTutor = (email) => {
    const normalized = normalizeOptionalEmail(email);
    if (normalized && !EMAIL_REGEX.test(normalized)) {
        return {
            isValid: false,
            message: 'El correo electrónico del tutor debe tener un formato válido. Ejemplo: tutor@correo.com'
        };
    }

    return { isValid: true, value: normalized };
};

const normalizeOptionalPhone = (phone) => {
    if (phone === undefined || phone === null || String(phone).trim() === '') {
        return null;
    }
    return String(phone).trim();
};

const validarTelefonoTutor = (phone) => {
    const normalized = normalizeOptionalPhone(phone);
    if (normalized && !PHONE_REGEX.test(normalized)) {
        return {
            isValid: false,
            message: 'El teléfono del tutor debe contener solo números.'
        };
    }

    return { isValid: true, value: normalized };
};

const buscarTutores = async (req, res) => {
    const { search } = req.query;
    try {
        const result = await pool.query(
            `SELECT * FROM tutor WHERE ci ILIKE $1 OR nombre || ' ' || apellido ILIKE $1 OR telefono ILIKE $1`,
            [`%${search}%`]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al buscar tutores', error: error.message });
    }
};

const registrarTutor = async (req, res) => {
    const { nombre, apellido, ci, genero, telefono, correo_electronico, direccion } = req.body;
    const correoValidation = validarCorreoTutor(correo_electronico);
    const telefonoValidation = validarTelefonoTutor(telefono);

    if (!correoValidation.isValid) {
        return res.status(400).json({ message: correoValidation.message });
    }

    if (!telefonoValidation.isValid) {
        return res.status(400).json({ message: telefonoValidation.message });
    }

    try {
        // NULL-safe: si ci es null/undefined, no validar duplicado por CI
        if (ci) {
            const ciCheck = await pool.query('SELECT * FROM tutor WHERE ci = $1 AND ci IS NOT NULL', [ci]);
            if (ciCheck.rows.length > 0) {
                return res.status(409).json({ message: `Ya existe un tutor con el CI ${ci}.`, tutor: ciCheck.rows[0] });
            }
        }

        const nuevoTutor = await pool.query(
            `INSERT INTO tutor (nombre, apellido, ci, genero, telefono, correo_electronico, direccion) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [nombre, apellido, ci, genero, telefonoValidation.value, correoValidation.value, direccion]
        );

        let advertencia = null;
        if (!telefonoValidation.value && !correoValidation.value) {
            advertencia = 'El tutor no tiene datos de contacto. Las notificaciones automáticas no podrán enviarse.';
        }

        res.status(201).json({ message: 'Tutor registrado', tutor: nuevoTutor.rows[0], advertencia });
    } catch (error) {
        res.status(500).json({ message: 'Error al registrar tutor', error: error.message });
    }
};

const vincularTutor = async (req, res) => {
    const { id_estudiante, id_tutor, parentesco, autorizado_recoger, contacto_emergencia } = req.body;
    try {
        const linkCheck = await pool.query(
            'SELECT * FROM tutor_estudiante WHERE id_estudiante = $1 AND id_tutor = $2',
            [id_estudiante, id_tutor]
        );
        if (linkCheck.rows.length > 0) {
            return res.status(409).json({ message: `Este tutor ya está vinculado al estudiante con el parentesco ${linkCheck.rows[0].parentesco}. Sugerencia: Edite el vínculo.` });
        }

        const vinculo = await pool.query(
            `INSERT INTO tutor_estudiante (id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [id_tutor, id_estudiante, parentesco, autorizado_recoger, contacto_emergencia]
        );
        res.status(201).json({ message: 'Vínculo creado correctamente.', vinculo: vinculo.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al vincular tutor', error: error.message });
    }
};

const desvincularTutor = async (req, res) => {
    const { id_estudiante, id_tutor } = req.params;
    try {
        const autorizados = await pool.query(
            'SELECT COUNT(*) FROM tutor_estudiante WHERE id_estudiante = $1 AND autorizado_recoger = TRUE AND id_tutor != $2',
            [id_estudiante, id_tutor]
        );

        if (parseInt(autorizados.rows[0].count) === 0) {
            return res.status(400).json({ message: 'Al menos un tutor debe estar autorizado para recoger al estudiante. No se puede desvincular.' });
        }

        await pool.query('DELETE FROM tutor_estudiante WHERE id_estudiante = $1 AND id_tutor = $2', [id_estudiante, id_tutor]);
        res.json({ message: 'Tutor desvinculado correctamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al desvincular', error: error.message });
    }
};

const editarTutor = async (req, res) => {
    const { id_tutor } = req.params;
    const { nombre, apellido, ci, genero, telefono, correo_electronico, direccion } = req.body;
    const correoValidation = validarCorreoTutor(correo_electronico);
    const telefonoValidation = validarTelefonoTutor(telefono);

    if (!correoValidation.isValid) {
        return res.status(400).json({ message: correoValidation.message });
    }

    if (!telefonoValidation.isValid) {
        return res.status(400).json({ message: telefonoValidation.message });
    }

    try {
        // Si se cambia el CI, verificar que no exista en otro tutor
        if (ci) {
            const ciCheck = await pool.query(
                'SELECT id_tutor FROM tutor WHERE ci = $1 AND ci IS NOT NULL AND id_tutor != $2',
                [ci, id_tutor]
            );
            if (ciCheck.rows.length > 0) {
                return res.status(409).json({ message: `Ya existe otro tutor registrado con el CI ${ci}.` });
            }
        }

        const updated = await pool.query(
            `UPDATE tutor SET
                nombre = COALESCE($1, nombre),
                apellido = COALESCE($2, apellido),
                ci = COALESCE($3, ci),
                genero = COALESCE($4, genero),
                telefono = COALESCE($5, telefono),
                correo_electronico = COALESCE($6, correo_electronico),
                direccion = COALESCE($7, direccion)
             WHERE id_tutor = $8 RETURNING *`,
            [nombre, apellido, ci, genero, telefonoValidation.value, correoValidation.value, direccion, id_tutor]
        );

        if (updated.rows.length === 0) {
            return res.status(404).json({ message: 'Tutor no encontrado.' });
        }
        res.json({ message: 'Tutor actualizado correctamente', tutor: updated.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar tutor', error: error.message });
    }
};

const editarVinculo = async (req, res) => {
    const { id_estudiante, id_tutor } = req.params;
    const { parentesco, autorizado_recoger, contacto_emergencia } = req.body;
    try {
        // Si se va a quitar autorización, verificar que quede al menos uno autorizado
        if (autorizado_recoger === false || autorizado_recoger === 'false') {
            const autorizados = await pool.query(
                'SELECT COUNT(*) FROM tutor_estudiante WHERE id_estudiante = $1 AND autorizado_recoger = TRUE AND id_tutor != $2',
                [id_estudiante, id_tutor]
            );
            if (parseInt(autorizados.rows[0].count) === 0) {
                return res.status(400).json({ message: 'Al menos un tutor debe estar autorizado para recoger al estudiante.' });
            }
        }

        const updated = await pool.query(
            `UPDATE tutor_estudiante SET
                parentesco = COALESCE($1, parentesco),
                autorizado_recoger = COALESCE($2, autorizado_recoger),
                contacto_emergencia = COALESCE($3, contacto_emergencia)
             WHERE id_estudiante = $4 AND id_tutor = $5 RETURNING *`,
            [parentesco, autorizado_recoger, contacto_emergencia, id_estudiante, id_tutor]
        );

        if (updated.rows.length === 0) {
            return res.status(404).json({ message: 'Vínculo no encontrado.' });
        }
        res.json({ message: 'Vínculo actualizado correctamente', vinculo: updated.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al editar el vínculo', error: error.message });
    }
};

module.exports = { buscarTutores, registrarTutor, vincularTutor, desvincularTutor, editarTutor, editarVinculo };
