const mongoose = require("mongoose");
const Feria = require("../models/Feria");
const Espacio = require("../models/Espacio");
const Solicitud = require("../models/Solicitud");
const roleMiddleware = require("../middleware/roleMiddleware");
const { sendJson } = require("../utils/response");

const verificarFeriante = roleMiddleware("feriante");
const verificarOrganizador = roleMiddleware("organizador");

function errorHttp(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

async function listarMisSolicitudes(req, res) {
    if (!verificarFeriante(req, res)) {
        return;
    }

    const solicitudes = await Solicitud.find({ feriante: req.auth.id })
        .populate({ path: "feria", select: "nombre fechaInicio fechaFin localidad estado" })
        .populate({ path: "espacio", select: "nombre numero precio" })
        .sort({ createdAt: -1 })
        .lean();

    sendJson(res, 200, {
        solicitudes: solicitudes.map((solicitud) => ({
            id: solicitud._id.toString(),
            estado: solicitud.estado,
            feria: solicitud.feria ? {
                id: solicitud.feria._id.toString(),
                nombre: solicitud.feria.nombre,
                fechaInicio: solicitud.feria.fechaInicio,
                fechaFin: solicitud.feria.fechaFin,
                localidad: solicitud.feria.localidad || "",
                estado: solicitud.feria.estado
            } : null,
            espacio: solicitud.espacio ? {
                id: solicitud.espacio._id.toString(),
                nombre: solicitud.espacio.nombre,
                numero: solicitud.espacio.numero,
                precio: Number(solicitud.espacio.precio)
            } : null
        }))
    });
}

async function listarSolicitudesDeFerias(req, res) {
    if (!verificarOrganizador(req, res)) {
        return;
    }

    const ferias = await Feria.find({ organizador: req.auth.id }).select("_id");
    const idsFeria = ferias.map((feria) => feria._id);
    const solicitudes = idsFeria.length
        ? await Solicitud.find({ feria: { $in: idsFeria } })
            .populate({ path: "feria", select: "nombre" })
            .populate({ path: "espacio", select: "nombre numero precio" })
            .populate({ path: "feriante", select: "nombre email" })
            .sort({ createdAt: -1 })
            .lean()
        : [];

    sendJson(res, 200, {
        solicitudes: solicitudes.map((solicitud) => ({
            id: solicitud._id.toString(),
            estado: solicitud.estado,
            observaciones: solicitud.observaciones || "",
            feria: solicitud.feria ? solicitud.feria.nombre : "Feria no disponible",
            espacio: solicitud.espacio ? solicitud.espacio.nombre : "Espacio no disponible",
            precio: solicitud.espacio ? Number(solicitud.espacio.precio) : null,
            feriante: solicitud.feriante ? {
                nombre: solicitud.feriante.nombre,
                email: solicitud.feriante.email
            } : null,
            creada: solicitud.createdAt
        }))
    });
}

async function crearSolicitud(req, res) {
    if (!verificarFeriante(req, res)) {
        return;
    }

    const body = req.body && typeof req.body === "object" &&
        !Array.isArray(req.body) ? req.body : {};
    const { feriaId, espacioId } = body;

    if (
        !mongoose.Types.ObjectId.isValid(feriaId) ||
        !mongoose.Types.ObjectId.isValid(espacioId)
    ) {
        throw errorHttp("Selecciona una feria y un espacio válidos.", 400);
    }

    const feria = await Feria.findOne({ _id: feriaId, estado: "abierta" });
    const espacioExistente = await Espacio.findOne({
        _id: espacioId,
        feria: feriaId
    }).select("_id");

    if (!feria || !espacioExistente) {
        throw errorHttp("La feria o el espacio ya no están disponibles.", 409);
    }

    const existente = await Solicitud.findOne({
        feriante: req.auth.id,
        feria: feria._id
    });

    if (existente) {
        throw errorHttp("Ya tienes una solicitud para esta feria.", 409);
    }

    const espacio = await Espacio.findOneAndUpdate(
        {
            _id: espacioId,
            feria: feriaId,
            disponible: true
        },
        { $set: { disponible: false } },
        { new: true }
    );

    if (!espacio) {
        throw errorHttp("Ese espacio ya ha sido solicitado por otro feriante.", 409);
    }

    let solicitud;
    try {
        solicitud = await Solicitud.create({
            feriante: req.auth.id,
            feria: feria._id,
            espacio: espacio._id,
            estado: "pendiente"
        });
    } catch (error) {
        await Espacio.updateOne(
            { _id: espacio._id, disponible: false },
            { $set: { disponible: true } }
        );
        throw error;
    }

    sendJson(res, 201, {
        mensaje: "Solicitud enviada. Podrás pagar cuando el organizador la apruebe.",
        solicitud: { id: solicitud._id.toString(), estado: solicitud.estado }
    });
}

async function actualizarEstado(req, res) {
    if (!verificarOrganizador(req, res)) {
        return;
    }

    const match = req.pathname.match(/^\/api\/solicitudes\/([a-f\d]{24})\/estado$/i);
    const estado = req.body && req.body.estado;

    if (!match || !["aprobada", "rechazada"].includes(estado)) {
        throw errorHttp("La decisión de solicitud no es válida.", 400);
    }

    const solicitud = await Solicitud.findById(match[1])
        .populate({ path: "feria", select: "organizador" });

    if (
        !solicitud ||
        !solicitud.feria ||
        solicitud.feria.organizador.toString() !== req.auth.id
    ) {
        throw errorHttp("No se encontró la solicitud en tus ferias.", 404);
    }

    if (solicitud.estado !== "pendiente") {
        throw errorHttp("Esta solicitud ya fue revisada.", 409);
    }

    solicitud.estado = estado;
    await solicitud.save();
    if (estado === "rechazada") {
        await Espacio.updateOne(
            { _id: solicitud.espacio, disponible: false },
            { $set: { disponible: true } }
        );
    }
    sendJson(res, 200, {
        mensaje: estado === "aprobada"
            ? "Solicitud aprobada; el feriante ya puede pagar."
            : "Solicitud rechazada.",
        solicitud: { id: solicitud._id.toString(), estado: solicitud.estado }
    });
}

module.exports = {
    listarMisSolicitudes,
    listarSolicitudesDeFerias,
    crearSolicitud,
    actualizarEstado
};