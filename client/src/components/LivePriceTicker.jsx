/**
 * LivePriceTicker.jsx
 * Real-time XLM/USD price ticker component for StellarPay.
 *
 * - Polls fetchLivePrices() every 60 s
 * - Primary source: StellarExpert API; fallback: CoinGecko
 * - Shows XLM price, 24 h change, and stable-coin rates (USDC / EURC)
 */

import { useEffect, useState, useCallback } from "react";
import { fetchLivePrices } from "../services/priceService";

const REFRESH_INTERVAL_MS = 60_000;

function formatUSD(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatChange(change) {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

export default function LivePriceTicker() {
  const [prices, setPrices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [pulse, setPulse] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchLivePrices();
      setPrices(data);
      setLastUpdated(new Date());
      setError(null);
      // Brief highlight animation on update
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    } catch {
      setError("Unable to fetch live prices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const xlm = prices?.XLM ?? { usd: 0, change24h: 0 };
  const isPositive = xlm.change24h >= 0;

  return (
    <div
      id="live-price-ticker"
      style={{
        background:
          "linear-gradient(135deg, rgba(17,17,17,0.95) 0%, rgba(20,20,35,0.95) 100%)",
        border: `1px solid ${pulse ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: "16px",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "12px",
        marginBottom: "24px",
        transition: "border-color 0.4s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle glow */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "radial-gradient(ellipse at 15% 50%, rgba(167,139,250,0.06) 0%, transparent 65%)",
          pointerEvents: "none",
        }}
      />

      {/* Left — XLM identity */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #a78bfa, #06b6d4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "20px",
            flexShrink: 0,
            boxShadow: "0 0 14px rgba(167,139,250,0.45)",
          }}
        >
          ⭐
        </div>
        <div>
          <div
            style={{ color: "#f1f5f9", fontWeight: 700, fontSize: "15px" }}
          >
            Stellar Lumens
          </div>
          <div style={{ color: "#64748b", fontSize: "12px", marginTop: "2px" }}>
            XLM / USD • Live
          </div>
        </div>
      </div>

      {/* Center — price + 24 h change */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {loading ? (
          <span style={{ color: "#64748b", fontSize: "14px" }}>
            Fetching price…
          </span>
        ) : error ? (
          <span style={{ color: "#f87171", fontSize: "13px" }}>{error}</span>
        ) : (
          <>
            <span
              id="xlm-live-price"
              style={{
                color: "#f1f5f9",
                fontWeight: 800,
                fontSize: "22px",
                fontFamily: "monospace",
                letterSpacing: "-0.5px",
                transition: "color 0.3s",
              }}
            >
              {formatUSD(xlm.usd)}
            </span>
            <span
              id="xlm-24h-change"
              style={{
                color: isPositive ? "#34d399" : "#f87171",
                fontWeight: 600,
                fontSize: "13px",
                background: isPositive
                  ? "rgba(52,211,153,0.1)"
                  : "rgba(248,113,113,0.1)",
                padding: "3px 10px",
                borderRadius: "20px",
                border: `1px solid ${
                  isPositive
                    ? "rgba(52,211,153,0.25)"
                    : "rgba(248,113,113,0.25)"
                }`,
              }}
            >
              {isPositive ? "▲" : "▼"} {formatChange(xlm.change24h)} 24h
            </span>
          </>
        )}
      </div>

      {/* Right — source + timestamp + refresh */}
      <div style={{ textAlign: "right" }}>
        {prices?.source && (
          <div
            style={{ color: "#a78bfa", fontSize: "11px", fontWeight: 600 }}
          >
            via {prices.source}
          </div>
        )}
        {lastUpdated && (
          <div
            style={{ color: "#475569", fontSize: "11px", marginTop: "2px" }}
          >
            {lastUpdated.toLocaleTimeString()}
          </div>
        )}
        <button
          id="refresh-price-btn"
          onClick={load}
          style={{
            marginTop: "4px",
            background: "none",
            border: "none",
            color: "#a78bfa",
            fontSize: "11px",
            cursor: "pointer",
            textDecoration: "underline",
            padding: 0,
          }}
        >
          Refresh
        </button>
      </div>

      {/* Bottom — stablecoin rates */}
      {prices && (
        <div
          style={{
            width: "100%",
            display: "flex",
            gap: "20px",
            alignItems: "center",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            paddingTop: "10px",
            marginTop: "4px",
          }}
        >
          {[
            { symbol: "USDC", icon: "💵", data: prices.USDC },
            { symbol: "EURC", icon: "💶", data: prices.EURC },
          ].map(({ symbol, icon, data }) => (
            <div
              key={symbol}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <span style={{ fontSize: "14px" }}>{icon}</span>
              <span
                style={{
                  color: "#94a3b8",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                {symbol}
              </span>
              <span
                style={{
                  color: "#e2e8f0",
                  fontSize: "12px",
                  fontFamily: "monospace",
                }}
              >
                {formatUSD(data.usd)}
              </span>
            </div>
          ))}
          <div
            style={{ marginLeft: "auto", color: "#334155", fontSize: "11px" }}
          >
            🔄 auto-refresh 60s
          </div>
        </div>
      )}
    </div>
  );
}
