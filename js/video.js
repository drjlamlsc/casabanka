const Video = (() => {
  let ffmpeg = null;
  let ffmpegLoaded = false;

  async function tryLoadFFmpeg() {
    if (ffmpegLoaded) return true;
    if (typeof FFmpeg === 'undefined') return false;
    try {
      const { createFFmpeg } = FFmpeg;
      ffmpeg = createFFmpeg({
        corePath: 'https://unpkg.com/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js',
        log: false,
      });
      await ffmpeg.load();
      ffmpegLoaded = true;
      return true;
    } catch (e) {
      console.warn('ffmpeg.wasm unavailable, using canvas fallback:', e.message);
      ffmpeg = null;
      return false;
    }
  }

  // Primary: ffmpeg.wasm — handles all video formats reliably
  async function extractWithFFmpeg(file, onProgress) {
    const { fetchFile } = FFmpeg;

    onProgress(0.02, 'Loading video processor…');
    ffmpeg.setProgress(({ ratio }) => {
      onProgress(0.05 + ratio * 0.75, 'Extracting frames…');
    });

    onProgress(0.04, 'Reading video file…');
    ffmpeg.FS('writeFile', 'input', await fetchFile(file));

    await ffmpeg.run(
      '-i', 'input',
      '-vf', 'fps=1/3,scale=800:-1',
      '-q:v', '5',
      'frame_%04d.jpg'
    );

    onProgress(0.82, 'Reading extracted frames…');
    const all = ffmpeg.FS('readdir', '/');
    const frameFiles = all.filter(f => /^frame_\d+\.jpg$/.test(f)).sort();

    const frames = [];
    for (let i = 0; i < frameFiles.length; i++) {
      const data = ffmpeg.FS('readFile', frameFiles[i]);
      frames.push('data:image/jpeg;base64,' + toBase64(data));
      onProgress(0.82 + (i + 1) / frameFiles.length * 0.18, `Reading frame ${i + 1} of ${frameFiles.length}…`);
    }

    // Clean up virtual FS
    try { ffmpeg.FS('unlink', 'input'); } catch (_) {}
    frameFiles.forEach(f => { try { ffmpeg.FS('unlink', f); } catch (_) {} });

    return frames;
  }

  // Fallback: HTML5 video + canvas (no external dependency)
  function extractWithCanvas(file, onProgress) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);
      video.src = url;
      video.muted = true;
      video.playsInline = true;

      video.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        reject(new Error('Browser could not load this video format.'));
      });

      video.addEventListener('loadedmetadata', async () => {
        try {
          const timestamps = [];
          for (let t = 0; t < video.duration; t += 3) timestamps.push(t);

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const frames = [];

          for (let i = 0; i < timestamps.length; i++) {
            await seek(video, timestamps[i]);
            const scale = Math.min(800 / video.videoWidth, 800 / video.videoHeight, 1);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            frames.push(canvas.toDataURL('image/jpeg', 0.75));
            onProgress((i + 1) / timestamps.length, `Extracting frame ${i + 1} of ${timestamps.length}…`);
          }

          URL.revokeObjectURL(url);
          resolve(frames);
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      });

      video.load();
    });
  }

  function seek(video, t) {
    return new Promise(res => {
      video.addEventListener('seeked', res, { once: true });
      video.currentTime = t;
    });
  }

  function toBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return btoa(bin);
  }

  async function extractFrames(file, onProgress) {
    onProgress(0, 'Initialising…');
    const hasFFmpeg = await tryLoadFFmpeg();
    if (hasFFmpeg) {
      return extractWithFFmpeg(file, onProgress);
    }
    return extractWithCanvas(file, onProgress);
  }

  return { extractFrames };
})();
