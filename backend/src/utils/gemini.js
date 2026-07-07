// Cliente mínimo para la Google Gemini API vía REST (sin SDK adicional).
// Usa fetch global (Node 18+).

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

class GeminiError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'GeminiError';
        this.status = status;
    }
}

/**
 * Genera contenido con Gemini.
 * @param {object} opts
 *   - systemPrompt: string  (instrucción de sistema)
 *   - userPrompt: string    (consulta del usuario)
 *   - json: boolean         (forzar respuesta JSON)
 * @returns {Promise<string>} texto de la respuesta
 */
async function generarContenido({ systemPrompt, userPrompt, json = false }) {
    if (!GEMINI_API_KEY) {
        throw new GeminiError('GEMINI_API_KEY no está configurada en el servidor.', 500);
    }

    const body = {
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
            temperature: 0,
            maxOutputTokens: 2048,
            ...(json ? { responseMimeType: 'application/json' } : {}),
        },
    };
    if (systemPrompt) {
        body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    let resp;
    try {
        resp = await fetch(`${BASE_URL}/${GEMINI_MODEL}:generateContent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': GEMINI_API_KEY,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(25000),
        });
    } catch (err) {
        throw new GeminiError(`No se pudo contactar a Gemini: ${err.message}`, 503);
    }

    if (!resp.ok) {
        const detalle = await resp.text().catch(() => '');
        throw new GeminiError(`Gemini respondió ${resp.status}: ${detalle.substring(0, 300)}`, resp.status);
    }

    const data = await resp.json();
    const texto = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
    if (!texto) {
        throw new GeminiError('Gemini devolvió una respuesta vacía.', 502);
    }
    return texto.trim();
}

module.exports = { generarContenido, GeminiError };
