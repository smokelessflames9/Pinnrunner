import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  ArrowDownUp,
  RefreshCw,
  Wallet,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  SlidersHorizontal,
  Info,
  Copy,
  Check,
  Lock,
} from 'lucide-react';
import { WalletState } from '../types';
import { PINN_CONFIG } from '../config/pinnConfig';
import { walletService } from '../services/walletService';
import {
  SUPPORTED_INPUT_TOKENS,
  OFFICIAL_PINN_TOKEN,
  SwapInputToken,
  JupiterQuoteResult,
  verifyOfficialPinnMint,
  fetchJupiterSwapQuote,
  fetchWalletSolBalance,
  executeJupiterSwapTransaction,
} from '../services/jupiterSwapService';
import { trackPinnEvent } from '../services/analyticsService';

interface JupiterSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletState: WalletState;
  onOpenWalletModal: () => void;
}

const SLIPPAGE_PRESETS_BPS = [
  { label: '0.5%', bps: 50 },
  { label: '1.0%', bps: 100 },
  { label: '2.5%', bps: 250 },
] as const;

export const JupiterSwapModal: React.FC<JupiterSwapModalProps> = ({
  isOpen,
  onClose,
  walletState,
  onOpenWalletModal,
}) => {
  const [selectedInputToken, setSelectedInputToken] = useState<SwapInputToken>(
    SUPPORTED_INPUT_TOKENS[0] // Default: SOL
  );
  const [inputAmount, setInputAmount] = useState<string>('0.5');
  const [slippageBps, setSlippageBps] = useState<number>(100); // 1.0% default
  const [showSlippageSettings, setShowSlippageSettings] = useState<boolean>(false);

  const [isFetchingQuote, setIsFetchingQuote] = useState<boolean>(false);
  const [quoteResult, setQuoteResult] = useState<JupiterQuoteResult | null>(null);

  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState<'phantom' | 'solflare' | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);

  // Two-step transaction review & signing state (never auto-executes)
  const [isReviewingTx, setIsReviewingTx] = useState<boolean>(false);
  const [isSigningTx, setIsSigningTx] = useState<boolean>(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [completedTx, setCompletedTx] = useState<{
    signature: string;
    solscanUrl: string;
    inputSymbol: string;
    inputAmount: string;
    estimatedPinn: string;
  } | null>(null);

  const [copiedMint, setCopiedMint] = useState<boolean>(false);

  const isMintVerified = verifyOfficialPinnMint(OFFICIAL_PINN_TOKEN.mint);

  // Fetch connected wallet SOL balance
  useEffect(() => {
    if (!isOpen || !walletState.isConnected || !walletState.address) {
      setSolBalance(null);
      return;
    }
    let cancelled = false;
    fetchWalletSolBalance(walletState.address).then((bal) => {
      if (!cancelled) {
        setSolBalance(bal);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, walletState.isConnected, walletState.address]);

  // Fetch live quote from Jupiter whenever input token, amount, or slippage changes
  const requestQuote = useCallback(async () => {
    if (!isOpen) return;

    const cleanAmount = inputAmount.trim();
    const numeric = parseFloat(cleanAmount);
    if (!cleanAmount || isNaN(numeric) || numeric <= 0) {
      setQuoteResult(null);
      setIsReviewingTx(false);
      return;
    }

    setIsFetchingQuote(true);
    setSwapError(null);
    trackPinnEvent('pinn_swap_quote_requested', {
      section: 'jupiter_swap_modal',
      platform: selectedInputToken.symbol,
    });

    try {
      const result = await fetchJupiterSwapQuote({
        inputToken: selectedInputToken,
        inputAmountUi: cleanAmount,
        slippageBps,
      });
      setQuoteResult(result);
      if (result.status !== 'ok') {
        setIsReviewingTx(false);
      }
    } catch (err: any) {
      setQuoteResult({
        status: 'error',
        error: err?.message || 'Unable to fetch quote from Jupiter.',
      });
      setIsReviewingTx(false);
    } finally {
      setIsFetchingQuote(false);
    }
  }, [isOpen, inputAmount, selectedInputToken, slippageBps]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      requestQuote();
    }, 350);
    return () => clearTimeout(timer);
  }, [isOpen, requestQuote]);

  if (!isOpen) return null;

  const handleCopyMint = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(OFFICIAL_PINN_TOKEN.mint).catch(() => {});
      setCopiedMint(true);
      setTimeout(() => setCopiedMint(false), 2200);
    }
  };

  const handleConnectProvider = async (walletType: 'phantom' | 'solflare') => {
    setWalletError(null);
    setIsConnectingWallet(walletType);
    try {
      await walletService.connect(walletType);
    } catch (err: any) {
      setWalletError(
        err?.message ||
          `Could not connect to ${walletType === 'phantom' ? 'Phantom' : 'Solflare'}.`
      );
    } finally {
      setIsConnectingWallet(null);
    }
  };

  const handleApproveAndSignSwap = async () => {
    if (!walletState.isConnected || !walletState.address) {
      setSwapError('Please connect your Phantom or Solflare wallet before signing.');
      return;
    }
    if (!quoteResult || quoteResult.status !== 'ok') {
      setSwapError('No valid Jupiter swap route is available to sign.');
      return;
    }
    if (!isMintVerified) {
      setSwapError('Security verification failed: Invalid $PINN token mint address.');
      return;
    }

    setIsSigningTx(true);
    setSwapError(null);

    try {
      const result = await executeJupiterSwapTransaction({
        quoteSummary: quoteResult.quote,
        userPublicKey: walletState.address,
      });

      trackPinnEvent('pinn_swap_submitted', {
        section: 'jupiter_swap_modal',
        platform: selectedInputToken.symbol,
      });

      setCompletedTx({
        signature: result.signature,
        solscanUrl: result.solscanUrl,
        inputSymbol: selectedInputToken.symbol,
        inputAmount: quoteResult.quote.inputAmountUi,
        estimatedPinn: quoteResult.quote.estimatedPinnUi,
      });
      setIsReviewingTx(false);
    } catch (err: any) {
      const msg = String(err?.message || 'Transaction failed or was rejected by wallet.');
      setSwapError(msg);
    } finally {
      setIsSigningTx(false);
    }
  };

  const truncateAddress = (addr: string) =>
    addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="jupiter-swap-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-zinc-950 border border-gold-glow shadow-[0_0_50px_-10px_rgba(212,175,55,0.3)] overflow-hidden my-auto">
        {/* Top Accent Bar */}
        <div className="h-1.5 w-full bg-gold-gradient" />

        {/* Modal Header */}
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-zinc-800/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={OFFICIAL_PINN_TOKEN.logoUrl}
              alt={OFFICIAL_PINN_TOKEN.name}
              className="w-10 h-10 rounded-xl bg-black border border-gold-subtle/60 object-contain p-0.5 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="jupiter-swap-modal-title"
                  className="text-lg sm:text-xl font-black text-white font-serif uppercase tracking-tight"
                >
                  SWAP FOR <span className="text-gold-gradient">$PINN</span>
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-[10px] font-mono-arcade font-bold text-emerald-300 uppercase">
                  Jupiter API
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-mono-arcade">
                {OFFICIAL_PINN_TOKEN.name} · Solana Mainnet
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowSlippageSettings((prev) => !prev)}
              title="Slippage Tolerance Settings"
              className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                showSlippageSettings
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={requestQuote}
              disabled={isFetchingQuote}
              title="Refresh Live Jupiter Quote"
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-amber-300 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isFetchingQuote ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Swap Modal"
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Slippage Drawer */}
          {showSlippageSettings && (
            <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-amber-500/30 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-300 uppercase tracking-wider font-mono-arcade">
                  Max Slippage Tolerance
                </span>
                <span className="text-zinc-400 font-mono-arcade">
                  {(slippageBps / 100).toFixed(1)}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {SLIPPAGE_PRESETS_BPS.map((preset) => (
                  <button
                    key={preset.bps}
                    type="button"
                    onClick={() => {
                      setSlippageBps(preset.bps);
                      setIsReviewingTx(false);
                    }}
                    className={`py-2 rounded-xl text-xs font-bold font-mono-arcade border transition-all cursor-pointer ${
                      slippageBps === preset.bps
                        ? 'bg-gold-gradient text-black border-amber-300 shadow-sm'
                        : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Completed Transaction Confirmation View */}
          {completedTx ? (
            <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/50 space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-mono-arcade uppercase tracking-widest text-emerald-400">
                  Transaction Broadcasted to Solana Mainnet
                </span>
                <h3 className="text-xl font-black text-white font-serif uppercase">
                  SWAP SUBMITTED
                </h3>
                <p className="text-xs text-zinc-300">
                  Swapped{' '}
                  <strong className="text-white">
                    {completedTx.inputAmount} {completedTx.inputSymbol}
                  </strong>{' '}
                  for approximately{' '}
                  <strong className="text-amber-300">{completedTx.estimatedPinn} $PINN</strong>
                </p>
              </div>

              <div className="p-3 rounded-xl bg-black/70 border border-zinc-800 text-left space-y-1">
                <span className="text-[10px] font-mono-arcade uppercase text-zinc-400 block">
                  Transaction Signature
                </span>
                <span className="text-xs font-mono-arcade text-emerald-300 break-all select-all block">
                  {completedTx.signature}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <a
                  href={completedTx.solscanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 px-4 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
                >
                  <span>VIEW ON SOLSCAN</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setCompletedTx(null);
                    requestQuote();
                  }}
                  className="py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 font-bold text-xs uppercase tracking-wider cursor-pointer"
                >
                  NEW SWAP
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* INPUT TOKEN BOX (You Pay) */}
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 focus-within:border-amber-400/60 transition-colors space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="font-mono-arcade uppercase tracking-wider">You Pay</span>
                  {selectedInputToken.symbol === 'SOL' && solBalance !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        const maxSafe = Math.max(0, solBalance - 0.01);
                        if (maxSafe > 0) {
                          setInputAmount(maxSafe.toFixed(4).replace(/\.?0+$/, ''));
                          setIsReviewingTx(false);
                        }
                      }}
                      className="text-[11px] font-mono-arcade text-amber-300 hover:underline cursor-pointer"
                    >
                      Balance: {solBalance.toFixed(4)} SOL (Use Max)
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  {/* Input Token Selector (SOL, USDC, USDT) */}
                  <div className="flex items-center gap-1.5 bg-black border border-zinc-800 rounded-xl p-1 shrink-0">
                    {SUPPORTED_INPUT_TOKENS.map((token) => {
                      const active = token.symbol === selectedInputToken.symbol;
                      return (
                        <button
                          key={token.symbol}
                          type="button"
                          onClick={() => {
                            setSelectedInputToken(token);
                            setIsReviewingTx(false);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                            active
                              ? 'bg-gold-gradient text-black shadow-sm'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          {token.symbol}
                        </button>
                      );
                    })}
                  </div>

                  {/* Amount Input */}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={inputAmount}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.]/g, '');
                      setInputAmount(val);
                      setIsReviewingTx(false);
                    }}
                    placeholder="0.00"
                    aria-label={`Amount of ${selectedInputToken.symbol} to swap`}
                    className="w-full bg-transparent text-right text-2xl sm:text-3xl font-black text-white font-mono-arcade focus:outline-none placeholder:text-zinc-700"
                  />
                </div>

                {/* Quick Amount Presets */}
                {selectedInputToken.symbol === 'SOL' && (
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    {['0.1', '0.5', '1', '5'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setInputAmount(preset);
                          setIsReviewingTx(false);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-arcade font-bold border transition-colors cursor-pointer ${
                          inputAmount === preset
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {preset} SOL
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Swap Direction Indicator */}
              <div className="flex items-center justify-center -my-2 relative z-10">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-gold-subtle/60 flex items-center justify-center text-amber-400 shadow-md">
                  <ArrowDownUp className="w-4 h-4" />
                </div>
              </div>

              {/* OUTPUT TOKEN BOX (You Receive: Official $PINN) */}
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-gold-subtle/40 space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="font-mono-arcade uppercase tracking-wider">
                    You Receive (Estimated)
                  </span>
                  <span className="text-[11px] font-mono-arcade text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verified Mint</span>
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 bg-black border border-gold-subtle/40 rounded-xl px-3 py-2 shrink-0">
                    <img
                      src={OFFICIAL_PINN_TOKEN.logoUrl}
                      alt="PINN"
                      className="w-6 h-6 rounded-full object-contain"
                    />
                    <div className="text-left">
                      <span className="text-xs font-black text-gold-gradient block leading-none">
                        ${OFFICIAL_PINN_TOKEN.symbol}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono-arcade block mt-0.5">
                        Solana SPL
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex-1 min-w-0">
                    {isFetchingQuote ? (
                      <div className="inline-flex items-center gap-2 text-amber-300 text-sm font-mono-arcade">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Fetching Jupiter route...</span>
                      </div>
                    ) : quoteResult?.status === 'ok' ? (
                      <div
                        className="text-xl sm:text-2xl font-black text-amber-300 font-mono-arcade truncate"
                        title={`${quoteResult.quote.estimatedPinnUi} PINN`}
                      >
                        {quoteResult.quote.estimatedPinnUi}
                      </div>
                    ) : (
                      <div className="text-xl font-bold text-zinc-600 font-mono-arcade">—</div>
                    )}
                  </div>
                </div>

                {/* Verified Mint Address Bar */}
                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2 text-[11px] font-mono-arcade">
                  <span className="text-zinc-400 truncate">
                    Mint: <span className="text-amber-300/90">{OFFICIAL_PINN_TOKEN.mint}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyMint}
                    className="text-zinc-400 hover:text-amber-300 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedMint ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* LIQUIDITY / ROUTING STATUS & QUOTE BREAKDOWN */}
              {quoteResult?.status === 'ok' && (
                <div className="p-3.5 rounded-2xl bg-black/70 border border-zinc-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Rate</span>
                    <span className="font-mono-arcade text-zinc-200">
                      1 {selectedInputToken.symbol} ≈ {quoteResult.quote.ratePerInputUnitUi} PINN
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Minimum Received ({(quoteResult.quote.slippageBps / 100).toFixed(1)}% Slippage)</span>
                    <span className="font-mono-arcade text-amber-300 font-semibold">
                      {quoteResult.quote.minimumPinnUi} PINN
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Price Impact</span>
                    <span
                      className={`font-mono-arcade font-semibold ${
                        quoteResult.quote.priceImpactPct > 5
                          ? 'text-red-400'
                          : quoteResult.quote.priceImpactPct > 2
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                      }`}
                    >
                      {quoteResult.quote.priceImpactPct < 0.01
                        ? '< 0.01%'
                        : `${quoteResult.quote.priceImpactPct.toFixed(2)}%`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Network &amp; Priority Fee</span>
                    <span className="font-mono-arcade text-zinc-300">
                      {quoteResult.quote.estimatedNetworkFeeSol}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Jupiter Route</span>
                    <span className="font-mono-arcade text-sky-300 truncate max-w-[210px]">
                      {quoteResult.quote.routeLabels.join(' → ')}
                    </span>
                  </div>
                </div>
              )}

              {/* NO LIQUIDITY / NO VALID ROUTE NOTICE (Requirement 7) */}
              {quoteResult?.status === 'no_route' && (
                <div
                  role="status"
                  className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-3"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                        No Active Jupiter Swap Route Available
                      </h4>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {quoteResult.reason}
                      </p>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        To protect your funds, PINN Arcade never displays fabricated token estimates or submits invalid transactions when Jupiter has no active liquidity route. You can check live pool status on Jupiter, Pump.fun, or DexScreener below:
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <a
                      href={PINN_CONFIG.JUPITER_SWAP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-amber-500/40 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <span>Open on Jup.ag</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={PINN_CONFIG.PUMP_FUN_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <span>View on Pump.fun</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={PINN_CONFIG.DEXSCREENER_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-sky-300 border border-sky-500/40 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <span>DexScreener Chart</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* API / Input Error Notice */}
              {quoteResult?.status === 'error' && (
                <div className="p-3.5 rounded-2xl bg-red-950/30 border border-red-500/40 flex items-start gap-2.5 text-xs text-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{quoteResult.error}</span>
                </div>
              )}

              {swapError && (
                <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/50 flex items-start gap-2.5 text-xs text-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{swapError}</span>
                </div>
              )}

              {walletError && (
                <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/40 text-xs text-red-300">
                  {walletError}
                </div>
              )}

              {/* TRANSACTION REVIEW CONFIRMATION STEP (Requirement 4: Review before signing) */}
              {isReviewingTx && quoteResult?.status === 'ok' && (
                <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-400/50 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Review Swap Before Signing</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsReviewingTx(false)}
                      className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer"
                    >
                      Edit Amount
                    </button>
                  </div>

                  <div className="text-xs text-zinc-300 space-y-1.5 font-mono-arcade bg-black/60 p-3 rounded-xl border border-zinc-800">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Pay:</span>
                      <span className="text-white font-bold">
                        {quoteResult.quote.inputAmountUi} {selectedInputToken.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Estimated Output:</span>
                      <span className="text-amber-300 font-bold">
                        {quoteResult.quote.estimatedPinnUi} $PINN
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Minimum Guaranteed:</span>
                      <span className="text-emerald-300">
                        {quoteResult.quote.minimumPinnUi} $PINN
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Output Mint:</span>
                      <span className="text-zinc-300">
                        {OFFICIAL_PINN_TOKEN.mint.slice(0, 6)}...{OFFICIAL_PINN_TOKEN.mint.slice(-6)}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Clicking <strong>Approve &amp; Sign in Wallet</strong> will open your connected Solana wallet ({walletState.walletName || 'Phantom / Solflare'}) so you can personally inspect and sign the transaction.
                  </p>
                </div>
              )}

              {/* WALLET CONNECTION OR SWAP ACTION BUTTONS */}
              {!walletState.isConnected ? (
                <div className="space-y-2.5 pt-1">
                  <div className="text-xs text-center text-zinc-400 font-semibold">
                    Connect a Solana wallet to review &amp; approve your $PINN swap:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={isConnectingWallet !== null}
                      onClick={() => handleConnectProvider('phantom')}
                      className="py-3 px-4 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                    >
                      {isConnectingWallet === 'phantom' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Wallet className="w-4 h-4" />
                      )}
                      <span>Connect Phantom</span>
                    </button>

                    <button
                      type="button"
                      disabled={isConnectingWallet !== null}
                      onClick={() => handleConnectProvider('solflare')}
                      className="py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-gold-subtle/60 font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isConnectingWallet === 'solflare' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Wallet className="w-4 h-4 text-amber-400" />
                      )}
                      <span>Connect Solflare</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-zinc-300 font-semibold">
                        {walletState.walletName || 'Solana Wallet'}:{' '}
                        <span className="font-mono-arcade text-amber-300">
                          {truncateAddress(walletState.address || '')}
                        </span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenWalletModal}
                      className="text-[11px] text-zinc-400 hover:text-amber-300 underline cursor-pointer"
                    >
                      Manage Wallet
                    </button>
                  </div>

                  {!isReviewingTx ? (
                    <button
                      type="button"
                      disabled={
                        isFetchingQuote ||
                        !quoteResult ||
                        quoteResult.status !== 'ok' ||
                        !isMintVerified
                      }
                      onClick={() => {
                        setSwapError(null);
                        setIsReviewingTx(true);
                      }}
                      className="w-full py-4 rounded-xl bg-gold-gradient text-black font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/20 hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isFetchingQuote ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Checking Jupiter Liquidity...</span>
                        </>
                      ) : quoteResult?.status === 'ok' ? (
                        <span>REVIEW SWAP TRANSACTION</span>
                      ) : quoteResult?.status === 'no_route' ? (
                        <span>NO JUPITER ROUTE AVAILABLE</span>
                      ) : (
                        <span>ENTER AMOUNT TO SWAP</span>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isSigningTx || quoteResult?.status !== 'ok'}
                      onClick={handleApproveAndSignSwap}
                      className="w-full py-4 rounded-xl bg-gold-gradient text-black font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/25 hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSigningTx ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>AWAITING WALLET SIGNATURE...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>APPROVE &amp; SIGN IN WALLET</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Footer Security & Non-Custodial Notice */}
          <div className="pt-2 border-t border-zinc-900 flex items-start gap-2 text-[11px] text-zinc-400">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Powered by official Jupiter Solana routing (<a href="https://dev.jup.ag/" target="_blank" rel="noopener noreferrer" className="text-amber-300 hover:underline">dev.jup.ag</a>). PINN Arcade never asks for private keys or seed phrases and never executes transactions without your explicit wallet signature.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
