const path = require("node:path");
const { randomBytes } = require("node:crypto");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Usuario = require("../src/models/Usuario");
const Feria = require("../src/models/Feria");
const Espacio = require("../src/models/Espacio");
const Solicitud = require("../src/models/Solicitud");
const { hashPassword } = require("../src/utils/password");

const backendEnvPath = path.join(__dirname, "..", ".env");
const confirmed = process.argv.includes("--confirm-test-db");
const users = [
    { rol: "organizador", numero: 1, nombre: "Organizador Demo 1" },
    { rol: "organizador", numero: 2, nombre: "Organizador Demo 2" },
    { rol: "ayuntamiento", numero: 1, nombre: "Ayuntamiento Demo 1" },
    { rol: "ayuntamiento", numero: 2, nombre: "Ayuntamiento Demo 2" },
    { rol: "feriante", numero: 1, nombre: "Feriante Demo 1" },
    { rol: "feriante", numero: 2, nombre: "Feriante Demo 2" }
].map((user) => ({
    ...user,
    email: `demo.${user.rol}.${user.numero}@example.com`
}));

function cargarConfiguracion() {
    if (!confirmed) {
        throw new Error("Confirma el uso de la base de pruebas con --confirm-test-db.");
    }

    const result = dotenv.config({
        path: backendEnvPath,
        override: true,
        quiet: true
    });
    if (result.error) {
        throw new Error("No se pudo leer backend/.env.");
    }
    if (!process.env.MONGODB_URI) {
        throw new Error("Falta MONGODB_URI en backend/.env.");
    }
}

function fechaEnDias(dias) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + dias);
    date.setUTCHours(0, 0, 0, 0);
    return date;
}

async function seedDemo() {
    cargarConfiguracion();
    await mongoose.connect(process.env.MONGODB_URI);

    const databaseName = mongoose.connection.name;
    if (!/(^|[-_])(test|demo)([-_]|$)/i.test(databaseName)) {
        throw new Error(
            "La carga demo se detuvo: el nombre de la base no indica un entorno test/demo."
        );
    }

    const existing = await Usuario.find({
        email: { $in: users.map((user) => user.email) }
    }).select("email esDemo").lean();
    if (existing.length) {
        const allDemo = existing.length === users.length &&
            existing.every((user) => user.esDemo);
        if (allDemo) {
            console.log("Las seis cuentas de demostración ya existen; no se modificó ningún dato.");
            return;
        }
        throw new Error(
            "Hay cuentas que coinciden con los correos demo; no se modificó ningún dato."
        );
    }

    const session = await mongoose.startSession();
    const credentials = [];
    try {
        await session.withTransaction(async () => {
            credentials.length = 0;
            const createdUsers = [];
            for (const user of users) {
                const password = randomBytes(18).toString("base64url");
                const [created] = await Usuario.create([{
                    nombre: user.nombre,
                    email: user.email,
                    password: await hashPassword(password),
                    rol: user.rol,
                    activo: true,
                    documentacionRequerida: false,
                    esDemo: true
                }], { session });
                createdUsers.push({ ...user, id: created._id });
                credentials.push({ ...user, password });
            }

            const organizers = createdUsers.filter((user) => user.rol === "organizador");
            const councils = createdUsers.filter((user) => user.rol === "ayuntamiento");
            const vendors = createdUsers.filter((user) => user.rol === "feriante");
            const fairs = [
                {
                    name: "Feria de Artesanía de Primavera",
                    organizer: organizers[0],
                    council: councils[0],
                    locality: "Madrid",
                    province: "Madrid",
                    start: 190,
                    end: 192,
                    prices: [35, 55]
                },
                {
                    name: "Mercado de Productores Locales",
                    organizer: organizers[0],
                    council: councils[0],
                    locality: "Alcalá de Henares",
                    province: "Madrid",
                    start: 230,
                    end: 232,
                    prices: [30, 45]
                },
                {
                    name: "Feria de Comercio y Tradición",
                    organizer: organizers[1],
                    council: councils[1],
                    locality: "Zaragoza",
                    province: "Zaragoza",
                    start: 270,
                    end: 272,
                    prices: [40, 60]
                },
                {
                    name: "Encuentro de Alimentación Artesana",
                    organizer: organizers[1],
                    council: councils[1],
                    locality: "Huesca",
                    province: "Huesca",
                    start: 310,
                    end: 312,
                    prices: [32, 48]
                }
            ];
            const createdFairs = [];

            for (const [index, fair] of fairs.entries()) {
                const [createdFair] = await Feria.create([{
                    nombre: fair.name,
                    descripcion: "Feria de demostración de MediaFeria.",
                    fechaInicio: fechaEnDias(fair.start),
                    fechaFin: fechaEnDias(fair.end),
                    localidad: fair.locality,
                    provincia: fair.province,
                    estado: "abierta",
                    organizador: fair.organizer.id,
                    ayuntamiento: fair.council.id
                }], { session });
                const createdSpaces = await Espacio.create(
                    fair.prices.map((price, spaceIndex) => ({
                        nombre: spaceIndex === 0 ? "Puesto estándar" : "Puesto amplio",
                        numero: spaceIndex + 1,
                        metrosCuadrados: spaceIndex === 0 ? 9 : 16,
                        precio: price,
                        disponible: true,
                        feria: createdFair._id
                    })),
                    { session, ordered: true }
                );
                createdFairs.push({
                    fair: createdFair,
                    space: createdSpaces[0],
                    index
                });
            }

            const requests = [
                { vendor: vendors[0], fair: createdFairs[0], estado: "aprobada" },
                { vendor: vendors[0], fair: createdFairs[1], estado: "pendiente" },
                { vendor: vendors[1], fair: createdFairs[2], estado: "aprobada" },
                { vendor: vendors[1], fair: createdFairs[3], estado: "pendiente" }
            ];
            const createdRequests = await Solicitud.create(requests.map((request) => ({
                feriante: request.vendor.id,
                feria: request.fair.fair._id,
                espacio: request.fair.space._id,
                estado: request.estado
            })), { session, ordered: true });
            await Espacio.updateMany(
                { _id: { $in: createdRequests.map((request) => request.espacio) } },
                { $set: { disponible: false } },
                { session }
            );
        });
    } finally {
        await session.endSession();
    }

    console.log("Creadas seis cuentas demo, cuatro ferias con espacios y cuatro solicitudes.");
    console.log("Credenciales generadas (guárdalas ahora):");
    for (const user of credentials) {
        console.log(`${user.rol} ${user.numero} | ${user.email} | ${user.password}`);
    }
}

seedDemo()
    .catch((error) => {
        console.error("No se pudo cargar la demo:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
