/**
 * m3u8-parser.js — Direct JS port of echo360/naive_m3u8_parser.py
 *
 * Handles two M3U8 master playlist formats:
 *
 * Format A (old): URI on the NEXT LINE after #EXT-X-STREAM-INF / #EXT-X-MEDIA
 *   #EXT-X-STREAM-INF:BANDWIDTH=102092,RESOLUTION=1280x756,...,AUDIO="group_audio"
 *   s1q1.m3u8
 *   #EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="group_audio",NAME="audio_0",DEFAULT=YES,URI="s0q0.m3u8"
 *
 * Format B (new): URI INLINE in the #EXT-X-MEDIA tag
 *   #EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="q0",NAME="Default",DEFAULT=YES,URI="s0q0.m3u8"
 *   #EXT-X-STREAM-INF:BANDWIDTH=55528,RESOLUTION=640x360,AUDIO="q0",...
 *   s1q0.m3u8
 */

import { urlJoin } from './utils.js';

const VIDEO_TOKENS = ['RESOLUTION='];
const AUDIO_TOKENS = ['AUDIO=', 'TYPE=AUDIO'];

export class NaiveM3U8Parser {
  constructor(lines) {
    this.lines = lines;
    this.videos = [];
    this.audios = [];
  }

  parse() {
    const lines = this.lines;
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      if (lines[i].startsWith('#')) {
        if (VIDEO_TOKENS.some(t => lines[i].includes(t))) {
          this.videos.push(this._extractProperties(lines, i));
        } else if (AUDIO_TOKENS.some(t => lines[i].includes(t))) {
          this.audios.push(this._extractProperties(lines, i));
        }
      }
    }
  }

  /**
   * Returns { videoUri, audioUri } — picks the last (highest quality) video.
   * audioUri may be null if audio is muxed into the video stream.
   */
  getVideoAndAudio() {
    if (this.videos.length === 0) return { videoUri: null, audioUri: null };
    const video = this.videos[this.videos.length - 1]; // last = highest quality
    const videoUri = video.URI;
    let audioUri = null;
    if (video.audio_name) {
      for (const audio of this.audios) {
        if (audio.name === video.audio_name) {
          audioUri = _removeQuotes(audio.URI);
          break;
        }
      }
    }
    return { videoUri, audioUri };
  }

  _extractProperties(lines, idx) {
    const tokens = _tokenise(_removePrefix(lines[idx]));
    const props = {};
    props.type = ('RESOLUTION' in tokens) ? 'video' : 'audio';

    if ('URI' in tokens) {
      // Format B: URI is inline
      props.URI = _removeQuotes(tokens.URI);
    } else {
      // Format A: URI is on the next line
      props.URI = lines[idx + 1]?.trim() ?? '';
    }

    if (props.type === 'video') {
      if ('AUDIO' in tokens) props.audio_name = _removeQuotes(tokens.AUDIO);
    } else {
      // Audio: name can come from AUDIO= (old) or GROUP-ID= (new)
      if ('AUDIO' in tokens) props.name = _removeQuotes(tokens.AUDIO);
      if ('GROUP-ID' in tokens) props.name = _removeQuotes(tokens['GROUP-ID']);
    }
    return props;
  }
}

function _removePrefix(str) {
  const m = str.match(/(?:[#a-zA-Z-]+:)(.*)$/);
  return m ? m[1] : str;
}

function _removeQuotes(str) {
  if (str && str.length >= 2 && str[0] === '"' && str[str.length - 1] === '"') {
    return str.slice(1, -1);
  }
  return str;
}

function _splitOnCommaNotInQuotes(str) {
  return str.split(/,(?=(?:[^"']*["'][^"']*["'])*[^"']*$)/);
}

function _tokenise(str) {
  const items = _splitOnCommaNotInQuotes(str).map(item => item.split('='));
  const result = {};
  for (const parts of items) {
    if (parts.length >= 2) {
      result[parts[0]] = parts.slice(1).join('='); // handle values with '=' in them
    }
  }
  return result;
}

/**
 * Fetch and parse a master M3U8 playlist URL.
 * Returns { videoM3u8Url, audioM3u8Url } — both resolved to absolute URLs.
 * @param {string} masterM3u8Url
 * @returns {Promise<{videoM3u8Url: string, audioM3u8Url: string|null}>}
 */
export async function parseMasterPlaylist(masterM3u8Url) {
  const res = await fetch(masterM3u8Url, { credentials: 'include' });
  if (!res.ok) throw new Error(`M3U8 fetch failed: ${res.status}`);
  const body = await res.text();
  const lines = body.split('\n');

  const parser = new NaiveM3U8Parser(lines);
  parser.parse();
  const { videoUri, audioUri } = parser.getVideoAndAudio();

  if (!videoUri) throw new Error('No video stream found in master playlist');

  return {
    videoM3u8Url: urlJoin(masterM3u8Url, videoUri),
    audioM3u8Url: audioUri ? urlJoin(masterM3u8Url, audioUri) : null,
  };
}

/**
 * Fetch a segment-level M3U8 playlist and return ordered absolute segment URLs.
 * Handles the nested M3U8 case: if there is exactly 1 non-segment entry,
 * recursively fetch that URL as another playlist (mirrors hls_downloader.py:94-111).
 * @param {string} segmentPlaylistUrl
 * @returns {Promise<string[]>}
 */
export async function fetchSegmentUrls(segmentPlaylistUrl) {
  const res = await fetch(segmentPlaylistUrl, { credentials: 'include' });
  if (!res.ok) throw new Error(`Segment playlist fetch failed: ${res.status}`);
  const body = await res.text();

  const urls = body
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => urlJoin(segmentPlaylistUrl, l.trim()));

  // Nested M3U8 detection (hls_downloader.py:94):
  // If exactly 1 entry and its extension is not a media segment type,
  // it's another playlist — recurse.
  if (urls.length === 1 && !urls[0].match(/\.(ts|mp4|m4s)(\?|$)/i)) {
    return fetchSegmentUrls(urls[0]);
  }

  return urls;
}
