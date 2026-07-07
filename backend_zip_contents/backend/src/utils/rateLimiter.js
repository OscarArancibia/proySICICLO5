const store = new Map();

const isLimited = (key, maxAttempts, windowMs) => {
    const now = Date.now();
    const current = store.get(key);

    if (!current || now > current.resetAt) {
        store.set(key, { attempts: 1, resetAt: now + windowMs });
        return { limited: false, retryAfterMs: 0 };
    }

    if (current.attempts >= maxAttempts) {
        return { limited: true, retryAfterMs: current.resetAt - now };
    }

    current.attempts += 1;
    store.set(key, current);
    return { limited: false, retryAfterMs: 0 };
};

const clearLimit = (key) => {
    store.delete(key);
};

module.exports = {
    isLimited,
    clearLimit,
};
