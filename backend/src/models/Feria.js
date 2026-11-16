const mongoose = require("mongoose");

const feriaSchema = new mongoose.Schema(
{
    nombre: {
        type: String,
        required: true
    },

    descripcion: {
        type: String
    },

    fechaInicio: {
        type: Date,
        required: true
    },

    fechaFin: {
        type: Date,
        required: true
    },

    localidad: {
        type: String
    },

    provincia: {
        type: String
    },

    estado: {
        type: String,
        enum: [
            "borrador",
            "pendiente_aprobacion",
            "abierta",
            "cerrada",
            "rechazada",
            "finalizada"
        ],
        default: "borrador"
    },

    organizador: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario"
    },

    ayuntamiento: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        required: true
    }
},
{
    timestamps: true
}
);

module.exports = mongoose.model(
    "Feria",
    feriaSchema,
    "Ferias"
);