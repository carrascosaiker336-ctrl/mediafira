const Usuario = require("../models/Usuario");
const Documentacion = require("../models/Documentacion");
const { sendJson } = require("../utils/response");
const { crearTokenAcceso } = require("../middleware/authMiddleware");
const { hashPassword, verifyPassword } = require("../utils/password");

const maximoDocumentoBytes = 5 * 1024 * 1024;
const tiposDocumentoPermitidos = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png"
]);
const rolesPublicos = new Set([
    "feriante",
    "organizador",
    "ayuntamiento"
]);

// Valida que el documento de identidad se haya enviado en un formato seguro y correcto.
function leerDocumentoIdentidad(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const nombreArchivo = typeof value.nombreArchivo === "string"
        ? value.nombreArchivo.trim().replace(/[\\/\u0000-\u001f]/g, "_")
        : "";
    const tipoArchivo = typeof value.tipoArchivo === "string"
        ? value.tipoArchivo.trim().toLowerCase()
        : "";
    const contenidoBase64 = value.contenidoBase64;

    if (
        !nombreArchivo ||
        nombreArchivo.length > 180 ||
        !tiposDocumentoPermitidos.has(tipoArchivo) ||
        typeof contenidoBase64 !== "string" ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
            contenidoBase64
        )
    ) {
        return null;
    }

    const archivo = Buffer.from(contenidoBase64, "base64");

    if (
        archivo.length === 0 ||
        archivo.length > maximoDocumentoBytes ||
        archivo.toString("base64") !== contenidoBase64
    ) {
        return null;
    }

    const esPdf = tipoArchivo === "application/pdf" &&
        archivo.subarray(0, 5).toString("ascii") === "%PDF-";
    const esJpeg = tipoArchivo === "image/jpeg" &&
        archivo[0] === 0xff &&
        archivo[1] === 0xd8 &&
        archivo[2] === 0xff;
    const firmaPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const esPng = tipoArchivo === "image/png" &&
        archivo.subarray(0, firmaPng.length).equals(firmaPng);

    if (!esPdf && !esJpeg && !esPng) {
        return null;
    }

    return { nombreArchivo, tipoArchivo, archivo };
}

// Registra un nuevo usuario, validando nombre, credenciales y documentación requerida.
async function crearUsuario(req, res) {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? req.body
        : {};
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
    const email = typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";
    const password = body.password;
    const telefono = body.telefono;
    const direccionFiscal = typeof body.direccionFiscal === "string"
        ? body.direccionFiscal.trim()
        : "";
    const documentoIdentidad = leerDocumentoIdentidad(body.documentoIdentidad);
    const rol = body.rol === undefined ? "feriante" : body.rol;

    // La validación central evita registros incompletos o maliciosos.
    if (
        nombre.length < 2 ||
        nombre.length > 100 ||
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof password !== "string" ||
        password.length < 12 ||
        password.length > 128 ||
        (telefono !== undefined &&
            (typeof telefono !== "string" || telefono.length > 32)) ||
        direccionFiscal.length < 5 ||
        direccionFiscal.length > 200 ||
        !documentoIdentidad ||
        !rolesPublicos.has(rol)
    ) {
        sendJson(res, 400, {
            mensaje: "Datos no válidos. El registro requiere nombre, correo, contraseña, dirección fiscal y un DNI/NIF válido (PDF, JPG o PNG de hasta 5 MB)."
        });
        return true;
    }

    let usuario;
    try {
        usuario = await Usuario.create({
            nombre,
            email,
            password: await hashPassword(password),
            telefono: telefono ? telefono.trim() : undefined,
            rol,
            direccionFiscal,
            documentacionRequerida: true,
            activo: true
        });
    } catch (error) {
        if (error.code === 11000) {
            sendJson(res, 409, {
                mensaje: "Ya existe una cuenta con ese correo electrónico."
            });
            return true;
        }

        throw error;
    }

    try {
        await Documentacion.create({
            usuario: usuario._id,
            nombreArchivo: documentoIdentidad.nombreArchivo,
            tipoArchivo: documentoIdentidad.tipoArchivo,
            archivo: documentoIdentidad.archivo
        });

        sendJson(res, 201, {
            mensaje: "Usuario creado correctamente.",
            usuario: {
                id: usuario._id.toString(),
                nombre: usuario.nombre,
                email: usuario.email,
                telefono: usuario.telefono,
                rol: usuario.rol
            }
        });
    } catch (error) {
        await Usuario.deleteOne({ _id: usuario._id });
        throw error;
    }
    return true;
}

// Inicia sesión comprobando credenciales, documentación y estado activo de la cuenta.
async function loginUsuario(req, res) {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? req.body
        : {};
    const { email, password } = body;

    if (
        typeof email !== "string" ||
        !email.trim() ||
        typeof password !== "string" ||
        !password
    ) {
        sendJson(res, 400, {
            mensaje: "Introduce el correo electrónico y la contraseña."
        });
        return true;
    }

    const usuario = await Usuario.findOne({
        email: email.trim().toLowerCase()
    });

    if (!usuario) {
        sendJson(res, 401, {
            mensaje: "Correo electrónico o contraseña incorrectos."
        });
        return true;
    }

    if (
        usuario.documentacionRequerida &&
        !await Documentacion.exists({ usuario: usuario._id })
    ) {
        sendJson(res, 403, {
            mensaje: "No puedes iniciar sesión porque falta tu documento de identidad."
        });
        return true;
    }

    if (!(await verifyPassword(password, usuario.password))) {
        sendJson(res, 401, {
            mensaje: "Correo electrónico o contraseña incorrectos."
        });
        return true;
    }

    if (!usuario.activo) {
        sendJson(res, 403, {
            mensaje: "La cuenta está desactivada."
        });
        return true;
    }

    const token = crearTokenAcceso(usuario);

    sendJson(res, 200, {
        mensaje: "Inicio de sesión correcto.",
        token,
        usuario: {
            id: usuario._id.toString(),
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol
        }
    });
    return true;
}

module.exports = { crearUsuario, loginUsuario };