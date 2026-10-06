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
        // لێرەدا فەرمانمان پێکردووە کە سەرەتا ژێرنووسە ئینگلیزییەکە بهێنێت (en)
        const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
        res.json(transcript);
    } catch (error) {
        // ئەگەر ئینگلیزی نەبوو، با هەر ژێرنووسێک هەبوو بیهێنێت
        try {
            const fallbackTranscript = await YoutubeTranscript.fetchTranscript(videoId);
            res.json(fallbackTranscript);
        } catch (e) {
            res.status(500).json({ error: 'نەتوانرا ژێرنووسەکە بهێنرێت.' });
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`سێرڤەرەکە بە سەرکەوتوویی کار دەکات لەسەر: http://localhost:${PORT}`);
});