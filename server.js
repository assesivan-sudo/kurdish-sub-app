const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

// فەنکشنێکی زۆر بەهێز بۆ بەکارهێنانی ٣ پرۆکسیی جیاواز بۆ شاردنەوەی ئایپی Render
async function fetchWithProxy(targetUrl) {
    const proxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
    ];

    for (let proxy of proxies) {
        try {
            const response = await fetch(proxy, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                redirect: 'follow'
            });
            
            if (response.ok) {
                const text = await response.text();
                // دڵنیابوونەوە لەوەی کە پەڕەی Captcha نییە
                if (!text.toLowerCase().includes('google.com/recaptcha') && !text.includes('Our systems have detected')) {
                    return text; // ئەگەر داتاکە خاوێن بوو، بیگەڕێنەوە
                }
            }
        } catch (e) {
            console.log(`پرۆکسی ${proxy} شکستی هێنا، تاقیکردنەوەی پرۆکسی داهاتوو...`);
        }
    }
    throw new Error('هەموو پرۆکسییەکان شکستیان هێنا یان بلۆک کران.');
}

app.get('/api/transcript', async (req, res) => {
    const videoId = req.query.videoId;
    if (!videoId) return res.status(400).json({ error: 'ئایدی ڤیدیۆ نەدۆزرایەوە.' });

    try {
        // ١. هێنانی پەڕەی سەرەکیی یوتیوب بە شێوەیەکی شاراوە
        const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const html = await fetchWithProxy(ytUrl);

        const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
        if (!captionMatch) {
            return res.status(404).json({ error: 'هیچ ژێرنووسێک نەدۆزراوەتەوە یان ڤیدیۆکە ژێرنووسی نییە.' });
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

        // ٢. هێنانی فایلی ژێرنووسەکە (JSON) بە هەمان شێوەی شاراوە
        const jsonSubtitleData = await fetchWithProxy(captionUrl);
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
        res.status(500).json({ error: 'نەتوانرا ژێرنووسەکە بهێنرێت. سێرڤەر ڕێگری لێکرا.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`سێرڤەرەکە بە سەرکەوتوویی کار دەکات لەسەر پۆرت: ${PORT}`);
});
