const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

app.get('/api/transcript', async (req, res) => {
    const videoId = req.query.videoId;
    if (!videoId) return res.status(400).json({ error: 'ئایدی ڤیدیۆ نەدۆزرایەوە.' });

    // سێرڤەرە بەهێزەکانی Piped
    const instances = [
        'https://pipedapi.kavin.rocks/streams/',
        'https://pipedapi.smnz.de/streams/',
        'https://api.piped.projectsegfau.lt/streams/'
    ];

    let videoData = null;

    // تاقیکردنەوەی سێرڤەرەکان بەکارهێنانی fetchـی مۆدێرن
    for (let url of instances) {
        try {
            const response = await fetch(`${url}${videoId}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            
            if (!response.ok) {
                console.log(`سێرڤەری ${url} هەڵەی هەبوو بە کۆدی: ${response.status}`);
                continue;
            }
            
            const data = await response.json();
            if (data && data.subtitles && data.subtitles.length > 0) {
                videoData = data;
                break; // سێرڤەرێکی گونجاو دۆزرایەوە
            }
        } catch (err) {
            console.log(`سێرڤەری ${url} پەیوەندییەکەی پچڕا.`);
        }
    }

    if (!videoData) {
        return res.status(404).json({ error: 'هیچ ژێرنووسێک نەدۆزراوەتەوە یان ڤیدیۆکە ژێرنووسی نییە.' });
    }

    try {
        // هێنانی ئینگلیزی یان هەر ژێرنووسێکی بەردەست
        let caption = videoData.subtitles.find(c => c.code === 'en' || c.language.toLowerCase().includes('english')) || videoData.subtitles[0];
        
        // خوێندنەوەی فایلەکە بە fetch
        const subRes = await fetch(caption.url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        
        const subText = await subRes.text();
        const subtitles = parseVttToTranscript(subText);
        
        res.json(subtitles);
    } catch (error) {
        console.error("هەڵە لە پارسکرن:", error.message);
        res.status(500).json({ error: 'هەڵە لە هێنانی ناوەرۆکی ژێرنووسەکەدا ڕوویدا.' });
    }
});

// گۆڕینی فۆرماتی VTT بۆ JSONـی ئەپەکەی تۆ
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
