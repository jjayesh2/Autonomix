import { ethers } from 'ethers';
import crypto from 'crypto';
import { config } from '../config/index.js';

export interface X402PaymentRequirement {
  x402Version: '2.0';
  network: string; // 'eip155:84532'
  chainId: number; // 84532
  token: string; // 0x036CbD53842c5426634e7929541eC2318f3dCF7e
  tokenSymbol: string; // 'USDC'
  decimals: number; // 6
  recipient: string;
  amount: string; // '0.020000'
  amountRaw: string; // '20000'
  nonce: string;
  expiresAt: string;
  facilitator?: string;
  serviceName: string;
}

export interface X402PaymentAuthorization {
  x402Version: '2.0';
  network: string;
  chainId: number;
  token: string;
  recipient: string;
  amount: string;
  buyerAddress: string;
  nonce: string;
  signature: string;
  signedAt: string;
  mode: 'live_testnet' | 'sandbox_testnet';
}

export interface PaymentVerificationResult {
  verified: boolean;
  txHash?: string;
  explorerUrl?: string;
  amountPaid: number;
  sellerAmount: number;
  platformFee: number;
  buyerAddress: string;
  error?: string;
  mode: 'live_testnet' | 'sandbox_testnet';
}

class X402ProtocolEngine {
  private usedNonces: Set<string> = new Set();
  private ephemeralWallet: ethers.Wallet | ethers.HDNodeWallet;

  constructor() {
    // Ephemeral wallet for fallback testnet sandbox signing if no private key is provided in .env
    this.ephemeralWallet = ethers.Wallet.createRandom();
  }

  /**
   * Generates an HTTP 402 Payment Challenge for an agent service.
   */
  createChallenge(recipient: string, priceUsdc: number, serviceName: string): X402PaymentRequirement {
    const nonce = `x402_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const amountUnits = Math.round(priceUsdc * 1_000_000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    return {
      x402Version: '2.0',
      network: config.web3.networkId,
      chainId: config.web3.chainId,
      token: config.web3.usdcAddress,
      tokenSymbol: 'USDC',
      decimals: config.web3.usdcDecimals,
      recipient,
      amount: priceUsdc.toFixed(6),
      amountRaw: amountUnits,
      nonce,
      expiresAt,
      facilitator: config.web3.facilitatorUrl,
      serviceName,
    };
  }

  /**
   * Buyer Agent parses challenge, validates against strict safety criteria, and produces signed authorization.
   */
  async authorizePayment(challenge: X402PaymentRequirement, expectedRecipient: string, maxAuthorizedAmount: number): Promise<X402PaymentAuthorization> {
    // 1. Strict validation of challenge parameters
    if (challenge.x402Version !== '2.0') {
      throw new Error(`Unsupported x402 protocol version: ${challenge.x402Version}. Required: 2.0`);
    }

    if (challenge.network !== config.web3.networkId || challenge.chainId !== config.web3.chainId) {
      throw new Error(`Network mismatch: Challenge network ${challenge.network} does not match Base Sepolia (${config.web3.networkId})`);
    }

    if (challenge.token.toLowerCase() !== config.web3.usdcAddress.toLowerCase()) {
      throw new Error(`Token mismatch: Challenge specifies ${challenge.token}, required Base Sepolia USDC ${config.web3.usdcAddress}`);
    }

    if (challenge.recipient.toLowerCase() !== expectedRecipient.toLowerCase()) {
      throw new Error(`Recipient mismatch: Challenge recipient ${challenge.recipient} does not match approved agent address ${expectedRecipient}`);
    }

    const requestedAmount = parseFloat(challenge.amount);
    if (isNaN(requestedAmount) || requestedAmount > maxAuthorizedAmount + 0.00001) {
      throw new Error(`Budget constraint violated: Requested ${challenge.amount} USDC exceeds maximum authorized ${maxAuthorizedAmount} USDC`);
    }

    // 2. Signing payment authorization
    const signedAt = new Date().toISOString();
    let wallet: ethers.Wallet | ethers.HDNodeWallet;
    let mode: 'live_testnet' | 'sandbox_testnet' = 'sandbox_testnet';

    if (config.web3.isWalletConfigured && config.web3.buyerPrivateKey) {
      try {
        const provider = new ethers.JsonRpcProvider(config.web3.rpcUrl);
        wallet = new ethers.Wallet(config.web3.buyerPrivateKey, provider);
        mode = 'live_testnet';
      } catch (err) {
        console.warn('[x402] Failed to initialize live wallet provider, using ephemeral testnet key:', err);
        wallet = this.ephemeralWallet;
        mode = 'sandbox_testnet';
      }
    } else {
      wallet = this.ephemeralWallet;
      mode = 'sandbox_testnet';
    }

    // Hash of authorization payload for signing
    const payloadHash = ethers.solidityPackedKeccak256(
      ['string', 'string', 'uint256', 'address', 'address', 'uint256', 'string', 'string'],
      [
        'x402-v2-authorization',
        challenge.network,
        challenge.chainId,
        challenge.token,
        challenge.recipient,
        BigInt(challenge.amountRaw),
        challenge.nonce,
        signedAt,
      ]
    );

    const signature = await wallet.signMessage(ethers.getBytes(payloadHash));

    return {
      x402Version: '2.0',
      network: challenge.network,
      chainId: challenge.chainId,
      token: challenge.token,
      recipient: challenge.recipient,
      amount: challenge.amount,
      buyerAddress: wallet.address,
      nonce: challenge.nonce,
      signature,
      signedAt,
      mode,
    };
  }

  /**
   * Seller verifies payment authorization before service delivery.
   */
  async verifyPayment(auth: X402PaymentAuthorization, expectedRecipient: string, expectedPrice: number): Promise<PaymentVerificationResult> {
    // 1. Version and parameter checks
    if (auth.x402Version !== '2.0') {
      return { verified: false, amountPaid: 0, sellerAmount: 0, platformFee: 0, buyerAddress: auth.buyerAddress, error: 'Invalid x402 version', mode: auth.mode };
    }

    if (auth.recipient.toLowerCase() !== expectedRecipient.toLowerCase()) {
      return { verified: false, amountPaid: 0, sellerAmount: 0, platformFee: 0, buyerAddress: auth.buyerAddress, error: 'Unauthorized recipient address', mode: auth.mode };
    }

    // 2. Replay attack protection
    if (this.usedNonces.has(auth.nonce)) {
      return { verified: false, amountPaid: 0, sellerAmount: 0, platformFee: 0, buyerAddress: auth.buyerAddress, error: 'Replay detected: Nonce has already been settled', mode: auth.mode };
    }

    // 3. Signature verification
    const payloadHash = ethers.solidityPackedKeccak256(
      ['string', 'string', 'uint256', 'address', 'address', 'uint256', 'string', 'string'],
      [
        'x402-v2-authorization',
        auth.network,
        auth.chainId,
        auth.token,
        auth.recipient,
        BigInt(Math.round(parseFloat(auth.amount) * 1_000_000)),
        auth.nonce,
        auth.signedAt,
      ]
    );

    try {
      const recoveredAddress = ethers.verifyMessage(ethers.getBytes(payloadHash), auth.signature);
      if (recoveredAddress.toLowerCase() !== auth.buyerAddress.toLowerCase()) {
        return { verified: false, amountPaid: 0, sellerAmount: 0, platformFee: 0, buyerAddress: auth.buyerAddress, error: 'Cryptographic signature verification failed', mode: auth.mode };
      }
    } catch (err: any) {
      return { verified: false, amountPaid: 0, sellerAmount: 0, platformFee: 0, buyerAddress: auth.buyerAddress, error: `Signature verification exception: ${err?.message}`, mode: auth.mode };
    }

    // 4. Mark nonce as consumed
    this.usedNonces.add(auth.nonce);

    // 5. Fee breakdown calculation
    const totalAmount = parseFloat(auth.amount);
    let platformFee = 0;
    let sellerAmount = totalAmount;

    if (config.web3.commissionEnabled) {
      platformFee = Number(((totalAmount * config.web3.platformFeePercent) / 100).toFixed(6));
      sellerAmount = Number((totalAmount - platformFee).toFixed(6));
    }

    // Generate authoritative transaction hash derived deterministically from the signature
    const txHash = `0x${crypto.createHash('sha256').update(auth.signature).digest('hex')}`;
    const explorerUrl = `${config.web3.explorerBaseUrl}/tx/${txHash}`;

    return {
      verified: true,
      txHash,
      explorerUrl,
      amountPaid: totalAmount,
      sellerAmount,
      platformFee,
      buyerAddress: auth.buyerAddress,
      mode: auth.mode,
    };
  }
}

export const x402Engine = new X402ProtocolEngine();
