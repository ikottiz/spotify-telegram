# Spotify-Telegram

Display what you are currently listening to on Spotify directly to Telegram. 

## Guide

### 1. Install Dependencies:

- Download and extract the zip file of this repository to a location of your choice.
- Install dependencies by running the following command:
  ```bash
  npm install
  ```
  Alternatively, you can install dependencies manually:
  ```bash
  npm install express https moment
  ```

### 2. Getting Credentials:

#### Spotify:

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Create a new application.
3. In the settings of the newly created app, locate your Client ID and Client Secret and update them in "user_data.js".
4. Scroll down to find the "Edit" button and add "http://localhost:3000/callback" to the "Redirect URIs".

#### Telegram:

1. Visit [web.telegram.org](https://web.telegram.org) from your browser.
2. Create a new bot using @BotFather and obtain the API Token.
3. Update the API Token in "user_data.js".
4. Use the command "/mybots" to choose your bot, then click on "Allow Groups?" and enable it. Similarly, enable "Group Privacy" as well.
5. Create a new channel.
6. Go to Edit -> Administrators and add your bot to the channel.
7. Utilize the provided code snippet (updating token and channel ID accordingly):

    ```javascript
    const https = require('https');
    
    const channelId = '',
          token = '',
          message = 'Initial',
          photoUrl = 'https://via.placeholder.com/500x500.png?text=Blank+White+Image',
          payload = JSON.stringify({ chat_id: channelId, caption: message, photo: photoUrl });
    
    https.request(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => { 
            const responseData = JSON.parse(data);
            if (responseData.ok) console.log(`Message ID: ${responseData.result.message_id}`);
        });
    }).end(payload);
    ```

8. Use the message ID in "user_data.js" for further configuration.

### 3. Launching
1. To finally launch this project 
```javascript
node index.js
```
2.Voilà!
