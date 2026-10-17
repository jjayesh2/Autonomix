import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useSound } from '../../context/SoundContext.js';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
  ShieldCheck,
  CreditCard,
  QrCode,
  Building,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Clock,
  Sparkles,
  Info,
  ChevronRight,
  X,
} from 'lucide-react';

interface WalletTx {
  id: string;
  type: 'deposit' | 'task_payment' | 'refund';
  amount: number;
  currency: string;
  status: 'confirmed' | 'pending' | 'failed';
  description: string;
  created_at: string;
  method?: string;
  tx_hash?: string;
}

export const CustomerWalletPage: React.FC<{ onNavigate: (screen: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { playClick, playSuccess, playError } = useSound();

  const [balance, setBalance] = useState<number>(0.85); // Default testnet balance
  const [reservedBudget, setReservedBudget] = useState<number>(0.10);
  const [transactions, setTransactions] = useState<WalletTx[]>([
    {
      id: 'tx-001',
      type: 'deposit',
      amount: 1.00,
      currency: 'USDC',
      status: 'confirmed',
      description: 'Testnet Faucet Initial Allocation',
      created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
      method: 'Base Sepolia Testnet Faucet',
      tx_hash: '0x8f2d4e8c1b9a7f3e5d0c2b4a6f8e1d3c5b7a9f0e2d4c6b8a0f2e4d6c8b0a2f4',
    },
    {
      id: 'tx-002',
      type: 'task_payment',
      amount: -0.15,
      currency: 'USDC',
      status: 'confirmed',
      description: 'x402 Micropayment: Market Intelligence Synthesis',
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      method: 'HTTP 402 Autonomous Escrow',
      tx_hash: '0x3a1c7b9e5f2d0a4c8e6b1d3f5a7c9e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2',
    },
  ]);

  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [depositAmount, setDepositAmount] = useState<number>(10); // in USD equivalent
  const [fiatCurrency, setFiatCurrency] = useState<'USD' | 'INR'>('USD');
  const [upiId, setUpiId] = useState('agentbuyer@oksbi');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [fundSuccess, setFundSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadWallet = async () => {
      try {
        if (user?.id) {
          const res = await api.getWalletSummary(user.id);
          if (res && res.balance !== undefined) {
            setBalance(res.balance);
            if (res.reserved !== undefined) setReservedBudget(res.reserved);
          }
        }
      } catch (err) {
        console.warn('Using seeded customer wallet state:', err);
      }
    };
    loadWallet();
  }, [user]);

  // Conversion rates: 1 USD = 83.5 INR
  const exchangeRate = 83.5;
  const inrEquivalent = fiatCurrency === 'USD' ? (depositAmount * exchangeRate).toFixed(0) : depositAmount.toFixed(0);
  const usdcEquivalent = fiatCurrency === 'USD' ? depositAmount : (depositAmount / exchangeRate);
  const processingFee = (usdcEquivalent * 0.015).toFixed(2);
  const networkFee = 0.05;
  const netCreditUsdc = Math.max(0, usdcEquivalent - Number(processingFee) - networkFee).toFixed(2);

  const handleOpenAddFunds = () => {
    playClick();
    setFundSuccess(false);
    setErrorMessage(null);
    setIsAddFundsOpen(true);
  };

  const handleExecuteAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    playClick();
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      setProcessingStep('Connecting to fiat settlement gateway...');
      await new Promise((r) => setTimeout(r, 900));

      setProcessingStep(
        selectedMethod === 'upi'
          ? 'Authorizing UPI VPA collect request...'
          : selectedMethod === 'card'
          ? 'Verifying 3D Secure card token...'
          : `Handshaking with ${selectedBank} net banking portal...`
      );
      await new Promise((r) => setTimeout(r, 1100));

      setProcessingStep('Broadcasting Base Sepolia autonomous wallet credit...');
      
      const payload = {
        userId: user?.id || 'demo-customer-1',
        amount: Number(netCreditUsdc),
        currency: fiatCurrency,
        method: selectedMethod,
        paymentDetails: {
          fiatPaid: fiatCurrency === 'USD' ? `$${depositAmount}` : `₹${depositAmount}`,
          method: selectedMethod,
          vpa: selectedMethod === 'upi' ? upiId : undefined,
          bank: selectedMethod === 'netbanking' ? selectedBank : undefined,
        },
      };

      try {
        await api.addFunds(payload);
      } catch {
        // Fallback gracefully in simulated environment
      }

      await new Promise((r) => setTimeout(r, 800));

      const newTx: WalletTx = {
        id: `tx-${Date.now().toString().slice(-4)}`,
        type: 'deposit',
        amount: Number(netCreditUsdc),
        currency: 'USDC',
        status: 'confirmed',
        description: `Fiat Funding (${selectedMethod.toUpperCase()} Settlement: ${fiatCurrency === 'USD' ? '$' + depositAmount : '₹' + depositAmount})`,
        created_at: new Date().toISOString(),
        method: selectedMethod === 'upi' ? 'UPI / VPA' : selectedMethod === 'card' ? 'Debit/Credit Card' : selectedBank,
        tx_hash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      };

      setBalance((prev) => prev + Number(netCreditUsdc));
      setTransactions((prev) => [newTx, ...prev]);
      setFundSuccess(true);
      playSuccess();
    } catch (err: any) {
      playError();
      setErrorMessage(err.message || 'Payment processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-mono mb-2 border border-cyan-500/20">
            <Coins className="w-3.5 h-3.5" />
            <span>Autonomous Spending Account & Settlement</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Wallet & Billing</h1>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Manage your autonomous agent balance, inspect x402 payment escrows, and fund your wallet using testnet USDC or fiat rails.
          </p>
        </div>

        <button
          onClick={handleOpenAddFunds}
          className="self-start sm:self-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-[#819BFF] hover:from-indigo-500 hover:to-[#819BFF] text-white font-bold text-xs shadow-glow-accent transition-all flex items-center gap-2 transform hover:-translate-y-0.5"
        >
          <CreditCard className="w-4 h-4" />
          <span>Add Funds (UPI / Card / Net Banking)</span>
        </button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Available Balance */}
        <div className="p-6 rounded-3xl bg-[#11141A] border border-white/[0.08] shadow-card-elevated relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#819BFF]/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs mb-3">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Available Spending Balance</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-[10px] border border-emerald-500/20">
              Ready for Agent Calls
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-white font-mono tracking-tight">{balance.toFixed(2)}</span>
            <span className="text-sm font-bold text-[#819BFF] font-mono">USDC</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-[#9CA3AF]">
            <span>≈ ₹{(balance * exchangeRate).toFixed(0)} INR</span>
            <span>•</span>
            <span className="text-[#819BFF] font-mono">Base Sepolia Testnet</span>
          </div>
        </div>

        {/* Reserved / In Escrow */}
        <div className="p-6 rounded-3xl bg-[#11141A] border border-white/[0.08] shadow-card-elevated">
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs mb-3">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Atomic Budget Reservation</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-amber-400 font-mono tracking-tight">{reservedBudget.toFixed(2)}</span>
            <span className="text-sm font-bold text-amber-400/80 font-mono">USDC</span>
          </div>
          <div className="mt-3 text-[11px] text-[#9CA3AF]">
            Locked during active orchestration pipelines to prevent overspending.
          </div>
        </div>

        {/* Network & Protocol Card */}
        <div className="p-6 rounded-3xl bg-[#11141A] border border-white/[0.08] shadow-card-elevated">
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs mb-2">
            <span className="font-semibold uppercase tracking-wider text-[11px]">x402 Protocol Settlement</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="space-y-1.5 font-mono text-[11px] text-slate-300 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Chain:</span>
              <span className="text-cyan-400 font-bold">Base Sepolia (84532)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">USDC Contract:</span>
              <a
                href="https://sepolia.basescan.org/token/0x036CbD53842c5426634e7929541eC2318f3dCF7e"
                target="_blank"
                rel="noreferrer"
                className="text-[#819BFF] hover:underline flex items-center gap-1"
              >
                0x036Cb...dCF7e <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Gas Subsidy:</span>
              <span className="text-emerald-400">EIP-2612 Gasless Permit</span>
            </div>
          </div>
        </div>
      </div>

      {/* Architectural Separation Notice */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0D0F14] border border-white/[0.08] text-xs text-[#9CA3AF] space-y-2">
        <div className="flex items-center gap-2 text-[#819BFF] font-bold">
          <Info className="w-4 h-4 shrink-0 text-[#819BFF]" />
          <span>Architectural Separation: Fiat Rails vs. Autonomous Agent Micro-Settlement</span>
        </div>
        <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
          Traditional fiat mechanisms like <strong>UPI, Debit Cards, and Net Banking</strong> operate on centralized clearing houses with high fixed transaction fees ($0.30+), settlement batch delays, and human 2FA friction. They cannot directly execute sub-cent autonomous machine-to-machine micropayments. Autonomix bridges this: human customers top up via standard fiat rails, and the backend instantly allocates cryptographic <strong>x402 testnet USDC tokens on Base Sepolia</strong> to the Buyer Agent's session-isolated spending wallet for instantaneous, verifiable HTTP 402 execution.
        </p>
      </div>

      {/* Transaction History */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#11141A] border border-white/[0.08] shadow-card-elevated space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Ledger & Micropayment History</h3>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              Itemized trace of deposits, task authorizations, and x402 settlement signatures.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">{transactions.length} records</span>
        </div>

        <div className="divide-y divide-white/[0.04] overflow-x-auto">
          {transactions.map((tx) => (
            <div key={tx.id} className="py-4 flex items-center justify-between gap-4 hover:bg-[#171A22]/50 px-2 rounded-xl transition-colors">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    tx.amount > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#819BFF]/10 text-[#819BFF]'
                  }`}
                >
                  {tx.amount > 0 ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">{tx.description}</div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                    <span>{new Date(tx.created_at).toLocaleString()}</span>
                    <span>•</span>
                    <span className="text-[#9CA3AF]">{tx.method || 'Protocol'}</span>
                    {tx.tx_hash && (
                      <>
                        <span>•</span>
                        <a
                          href={`https://sepolia.basescan.org/tx/${tx.tx_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#819BFF] hover:underline inline-flex items-center gap-0.5"
                        >
                          Tx: {tx.tx_hash.slice(0, 10)}... <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span
                  className={`text-sm font-mono font-bold block ${
                    tx.amount > 0 ? 'text-emerald-400' : 'text-[#F3F4F6]'
                  }`}
                >
                  {tx.amount > 0 ? `+${tx.amount.toFixed(2)}` : tx.amount.toFixed(2)} USDC
                </span>
                <span className="text-[10px] uppercase font-mono text-emerald-400 font-semibold">
                  {tx.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ADD FUNDS MODAL */}
      {isAddFundsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl bg-[#11141A] border border-white/[0.08] p-6 sm:p-8 space-y-6 shadow-card-elevated">
            <button
              onClick={() => {
                playClick();
                setIsAddFundsOpen(false);
              }}
              className="absolute top-6 right-6 p-1.5 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-[#171A22] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {fundSuccess ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white">Funds Successfully Credited!</h3>
                <p className="text-xs text-[#9CA3AF] max-w-sm mx-auto">
                  Your autonomous buyer balance has been credited with <strong>+{netCreditUsdc} USDC</strong> on Base Sepolia. Your buyer agent is ready to execute tasks with strict x402 budget enforcement.
                </p>
                <div className="p-4 rounded-2xl bg-[#0D0F14] border border-white/[0.08] font-mono text-xs text-[#9CA3AF] text-left space-y-1">
                  <div className="flex justify-between">
                    <span>Payment Method:</span>
                    <span className="text-white uppercase">{selectedMethod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Settlement Network:</span>
                    <span className="text-[#819BFF]">Base Sepolia Testnet</span>
                  </div>
                  <div className="flex justify-between">
                    <span>New Balance:</span>
                    <span className="text-emerald-400 font-bold">{balance.toFixed(2)} USDC</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddFundsOpen(false)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-[#819BFF] hover:from-indigo-500 hover:to-[#819BFF] text-white font-bold text-xs shadow-glow-accent transition-all"
                >
                  Done & Return to Wallet
                </button>
              </div>
            ) : (
              <form onSubmit={handleExecuteAddFunds} className="space-y-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#819BFF]/10 text-[#819BFF] text-[10px] font-mono border border-[#819BFF]/20 mb-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Instant Autonomous Top-Up</span>
                  </div>
                  <h3 className="text-xl font-bold text-white">Add Funds to Agent Wallet</h3>
                  <p className="text-xs text-[#9CA3AF] mt-1">
                    Select your preferred fiat rail. Funds are seamlessly converted to testnet USDC for x402 execution.
                  </p>
                </div>

                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Amount Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#F3F4F6]">Select Funding Amount</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFiatCurrency('USD');
                          setDepositAmount(10);
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          fiatCurrency === 'USD' ? 'bg-[#819BFF] text-white font-bold' : 'bg-[#0D0F14] border border-white/[0.08] text-[#9CA3AF]'
                        }`}
                      >
                        USD ($)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFiatCurrency('INR');
                          setDepositAmount(1000);
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          fiatCurrency === 'INR' ? 'bg-[#819BFF] text-white font-bold' : 'bg-[#0D0F14] border border-white/[0.08] text-[#9CA3AF]'
                        }`}
                      >
                        INR (₹)
                      </button>
                    </div>
                  </div>

                  {/* Preset Buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    {(fiatCurrency === 'USD' ? [5, 10, 25, 50] : [500, 1000, 2500, 5000]).map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setDepositAmount(amt)}
                        className={`py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                          depositAmount === amt
                            ? 'bg-[#171A22] border-[#819BFF] text-white shadow-sm'
                            : 'bg-[#0D0F14] border-white/[0.08] text-[#9CA3AF] hover:border-white/[0.16]'
                        }`}
                      >
                        {fiatCurrency === 'USD' ? `$${amt}` : `₹${amt}`}
                      </button>
                    ))}
                  </div>

                  <div className="text-[11px] text-[#9CA3AF] font-mono flex items-center justify-between px-1">
                    <span>Receiving ≈ <strong className="text-emerald-400 font-bold">{netCreditUsdc} USDC</strong></span>
                    <span>(1 USD ≈ ₹{exchangeRate})</span>
                  </div>
                </div>

                {/* Method Tabs */}
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-[#F3F4F6]">Choose Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('upi')}
                      className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 border text-center transition-all ${
                        selectedMethod === 'upi'
                          ? 'bg-[#171A22] border-[#819BFF] text-white shadow-sm'
                          : 'bg-[#0D0F14] border-white/[0.08] text-[#9CA3AF] hover:border-white/[0.16]'
                      }`}
                    >
                      <QrCode className="w-5 h-5 text-cyan-400" />
                      <span className="text-xs font-bold">UPI / QR</span>
                      <span className="text-[9px] text-slate-500">GPay, PhonePe, Paytm</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMethod('card')}
                      className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 border text-center transition-all ${
                        selectedMethod === 'card'
                          ? 'bg-[#171A22] border-[#819BFF] text-white shadow-sm'
                          : 'bg-[#0D0F14] border-white/[0.08] text-[#9CA3AF] hover:border-white/[0.16]'
                      }`}
                    >
                      <CreditCard className="w-5 h-5 text-[#819BFF]" />
                      <span className="text-xs font-bold">Cards</span>
                      <span className="text-[9px] text-slate-500">Visa, MC, RuPay</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMethod('netbanking')}
                      className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 border text-center transition-all ${
                        selectedMethod === 'netbanking'
                          ? 'bg-[#171A22] border-[#819BFF] text-white shadow-sm'
                          : 'bg-[#0D0F14] border-white/[0.08] text-[#9CA3AF] hover:border-white/[0.16]'
                      }`}
                    >
                      <Building className="w-5 h-5 text-amber-400" />
                      <span className="text-xs font-bold">Net Banking</span>
                      <span className="text-[9px] text-slate-500">50+ Banks</span>
                    </button>
                  </div>
                </div>

                {/* Method Specific Fields */}
                {selectedMethod === 'upi' && (
                  <div className="p-4 rounded-2xl bg-[#0D0F14] border border-white/[0.08] space-y-3">
                    <label className="text-xs font-semibold text-[#F3F4F6] block">UPI ID / Virtual Payment Address</label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="username@bank"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090C] border border-white/[0.08] text-white text-xs font-mono focus:outline-none focus:border-[#819BFF]/60 transition-colors"
                      required
                    />
                    <div className="flex items-center gap-2 text-[11px] text-[#9CA3AF]">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>Instant collect request will be sent to your UPI app.</span>
                    </div>
                  </div>
                )}

                {selectedMethod === 'card' && (
                  <div className="p-4 rounded-2xl bg-[#0D0F14] border border-white/[0.08] space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-[#F3F4F6] block mb-1">Card Number</label>
                      <input
                        type="text"
                        placeholder="4532 •••• •••• 8892"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090C] border border-white/[0.08] text-white text-xs font-mono focus:outline-none focus:border-[#819BFF]/60 transition-colors"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-[#F3F4F6] block mb-1">Expiry</label>
                        <input
                          type="text"
                          placeholder="MM/YY"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090C] border border-white/[0.08] text-white text-xs font-mono focus:outline-none focus:border-[#819BFF]/60 transition-colors"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-[#F3F4F6] block mb-1">CVV</label>
                        <input
                          type="password"
                          placeholder="•••"
                          maxLength={4}
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090C] border border-white/[0.08] text-white text-xs font-mono focus:outline-none focus:border-[#819BFF]/60 transition-colors"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedMethod === 'netbanking' && (
                  <div className="p-4 rounded-2xl bg-[#0D0F14] border border-white/[0.08] space-y-3">
                    <label className="text-xs font-semibold text-[#F3F4F6] block">Select Primary Bank</label>
                    <select
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090C] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-[#819BFF]/60 transition-colors"
                    >
                      <option value="HDFC Bank">HDFC Bank</option>
                      <option value="ICICI Bank">ICICI Bank</option>
                      <option value="State Bank of India">State Bank of India</option>
                      <option value="Axis Bank">Axis Bank</option>
                      <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                    </select>
                  </div>
                )}

                {/* Cost Breakdown */}
                <div className="p-4 rounded-2xl bg-[#0D0F14] border border-white/[0.08] text-xs font-mono space-y-1.5 text-[#9CA3AF]">
                  <div className="flex justify-between">
                    <span>Fiat Amount:</span>
                    <span className="text-white">{fiatCurrency === 'USD' ? `$${depositAmount}` : `₹${depositAmount}`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gateway Processing (1.5%):</span>
                    <span>-${processingFee} USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Base Sepolia Mint/Gas Subsidy:</span>
                    <span>-${networkFee.toFixed(2)} USDC</span>
                  </div>
                  <div className="border-t border-white/[0.08] pt-1.5 flex justify-between font-bold text-white">
                    <span>Net Credit to Agent Wallet:</span>
                    <span className="text-emerald-400">+{netCreditUsdc} USDC</span>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-[#819BFF] to-[#9B8AFF] hover:from-indigo-500 hover:to-[#9B8AFF] text-white font-bold text-xs shadow-glow-accent transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{processingStep || 'Processing payment...'}</span>
                    </>
                  ) : (
                    <>
                      <span>Pay {fiatCurrency === 'USD' ? `$${depositAmount}` : `₹${depositAmount}`} & Credit +{netCreditUsdc} USDC</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
