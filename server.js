const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

app.get('/api/transcript', async (req, res) => {
    const videoId = req.query.videoId;
    if (!videoId) return res.status(400).json({ error: 'ئایدی ڤیدیۆ نەدۆزرایەوە.' });

    try {
        // بەکارهێنانی InnerTube API کە ڕاستەوخۆ دەچێتە ناو کرۆکی یوتیوب و کەمترین جار بلۆک دەکرێت
        const response = await fetch('https://www.youtube.com/youtubei/v1/player', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify({
                context: {
                    client: {
                        clientName: 'WEB',
                        clientVersion: '2.20210721.00.00'
                    }
                },
                videoId: videoId
            })
        });

        if (!response.ok) {
            throw new Error('InnerTube API وەڵامی نەدایەوە');
        }

        const data = await response.json();

        // گەڕان بەدوای لیستی ژێرنووسەکاندا لەناو داتا خاوێنەکەدا
        const captions = data.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        
        if (!captions || captions.length === 0) {
            return res.status(404).json({ error: 'هیچ ژێرنووسێک بۆ ئەم ڤیدیۆیە نەدۆزراوەتەوە، یان ڤیدیۆکە ژێرنووسی نییە.' });
        }

        // دۆزینەوەی ئینگلیزی یان یەکەم ژێرنووسی بەردەست
        const track = captions.find(c => c.languageCode === 'en' || c.name.simpleText.toLowerCase().includes('english')) || captions[0];

        let captionUrl = track.baseUrl;
        // دڵنیابوون لەوەی بە فۆرماتی JSON3 دەیگێڕێتەوە کە خوێندنەوەی ئاسانترە
        if (!captionUrl.includes('fmt=json3')) {
            captionUrl += '&fmt=json3';
        }

        // هێنانی فایلی ژێرنووسەکە خۆی
        const transcriptResponse = await fetch(captionUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const transcriptData = await transcriptResponse.json();

        if (!transcriptData.events) {
            return res.status(500).json({ error: 'داتای ژێرنووسەکە بەتاڵە.' });
        }

        // ڕێکخستنی داتاکە بۆ ئەو شێوازەی کە ئەپەکەی تۆ دەیخوێنێتەوە
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
