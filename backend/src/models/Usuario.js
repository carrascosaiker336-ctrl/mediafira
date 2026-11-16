const mongoose = require("mongoose");

const usuarioSchema = new mongoose.Schema(
{
    nombre: {
        type: String,
        required: true,
        trim: true
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },

    password: {
        type: String,
        required: true
    },

    telefono: {
        type: String
    },

    rol: {
        type: String,
        required: true,
        enum: [
            "admin",
            "organizador",
            "ayuntamiento",
            "feriante"
        ]
    },

    entidad: {
        type: String
    },

    cif: {
        type: String
    },

    direccionFiscal: {
        type: String,
        trim: true,
        maxlength: 200
    },

    documentacionRequerida: {
        type: Boolean,
        default: false
    },

    esDemo: {
        type: Boolean,
        default: false
    },

    activo: {
        type: Boolean,
        default: true
    }
},
{
    timestamps: true
}
);

module.exports = mongoose.model(
    "Usuario",
    usuarioSchema,
    "usuarios"
);