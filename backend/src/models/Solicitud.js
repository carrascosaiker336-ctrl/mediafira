const mongoose = require("mongoose");

const solicitudSchema = new mongoose.Schema(
{
    feriante: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        required: true
    },

    feria: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Feria",
        required: true
    },

    espacio: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Espacio",
        required: true
    },

    estado: {
        type: String,
        enum: [
            "pendiente",
            "aprobada",
            "rechazada"
        ],
        default: "pendiente"
    },

    observaciones: {
        type: String
    }
},
{
    timestamps: true
}
);

module.exports = mongoose.model(
    "Solicitud",
    solicitudSchema,
    "solicitud"
);