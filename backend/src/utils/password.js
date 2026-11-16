const {
    randomBytes,
    scrypt: scryptCallback,
    timingSafeEqual
} = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

async function hashPassword(password) {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = await scrypt(
        password,
        salt,
        KEY_LENGTH,
        SCRYPT_OPTIONS
    );

    return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, storedPassword) {
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
