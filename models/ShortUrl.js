const mongoose = require('mongoose');

const ShortUrlSchema = new mongoose.Schema({
    longUrl: {
        type: String,
        required: true,
    },
    shortUrl: {
        type: String,
        required: true,
        unique: true,
    },
    customAlias: {
        type: String,
        unique: true,
    },
    topic: {
        type: String,
    },
    userId: { type: String, required: true },
    alias: { type: String, default: null, unique: true, index: true },

    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('ShortUrl', ShortUrlSchema);
