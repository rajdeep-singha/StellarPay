  import React, { useState } from "react";

  const WithdrawForm = ({
    onWithdraw,
    maxAmount,
    isLoading,
    isConnected,
    // Multi-currency props
    tokenBalances = [],
    selectedToken,
    onTokenChange,
    exchangeRates = {},
    loadingBalances = false,
  }) => {
    const [amount, setAmount] = useState("");
    const [customAmount, setCustomAmount] = useState("");
    const [isCustom, setIsCustom] = useState(false);

    const presetAmounts = [100, 250, 500, 1000];

    // Active token info
    const activeToken = selectedToken || { symbol: "XLM", icon: "⭐", decimals: 7 };
    const activeBalance = maxAmount;

    // USD value display
    const usdRate = exchangeRates[activeToken.symbol];
    const getUsdDisplay = (amt) => {
      if (!usdRate || !amt) return null;
      return `≈ $${(amt * usdRate).toFixed(2)} USD`;
    };

    const handlePresetClick = (preset) => {
      setIsCustom(false);
      setAmount(preset.toString());
      setCustomAmount("");
    };

    const handleCustomChange = (e) => {
      const value = e.target.value;
      if (value === "" || /^\d*\.?\d*$/.test(value)) {
        setCustomAmount(value);
        setAmount(value);
        setIsCustom(true);
      }
    };

    const handleWithdraw = () => {
      const withdrawAmount = parseFloat(amount);
      if (!withdrawAmount || withdrawAmount <= 0) return;
      if (withdrawAmount > maxAmount) return;
      onWithdraw(withdrawAmount, activeToken);
      setAmount("");
      setCustomAmount("");
      setIsCustom(false);
    };

    const selectedAmount = parseFloat(amount) || 0;
    const fee = selectedAmount * 0.0125;
    const netAmount = selectedAmount - fee;
    const isValidAmount = selectedAmount > 0 && selectedAmount <= maxAmount;

    return (
      <div className="space-y-6">

        {/* ── Currency Selector ── */}
        <div>
          <p className="text-gray-500 text-sm mb-3">Select Currency</p>
          {loadingBalances ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm py-3">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading balances...
            </div>
          ) : tokenBalances.length > 0 ? (
            <div className="grid gap-2">
              {tokenBalances.map((token) => {
                const isActive = activeToken.symbol === token.symbol;
                const usdVal = exchangeRates[token.symbol]
                  ? (token.balance * exchangeRates[token.symbol]).toFixed(2)
                  : null;

                return (
                  <button
                    key={token.symbol}
                    onClick={() => {
                      onTokenChange?.(token);
                      setAmount("");
                      setCustomAmount("");
                    }}
                    disabled={!isConnected}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 ${
                      isActive
                        ? "bg-gradient-to-r from-pink-400/20 to-purple-400/20 border-pink-400/50 text-white"
                        : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{token.icon}</span>
                      <div className="text-left">
                        <p className="font-semibold text-sm">{token.symbol}</p>
                        <p className="text-xs text-gray-500">{token.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">
                        {token.balance.toFixed(4)} {token.symbol}
                      </p>
                      {usdVal && (
                        <p className="text-xs text-gray-500">≈ ${usdVal} USD</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            // Fallback: simple dropdown if balances not loaded yet
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-xl">{activeToken.icon || "🪙"}</span>
              <span className="text-white font-medium">{activeToken.symbol}</span>
            </div>
          )}
        </div>

        {/* ── Exchange Rate Banner ── */}
        {usdRate && activeToken.symbol !== "USDC" && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-gray-500">
            <span>📈</span>
            <span>1 {activeToken.symbol} ≈ ${usdRate.toFixed(4)} USD</span>
          </div>
        )}

        {/* ── Preset Amount Buttons ── */}
        <div>
          <p className="text-gray-500 text-sm mb-3">Quick Select</p>
          <div className="grid grid-cols-4 gap-3">
            {presetAmounts.map((preset) => (
              <button
                key={preset}
                onClick={() => handlePresetClick(preset)}
                disabled={preset > maxAmount || !isConnected}
                className={`py-3 px-4 rounded-xl font-medium transition-all duration-200 ${
                  amount === preset.toString() && !isCustom
                    ? "bg-gradient-to-r from-pink-400 to-purple-400 text-black"
                    : preset > maxAmount
                    ? "bg-white/5 text-gray-700 cursor-not-allowed"
                    : "bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10"
                }`}
              >
                {preset} {activeToken.symbol}
              </button>
            ))}
          </div>
        </div>

        {/* ── Custom Amount Input ── */}
        <div>
          <p className="text-gray-500 text-sm mb-3">Or Enter Custom Amount</p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 text-sm font-medium">
              {activeToken.icon}
            </span>
            <input
              type="text"
              value={customAmount}
              onChange={handleCustomChange}
              placeholder="0.00"
              disabled={!isConnected}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-10 pr-20 text-xl font-medium text-white placeholder-gray-700 focus:outline-none focus:border-pink-400/50 focus:ring-1 focus:ring-pink-400/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={() => {
                setCustomAmount(maxAmount.toFixed(4));
                setAmount(maxAmount.toFixed(4));
                setIsCustom(true);
              }}
              disabled={!isConnected}
              className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-semibold text-pink-400 bg-pink-400/10 rounded-lg hover:bg-pink-400/20 transition-colors disabled:opacity-50"
            >
              MAX
            </button>
          </div>
          {customAmount && getUsdDisplay(parseFloat(customAmount)) && (
            <p className="text-xs text-gray-500 mt-1 ml-1">
              {getUsdDisplay(parseFloat(customAmount))}
            </p>
          )}
        </div>

        {/* ── Fee Breakdown ── */}
        {selectedAmount > 0 && (
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Requested Amount</span>
              <span className="text-white">
                {selectedAmount.toFixed(4)} {activeToken.symbol}
                {getUsdDisplay(selectedAmount) && (
                  <span className="text-gray-500 text-xs ml-1">{getUsdDisplay(selectedAmount)}</span>
                )}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Processing Fee (1.25%)</span>
              <span className="text-amber-400">
                -{fee.toFixed(4)} {activeToken.symbol}
              </span>
            </div>
            <div className="border-t border-white/10 pt-3 flex justify-between">
              <span className="text-gray-400 font-medium">You'll Receive</span>
              <div className="text-right">
                <span className="text-xl font-bold text-pink-400">
                  {netAmount.toFixed(4)} {activeToken.symbol}
                </span>
                {getUsdDisplay(netAmount) && (
                  <p className="text-xs text-gray-500 mt-0.5">{getUsdDisplay(netAmount)}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Error Message ── */}
        {selectedAmount > maxAmount && (
          <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-sm">
            ⚠️ Amount exceeds your available balance of {maxAmount.toFixed(4)} {activeToken.symbol}
          </div>
        )}

        {/* ── Withdraw Button ── */}
        <button
          onClick={handleWithdraw}
          disabled={!isValidAmount || isLoading || !isConnected}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-all duration-200 ${
            isValidAmount && isConnected
              ? "bg-gradient-to-r from-pink-400 to-purple-400 text-black hover:opacity-90"
              : "bg-white/5 text-gray-600 cursor-not-allowed"
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-3">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </span>
          ) : !isConnected ? (
            "Connect Wallet to Withdraw"
          ) : (
            `Withdraw ${selectedAmount > 0 ? `${netAmount.toFixed(4)} ${activeToken.symbol}` : ""}`
          )}
        </button>
      </div>
    );
  };

  export default WithdrawForm;