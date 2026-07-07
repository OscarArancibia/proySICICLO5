const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { validatePasswordStrength } = require('../utils/passwordPolicy');

const getProfesores = async (req, res) => {
    try {
        const query = `
            SELECT p.*, u.username, u.email, u.estado as usuario_activo
            FROM profesor p
            LEFT JOIN usuario u ON p.id_usuario = u.id_usuario
            ORDER BY p.apellido ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener lista de profesores', error: error.message });
    }
};

const createProfesor = async (req, res) => {
    const {
        nombre, apellido, ci, profesion, genero,
        id_usuario,
        crear_cuenta, username, password, email
    } = req.body;

    if (!nombre || !apellido || !ci || !genero) {
        return res.status(400).json({ message: 'Los datos básicos del profesor son obligatorios.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const ciCheck = await client.query('SELECT id_profesor FROM profesor WHERE ci = $1', [ci]);
        if (ciCheck.rows.length > 0) {
            throw new Error('Profesor ya existe (CI duplicado).');
        }

        let usuarioFinalId = id_usuario;

        if (crear_cuenta) {
            if (!email) {
                throw new Error('El correo electrónico es obligatorio para crear la cuenta de usuario.');
            }
            const passwordValidation = validatePasswordStrength(password);
            if (!passwordValidation.isValid) {
                throw new Error(passwordValidation.message);
            }

            const userCheck = await client.query('SELECT id_usuario FROM usuario WHERE username = $1 OR email = $2', [username, email]);
            if (userCheck.rows.length > 0) {
                throw new Error('El nombre de usuario ya está en uso.');
            }

            const salt = await bcrypt.genSalt(10);
            const passHash = await bcrypt.hash(password, salt);
            const newUser = await client.query(
                'INSERT INTO usuario (username, password_hash, id_rol, email) VALUES ($1, $2, 3, $3) RETURNING id_usuario',
                [username, passHash, email]
            );

            usuarioFinalId = newUser.rows[0].id_usuario;
        } else if (usuarioFinalId) {
            const linkCheck = await client.query('SELECT id_profesor FROM profesor WHERE id_usuario = $1', [usuarioFinalId]);
            if (linkCheck.rows.length > 0) {
                throw new Error('La cuenta de usuario seleccionada ya está vinculada a otro profesor.');
            }
        }

        const newProfesor = await client.query(
            `INSERT INTO profesor (id_usuario, nombre, apellido, ci, profesion, genero) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [usuarioFinalId, nombre, apellido, ci, profesion, genero]
        );

        await client.query('COMMIT');
        res.status(201).json({
            message: 'Profesor registrado correctamente.',
            profesor: newProfesor.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: error.message });
    } finally {
        client.release();
    }
};

const updateProfesor = async (req, res) => {
    const { id } = req.params;
    const { nombre, apellido, ci, profesion, genero } = req.body;

    if (!nombre || !apellido || !ci || !genero) {
        return res.status(400).json({ message: 'Nombre, apellido, CI y género son obligatorios.' });
    }

    try {
        const ciCheck = await pool.query(
            'SELECT id_profesor FROM profesor WHERE ci = $1 AND id_profesor != $2',
            [ci, id]
        );
        if (ciCheck.rows.length > 0) {
            return res.status(409).json({ message: 'El CI ya está registrado para otro profesor.' });
        }

        const updated = await pool.query(
            `UPDATE profesor SET nombre = $1, apellido = $2, ci = $3, profesion = $4, genero = $5
             WHERE id_profesor = $6
             RETURNING *`,
            [nombre, apellido, ci, profesion, genero, id]
        );

        if (updated.rows.length === 0) {
            return res.status(404).json({ message: 'Profesor no encontrado.' });
        }

        res.json({ message: 'Profesor actualizado correctamente.', profesor: updated.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar el profesor.', error: error.message });
    }
};

const linkCuentaProfesor = async (req, res) => {
    const { id } = req.params;
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
        return res.status(400).json({ message: 'Username, contraseña y correo electrónico son obligatorios.' });
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
        return res.status(400).json({ message: passwordValidation.message });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verificar que el profesor existe y no tiene cuenta
        const profCheck = await client.query(
            'SELECT id_profesor, id_usuario FROM profesor WHERE id_profesor = $1',
            [id]
        );
        if (profCheck.rows.length === 0) {
            throw new Error('Profesor no encontrado.');
        }
        if (profCheck.rows[0].id_usuario) {
            throw new Error('Este profesor ya tiene una cuenta de usuario vinculada.');
        }

        // Verificar que username y email no estén en uso
        const userCheck = await client.query(
            'SELECT id_usuario FROM usuario WHERE username = $1 OR email = $2',
            [username, email]
        );
        if (userCheck.rows.length > 0) {
            throw new Error('El nombre de usuario o correo electrónico ya está en uso.');
        }

        // Crear usuario con rol Docente (id_rol = 3)
        const salt = await bcrypt.genSalt(10);
        const passHash = await bcrypt.hash(password, salt);
        const newUser = await client.query(
            'INSERT INTO usuario (username, password_hash, id_rol, email) VALUES ($1, $2, 3, $3) RETURNING id_usuario',
            [username, passHash, email]
        );

        const newUserId = newUser.rows[0].id_usuario;

        // Vincular usuario al profesor
        await client.query(
            'UPDATE profesor SET id_usuario = $1 WHERE id_profesor = $2',
            [newUserId, id]
        );

        await client.query('COMMIT');
        res.status(201).json({ message: 'Cuenta creada y vinculada correctamente al profesor.' });

    } catch (error) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: error.message });
    } finally {
        client.release();
    }
};

module.exports = { getProfesores, createProfesor, updateProfesor, linkCuentaProfesor };
