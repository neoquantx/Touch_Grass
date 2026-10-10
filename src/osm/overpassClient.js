import { CONFIG } from '../config.js';
import { buildQuery } from './overpass.js';

function stripTags(html) {
  return html.replace(/<[^>]*>?/gm, '');
}

export class OverpassError extends Error {
  constructor(message, failures) {
    super(message);
    this.name = 'OverpassError';
    this.failures = failures;
  }
}

export async function fetchOverpass(lat, lon, radius, onProgress) {
  const endpoints = CONFIG.AREA.overpassEndpoints;
  const timeoutMs = CONFIG.AREA.timeoutMs;
  const failures = [];
  
  const startTime = Date.now();
  const maxWallClock = 90000;
  
  const tryQuery = async (level) => {
    const query = buildQuery(lat, lon, radius, level);
    const body = `data=${encodeURIComponent(query)}`;
    
    for (let i = 0; i < endpoints.length; i++) {
      if (Date.now() - startTime > maxWallClock) {
        throw new OverpassError(`Total time limit of 90s exceeded.\n` + failures.map(f => `- ${f.host}: ${f.status}`).join('\n'), failures);
      }
      
      const endpoint = endpoints[i];
      const host = new URL(endpoint).hostname;
      
      if (onProgress) {
        onProgress(level === 'full' 
          ? `Trying ${host} (${i + 1} of ${endpoints.length})...`
          : `Retrying with a smaller area... (${host})`
        );
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      let status = 'network';
      let responseBodyText = '';
      
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Accept': 'application/json',
            'User-Agent': 'TouchGrass/1.0 (DEV hackathon app)'
          },
          body,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        status = response.status;
        
        if (response.ok) {
          const json = await response.json();
          if (!json.elements) {
            throw new Error('Invalid JSON: missing elements array');
          }
          return json.elements;
        } else {
          // It failed with a status code
          responseBodyText = await response.text().catch(() => '');
          if ([429, 500, 502, 503, 504].includes(status)) {
            // we will retry
            throw new Error(`HTTP ${status}`);
          } else {
            // throw unrecoverable
            throw new Error(`HTTP ${status} (unrecoverable)`);
          }
        }
      } catch (e) {
        clearTimeout(timeoutId);
        
        if (e.name === 'AbortError') {
          status = 'timeout';
        }
        
        let preview = stripTags(responseBodyText).substring(0, 120).trim();
        if (!preview && e.message) {
          preview = e.message.substring(0, 120);
        }
        
        failures.push({ host, status, error: preview });
        
        if (e.message && e.message.includes('unrecoverable')) {
           // Break the loop if we shouldn't retry this error
           break;
        }
        
        // Wait 2s before trying next endpoint
        if (i < endpoints.length - 1 || level === 'full') {
           await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    return null;
  };
  
  // Try full query
  let result = await tryQuery('full');
  if (result) return result;
  
  // Try light query
  result = await tryQuery('light');
  if (result) return result;
  
  const errorMessage = `All Overpass endpoints failed.\n` + failures.map(f => `- ${f.host}: [${f.status}] ${f.error}`).join('\n');
  throw new OverpassError(errorMessage, failures);
}
