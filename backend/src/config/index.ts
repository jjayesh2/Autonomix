import dotenv from 'dotenv';
import path from 'path';

// Load .env from workspace root or current directory
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  clientUrl: string;
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
    isConfigured: boolean;
  };
  web3: {
    chainId: number;
    networkId: string;
    rpcUrl: string;
    usdcAddress: string;
    usdcDecimals: number;
    buyerPrivateKey?: string;
    isWalletConfigured: boolean;
    platformTreasury: string;
    platformFeePercent: number;
    commissionEnabled: boolean;
    facilitatorUrl?: string;
    explorerBaseUrl: string;
  };
  ai: {
    provider: 'gemini' | 'openai' | 'deterministic';
    geminiApiKey?: string;
    openaiApiKey?: string;
  };
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const buyerKey = process.env.BUYER_WALLET_PRIVATE_KEY || '';

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  supabase: {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    serviceRoleKey: supabaseServiceKey,
    isConfigured: Boolean(
      supabaseUrl &&
        supabaseUrl.startsWith('http') &&
        !supabaseUrl.includes('your-project') &&
        supabaseServiceKey &&
        !supabaseServiceKey.includes('your_service_role_key')
    ),
  },
  web3: {
    chainId: parseInt(process.env.CHAIN_ID || '84532', 10),
    networkId: 'eip155:84532',
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    usdcAddress: process.env.USDC_CONTRACT_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    usdcDecimals: 6,
    buyerPrivateKey: buyerKey.trim() || undefined,
    isWalletConfigured: Boolean(buyerKey && buyerKey.length >= 64),
    platformTreasury: process.env.PLATFORM_TREASURY_ADDRESS || '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    platformFeePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT || '10'),
    commissionEnabled: process.env.PLATFORM_COMMISSION_ENABLED !== 'false',
    facilitatorUrl: process.env.X402_FACILITATOR_URL || 'https://facilitator.x402.org',
    explorerBaseUrl: 'https://sepolia.basescan.org',
  },
  ai: {
    provider: (process.env.AI_PROVIDER as any) || 'deterministic',
    geminiApiKey: process.env.GEMINI_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
  },
};
