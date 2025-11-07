// api/lookup.js
export default async function handler(req, res) {
  try {
    let zip;
    if (req.method === "POST") {
      const body =
        typeof req.body === "object"
          ? req.body
          : req.body
          ? JSON.parse(req.body)
          : {};
      zip = body.zip;
    } else {
      zip = req.query?.zip || null;
    }

    if (!zip || !/^\d{5}$/.test(zip)) {
      return res.status(400).json({ ok: false, error: "Invalid ZIP" });
    }

    // 1️⃣ Get city/state from Zippopotam (public API)
    const zpUrl = `https://api.zippopotam.us/us/${zip}`;
    const zpResp = await fetch(zpUrl);
    if (!zpResp.ok) {
      return res
        .status(404)
        .json({ ok: false, error: "ZIP not found in database" });
    }
    const zpData = await zpResp.json();
    const place = zpData.places?.[0] || {};
    const city = (place["place name"] || "").trim();
    const state = (place["state abbreviation"] || "").trim();
    const cityKey = city.toLowerCase();

    // 2️⃣ Mapping for Electric + Gas utilities
    const mapping = {
      OH: {
        cleveland: {
          electric: "The Illuminating Company (FirstEnergy)",
          gas: "Dominion Energy Ohio",
        },
        akron: {
          electric: "Ohio Edison (FirstEnergy)",
          gas: "Dominion Energy Ohio",
        },
        toledo: {
          electric: "Toledo Edison (FirstEnergy)",
          gas: "Columbia Gas of Ohio",
        },
        columbus: {
          electric: "AEP Ohio",
          gas: "Columbia Gas of Ohio",
        },
        cincinnati: {
          electric: "Duke Energy Ohio",
          gas: "Duke Energy Gas",
        },
        dayton: {
          electric: "AES Ohio (DP&L)",
          gas: "Vectren / CenterPoint Energy",
        },
        default: { electric: "AEP Ohio", gas: "Columbia Gas of Ohio" },
      },

      PA: {
        philadelphia: { electric: "PECO Energy", gas: "PECO Gas" },
        pittsburgh: {
          electric: "Duquesne Light Company",
          gas: "Columbia Gas of PA",
        },
        harrisburg: { electric: "PPL Electric Utilities", gas: "UGI Gas" },
        allentown: { electric: "PPL Electric Utilities", gas: "UGI Gas" },
        scranton: { electric: "PPL Electric Utilities", gas: "UGI Gas" },
        reading: { electric: "Met-Ed (FirstEnergy)", gas: "UGI Gas" },
        erie: { electric: "Penelec (FirstEnergy)", gas: "National Fuel Gas" },
        york: { electric: "Met-Ed (FirstEnergy)", gas: "Columbia Gas of PA" },
        lancaster: { electric: "PPL Electric Utilities", gas: "UGI Gas" },
        bethlehem: { electric: "PPL Electric Utilities", gas: "UGI Gas" },
        "wilkes-barre": { electric: "PPL Electric Utilities", gas: "UGI Gas" },
        johnstown: { electric: "Penelec (FirstEnergy)", gas: "Peoples Gas" },
        altoona: { electric: "Penelec (FirstEnergy)", gas: "Columbia Gas of PA" },
        default: { electric: "PECO Energy", gas: "UGI Gas" },
      },

      NJ: {
        newark: { electric: "PSE&G", gas: "PSE&G Gas" },
        "jersey city": { electric: "PSE&G", gas: "PSE&G Gas" },
        trenton: {
          electric: "PSE&G / Atlantic City Electric",
          gas: "New Jersey Natural Gas",
        },
        "atlantic city": {
          electric: "Atlantic City Electric",
          gas: "South Jersey Gas",
        },
        "toms river": {
          electric: "JCP&L",
          gas: "New Jersey Natural Gas",
        },
        default: { electric: "PSE&G", gas: "New Jersey Natural Gas" },
      },

      DE: { default: { electric: "Delmarva Power", gas: "Chesapeake Utilities" } },
      MI: { default: { electric: "DTE Energy", gas: "Consumers Energy" } },
      RI: { default: { electric: "Rhode Island Energy", gas: "Rhode Island Energy Gas" } },
      NY: { default: { electric: "Con Edison", gas: "National Grid" } },
      CA: { default: { electric: "Pacific Gas & Electric (PG&E)", gas: "SoCalGas" } },
    };

    // 3️⃣ Find provider
    const stateMap = mapping[state];
    let provider = stateMap ? stateMap["default"] : { electric: "Unknown", gas: "Unknown" };

    if (stateMap) {
      for (const key of Object.keys(stateMap)) {
        if (key !== "default" && cityKey.includes(key.toLowerCase())) {
          provider = stateMap[key];
          break;
        }
      }
    }

    // 4️⃣ Send final result
    return res.json({
      ok: true,
      data: {
        city,
        state,
        electric: provider.electric,
        gas: provider.gas,
      },
    });
  } catch (err) {
    console.error("lookup error", err);
    return res.status(500).json({ ok: false, error: "lookup_failed" });
  }
}
