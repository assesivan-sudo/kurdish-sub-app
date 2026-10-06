const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors()); 
app.use(express.json());

// فەنکشنی پرۆکسی بۆ هێنانی پەڕەی ڤیدیۆ و فایلی ژێرنووس بێ ئەوەی یوتیوب بزانێت داواکارییەکە لە Renderـەوەیە
function fetchViaProxy(targetUrl) {
    return new Promise((resolve, reject) => {
        // بەکارهێنانی codetabs وەک پرۆکسییەکی زۆر خێرا و بێ کێشە
        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`;
        https.get(proxyUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
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
        // ١. هێنانی پەڕەی یوتیوبەکە بە پرۆکسی
        const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const html = await fetchViaProxy(ytUrl);

        if (!html || !html.includes('captionTracks')) {
            return res.status(404).json({ error: 'هیچ ژێرنووسێک نەدۆزراوەتەوە. ڕەنگە ڤیدیۆکە ژێرنووسی نەبێت.' });
        }

        const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
        if (!captionMatch) {
            return res.status(404).json({ error: 'ژێرنووس بەردەست نییە.' });
        }

        const captionTracks = JSON.parse(captionMatch[1]);
        // دۆزینەوەی ئینگلیزی یان یەکەمین ژێرنووس
        const track = captionTracks.find(t => t.languageCode === 'en' || (t.name && t.name.simpleText && t.name.simpleText.toLowerCase().includes('english'))) || captionTracks[0];

        let captionUrl = track.baseUrl;
        if (!captionUrl.includes('fmt=json3')) {
            captionUrl += '&fmt=json3';
        }

        // ٢. چارەسەری سەرەکی لێرەدایە: ئێستا خودی فایلەکەش بە پرۆکسی دەهێنین
        const jsonSubtitleData = await fetchViaProxy(captionUrl);
        
        // دڵنیابوونەوە لەوەی وەڵامەکە HTML یان Captcha نییە
        if (jsonSubtitleData.trim().startsWith('<')) {
             return res.status(500).json({ error: 'یوتیوب ڕێگری لە هێنانی فایلی ژێرنووسەکە کرد.' });
        }

        const subJson = JSON.parse(jsonSubtitleData);

        if (!subJson.events) {
            return res.status(500).json({ error: 'داتای ژێرنووسەکە بەتاڵە.' });
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
