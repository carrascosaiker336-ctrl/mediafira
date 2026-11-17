const {
    randomBytes,
    scrypt: scryptCallback,
    timingSafeEqual
} = require("node:crypto");
const { promisify } = require("node:util");
const bcrypt = require("bcrypt");

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };
// Coste de trabajo usado por bcrypt al generar nuevos hashes.
const BCRYPT_ROUNDS = 12;

async function hashPassword(password) {
    // bcrypt genera automáticamente un salt aleatorio y lo incluye en el hash.
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password, storedPassword) {
    // Los hashes bcrypt empiezan por $2 y se validan con comparación constante.
    if (storedPassword.startsWith("$2")) {
        return bcrypt.compare(password, storedPassword);
    }

    // Mantiene la compatibilidad con contraseñas guardadas antes de bcrypt.
    if (!storedPassword.startsWith("scrypt$")) {
        return storedPassword === password;
    }

    const [, salt, storedHash] = storedPassword.split("$");

    if (
        !/^[0-9a-f]{32}$/i.test(salt || "") ||
        !/^[0-9a-f]{128}$/i.test(storedHash || "")
    ) {
        return false;
    }

    const derivedKey = await scrypt(
        password,
        salt,
        KEY_LENGTH,
        SCRYPT_OPTIONS
    );
    const expectedKey = Buffer.from(storedHash, "hex");

    return timingSafeEqual(derivedKey, expectedKey);
}

module.exports = { hashPassword, verifyPassword };