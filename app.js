// === پەیوەندیکردن بە Supabase ===
const supabaseUrl = 'https://lkalgzqosnzjdbfdzbxk.supabase.co';
const supabaseKey = 'sb_publishable_kddecMPk0R8wSp_iLQkefg_B0j3zQn2';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const linkInput = document.getElementById('youtube-link');
const translateBtn = document.getElementById('translate-btn');
const videoContainer = document.getElementById('video-container');
const settingsPanel = document.getElementById('settings-panel');

const fontFamilyInput = document.getElementById('font-family-input');
const fontSizeInput = document.getElementById('font-size-input');
const textColorInput = document.getElementById('text-color-input');
const bgColorInput = document.getElementById('bg-color-input');
const bgOpacityInput = document.getElementById('bg-opacity-input');

let subtitles = []; 
let player; 
let activeSubOffset = -1; 

// فەنکشنی نوێ بۆ هێنانی ژێرنووس ڕاستەوخۆ لە وێبگەڕەوە بێ سێرڤەر
async function fetchSubtitlesDirectly(videoId) {
    const instances = [
        'https://pipedapi.kavin.rocks/streams/',
        'https://pipedapi.smnz.de/streams/',
        'https://api.piped.projectsegfau.lt/streams/'
    ];

    let videoData = null;

    for (let baseUrl of instances) {
        try {
            const res = await fetch(`${baseUrl}${videoId}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.subtitles && data.subtitles.length > 0) {
                    videoData = data;
                    break;
                }
            }
        } catch (e) {
            console.log(`Failed to fetch from ${baseUrl}`);
        }
    }

    if (!videoData) {
        throw new Error('هیچ ژێرنووسێک بۆ ئەم ڤیدیۆیە نەدۆزراوەتەوە، یان ڤیدیۆکە ژێرنووسی نییە.');
    }

    // دۆزینەوەی ئینگلیزی
    const track = videoData.subtitles.find(c => c.code === 'en' || (c.name && c.name.toLowerCase().includes('english'))) || videoData.subtitles[0];

    // هێنانی دەقی ژێرنووسەکە
    const subRes = await fetch(track.url);
    const subText = await subRes.text();

    // پارسکرن (گۆڕینی بۆ داتای بەکارهاتوو)
    const lines = subText.split('\n');
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
    return result;
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

translateBtn.addEventListener('click', async () => {
    const url = linkInput.value;
    if (!url) return alert("تکایە لینکێکی یوتیوب دابنێ!");

    const videoId = extractVideoID(url);
    if (!videoId) return alert("لینکەکە هەڵەیە، تکایە لینکێکی دروستی یوتیوب دابنێ.");

    videoContainer.innerHTML = `<p class="text-[#83d1c4] mt-4 text-center font-bold animate-pulse">لە هەوڵی هێنانی ژێرنووسەکانداین...</p>`;
    settingsPanel.classList.add('hidden');

    try {
        // ئێستا ڕاستەوخۆ بانگی فەنکشنەکە دەکات لەجیاتی ئەوەی بچێت بۆ باکێند
        subtitles = await fetchSubtitlesDirectly(videoId);
        
        try {
            await supabaseClient
                .from('saved_videos')
                .insert([{ video_id: videoId }]);
        } catch (err) {
            console.log("داتابەیس:", err);
        }
        
        videoContainer.innerHTML = `
            <div class="w-full max-w-md px-5 relative">
                <div class="relative w-full aspect-video rounded-2xl overflow-hidden border border-gray-800 shadow-lg bg-black">
                    <div id="yt-player" class="absolute top-0 left-0 w-full h-full"></div>
                </div>
                <div id="subtitle-display" class="absolute bottom-6 left-0 w-full text-center px-4 pointer-events-none z-10 flex justify-center">
                    <span class="kurdish-subtitle hidden" dir="rtl"></span>
                </div>
            </div>
        `;

        settingsPanel.classList.remove('hidden');
        applySubtitleStyles();
        loadYouTubePlayer(videoId);
    } catch (error) {
        videoContainer.innerHTML = `<p class="text-red-500 mt-4 text-center">${error.message}</p>`;
    }
});

function extractVideoID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

async function translateToKurdish(text) {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ckb&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const data = await res.json();
        return data[0][0][0]; 
    } catch (e) {
        return text; 
    }
}

function applySubtitleStyles() {
    const span = document.querySelector('#subtitle-display span');
    if (!span) return;
    
    const fontFamily = fontFamilyInput.value;
    const size = fontSizeInput.value;
    const textColor = textColorInput.value;
    const bgColor = bgColorInput.value;
    const opacity = bgOpacityInput.value / 100;
    
    const r = parseInt(bgColor.slice(1, 3), 16);
    const g = parseInt(bgColor.slice(3, 5), 16);
    const b = parseInt(bgColor.slice(5, 7), 16);
    
    span.style.fontFamily = fontFamily;
    span.style.fontSize = `${size}px`;
    span.style.color = textColor;
    
    if (opacity > 0) {
        span.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        span.style.padding = "4px 12px";
        span.style.borderRadius = "8px";
    } else {
        span.style.backgroundColor = "transparent";
        span.style.padding = "0";
    }
}

fontFamilyInput.addEventListener('change', applySubtitleStyles);
fontSizeInput.addEventListener('input', applySubtitleStyles);
textColorInput.addEventListener('input', applySubtitleStyles);
bgColorInput.addEventListener('input', applySubtitleStyles);
bgOpacityInput.addEventListener('input', applySubtitleStyles);

function loadYouTubePlayer(videoId) {
    if (window.YT && window.YT.Player) {
        createPlayer(videoId);
    } else {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        window.onYouTubeIframeAPIReady = () => createPlayer(videoId);
    }
}

function createPlayer(videoId) {
    player = new YT.Player('yt-player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: { 'autoplay': 1, 'controls': 1, 'rel': 0 },
        events: { 'onReady': onPlayerReady }
    });
}

function onPlayerReady(event) {
    event.target.playVideo();
    setInterval(updateSubtitle, 100);
}

async function updateSubtitle() {
    if (!player || !player.getCurrentTime) return;
    
    const currentTime = player.getCurrentTime(); 
    const displaySpan = document.querySelector('#subtitle-display span');
    if (!displaySpan) return;
    
    const currentSub = subtitles.find(sub => {
        return currentTime >= sub.offset && currentTime <= (sub.offset + sub.duration);
    });

    if (currentSub) {
        if (activeSubOffset !== currentSub.offset) {
            activeSubOffset = currentSub.offset;
            displaySpan.classList.remove('hidden');
            
            if (!currentSub.translatedText) {
                currentSub.translatedText = await translateToKurdish(currentSub.text);
            }
            
            if (activeSubOffset === currentSub.offset) {
                displaySpan.innerText = currentSub.translatedText;
            }
        }
    } else {
        activeSubOffset = -1;
        displaySpan.innerText = "";
        displaySpan.classList.add('hidden');
    }
}
