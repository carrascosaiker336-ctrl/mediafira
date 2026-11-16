const mongoose = require("mongoose");

const espacioSchema = new mongoose.Schema(
{
    nombre: {
        type: String,
        required: true
    },

    numero: {
        type: Number,
        required: true
    },

    metrosCuadrados: {
        type: Number,
        required: true
    },

    precio: {
        type: Number,
        required: true
    },

    disponible: {
        type: Boolean,
        default: true
    },

    feria: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Feria",
        required: true
    }
},
{
    timestamps: true
}
);

module.exports = mongoose.model(
    "Espacio",
    espacioSchema,
    "espacios"
);