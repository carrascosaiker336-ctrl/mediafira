const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const Feria = require("../src/models/Feria");
const Espacio = require("../src/models/Espacio");
const Solicitud = require("../src/models/Solicitud");
const {
    crearSolicitud,
    actualizarEstado
} = require("../src/controllers/solicitudController");

const originalFeriaFindOne = Feria.findOne;
const originalEspacioFindOne = Espacio.findOne;
const originalEspacioFindOneAndUpdate = Espacio.findOneAndUpdate;
const originalEspacioUpdateOne = Espacio.updateOne;
const originalSolicitudFindOne = Solicitud.findOne;
const originalSolicitudCreate = Solicitud.create;
const originalSolicitudFindById = Solicitud.findById;

afterEach(() => {
    Feria.findOne = originalFeriaFindOne;
    Espacio.findOne = originalEspacioFindOne;
    Espacio.findOneAndUpdate = originalEspacioFindOneAndUpdate;
    Espacio.updateOne = originalEspacioUpdateOne;
    Solicitud.findOne = originalSolicitudFindOne;
    Solicitud.create = originalSolicitudCreate;
    Solicitud.findById = originalSolicitudFindById;
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

const feriaId = "64a1a1a1a1a1a1a1a1a1a1a1";
const espacioId = "64b2b2b2b2b2b2b2b2b2b2b2";

test("feriantes can apply for an open fair and the price is deferred until approval", async () => {
    let spaceReservation;
    let createdApplication;
    Feria.findOne = async () => ({ _id: feriaId, estado: "abierta" });
    Espacio.findOne = () => ({
        select: async () => ({ _id: espacioId })
    });
    Solicitud.findOne = async () => null;
    Espacio.findOneAndUpdate = async (filter) => {
        spaceReservation = filter;
        return { _id: espacioId };
    };
    Solicitud.create = async (application) => {
        createdApplication = application;
        return { _id: { toString: () => "application-id" }, ...application };
    };
    const res = createResponse();

    await crearSolicitud({
        auth: { id: "64c3c3c3c3c3c3c3c3c3c3c3", rol: "feriante" },
        body: { feriaId, espacioId }
    }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(createdApplication.estado, "pendiente");
    assert.equal(spaceReservation.disponible, true);
    assert.match(res.body.mensaje, /podrás pagar cuando el organizador la apruebe/i);
});

test("an already reserved space cannot be requested twice", async () => {
    Feria.findOne = async () => ({ _id: feriaId, estado: "abierta" });
    Espacio.findOne = () => ({
        select: async () => ({ _id: espacioId })
    });
    Solicitud.findOne = async () => null;
    Espacio.findOneAndUpdate = async () => null;

    await assert.rejects(
        crearSolicitud({
            auth: { id: "64c3c3c3c3c3c3c3c3c3c3c3", rol: "feriante" },
            body: { feriaId, espacioId }
        }),
        (error) => error.statusCode === 409
    );
});

test("rejecting an application releases its reserved space", async () => {
    let saved = false;
    let releasedSpace;
    const solicitud = {
        _id: { toString: () => "application-id" },
        feria: { organizador: { toString: () => "organizer-id" } },
        espacio: "64b2b2b2b2b2b2b2b2b2b2b2",
        estado: "pendiente",
        async save() {
            saved = true;
        }
    };
    Solicitud.findById = () => ({
        populate: async () => solicitud
    });
    Espacio.updateOne = async (filter) => {
        releasedSpace = filter;
    };
    const res = createResponse();

    await actualizarEstado({
        auth: { id: "organizer-id", rol: "organizador" },
        pathname: "/api/solicitudes/64d4d4d4d4d4d4d4d4d4d4d4/estado",
        body: { estado: "rechazada" }
    }, res);

    assert.equal(saved, true);
    assert.equal(releasedSpace.disponible, false);
    assert.equal(res.statusCode, 200);
});

test("only the organizer can approve or reject a vendor request", async () => {
    let databaseQueried = false;
    Solicitud.findById = () => {
        databaseQueried = true;
        throw new Error("The database must not be queried for another role.");
    };
    const res = createResponse();

    await actualizarEstado({
        auth: { id: "vendor-id", rol: "feriante" },
        pathname: "/api/solicitudes/64d4d4d4d4d4d4d4d4d4d4d4/estado",
        body: { estado: "aprobada" }
    }, res);

    assert.equal(res.statusCode, 403);
    assert.equal(databaseQueried, false);
});
