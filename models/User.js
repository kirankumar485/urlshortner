const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    googleId: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    name: {
        type: String,
        required: true,
    },
    profilePhoto: {
        type: String,
    },
    refreshToken: {
        type: String,
    },
});

module.exports = mongoose.model('User', UserSchema);
