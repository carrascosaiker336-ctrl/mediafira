const mongoose = require("mongoose");

const documentacionSchema = new mongoose.Schema(
{
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        required: true
    },

    solicitud: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Solicitud"
    },

    nombreArchivo: {
        type: String,
        required: true
    },

    archivo: {
        type: Buffer,
        required: true,
        select: false
    },

    urlArchivo: {
        type: String,
    },

    tipoArchivo: {
        type: String
    }
},
{
    timestamps: true
}
);

module.exports = mongoose.model(
    "Documentacion",
    documentacionSchema,
    "Documentacion"
);