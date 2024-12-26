const express = require('express');
const fetch = require('node-fetch');
const useragent = require('useragent');
const crypto = require('crypto');
const app = express();
const dotenv = require('dotenv');
const axios = require('axios');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const redis = require('redis');

const Analytics = require("../models/Analytics")
const ShortUrl = require('../models/ShortUrl');

const router = express.Router();

dotenv.config();
app.use(bodyParser.json());

const redisClient = redis.createClient();
redisClient.connect().catch(console.error);
redisClient.on('connect', function () {
    console.log('Connected to Redis...');
});

const createShortUrlRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many requests, please try again later.',
});

const createShortApi = async (req, res) => {
    const { longUrl, customAlias, topic } = req.body;
    console.log(req.body)

    if(!longUrl) {
        return res.status(400).json({ message: 'longUrl is required' });
    }

    const alias = customAlias || generateAlias();

    const existingUrl = await ShortUrl.findOne({ alias });
    if(existingUrl) {
        return res.status(400).json({ message: 'Alias already in use' });
    }

    const shortUrl = `http://localhost:${process.env.PORT}/${alias}`;
    const createdAt = new Date();

    try {
        const newShortUrl = new ShortUrl({
            userId: (req.user.id),
            longUrl,
            shortUrl,
            alias,
            topic: topic || null,
            createdAt,
        });
        await newShortUrl.save();
        redisClient.setEx(`shortUrl:${alias}`, 3600, JSON.stringify(shortUrl));
        res.status(201).json({ shortUrl, createdAt });
    } catch(err) {
        console.error('Error saving short URL:', err);
        res.status(500).json({ message: 'Server error' });
    }
}

const redirectShortApi = async (req, res) => {
    console.log(req.params)
    const alias = req.params.alias;

    let shortUrlRecord;

    shortUrlRecord = await ShortUrl.findOne({ alias: alias });
    if(!shortUrlRecord) {
        return res.status(404).json({ message: 'Short URL not founds' });
    }

    const timestamp = new Date();
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip;

    let geolocation = {};
    try {
        const geolocationResponse = await axios.get(`https://ipinfo.io/${ipAddress}/json`);
        geolocation = geolocationResponse.data;
    } catch(error) {
        console.error('Error fetching geolocation data:', error);
    }

    const osName = getOSFromUserAgent(userAgent);
    const deviceName = getDeviceFromUserAgent(userAgent);

    let analyticsData = await Analytics.findOne({ shortUrlAlias: alias });

    if(!analyticsData) {
        analyticsData = new Analytics({
            shortUrlAlias: alias,
            totalClicks: 0,
            uniqueClicks: [],
            clicksByDate: [],
            osType: [],
            deviceType: []
        });
    }

    analyticsData.totalClicks += 1;

    const uniqueClicksSet = new Set(analyticsData.uniqueClicks);

    if(!uniqueClicksSet.has(ipAddress)) {
        uniqueClicksSet.add(ipAddress);
        analyticsData.uniqueClicks = Array.from(uniqueClicksSet);
    }

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 7);

    const clicksByDate = analyticsData.clicksByDate.find(item => item.date.toISOString().split('T')[0] === today.toISOString().split('T')[0]);
    if(clicksByDate) {
        clicksByDate.clickCount += 1;
    } else {
        analyticsData.clicksByDate.push({ date: today, clickCount: 1 });
    }

    const osRecord = analyticsData.osType.find(item => item.osName === osName);
    if(osRecord) {
        osRecord.uniqueClicks += 1;
        osRecord.uniqueUsers += 1;
    } else {
        analyticsData.osType.push({
            osName,
            uniqueClicks: 1,
            uniqueUsers: 1
        });
    }

    const deviceRecord = analyticsData.deviceType.find(item => item.deviceName === deviceName);
    if(deviceRecord) {
        deviceRecord.uniqueClicks += 1;
        deviceRecord.uniqueUsers += 1;
    } else {
        analyticsData.deviceType.push({
            deviceName,
            uniqueClicks: 1,
            uniqueUsers: 1
        });
    }

    await analyticsData.save();
    redisClient.setEx(`shortUrl:${alias}`, 3600, JSON.stringify(shortUrlRecord));


    res.redirect(shortUrlRecord.longUrl);
}
const analyticsTopic = async (req, res) => {
    const alias = req.params.alias;

    try {

        const analyticsData = await Analytics.findOne({ shortUrlAlias: alias });

        if(!analyticsData) {
            return res.status(404).json({ message: 'Analytics not found for the alias' });
        }

        res.json({
            totalClicks: analyticsData.totalClicks,
            uniqueClicks: analyticsData.uniqueClicks.length,
            clicksByDate: analyticsData.clicksByDate,
            osType: analyticsData.osType,
            deviceType: analyticsData.deviceType
        });
    } catch(error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

const analyticsTopicById = async (req, res) => {
    const topic = req.params.topic;

    try {
        const shortUrls = await ShortUrl.find({ topic: topic });

        if(shortUrls.length === 0) {
            return res.status(404).json({ message: 'No short URLs found for this topic' });
        }

        let totalClicks = 0;
        let uniqueClicks = 0;
        let clicksByDate = [];
        const urls = [];

        for(const url of shortUrls) {
            const analyticsData = await Analytics.findOne({ shortUrlAlias: url.alias });

            if(analyticsData) {
                totalClicks += analyticsData.totalClicks;
                uniqueClicks += analyticsData.uniqueClicks.length;

                clicksByDate = mergeClicksByDate(clicksByDate, analyticsData.clicksByDate); // Function to merge dates

                urls.push({
                    shortUrl: url.shortUrl,
                    totalClicks: analyticsData.totalClicks,
                    uniqueClicks: analyticsData.uniqueClicks.length
                });
            }
        }

        res.json({
            totalClicks,
            uniqueClicks,
            clicksByDate,
            urls
        });
    } catch(error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

const analyticsOverall = async (req, res) => {
    const userId = req.user.id;

    try {
        const shortUrls = await ShortUrl.find({ userId: userId });

        if(shortUrls.length === 0) {
            return res.status(404).json({ message: 'No short URLs found for the user' });
        }

        let totalClicks = 0;
        let uniqueClicks = 0;
        let clicksByDate = [];
        let osType = [];
        let deviceType = [];

        for(const url of shortUrls) {
            const analyticsData = await Analytics.findOne({ shortUrlAlias: url.alias });

            if(analyticsData) {
                totalClicks += analyticsData.totalClicks;
                uniqueClicks += analyticsData.uniqueClicks.length;

                clicksByDate = mergeClicksByDate(clicksByDate, analyticsData.clicksByDate);

                analyticsData.osType.forEach(os => {
                    const existingOs = osType.find(o => o.osName === os.osName);
                    if(existingOs) {
                        existingOs.uniqueClicks += os.uniqueClicks;
                        existingOs.uniqueUsers += os.uniqueUsers;
                    } else {
                        osType.push(os);
                    }
                });

                analyticsData.deviceType.forEach(device => {
                    const existingDevice = deviceType.find(d => d.deviceName === device.deviceName);
                    if(existingDevice) {
                        existingDevice.uniqueClicks += device.uniqueClicks;
                        existingDevice.uniqueUsers += device.uniqueUsers;
                    } else {
                        deviceType.push(device);
                    }
                });
            }
        }

        res.json({
            totalUrls: shortUrls.length,
            totalClicks,
            uniqueClicks,
            clicksByDate,
            osType,
            deviceType
        });
    } catch(error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

function generateAlias () {
    return crypto.randomBytes(4).toString('hex');
}


function mergeClicksByDate (existingData, newData) {
    newData.forEach(item => {
        const existing = existingData.find(d => d.date.toISOString().split('T')[0] === item.date.toISOString().split('T')[0]);
        if(existing) {
            existing.clickCount += item.clickCount;
        } else {
            existingData.push(item);
        }
    });

    return existingData;
}



function getOSFromUserAgent (userAgent) {
    const agent = useragent.parse(userAgent);
    return agent.os.family;
}

function getDeviceFromUserAgent (userAgent) {
    const agent = useragent.parse(userAgent);
    return agent.device.family;
}

module.exports = {
    createShortApi, redirectShortApi, analyticsTopic, analyticsTopicById, analyticsOverall
}