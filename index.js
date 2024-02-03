const express = require('express');
const https = require('https');
const { URLSearchParams } = require('url');
const fs = require('fs');

const app = express();
const PORT = 3000;
const moment = require('moment');

// Load user data from config file
const userData = require('./user_data.js');
// Spotify API credentials
const CLIENT_ID = userData.spotify.client_id;
const CLIENT_SECRET = userData.spotify.client_secret;
const REDIRECT_URI = userData.spotify.redirect_uri;

// Telegram Bot Token
const TELEGRAM_BOT_TOKEN = userData.telegram.bot_token;
const TELEGRAM_CHANNEL_ID = userData.telegram.channel_id;
let MESSAGE_ID = userData.telegram.message_id;
app.set('view engine', 'ejs');

// Landing page
app.get('/', (req, res) => {
    res.render('index');
});
let accessToken = null;
// Function to create a new token file if it doesn't exist
function createTokenFile() {
    const initialTokenData = {
        accessToken: null
    };
    fs.writeFile('token.json', JSON.stringify(initialTokenData), err => {
        if (err) {
            console.error('Error creating token file:', err);
        } else {
            console.log('Token file created.');
        }
    });
}
// Check if the access token is valid
async function isTokenValid() {
    if (!accessToken) return false;

    const options = {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    };

    return new Promise((resolve, reject) => {
        https.get('https://api.spotify.com/v1/me', options, response => {
            if (response.statusCode === 200) {
                resolve(true);
            } else {
                resolve(false);
            }
        }).on('error', error => {
            console.error('Error checking token validity:', error);
            reject(error);
        });
    });
}
// Load token data from file on server start
fs.readFile('token.json', 'utf8', (err, data) => {
    if (err) {
        if (err.code === 'ENOENT') {
            console.error('Error: Token file not found.');
            createTokenFile();
            console.log('Please authorize.');
        } else {
            console.error('Error reading token file:', err);
        }
        return;
    }

    try {
        const tokenData = JSON.parse(data);
        accessToken = tokenData.accessToken;
        console.log('Token loaded from file:', accessToken);
        if (accessToken) {
            // Check if token is valid
            isTokenValid()
                .then(valid => {
                    if (valid) {
                        console.log('Token is valid. Starting to fetch track information...');
                        setInterval(async () => {
                            await getTrackInfoAndSend();
                        }, 10000);
                    } else {
                        console.log('Token is invalid. Please reauthorize.');
                    }
                })
                .catch(error => {
                    console.error('Error checking token validity:', error);
                });
        } else {
            console.log('No token found. Please authorize.');
        }
    } catch (error) {
        console.error('Error parsing token data:', error);
    }
});

// Function to save token data to file
function saveTokenToFile() {
    const tokenData = {
        accessToken: accessToken
    };
    fs.writeFile('token.json', JSON.stringify(tokenData), err => {
        if (err) {
            console.error('Error saving token to file:', err);
        } else {
            console.log('Token saved to file.');
        }
    });
}
// Function to handle Spotify authorization and save access token
async function handleAuthorization(code) {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', REDIRECT_URI);
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);

    try {
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        };

        const response = await new Promise((resolve, reject) => {
            const request = https.request('https://accounts.spotify.com/api/token', options, response => {
                let data = '';
                response.on('data', chunk => {
                    data += chunk;
                });
                response.on('end', () => {
                    resolve(JSON.parse(data));
                });
            });

            request.on('error', error => {
                reject(error);
            });

            request.write(params.toString());
            request.end();
        });
        accessToken = response.access_token; // Update accessToken
        saveTokenToFile(); // Save the token data to file
        return accessToken;
    } catch (error) {
        console.error('Error during authorization:', error);
        throw new Error('Authorization failed');
    }
}
let currentTrackInfo = {}; // Store current track information
// Function to get track information and send it
async function getTrackInfoAndSend() {
    // there is no point in commenting this function
    if (!accessToken) {
        console.error('Access token is not available');
        return;
    }

    const options = {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    };

    try {
        const response = await new Promise((resolve, reject) => {
            https.get('https://api.spotify.com/v1/me/player/currently-playing', options, response => {
                let data = '';
                response.on('data', chunk => {
                    data += chunk;
                });
                response.on('end', () => {
                    if (data) {
                        resolve(JSON.parse(data));
                    } else {
                        resolve(null);
                    }
                });
            }).on('error', error => {
                resolve(null);
            });
        });

        if (!response || !response.item) {
            console.log(moment().format('MM-DD HH:mm:ss') + ' No music currently playing.');
            return;
        }

        const trackName = response.item ? response.item.name : null;
        const artistName = response.item && response.item.artists.length > 0 ? response.item.artists[0].name : null;
        const imageUrl = response.item && response.item.album.images.length > 0 ? response.item.album.images[0].url : null;
        const songLink = response.item ? response.item.external_urls.spotify : null;

        if (!trackName) {
            console.log(moment().format('MM-DD HH:mm:ss') + ' No music currently playing.');
            return;
        }
        if (
            trackName !== currentTrackInfo.trackName ||
            artistName !== currentTrackInfo.artistName
        ) {
            currentTrackInfo = {
                trackName,
                artistName
            };
            if (MESSAGE_ID) {
                const telegramCaptionURL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageCaption?chat_id=${TELEGRAM_CHANNEL_ID}&message_id=${MESSAGE_ID}&caption=<a href="${encodeURIComponent(songLink)}">${trackName} - ${artistName}</a>&parse_mode=HTML`;
                const telegramMediaURL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageMedia?chat_id=${TELEGRAM_CHANNEL_ID}&message_id=${MESSAGE_ID}&media=${encodeURIComponent(JSON.stringify({
                    type: 'photo',
                    media: imageUrl
                }))}`;
                try {
                    await Promise.all([ // i forgot why
                        new Promise((resolve, reject) => {
                            https.get(telegramMediaURL, () => {}).on('finish', () => {
                                setTimeout(resolve, 1500);
                                https.get(telegramCaptionURL, () => resolve()).on('error', error => reject(error));
                            })
                        }),
                    ]);                
                    console.log(moment().format('MM-DD HH:mm:ss') + ' Status updated successfully!');
                } catch (error) {
                    console.error(moment().format('MM-DD HH:mm:ss') + ' Error updating message:', error);
                }
            }
        } else {
            console.log(moment().format('MM-DD HH:mm:ss') + ' Current track is the same as before. Not updating message.');
        }
    } catch (error) {
        console.error(moment().format('MM-DD HH:mm:ss') + ' Error getting track information:', error);
    }
}
// todo: delete this shit
app.get('/callback', async (req, res) => {
    // We are getting spotify authorization in view like this:http://localhost:3000/callback?code=authorizationCode
    const code = req.query.code;
    // Self-explanation
    try {
        accessToken = await handleAuthorization(code);
        // Set up interval for fetching track information after authorization
        setInterval(async () => {
            if (accessToken) {
                await getTrackInfoAndSend();
            }
        }, 10000);
        res.send('Callback handled successfully!');
    } catch (error) {
        console.error('Callback handling failed:', error);
        res.status(500).send('Error handling callback');
    }
});
// Сheck token validity and start fetching track info if valid
setInterval(async () => {
    if (await isTokenValid()) {
        console.log('Token is valid. Starting to fetch track information...');
        setInterval(async () => {
            if (accessToken) {
                await getTrackInfoAndSend();
            }
        }, 10000);
    } else {
        console.log('Token is invalid. Please reauthorize.');
    }
}, 3600000);
// Server info
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
