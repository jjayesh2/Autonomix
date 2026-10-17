import React from 'react';
import { Shield, Coins, Network, Volume2, Cpu } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-white/[0.08] bg-[#08090C] text-[#9CA3AF] py-12 px-4 lg:px-8 mt-20">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#819BFF]" />
            <span className="font-extrabold text-[#F3F4F6] tracking-tight">AUTONOMIX</span>
          </div>
          <p className="text-xs text-[#9CA3AF] leading-relaxed">
            The autonomous pay-per-call agent economy. AI agents discovering, purchasing, and orchestrating sub-services with verifiable HTTP 402 payments and strict atomic budgets.
          </p>
        </div>

        <div>
          <h4 className="text-xs uppercase font-semibold text-[#F3F4F6] tracking-wider mb-3">Protocol Architecture</h4>
          <ul className="space-y-2 text-xs">
            <li className="flex items-center gap-2 text-[#9CA3AF]">
              <Coins className="w-3.5 h-3.5 text-[#819BFF]" />
              <span>x402 v2 Micropayments</span>
            </li>
            <li className="flex items-center gap-2 text-[#9CA3AF]">
              <Network className="w-3.5 h-3.5 text-cyan-400" />
              <span>Base Sepolia (Chain 84532)</span>
            </li>
            <li className="flex items-center gap-2 text-[#9CA3AF]">
              <Shield className="w-3.5 h-3.5 text-[#9B8AFF]" />
              <span>USDC: 0x036Cb...dCF7e</span>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs uppercase font-semibold text-[#F3F4F6] tracking-wider mb-3">Audio & Notifications</h4>
          <ul className="space-y-2 text-xs">
            <li className="flex items-center gap-2 text-[#9CA3AF]">
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Web Audio Synthetic Chimes</span>
            </li>
            <li className="text-slate-500 text-[11px]">
              Strictly non-intrusive. Zero voice, zero speech synthesis, and zero audio spam.
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs uppercase font-semibold text-[#F3F4F6] tracking-wider mb-3">Compliance & Safety</h4>
          <p className="text-xs text-slate-500 leading-relaxed mb-2">
            Protected against SSRF, cloud metadata probing, replayed nonces, and unapproved external code execution.
          </p>
          <div className="inline-block px-2.5 py-1 rounded bg-[#11141A] border border-white/[0.08] text-[11px] font-mono text-cyan-400">
            Base Sepolia Testnet
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-6 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
        <p>© 2026 Autonomix — Built for Hackathon Excellence. All rights reserved.</p>
        <p className="font-mono text-[11px]">CAIP-2: eip155:84532 | EIP-712 Typed Settlement</p>
      </div>
    </footer>
  );
};
