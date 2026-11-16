const mongoose = require("mongoose");

const pagoSchema = new mongoose.Schema(
{
    solicitud: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Solicitud",
        required: true
    },

    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        required: true
    },

    importe: {
        type: Number,
        required: true
    },

    metodoPago: {
        type: String,
        enum: [
            "transferencia",
            "tarjeta",
            "bizum"
        ]
    },

    estado: {
        type: String,
        enum: [
            "pendiente",
            "pagado",
            "cancelado"
        ],
        default: "pendiente"
    },

    stripeSessionId: {
        type: String,
        default: null,
        index: true
    },

    stripePaymentIntentId: {
        type: String,
        default: null
    }
},
{
    timestamps: true
}
);

pagoSchema.index(
    { solicitud: 1, usuario: 1 },
    {
        unique: true,
        partialFilterExpression: { estado: "pendiente" }
    }
);

module.exports = mongoose.model(
    "Pago",
    pagoSchema,
    "pagos"
);