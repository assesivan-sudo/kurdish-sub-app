const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors()); 
app.use(express.json());

// فەنکشنێک بۆ هێنانی پەڕەی یوتیوب لە ڕێگەی پرۆکسییەوە بۆ تێپەڕاندنی بلۆکی Render
function fetchViaProxy(videoId) {
    return new Promise((resolve, reject) => {
        const ytUrl = encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`);
        const proxyUrl = `https://api.allorigins.win/get?url=${ytUrl}`;

        https.get(proxyUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.contents); // HTMLـی پەڕەکە لێرەدایە
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

app.get('/api/transcript', async (req, res) => {
    const videoId = req.query.videoId;
    if (!videoId) return res.status(400).json({ error: 'ئایدی ڤیدیۆ نەدۆزرایەوە.' });

    try {
        // هێنانی داتای ڤیدیۆکە بە شێوەیەکی شاراوە (Proxy)
        const html = await fetchViaProxy(videoId);

        if (!html) {
            return res.status(500).json({ error: 'نەتوانرا پەڕەی یوتیوب بهێنرێت.' });
        }

        const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
        if (!captionMatch) {
            return res.status(404).json({ error: 'هیچ ژێرنووسێک نەدۆزراوەتەوە. ڕەنگە ڤیدیۆکە ژێرنووسی نەبێت.' });
        }

        const captionTracks = JSON.parse(captionMatch[1]);
        if (!captionTracks || captionTracks.length === 0) {
            return res.status(404).json({ error: 'ژێرنووس بەردەست نییە.' });
        }

        // دۆزینەوەی ئینگلیزی یان یەکەمین ژێرنووس
        const track = captionTracks.find(t => t.languageCode === 'en' || (t.name && t.name.simpleText && t.name.simpleText.toLowerCase().includes('english'))) || captionTracks[0];

        let captionUrl = track.baseUrl;
        if (!captionUrl.includes('fmt=json3')) {
            captionUrl += '&fmt=json3';
        }

        const jsonSubtitleData = await fetchUrl(captionUrl);
        const subJson = JSON.parse(jsonSubtitleData);

        if (!subJson.events) {
            return res.status(500).json({ error: 'داتای ژێرنووس هەڵەیە.' });
        }

        const subtitles = subJson.events
            .filter(event => event.segs && event.segs.length > 0)
            .map(event => {
                const text = event.segs.map(seg => seg.utf8 || '').join('').trim();
                const offset = (event.tStartMs || 0) / 1000;
                const duration = (event.dDurationMs || 3000) / 1000;
                return { text, offset, duration };
            })
            .filter(sub => sub.text.length > 0 && sub.text !== '\n');

        res.json(subtitles);

    } catch (error) {
        console.error("Transcript error:", error.message);
        res.status(500).json({ error: 'نەتوانرا ژێرنووسەکە بهێنرێت.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`سێرڤەرەکە بە سەرکەوتوویی کار دەکات لەسەر پۆرت: ${PORT}`);
});
