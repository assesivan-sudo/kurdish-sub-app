const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors()); 
app.use(express.json());

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

app.get('/api/transcript', async (req, res) => {
    const videoId = req.query.videoId;
    if (!videoId) {
        return res.status(400).json({ error: 'ئایدی ڤیدیۆ نەدۆزرایەوە.' });
    }

    try {
        const invidiousApiUrl = `https://invidious.projectsegfau.lt/api/v1/videos/${videoId}`;
        const videoData = await fetchJson(invidiousApiUrl);

        if (!videoData.captions || videoData.captions.length === 0) {
            return res.status(404).json({ error: 'نەتوانرا ژێرنووس بهێنرێت. دڵنیابە ڤیدیۆکە ژێرنووسی هەیە.' });
        }

        let caption = videoData.captions.find(c => c.languageCode === 'en' || c.label.toLowerCase().includes('english')) || videoData.captions[0];
        
        let captionUrl = caption.url;
        if (captionUrl.startsWith('/')) {
            captionUrl = `https://invidious.projectsegfau.lt${captionUrl}`;
        }

        https.get(captionUrl, (subRes) => {
            let subData = '';
            subRes.on('data', chunk => subData += chunk);
            subRes.on('end', () => {
                const subtitles = parseVttToTranscript(subData);
                res.json(subtitles);
            });
        }).on('error', () => {
            res.status(500).json({ error: 'هەڵە لە هێنانی ناوەرۆکی ژێرنووس.' });
        });

    } catch (error) {
        console.error("API error:", error.message);
        res.status(500).json({ error: 'نەتوانرا ژێرنووسەکە بهێنرێت. لەوانەیە ڤیدیۆکە ژێرنووسی نەبێت.' });
    }
});

function parseVttToTranscript(data) {
    const lines = data.split('\n');
    const result = [];
    let currentSub = {};
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (line.includes('-->')) {
            const parts = line.split('-->');
            currentSub.offset = parseTimeToSeconds(parts[0].trim());
            const endTime = parseTimeToSeconds(parts[1].trim().split(' ')[0]);
            currentSub.duration = endTime - currentSub.offset;
        } else if (line && !line.includes('WEBVTT') && !/^\d+$/.test(line) && !line.includes('align:')) {
            currentSub.text = line;
            if (currentSub.offset !== undefined) {
                result.push({ ...currentSub });
                currentSub = {};
            }
        }
    }
    return result.length > 0 ? result : [{ text: data, offset: 0, duration: 5 }];
}

function parseTimeToSeconds(timeStr) {
    const parts = timeStr.split(':');
    if (parts.length === 3) {
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2].replace(',', '.'));
    } else if (parts.length === 2) {
        return parseInt(parts[0]) * 60 + parseFloat(parts[1].replace(',', '.'));
    }
    return parseFloat(timeStr);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`سێرڤەرەکە بە سەرکەوتوویی کار دەکات لەسەر پۆرت: ${PORT}`);
});
