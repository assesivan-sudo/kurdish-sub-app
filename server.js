const express = require('express');
const cors = require('cors');
const { YoutubeTranscript } = require('youtube-transcript');

const app = express();
app.use(cors()); 
app.use(express.json());

app.get('/api/transcript', async (req, res) => {
    const videoId = req.query.videoId;

    if (!videoId) {
        return res.status(400).json({ error: 'ئایدی ڤیدیۆ نەدۆزرایەوە.' });
    }

    try {
        // هێنانی ژێرنووس بە ڕێگەی زیرەک بۆ تێپەڕاندنی قەدەغەکردنی یوتیوب
        const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
            lang: 'en',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });
        res.json(transcript);
    } catch (error) {
        console.error("Error fetching transcript:", error.message);
        try {
            const fallbackTranscript = await YoutubeTranscript.fetchTranscript(videoId, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                }
            });
            res.json(fallbackTranscript);
        } catch (e) {
            console.error("Fallback error:", e.message);
            res.status(500).json({ error: 'نەتوانرا ژێرنووسەکە بهێنرێت. دڵنیابە ڤیدیۆکە ژێرنووسی هەیە.' });
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`سێرڤەرەکە بە سەرکەوتوویی کار دەکات لەسەر پۆرت: ${PORT}`);
});
