const mongoose = require("mongoose");
const Usuario = require("../models/Usuario");
const Conversacion = require("../models/Conversacion");
const Mensaje = require("../models/Mensaje");
const { sendJson } = require("../utils/response");

function errorHttp(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function leerIdConversacion(pathname) {
    const match = pathname.match(
        /^\/api\/chat\/conversaciones\/([a-f\d]{24})\/mensajes$/i
    );

    if (!match) {
        throw errorHttp("La conversación indicada no es válida.", 400);
    }

    return match[1];
}

async function listarContactos(req, res) {
    const contactos = await Usuario.find({
        _id: { $ne: req.auth.id },
        activo: true,
        rol: { $in: ["organizador", "ayuntamiento", "feriante"] }
    })
        .select("nombre rol entidad")
        .sort({ nombre: 1 })
        .limit(200)
        .lean();

    sendJson(res, 200, {
        contactos: contactos.map((contacto) => ({
            id: contacto._id.toString(),
            nombre: contacto.nombre,
            rol: contacto.rol,
            entidad: contacto.entidad || ""
        }))
    });
}

async function listarConversaciones(req, res) {
    const conversaciones = await Conversacion.find({
        participantes: req.auth.id
    })
        .populate({ path: "participantes", select: "nombre rol" })
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean();

    sendJson(res, 200, {
        conversaciones: conversaciones.map((conversacion) => {
            const otro = conversacion.participantes.find(
                (participante) => participante._id.toString() !== req.auth.id
            );
            return {
                id: conversacion._id.toString(),
                contacto: otro ? {
                    id: otro._id.toString(),
                    nombre: otro.nombre,
                    rol: otro.rol
                } : null,
                actualizada: conversacion.updatedAt
            };
        })
    });
}

async function crearConversacion(req, res) {
    const contactoId = req.body && req.body.contactoId;

    if (
        typeof contactoId !== "string" ||
        !mongoose.Types.ObjectId.isValid(contactoId) ||
        contactoId === req.auth.id
    ) {
        throw errorHttp("Selecciona un contacto válido.", 400);
    }

    const contacto = await Usuario.findOne({
        _id: contactoId,
        activo: true,
        rol: { $in: ["organizador", "ayuntamiento", "feriante"] }
    }).select("_id");

    if (!contacto) {
        throw errorHttp("No se encontró el contacto.", 404);
    }

    const participantes = [req.auth.id, contacto._id.toString()].sort();
    const pareja = participantes.join(":");
    let conversacion = await Conversacion.findOne({ pareja });

    if (!conversacion) {
        try {
            conversacion = await Conversacion.create({ participantes, pareja });
        } catch (error) {
            if (!error || error.code !== 11000) {
                throw error;
            }
            conversacion = await Conversacion.findOne({ pareja });
            if (!conversacion) {
                throw error;
            }
        }
    }

    sendJson(res, 200, {
        conversacion: { id: conversacion._id.toString() }
    });
}

async function obtenerConversacion(req, conversationId) {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        throw errorHttp("La conversación indicada no es válida.", 400);
    }

    const conversacion = await Conversacion.findOne({
        _id: conversationId,
        participantes: req.auth.id
    }).select("_id");

    if (!conversacion) {
        throw errorHttp("No se encontró la conversación.", 404);
    }

    return conversacion;
}

async function listarMensajes(req, res) {
    const conversacion = await obtenerConversacion(
        req,
        leerIdConversacion(req.pathname)
    );
    const mensajes = await Mensaje.find({ conversacion: conversacion._id })
        .populate({ path: "remitente", select: "nombre" })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

    sendJson(res, 200, {
        mensajes: mensajes.reverse().map((mensaje) => ({
            id: mensaje._id.toString(),
            remitenteId: mensaje.remitente
                ? mensaje.remitente._id.toString()
                : "",
            remitente: mensaje.remitente ? mensaje.remitente.nombre : "Usuario",
            texto: mensaje.texto,
            creado: mensaje.createdAt
        }))
    });
}

async function enviarMensaje(req, res) {
    const conversacion = await obtenerConversacion(
        req,
        leerIdConversacion(req.pathname)
    );
    const texto = req.body && typeof req.body.texto === "string"
        ? req.body.texto.trim()
        : "";

    if (!texto || texto.length > 2000) {
        throw errorHttp("El mensaje debe tener entre 1 y 2000 caracteres.", 400);
    }

    const mensaje = await Mensaje.create({
        conversacion: conversacion._id,
        remitente: req.auth.id,
        texto
    });
    await Conversacion.updateOne(
        { _id: conversacion._id },
        { $set: { updatedAt: new Date() } }
    );

    sendJson(res, 201, {
        mensaje: {
            id: mensaje._id.toString(),
            texto: mensaje.texto,
            creado: mensaje.createdAt
        }
    });
}

module.exports = {
    listarContactos,
    listarConversaciones,
    crearConversacion,
    listarMensajes,
    enviarMensaje
};
