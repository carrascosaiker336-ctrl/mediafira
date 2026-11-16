const mongoose = require("mongoose");
const Feria = require("../models/Feria");
const Espacio = require("../models/Espacio");
const Usuario = require("../models/Usuario");
const roleMiddleware = require("../middleware/roleMiddleware");
const { sendJson } = require("../utils/response");

const verificarOrganizador = roleMiddleware("organizador");
const verificarAyuntamiento = roleMiddleware("ayuntamiento");
const verificarFeria = roleMiddleware("organizador", "ayuntamiento", "feriante", "admin");

function errorHttp(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function texto(value, min, max) {
    return typeof value === "string" && value.trim().length >= min &&
        value.trim().length <= max;
}

async function listarAyuntamientos(req, res) {
    if (!verificarOrganizador(req, res)) {
        return;
    }

    const ayuntamientos = await Usuario.find({
        rol: "ayuntamiento",
        activo: true
    })
        .select("nombre entidad")
        .sort({ nombre: 1 })
        .lean();

    sendJson(res, 200, {
        ayuntamientos: ayuntamientos.map(({ _id, nombre, entidad }) => ({
            id: _id.toString(),
            nombre,
            entidad: entidad || ""
        }))
    });
}

async function listarFerias(req, res) {
    if (!verificarFeria(req, res)) {
        return;
    }

    const filtro = req.auth.rol === "organizador"
        ? { organizador: req.auth.id }
        : req.auth.rol === "ayuntamiento"
            ? { ayuntamiento: req.auth.id }
            : req.auth.rol === "feriante"
                ? { estado: "abierta", fechaFin: { $gte: new Date() } }
                : {};
    const ferias = await Feria.find(filtro)
        .populate({ path: "ayuntamiento", select: "nombre entidad" })
        .populate({ path: "organizador", select: "nombre" })
        .sort({ fechaInicio: 1 })
        .lean();
    const ids = ferias.map((feria) => feria._id);
    const espacios = ids.length
        ? await Espacio.find({ feria: { $in: ids } })
            .select("nombre numero metrosCuadrados precio disponible feria")
            .sort({ numero: 1 })
            .lean()
        : [];
    const espaciosPorFeria = new Map();

    for (const espacio of espacios) {
        const feriaId = espacio.feria.toString();
        const lista = espaciosPorFeria.get(feriaId) || [];
        lista.push({
            id: espacio._id.toString(),
            nombre: espacio.nombre,
            numero: espacio.numero,
            metrosCuadrados: espacio.metrosCuadrados,
            precio: Number(espacio.precio),
            disponible: espacio.disponible
        });
        espaciosPorFeria.set(feriaId, lista);
    }

    sendJson(res, 200, {
        ferias: ferias.map((feria) => ({
            id: feria._id.toString(),
            nombre: feria.nombre,
            descripcion: feria.descripcion || "",
            fechaInicio: feria.fechaInicio,
            fechaFin: feria.fechaFin,
            localidad: feria.localidad || "",
            provincia: feria.provincia || "",
            estado: feria.estado,
            organizador: feria.organizador
                ? feria.organizador.nombre
                : "",
            ayuntamiento: feria.ayuntamiento
                ? feria.ayuntamiento.entidad || feria.ayuntamiento.nombre
                : "",
            espacios: espaciosPorFeria.get(feria._id.toString()) || []
        }))
    });
}

async function crearFeria(req, res) {
    if (!verificarOrganizador(req, res)) {
        return;
    }

    const body = req.body && typeof req.body === "object" &&
        !Array.isArray(req.body) ? req.body : {};
    const fechaInicio = new Date(body.fechaInicio);
    const fechaFin = new Date(body.fechaFin);
    const precio = Number(body.precio);
    const metrosCuadrados = Number(body.metrosCuadrados);
    const ayuntamientoId = body.ayuntamientoId;
    const nombreEspacio = typeof body.nombreEspacio === "string"
        ? body.nombreEspacio.trim()
        : "";

    if (
        !texto(body.nombre, 3, 120) ||
        (body.descripcion !== undefined && !texto(body.descripcion, 0, 2000)) ||
        !texto(body.localidad, 2, 100) ||
        (body.provincia !== undefined && !texto(body.provincia, 0, 100)) ||
        !Number.isFinite(fechaInicio.getTime()) ||
        !Number.isFinite(fechaFin.getTime()) ||
        fechaInicio <= new Date() ||
        fechaFin <= fechaInicio ||
        !mongoose.Types.ObjectId.isValid(ayuntamientoId) ||
        !texto(nombreEspacio, 2, 100) ||
        !Number.isFinite(precio) ||
        precio < 0.5 ||
        precio > 100000 ||
        !Number.isFinite(metrosCuadrados) ||
        metrosCuadrados <= 0 ||
        metrosCuadrados > 10000
    ) {
        throw errorHttp("Completa los datos de la feria y del espacio con valores válidos.", 400);
    }

    const ayuntamiento = await Usuario.findOne({
        _id: ayuntamientoId,
        rol: "ayuntamiento",
        activo: true
    }).select("_id");

    if (!ayuntamiento) {
        throw errorHttp("Selecciona un ayuntamiento activo.", 400);
    }

    const feria = new Feria({
        nombre: body.nombre.trim(),
        descripcion: body.descripcion ? body.descripcion.trim() : "",
        fechaInicio,
        fechaFin,
        localidad: body.localidad.trim(),
        provincia: body.provincia ? body.provincia.trim() : "",
        estado: "pendiente_aprobacion",
        organizador: req.auth.id,
        ayuntamiento: ayuntamiento._id
    });

    await feria.save();

    try {
        await new Espacio({
            nombre: nombreEspacio,
            numero: 1,
            metrosCuadrados,
            precio: Math.round(precio * 100) / 100,
            disponible: true,
            feria: feria._id
        }).save();
    } catch (error) {
        await Feria.deleteOne({ _id: feria._id });
        throw error;
    }

    sendJson(res, 201, {
        mensaje: "Feria enviada al ayuntamiento para su aprobación.",
        feria: { id: feria._id.toString(), estado: feria.estado }
    });
}

async function actualizarAprobacion(req, res) {
    if (!verificarAyuntamiento(req, res)) {
        return;
    }

    const match = req.pathname.match(/^\/api\/ferias\/([a-f\d]{24})\/aprobacion$/i);
    const estado = req.body && req.body.estado;

    if (!match || !["abierta", "rechazada"].includes(estado)) {
        throw errorHttp("La acción de aprobación no es válida.", 400);
    }

    const feria = await Feria.findOne({
        _id: match[1],
        ayuntamiento: req.auth.id,
        estado: "pendiente_aprobacion"
    });

    if (!feria) {
        throw errorHttp("No se encontró una feria pendiente de tu ayuntamiento.", 404);
    }

    feria.estado = estado;
    await feria.save();
    sendJson(res, 200, {
        mensaje: estado === "abierta"
            ? "Feria aprobada y publicada."
            : "Feria rechazada.",
        feria: { id: feria._id.toString(), estado: feria.estado }
    });
}

module.exports = {
    listarAyuntamientos,
    listarFerias,
    crearFeria,
    actualizarAprobacion
};