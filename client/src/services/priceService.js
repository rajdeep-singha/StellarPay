/**
 * priceService.js
 * Real-time XLM price feed for StellarPay.
 *
 * Primary source  : StellarExpert Ticker API (no API key required)
 * Fallback source : CoinGecko public API
 * Cache TTL       : 60 seconds (avoids rate-limiting)
 */

const CACHE_TTL_MS = 60_000; // 60 seconds

let _cache = {
  rates: null,
  fetchedAt: 0,
};

// ---------- Primary: StellarExpert ----------

async function fetchFromStellarExpert() {
  // XLM price ticker from StellarExpert public API (no auth required)
  const url =
    "https://api.stellar.expert/explorer/public/asset/XLM/price?period=1d";
  const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new Error(`StellarExpert HTTP ${res.status}`);
  const data = await res.json();
  return {
    XLM: {
      usd: parseFloat(data.price ?? data.close ?? 0),
      change24h: parseFloat(data.change ?? 0),
    },
    USDC: { usd: 1.0, change24h: 0 },
    EURC: { usd: 1.08, change24h: 0 },
    source: "StellarExpert",
  };
}

// ---------- Fallback: CoinGecko ----------

async function fetchFromCoinGecko() {
  const url =
    "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd&include_24hr_change=true";
  const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data = await res.json();
  const xlm = data?.stellar ?? {};
  return {
    XLM: {
      usd: parseFloat(xlm.usd ?? 0.11),
      change24h: parseFloat(xlm.usd_24h_change ?? 0),
    },
    USDC: { usd: 1.0, change24h: 0 },
    EURC: { usd: 1.08, change24h: 0 },
    source: "CoinGecko",
  };
}

// ---------- Public API ----------

/**
 * Returns live exchange rates for XLM, USDC, and EURC.
 * Results are cached for 60 seconds to avoid API rate limits.
 *
 * @returns {Promise<{XLM:{usd:number,change24h:number}, USDC:{usd:number}, EURC:{usd:number}, source:string, cachedAt:number}>}
 */
export async function fetchLivePrices() {
  const now = Date.now();
  if (_cache.rates && now - _cache.fetchedAt < CACHE_TTL_MS) {
    return { ..._cache.rates, cachedAt: _cache.fetchedAt };
  }

  let rates;
  try {
    rates = await fetchFromStellarExpert();
  } catch (primaryErr) {
    console.warn(
      "[priceService] StellarExpert failed, trying CoinGecko:",
      primaryErr.message
    );
    try {
      rates = await fetchFromCoinGecko();
    } catch (fallbackErr) {
      console.error(
        "[priceService] Both price sources failed:",
        fallbackErr.message
      );
      // Return last cached value or hard fallback — never throw to callers
      return (
        _cache.rates ?? {
          XLM: { usd: 0.11, change24h: 0 },
          USDC: { usd: 1.0, change24h: 0 },
          EURC: { usd: 1.08, change24h: 0 },
          source: "fallback",
          cachedAt: now,
        }
      );
    }
  }

  _cache = { rates, fetchedAt: now };
  return { ...rates, cachedAt: now };
}

/**
 * Returns the simple flat map compatible with the existing
 * sorobanService.fetchExchangeRates() signature:
 *   { XLM: number, USDC: number, EURC: number }
 */
export async function fetchExchangeRates() {
  const prices = await fetchLivePrices();
  return {
    XLM: prices.XLM.usd,
    USDC: prices.USDC.usd,
    EURC: prices.EURC.usd,
  };
}

export default { fetchLivePrices, fetchExchangeRates };
