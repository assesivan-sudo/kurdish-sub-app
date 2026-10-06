const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

// فەنکشنێک بۆ هێنانی ژێرنووسەکان بە ناسنامەی مۆبایل و ئیمبێد بۆ تێپەڕاندنی بلۆکی یوتیوب
async function getYoutubeCaptions(videoId) {
    try {
        // هەوڵی یەکەم: خۆناساندن وەک ئەپڵیکەیشنی Android (کە بلۆک ناکرێت)
        const response = await fetch('https://www.youtube.com/youtubei/v1/player', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                context: {
                    client: {
                        clientName: 'ANDROID',
                        clientVersion: '17.31.35',
                        androidSdkVersion: 30,
                        hl: 'en',
                        gl: 'US'
                    }
                },
                videoId: videoId
            })
        });

        const data = await response.json();
        let captions = data.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        
        // هەوڵی دووەم: ئەگەر ئەندرۆید وەڵامی نەداوە، خۆمان وەک WEB_EMBED (ڤیدیۆی ناو ماڵپەڕەکان) دەناسێنین
        if (!captions || captions.length === 0) {
            const resWeb = await fetch('https://www.youtube.com/youtubei/v1/player', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    context: {
                        client: {
                            clientName: 'WEB_EMBED',
                            clientVersion: '1.20231102.01.00'
                        }
                    },
                    videoId: videoId
                })
            });
            const dataWeb = await resWeb.json();
            captions = dataWeb.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        }

        return captions;
    } catch (e) {
        console.error("Error fetching InnerTube:", e);
        return null;
    }
}

app.get('/api/transcript', async (req, res) => {
    const videoId = req.query.videoId;
    if (!videoId) return res.status(400).json({ error: 'ئایدی ڤیدیۆ نەدۆزرایەوە.' });

    try {
        const captions = await getYoutubeCaptions(videoId);
        
        if (!captions || captions.length === 0) {
            return res.status(404).json({ error: 'هیچ ژێرنووسێک بۆ ئەم ڤیدیۆیە نەدۆزراوەتەوە، یان ڤیدیۆکە ژێرنووسی نییە.' });
        }

        // دۆزینەوەی ژێرنووسی ئینگلیزی یان یەکەم ژێرنووس
        const track = captions.find(c => c.languageCode === 'en' || c.name.simpleText.toLowerCase().includes('english')) || captions[0];

        let captionUrl = track.baseUrl;
        if (!captionUrl.includes('fmt=json3')) {
            captionUrl += '&fmt=json3';
        }

        const transcriptResponse = await fetch(captionUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const transcriptData = await transcriptResponse.json();

        if (!transcriptData.events) {
            return res.status(500).json({ error: 'داتای ژێرنووسەکە بەتاڵە.' });
        }

        const subtitles = transcriptData.events
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
        res.status(500).json({ error: 'نەتوانرا ژێرنووسەکە بهێنرێت، سێرڤەری یوتیوب ڕێگری کرد.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`سێرڤەرەکە بە سەرکەوتوویی کار دەکات لەسەر پۆرت: ${PORT}`);
});
module.exports = app;
