const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors()); 
app.use(express.json());

// فەنکشنێکی یارمەتیدەر بۆ هێنانی داتای پەیجی یوتیوب بە هێدەری تەواو
function fetchYouTubePage(videoId) {
    return new Promise((resolve, reject) => {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => { resolve(data); });
        }).on('error', (err) => { reject(err); });
    });
}

app.get('/api/transcript', async (req, res) => {
    const videoId = req.query.videoId;

    if (!videoId) {
        return res.status(400).json({ error: 'ئایدی ڤیدیۆ نەدۆزرایەوە.' });
    }

    try {
        const html = await fetchYouTubePage(videoId);
        
        // گەڕان بەدوای کلیلەکانی ژێرنووس لە ناو HTMLـی ڤیدیۆکەدا
        const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
        
        if (!captionMatch) {
            return res.status(404).json({ error: 'هیچ ژێرنووسێک بۆ ئەم ڤیدیۆیە نەدۆزراوەتەوە.' });
        }

        const captionTracks = JSON.parse(captionMatch[1]);
        if (captionTracks.length === 0) {
            return res.status(404).json({ error: 'ژێرنووس بەردەست نییە.' });
        }

        // وەرگرتنی بەستەری ژێرنووسەکە
        const transcriptUrl = captionTracks[0].baseUrl;

        https.get(transcriptUrl, (subRes) => {
            let subData = '';
            subRes.on('data', (chunk) => { subData += chunk; });
            subRes.on('end', () => {
                // گەڕاندنەوەی وەڵامەکە بە شێوەی XML یان JSON بە پێی پێویستی فرۆنتەند
                res.setHeader('Content-Type', 'application/xml');
                res.send(subData);
            });
        }).on('error', (err) => {
            res.status(500).json({ error: 'هەڵە لە هێنانی ناوەرۆکی ژێرنووس.' });
        });

    } catch (error) {
        res.status(500).json({ error: 'نەتوانرا پەیوەندی بە یوتیوبەوە بکرێت.', details: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`سێرڤەرەکە بە سەرکەوتوویی کار دەکات لەسەر پۆرت: ${PORT}`);
});
