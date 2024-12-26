const express = require("express");
const User = require('../models/User');
const dotenv = require('dotenv');
dotenv.config();
const axios = require('axios');

const router = express.Router();

router.get('/google', (req, res) => {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&response_type=code&scope=email profile`;
    res.redirect(authUrl);
});

router.get('/google/callback', async (req, res) => {
    const code = req.query.code;

    if(!code) {
        return res.status(400).send('Authorization code not found');
    }

    try {
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: process.env.GOOGLE_REDIRECT_URI,
            grant_type: 'authorization_code',
            code,
        });

        const { access_token, refresh_token } = tokenResponse.data;

        const userProfileResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        const { id, email, name, picture } = userProfileResponse.data;
        console.log(access_token, 'accessToken');
        console.log(refresh_token, 'refreshToken')
        let user = await User.findOne({ googleId: id });

        if(!user) {
            user = new User({
                googleId: id,
                email,
                name,
                profilePhoto: picture,
                refreshToken: refresh_token,
                access_token: access_token
            });
            await user.save();
        }

        res.json({
            message: 'Login successful',
            user: {
                id: user.googleId,
                email: user.email,
                name: user.name,
                profilePhoto: user.profilePhoto,
                access_token: access_token
            },
        });
    } catch(err) {
        console.error('Error during Google OAuth:', err);
        res.status(500).send('Authentication failed');
    }
});

module.exports = router;
