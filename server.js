const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors()); 
app.use(express.json());

// فەنکشنێک بۆ خوێندنەوەی JSON لە سێرڤەرەکانەوە
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

// فەنکشنێک بۆ خوێندنەوەی دەقی ژێرنووسەکە
function fetchText(url) {
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

    // بەکارهێنانی ٣ سێرڤەری جیاواز بۆ دڵنیابوون لەوەی هەمیشە کار دەکات
    const instances = [
        'https://api.piped.projectsegfau.lt/streams/',
        'https://pipedapi.smnz.de/streams/',
        'https://pipedapi.kavin.rocks/streams/'
    ];

    let videoData = null;

    // تاقیکردنەوەی سێرڤەرەکان یەک لە دوای یەک تا یەکێکیان سەرکەوتوو دەبێت
    for (let url of instances) {
        try {
            const data = await fetchJson(`${url}${videoId}`);
            if (data && data.subtitles && data.subtitles.length > 0) {
                videoData = data;
                break; // ئەگەر دۆزرایەوە، واز لە سێرڤەرەکانی تر بهێنە
            }
        } catch (err) {
            console.log(`سێرڤەری ${url} وەڵامی نەدایەوە، تاقیکردنەوەی سێرڤەری داهاتوو...`);
        }
    }

    if (!videoData) {
        return res.status(404).json({ error: 'هیچ ژێرنووسێک نەدۆزراوەتەوە. ڕەنگە ڤیدیۆکە ژێرنووسی نەبێت.' });
    }

    try {
        // دۆزینەوەی ئینگلیزی یان هەر ژێرنووسێکی تر کە هەبێت
        let caption = videoData.subtitles.find(c => c.code === 'en' || c.language.toLowerCase().includes('english')) || videoData.subtitles[0];
        
        let subText = await fetchText(caption.url);
        const subtitles = parseVttToTranscript(subText);
        
        res.json(subtitles);
    } catch (error) {
        console.error("هەڵە لە وەرگێڕانی فایلی ژێرنووس:", error.message);
        res.status(500).json({ error: 'هەڵە لە هێنانی ناوەرۆکی ژێرنووسەکەدا ڕوویدا.' });
    }
});

// گۆڕینی فۆرماتی VTT بۆ ئەو شێوازەی کە ئەپەکەی تۆ دەیخوێنێتەوە
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
