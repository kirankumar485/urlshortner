const express = require('express');
const fetch = require('node-fetch');
const app = express();
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');

const { createShortApi, redirectShortApi, analyticsTopic, analyticsTopicById, analyticsOverall } = require('../controller/apiController');

const router = express.Router();

dotenv.config();
app.use(bodyParser.json());


const createShortUrlRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many requests, please try again later.',
});


async function authenticate (req, res, next) {
    const authHeader = req.headers['authorization'];
    if(!authHeader) {
        return res.status(401).json({ message: 'Authorization header missing' });
    }

    const token = authHeader.split(' ')[1];
    console.log(token)
    if(!token) {
        return res.status(401).json({ message: 'Access token missing' });
    }

    try {
        const response = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
        if(!response.ok) {
            throw new Error('Invalid or expired token');
        }

        const tokenInfo = await response.json();

        if(tokenInfo.aud !== process.env.GOOGLE_CLIENT_ID) {
            throw new Error('Token audience mismatch');
        }

        req.user = {
            id: tokenInfo.sub,
            email: tokenInfo.email,
            name: tokenInfo.name,
        };
        console.log(req.user)
        next();
    } catch(error) {
        console.error('Token validation error:', error.message);
        res.status(401).json({ message: 'Unauthorized: ' + error.message });
    }
}


//create Shorten API
router.post('/shorten', createShortUrlRateLimiter, authenticate, createShortApi
)

// GET Shorten API Data
router.get('/shorten/:alias', redirectShortApi);

// Get analytics data
router.get('/analytics/overall', authenticate, analyticsOverall);
router.get('/analytics/:alias', authenticate, analyticsTopic);

//get analytics data for each topic
router.get('/analytics/topic/:topic', authenticate, analyticsTopicById);

//get overall analytics



module.exports = router;


