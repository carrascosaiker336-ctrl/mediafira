const assert = require("node:assert/strict");
const { test } = require("node:test");
const { hashPassword, verifyPassword } = require("../src/utils/password");

test("password hashes verify securely and reject a different password", async () => {
    const password = "a-secure-password";
    const hash = await hashPassword(password);

    assert.notEqual(hash, password);
    assert.equal(await verifyPassword(password, hash), true);
    assert.equal(await verifyPassword("another-password", hash), false);
});

test("legacy plaintext passwords remain verifiable", async () => {
    assert.equal(await verifyPassword("legacy-password", "legacy-password"), true);
});
