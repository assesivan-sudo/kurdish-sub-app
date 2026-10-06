export async function onRequest(context) {
  const { request } = context;
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(request.url);
  const videoId = url.searchParams.get('videoId');
  
  if (!videoId) {
    return new Response(JSON.stringify({ error: 'ئایدی ڤیدیۆ نەدۆزرایەوە.' }), { 
      status: 400, 
      headers: { "Content-Type": "application/json", ...corsHeaders } 
    });
  }

  const instances = [
      'https://pipedapi.kavin.rocks/streams/',
      'https://pipedapi.smnz.de/streams/',
      'https://api.piped.projectsegfau.lt/streams/'
  ];

  let videoData = null;

  for (let baseUrl of instances) {
      try {
          const res = await fetch(`${baseUrl}${videoId}`, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          if (res.ok) {
              const data = await res.json();
              if (data && data.subtitles && data.subtitles.length > 0) {
                  videoData = data;
                  break; 
              }
          }
      } catch (e) {
          continue;
      }
  }

  if (!videoData) {
      return new Response(JSON.stringify({ error: 'هیچ ژێرنووسێک بۆ ئەم ڤیدیۆیە نەدۆزراوەتەوە، یان ڤیدیۆکە ژێرنووسی نییە.' }), { 
        status: 404, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      });
  }

  try {
    const track = videoData.subtitles.find(c => c.code === 'en' || (c.name && c.name.toLowerCase().includes('english'))) || videoData.subtitles[0];
    const subRes = await fetch(track.url);
    const subText = await subRes.text();

    const lines = subText.split('\n');
    const subtitles = [];
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
                subtitles.push({ ...currentSub });
                currentSub = {};
            }
        }
    }

    return new Response(JSON.stringify(subtitles), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: 'نەتوانرا ژێرنووسەکە بە دروستی بخوێنرێتەوە.' }), { 
      status: 500, 
      headers: { "Content-Type": "application/json", ...corsHeaders } 
    });
  }
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
