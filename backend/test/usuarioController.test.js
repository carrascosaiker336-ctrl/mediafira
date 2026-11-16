const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const Usuario = require("../src/models/Usuario");
const Documentacion = require("../src/models/Documentacion");
const {
    crearUsuario,
    loginUsuario
} = require("../src/controllers/usuarioController");
const { verifyPassword } = require("../src/utils/password");

const originalCreate = Usuario.create;
const originalDeleteOne = Usuario.deleteOne;
const originalFindOne = Usuario.findOne;
const originalDocumentacionCreate = Documentacion.create;
const originalDocumentacionExists = Documentacion.exists;
const originalJwtSecret = process.env.JWT_SECRET;

afterEach(() => {
    Usuario.create = originalCreate;
    Usuario.deleteOne = originalDeleteOne;
    Usuario.findOne = originalFindOne;
    Documentacion.create = originalDocumentacionCreate;
    Documentacion.exists = originalDocumentacionExists;

    if (originalJwtSecret === undefined) {
        delete process.env.JWT_SECRET;
    } else {
        process.env.JWT_SECRET = originalJwtSecret;
    }
});

function createResponse() {
    return {
        writeHead(statusCode) {
            this.statusCode = statusCode;
        },
        end(body) {
            this.body = JSON.parse(body);
        }
    };
}

function registrationData(overrides = {}) {
    return {
        nombre: "Iker Carrascosa",
        email: "iker@example.com",
        password: "a-secure-password",
        rol: "feriante",
        direccionFiscal: "Calle Mayor 10, Madrid",
        documentoIdentidad: {
            nombreArchivo: "dni.pdf",
            tipoArchivo: "application/pdf",
            contenidoBase64: Buffer.from("%PDF-1.4 documento").toString("base64")
        },
        ...overrides
    };
}

test("public registration preserves the selected non-admin role", async () => {
    let savedUser;
    let createdUser;
    let savedDocument;
    Usuario.create = async (data) => {
        savedUser = data;
        createdUser = {
            ...data,
            _id: { toString: () => "user-id" }
        };
        return createdUser;
    };
    Documentacion.create = async (data) => {
        savedDocument = data;
    };
    const res = createResponse();

    await crearUsuario({
        body: registrationData({ email: "IKER@example.com" })
    }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(savedUser.rol, "feriante");
    assert.equal(savedUser.email, "iker@example.com");
    assert.notEqual(savedUser.password, "a-secure-password");
    assert.equal(
        await verifyPassword("a-secure-password", savedUser.password),
        true
    );
    assert.equal(savedUser.direccionFiscal, "Calle Mayor 10, Madrid");
    assert.equal(savedUser.documentacionRequerida, true);
    assert.equal(savedDocument.usuario, createdUser._id);
    assert.equal(savedDocument.nombreArchivo, "dni.pdf");
    assert.equal(savedDocument.archivo.toString(), "%PDF-1.4 documento");
    assert.equal("password" in res.body.usuario, false);
});

test("public registration accepts the roles offered by the registration page", async () => {
    const savedRoles = [];
    Usuario.create = async (data) => {
        savedRoles.push(data.rol);
        return {
            ...data,
            _id: { toString: () => `user-${data.rol}` }
        };
    };
    Documentacion.create = async () => {};

    for (const rol of ["organizador", "ayuntamiento"]) {
        const res = createResponse();
        await crearUsuario({
            body: registrationData({
                nombre: "Cuenta de prueba",
                email: `${rol}@example.com`,
                rol
            })
        }, res);

        assert.equal(res.statusCode, 201);
    }

    assert.deepEqual(savedRoles, ["organizador", "ayuntamiento"]);
});

test("public registration rejects attempts to select an admin role", async () => {
    let createCalled = false;
    Usuario.create = async () => {
        createCalled = true;
    };
    const res = createResponse();

    await crearUsuario({
        body: registrationData({ rol: "admin" })
    }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(createCalled, false);
});

test("public registration rejects missing identity documents and fiscal addresses", async () => {
    let createCalled = false;
    Usuario.create = async () => {
        createCalled = true;
    };
    const cases = [
        { documentoIdentidad: undefined },
        { direccionFiscal: " " },
        {
            documentoIdentidad: {
                nombreArchivo: "dni.txt",
                tipoArchivo: "text/plain",
                contenidoBase64: Buffer.from("no es un documento").toString("base64")
            }
        }
    ];

    for (const override of cases) {
        const res = createResponse();
        await crearUsuario({ body: registrationData(override) }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(createCalled, false);
    }
});

test("login blocks a new account whose identity document is missing", async () => {
    Usuario.findOne = async () => ({
        _id: { toString: () => "user-id" },
        email: "iker@example.com",
        password: "hashed-password",
        rol: "feriante",
        activo: true,
        documentacionRequerida: true
    });
    Documentacion.exists = async () => null;
    const res = createResponse();

    await loginUsuario({
        body: { email: "iker@example.com", password: "a-secure-password" }
    }, res);

    assert.equal(res.statusCode, 403);
    assert.match(res.body.mensaje, /falta tu documento de identidad/i);
    assert.equal("token" in res.body, false);
});
