const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
    shortUrlAlias: {
        type: String,
        required: true,
        ref: 'ShortUrl'  // Reference to the ShortUrl schema
    },
    totalClicks: {
        type: Number,
        default: 0
    },
    uniqueClicks: {
        type: [String],  // Array of unique IPs or identifiers
        default: []
    },
    clicksByDate: [
        {
            date: {
                type: Date,
                required: true
            },
            clickCount: {
                type: Number,
                required: true
            }
        }
    ],
    osType: [
        {
            osName: {
                type: String,
                required: true
            },
            uniqueClicks: {
                type: Number,
                default: 0
            },
            uniqueUsers: {
                type: Number,
                default: 0
            }
        }
    ],
    deviceType: [
        {
            deviceName: {
                type: String,
                required: true
            },
            uniqueClicks: {
                type: Number,
                default: 0
            },
            uniqueUsers: {
                type: Number,
                default: 0
            }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('Analytics', analyticsSchema);
