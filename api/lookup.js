// api/lookup.js
// Serverless function: ZIP -> city/state via Zippopotam, then city-level mapping -> utility.
// NOTE: mapping is realistic / practical but not an official authoritative dataset.

export default async function handler(req, res) {
  try {
    // support POST (JSON body) and GET (query)
    let zip;
    if (req.method === 'POST') {
      const body = typeof req.body === 'object' ? req.body : (req.body ? JSON.parse(req.body) : {});
      zip = body.zip;
    } else {
      // GET fallback
      zip = req.query?.zip || null;
    }

    if (!zip || !/^\d{5}$/.test(zip)) {
      return res.status(400).json({ ok: false, error: 'Invalid ZIP' });
    }

    // 1) get city/state from Zippopotam.us
    const zpUrl = `https://api.zippopotam.us/us/${zip}`;
    const zpResp = await fetch(zpUrl);
    if (!zpResp.ok) {
      return res.status(404).json({ ok: false, error: 'ZIP not found' });
    }
    const zpData = await zpResp.json();
    const place = zpData.places?.[0] || {};
    const city = (place['place name'] || '').trim();
    const state = (place['state abbreviation'] || '').trim();

    // 2) mapping: city-level first, then fallback to state-level default
    // city keys will be normalized to lowercase for matching
    const mapping = {
      OH: {
        // city -> utility (examples for major Ohio cities)
        'cleveland': 'The Illuminating Company (FirstEnergy)',
        'akron': 'Ohio Edison (FirstEnergy)',
        'toledo': 'Toledo Edison (FirstEnergy)',
        'columbus': 'AEP Ohio',
        'cincinnati': 'Duke Energy Ohio',
        'dayton': 'DP&L (AES Ohio)',
        'youngstown': 'FirstEnergy (Ohio Edison/Penn Power area)',
        // add more city mappings as you want...
      },
      PA: {
        'philadelphia': 'PECO Energy',
        'pittsburgh': 'Duquesne Light Company',
        'allentown': 'PPL Electric Utilities',
        'harrisburg': 'PPL / Hershey area (PPL)',
        'er ie': 'Penelec / FirstEnergy', // "erie" sometimes spelled
        'reading': 'PPL / Met-Ed area (PPL/FirstEnergy)',
        'wilkes-barre': 'FirstEnergy (Penelec)',
        // ...
      },
      NJ: {
        'newark': 'PSE&G',
        'jersey city': 'PSE&G',
        'trenton': 'PSE&G / Atlantic City Electric depending on area',
        'atlantic city': 'Atlantic City Electric',
        'toms river': 'JCP&L',
        // ...
      },
      CA: {
        'los angeles': 'Southern California Edison',
        'san francisco': 'Pacific Gas & Electric (PG&E)',
        'san diego': 'San Diego Gas & Electric (SDG&E)',
        'san jose': 'Pacific Gas & Electric (PG&E)',
        'fresno': 'Pacific Gas & Electric (PG&E)',
        // ...
      },
      NY: {
        'new york': 'Con Edison',
        'brooklyn': 'Con Edison',
        'buffalo': 'National Grid',
        'rochester': 'NYSEG / RG&E (RG&E)',
        'syracuse': 'National Grid / NYSEG',
        // ...
      },
      DE: {
        // Delaware statewide main retail utility for electricity is Delmarva Power
        // (Delmarva covers most of DE; distribution sometimes by municipal utilities)
        'default': 'Delmarva Power'
      },
      MI: {
        'detroit': 'DTE Energy',
        'grand rapids': 'Consumers Energy',
        'lansing': 'Consumers Energy',
        'flint': 'DTE Energy / Consumers area (depends)',
        // ...
      },
      RI: {
        'default': 'Rhode Island Energy'
      }
    };

    // state-level defaults (if city not mapped, show common providers for the state)
    const stateDefaults = {
      OH: ['Ohio Edison (FirstEnergy)', 'AEP Ohio', 'Duke Energy Ohio', 'Toledo Edison', 'The Illuminating Company'],
      PA: ['PECO Energy', 'PPL Electric Utilities', 'Duquesne Light', 'Columbia Gas of PA', 'UGI'],
      NJ: ['PSE&G', 'JCP&L', 'Atlantic City Electric'],
      CA: ['Pacific Gas & Electric (PG&E)', 'Southern California Edison', 'SDG&E'],
      NY: ['Con Edison', 'National Grid', 'NYSEG', 'RG&E'],
      DE: ['Delmarva Power'],
      MI: ['DTE Energy', 'Consumers Energy'],
      RI: ['Rhode Island Energy']
    };

    // normalize city
    const cityKey = (city || '').toLowerCase();

    let utility = null;
    if (mapping[state]) {
      const cityMap = mapping[state];
      // try exact city match
      for (const k of Object.keys(cityMap)) {
        if (k === 'default') continue;
        // match if cityKey includes the mapping key or equals (handles "new york" vs "new york city")
        if (cityKey.includes(k.toLowerCase())) {
          utility = cityMap[k];
          break;
        }
      }
      // city-specific not found, check for default within mapping
      if (!utility && cityMap.default) utility = cityMap.default;
    }

    // If still not found, use state defaults (choose first as primary)
    if (!utility) {
      if (stateDefaults[state] && stateDefaults[state].length > 0) {
        utility = stateDefaults[state][0];
      } else {
        utility = 'No utility data available for this state';
      }
    }

    // Build meta / explanation (be transparent)
    const meta = `Determined from city: ${city || 'unknown'}, state: ${state || 'unknown'}.`;
    const note = `This result is based on an internal mapping (city-first, then state defaults). For official utility assignments consult the utility or local distribution company.`;

    return res.json({
      ok: true,
      utility,
      state,
      city,
      meta,
      note
    });
  } catch (err) {
    console.error('lookup error', err);
    return res.status(500).json({ ok: false, error: 'lookup_failed' });
  }
        }
