const PASSWORD_POLICY = {
    minLength: 10,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialChar: true,
};

const SPECIAL_CHAR_REGEX = /[^A-Za-z0-9]/;

const validatePasswordStrength = (password) => {
    if (!password || typeof password !== 'string') {
        return {
            isValid: false,
            message: 'La contraseña es obligatoria.'
        };
    }

    if (password.length < PASSWORD_POLICY.minLength) {
        return {
            isValid: false,
            message: `La contraseña debe tener al menos ${PASSWORD_POLICY.minLength} caracteres.`
        };
    }

    if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
        return {
            isValid: false,
            message: 'La contraseña debe incluir al menos una letra mayúscula.'
        };
    }

    if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
        return {
            isValid: false,
            message: 'La contraseña debe incluir al menos una letra minúscula.'
        };
    }

    if (PASSWORD_POLICY.requireNumber && !/[0-9]/.test(password)) {
        return {
            isValid: false,
            message: 'La contraseña debe incluir al menos un número.'
        };
    }

    if (PASSWORD_POLICY.requireSpecialChar && !SPECIAL_CHAR_REGEX.test(password)) {
        return {
            isValid: false,
            message: 'La contraseña debe incluir al menos un carácter especial.'
        };
    }

    return { isValid: true };
};

module.exports = {
    PASSWORD_POLICY,
    validatePasswordStrength,
};
