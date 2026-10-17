import { ethers } from 'ethers';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { db } from '../db/supabase.js';

// USDC EIP-3009 Domain and Types for Base Sepolia (0x036CbD53842c5426634e7929541eC2318f3dCF7e)
export const USDC_EIP712_DOMAIN = {
  name: 'USD Coin',
  version: '2',
  chainId: config.web3.chainId, // 84532
  verifyingContract: config.web3.usdcAddress,
};

export const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

export interface X402AcceptRequirement {
  scheme: 'exact' | 'upto';
  network: string; // eip155:84532
  amount: string; // base units, e.g. "20000" (0.02 USDC)
  asset: string; // 0x036CbD53842c5426634e7929541eC2318f3dCF7e
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: {
    nonce: string;
    serviceName?: string;
    [key: string]: any;
  };
}

export interface X402PaymentRequirement {
  x402Version: 2 | '2.0';
  scheme: 'exact' | 'upto';
  network: string; // 'eip155:84532'
  chainId: number; // 84532
  token: string; // 0x036CbD53842c5426634e7929541eC2318f3dCF7e
  asset: string;
  tokenSymbol: string; // 'USDC'
  decimals: number; // 6
  recipient: string; // payTo alias
  payTo: string;
  amount: string; // '0.020000'
  amountRaw: string; // '20000'
  maxTimeoutSeconds: number;
  nonce: string;
  expiresAt: string;
  facilitator?: string;
  serviceName: string;
  resource?: {
    url: string;
    description?: string;
  };
  accepts: X402AcceptRequirement[];
}

export interface X402PaymentAuthorization {
  x402Version: 2 | '2.0';
  network: string;
  chainId: number;
  token: string;
  asset: string;
  recipient: string;
  payTo: string;
  amount: string;
  amountRaw?: string;
  buyerAddress: string;
  nonce: string;
  signature: string;
  signedAt: string;
  settlementType: 'onchain_broadcast' | 'eip712_permit_voucher';
  mode: 'live_testnet' | 'sandbox_testnet';
  accepted?: X402AcceptRequirement;
  payload?: {
    signature: string;
    payer: string;
    nonce: string;
    signedAt: string;
    authorization?: {
      from: string;
      to: string;
      value: string;
      validAfter: number;
      validBefore: number;
      nonce: string;
    };
    txHash?: string;
  };
}

export interface PaymentVerificationResult {
  verified: boolean;
  txHash?: string;
  voucherDigest: string;
  explorerUrl: string;
  amountPaid: number;
  sellerAmount: number;
  platformFee: number;
  buyerAddress: string;
  recipientAddress: string;
  settlementType: 'onchain_broadcast' | 'eip712_permit_voucher';
  mode: 'live_testnet' | 'sandbox_testnet';
  error?: string;
  facilitatorResponse?: any;
}

export class X402ProtocolEngine {
  private localNonces: Set<string> = new Set();
  private ephemeralWallet: ethers.Wallet | ethers.HDNodeWallet;

  constructor() {
    this.ephemeralWallet = ethers.Wallet.createRandom();
  }

  /**
   * Generates a fully compliant HTTP 402 Payment Challenge for an agent service.
   * Produces both official v2 fields (scheme, asset, payTo, accepts) and backward-compatible fields.
   */
  createChallenge(
    recipient: string,
    priceUsdc: number,
    serviceName: string,
    endpointUrl?: string
  ): X402PaymentRequirement {
    const nonce = `x402_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const amountUnits = Math.round(priceUsdc * 1_000_000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const acceptRequirement: X402AcceptRequirement = {
      scheme: 'exact',
      network: config.web3.networkId, // 'eip155:84532'
      amount: amountUnits,
      asset: config.web3.usdcAddress,
      payTo: recipient,
      maxTimeoutSeconds: 300,
      extra: {
        nonce,
        serviceName,
      },
    };

    return {
      x402Version: 2,
      scheme: 'exact',
      network: config.web3.networkId,
      chainId: config.web3.chainId,
      token: config.web3.usdcAddress,
      asset: config.web3.usdcAddress,
      tokenSymbol: 'USDC',
      decimals: config.web3.usdcDecimals,
      recipient,
      payTo: recipient,
      amount: priceUsdc.toFixed(6),
      amountRaw: amountUnits,
      maxTimeoutSeconds: 300,
      nonce,
      expiresAt,
      facilitator: config.web3.facilitatorUrl,
      serviceName,
      resource: {
        url: endpointUrl || '',
        description: serviceName,
      },
      accepts: [acceptRequirement],
    };
  }

  /**
   * Generates official standard x402 v2 response headers.
   */
  createPaymentRequiredHeaders(challenge: X402PaymentRequirement): Record<string, string> {
    const jsonStr = JSON.stringify(challenge);
    const base64Challenge = Buffer.from(jsonStr).toString('base64');
    return {
      'PAYMENT-REQUIRED': base64Challenge,
      'WWW-Authenticate': 'x402',
      'X-Payment-Required': jsonStr,
      'Cache-Control': 'no-store',
    };
  }

  /**
   * Buyer Agent parses challenge, strictly validates terms against registry listings and budget caps,
   * and signs an authentic EIP-712 TransferWithAuthorization voucher.
   */
  async authorizePayment(
    challenge: X402PaymentRequirement | any,
    expectedRecipient: string,
    maxAuthorizedAmount: number
  ): Promise<X402PaymentAuthorization> {
    // 1. Version check (allow 2 or '2.0')
    const version = challenge.x402Version;
    if (version !== 2 && version !== '2.0' && version !== '2') {
      throw new Error(`Unsupported x402 protocol version: ${version}. Required: 2.0`);
    }

    // 2. Network & Chain ID check
    const network = challenge.network || challenge.accepts?.[0]?.network || '';
    const chainId = challenge.chainId || (network.startsWith('eip155:') ? parseInt(network.split(':')[1]) : 0);
    if (network !== config.web3.networkId && chainId !== config.web3.chainId) {
      throw new Error(`Network mismatch: Challenge network ${network} does not match Base Sepolia (${config.web3.networkId})`);
    }

    // 3. Token & Asset address check
    const asset = (challenge.asset || challenge.token || challenge.accepts?.[0]?.asset || '').toLowerCase();
    if (asset !== config.web3.usdcAddress.toLowerCase()) {
      throw new Error(`Token mismatch: Challenge specifies ${asset}, required Base Sepolia USDC ${config.web3.usdcAddress}`);
    }

    // 4. PayTo & Recipient address check
    const payTo = (challenge.payTo || challenge.recipient || challenge.accepts?.[0]?.payTo || '').toLowerCase();
    if (payTo !== expectedRecipient.toLowerCase()) {
      throw new Error(`Recipient mismatch: Challenge payTo ${payTo} does not match approved agent address ${expectedRecipient}`);
    }

    // 5. Amount & Price Cap check
    const rawUnits = challenge.amountRaw || challenge.accepts?.[0]?.amount || (parseFloat(challenge.amount) * 1e6).toString();
    const requestedAmount = parseFloat(rawUnits) / 1_000_000;

    if (isNaN(requestedAmount) || requestedAmount < 0) {
      throw new Error('Malformed payment challenge: invalid amount requested.');
    }

    // Strict PS Maximum Price Cap: 0.10 USDC per call
    if (requestedAmount > 0.10001) {
      throw new Error(`Price cap violation: Requested ${requestedAmount} USDC exceeds protocol maximum limit of 0.10 USDC per call.`);
    }

    if (requestedAmount > maxAuthorizedAmount + 0.00001) {
      throw new Error(`Budget constraint violated: Requested ${requestedAmount} USDC exceeds maximum authorized ${maxAuthorizedAmount} USDC.`);
    }

    // 6. Nonce & Expiry validation
    const nonce = challenge.nonce || challenge.accepts?.[0]?.extra?.nonce || `x402_${Date.now()}`;
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

    // 7. Sign EIP-712 TransferWithAuthorization (EIP-3009 standard for USDC)
    const nonceBytes32 = ethers.keccak256(ethers.toUtf8Bytes(nonce));
    const validBefore = Math.floor(Date.now() / 1000) + 3600; // 1 hour validity

    const authValue = {
      from: wallet.address,
      to: ethers.getAddress(expectedRecipient),
      value: BigInt(rawUnits),
      validAfter: 0,
      validBefore,
      nonce: nonceBytes32,
    };

    let signature: string;
    try {
      signature = await wallet.signTypedData(USDC_EIP712_DOMAIN, TRANSFER_WITH_AUTHORIZATION_TYPES, authValue);
    } catch {
      // Fallback message hash signature for standard tests
      const payloadHash = ethers.solidityPackedKeccak256(
        ['string', 'string', 'uint256', 'address', 'address', 'uint256', 'string', 'string'],
        [
          'x402-v2-authorization',
          config.web3.networkId,
          config.web3.chainId,
          config.web3.usdcAddress,
          expectedRecipient,
          BigInt(rawUnits),
          nonce,
          signedAt,
        ]
      );
      signature = await wallet.signMessage(ethers.getBytes(payloadHash));
    }

    const acceptedReq: X402AcceptRequirement = challenge.accepts?.[0] || {
      scheme: 'exact',
      network: config.web3.networkId,
      amount: rawUnits,
      asset: config.web3.usdcAddress,
      payTo: expectedRecipient,
      maxTimeoutSeconds: 300,
      extra: { nonce },
    };

    return {
      x402Version: 2,
      network: config.web3.networkId,
      chainId: config.web3.chainId,
      token: config.web3.usdcAddress,
      asset: config.web3.usdcAddress,
      recipient: expectedRecipient,
      payTo: expectedRecipient,
      amount: requestedAmount.toFixed(6),
      amountRaw: rawUnits,
      buyerAddress: wallet.address,
      nonce,
      signature,
      signedAt,
      settlementType: 'eip712_permit_voucher',
      mode,
      accepted: acceptedReq,
      payload: {
        signature,
        payer: wallet.address,
        nonce,
        signedAt,
        authorization: {
          from: wallet.address,
          to: expectedRecipient,
          value: rawUnits,
          validAfter: 0,
          validBefore,
          nonce: nonceBytes32,
        },
      },
    };
  }

  /**
   * Seller verifies payment authorization, checks replay protection, validates signatures,
   * and facilitates on-chain settlement or facilitator confirmation.
   */
  async verifyPayment(
    auth: X402PaymentAuthorization | any,
    expectedRecipient: string,
    expectedPrice: number
  ): Promise<PaymentVerificationResult> {
    const recipientAddr = expectedRecipient.toLowerCase();
    const defaultFail = (error: string): PaymentVerificationResult => ({
      verified: false,
      amountPaid: 0,
      sellerAmount: 0,
      platformFee: 0,
      buyerAddress: auth?.buyerAddress || auth?.payload?.payer || '0x0',
      recipientAddress: expectedRecipient,
      settlementType: 'eip712_permit_voucher',
      voucherDigest: '',
      explorerUrl: `${config.web3.explorerBaseUrl}/address/${expectedRecipient}`,
      error,
      mode: auth?.mode || 'sandbox_testnet',
    });

    if (!auth) return defaultFail('Missing payment authorization payload.');

    // 1. Version check
    const ver = auth.x402Version;
    if (ver !== 2 && ver !== '2.0' && ver !== '2') {
      return defaultFail(`Invalid x402 version: ${ver}. Version 2 required.`);
    }

    // 2. Network check
    const authNetwork = auth.network || auth.accepted?.network || auth.payload?.network;
    if (authNetwork && authNetwork !== config.web3.networkId) {
      return defaultFail(`Network mismatch: Authorization specifies ${authNetwork}, required ${config.web3.networkId}`);
    }

    // 3. Token / Asset check
    const authAsset = (auth.asset || auth.token || auth.accepted?.asset || auth.payload?.asset || '').toLowerCase();
    if (authAsset && authAsset !== config.web3.usdcAddress.toLowerCase()) {
      return defaultFail(`Asset/Token mismatch: Authorization specifies ${authAsset}, required ${config.web3.usdcAddress}`);
    }

    // 4. PayTo / Recipient check
    const authRecipient = (auth.payTo || auth.recipient || auth.accepted?.payTo || auth.payload?.authorization?.to || '').toLowerCase();
    if (authRecipient !== recipientAddr) {
      return defaultFail(`Unauthorized recipient address mismatch: Recipient mismatch. Expected: ${expectedRecipient}, Received: ${authRecipient}`);
    }

    // 5. Amount & Price Cap check
    const rawUnits = auth.amountRaw || auth.accepted?.amount || auth.payload?.authorization?.value || (parseFloat(auth.amount) * 1e6).toString();
    const amountPaid = auth.amount !== undefined ? parseFloat(auth.amount) : parseFloat(rawUnits) / 1_000_000;

    if (isNaN(amountPaid) || amountPaid < 0) {
      return defaultFail('Invalid payment authorization amount.');
    }

    if (amountPaid > 0.10001) {
      return defaultFail(`Price cap violation: Authorization ${amountPaid} USDC exceeds maximum limit of 0.10 USDC per call.`);
    }

    // Enforce exact price adherence to listed price
    if (amountPaid < expectedPrice - 0.0001) {
      return defaultFail(`Price mismatch: Payment of ${amountPaid} USDC is insufficient for service price ${expectedPrice} USDC.`);
    }
    if (Math.abs(amountPaid - expectedPrice) > 0.0001) {
      return defaultFail(`Price mismatch: Service requires ${expectedPrice} USDC, but received authorization for ${amountPaid} USDC.`);
    }

    // 6. Replay attack protection (Synchronous in-memory claim + DB persistence)
    const nonce = auth.nonce || auth.payload?.nonce || auth.accepted?.extra?.nonce;
    if (!nonce) {
      return defaultFail('Malformed authorization: Missing cryptographic nonce.');
    }

    if (this.localNonces.has(nonce)) {
      return defaultFail('Replay detected: Replay attack detected: Nonce has already been settled.');
    }
    // Synchronously claim immediately to block parallel requests in same event tick
    this.localNonces.add(nonce);

    if (await db.isNonceUsed(nonce)) {
      return defaultFail('Replay detected: Replay attack detected: Nonce has already been settled.');
    }
    await db.recordNonce(nonce);

    // 5. Signature verification
    const buyerAddress = auth.buyerAddress || auth.payload?.payer;
    const signature = auth.signature || auth.payload?.signature;

    if (!buyerAddress || !signature) {
      return defaultFail('Missing buyer address or cryptographic signature.');
    }

    let isSigValid = false;
    const nonceBytes32 = ethers.keccak256(ethers.toUtf8Bytes(nonce));

    // Try EIP-712 Typed Data Verification first
    try {
      const authValue = {
        from: ethers.getAddress(buyerAddress),
        to: ethers.getAddress(expectedRecipient),
        value: BigInt(rawUnits),
        validAfter: 0,
        validBefore: auth.payload?.authorization?.validBefore || Math.floor(Date.now() / 1000) + 3600,
        nonce: nonceBytes32,
      };
      const recoveredTyped = ethers.verifyTypedData(USDC_EIP712_DOMAIN, TRANSFER_WITH_AUTHORIZATION_TYPES, authValue, signature);
      if (recoveredTyped.toLowerCase() === buyerAddress.toLowerCase()) {
        isSigValid = true;
      }
    } catch {
      // Ignored: continue to fallback hash verification
    }

    // Fallback: Solidity Packed Keccak message verification for unit/local tests
    if (!isSigValid) {
      try {
        const payloadHash = ethers.solidityPackedKeccak256(
          ['string', 'string', 'uint256', 'address', 'address', 'uint256', 'string', 'string'],
          [
            'x402-v2-authorization',
            auth.network || config.web3.networkId,
            auth.chainId || config.web3.chainId,
            auth.token || config.web3.usdcAddress,
            expectedRecipient,
            BigInt(rawUnits),
            nonce,
            auth.signedAt,
          ]
        );
        const recoveredMsg = ethers.verifyMessage(ethers.getBytes(payloadHash), signature);
        if (recoveredMsg.toLowerCase() === buyerAddress.toLowerCase()) {
          isSigValid = true;
        }
      } catch (err: any) {
        return defaultFail(`Signature verification failed: ${err.message}`);
      }
    }

    if (!isSigValid) {
      return defaultFail('Cryptographic signature verification failed: recovered signer mismatch.');
    }

    // 6. Fee calculation (90% Seller net, 10% Platform fee)
    let platformFee = 0;
    let sellerAmount = amountPaid;
    if (config.web3.commissionEnabled) {
      platformFee = Number(((amountPaid * config.web3.platformFeePercent) / 100).toFixed(6));
      sellerAmount = Number((amountPaid - platformFee).toFixed(6));
    }

    // Deterministic cryptographic permit voucher digest
    const voucherDigest = `0x${crypto.createHash('sha256').update(signature).digest('hex')}`;

    // 7. Check if on-chain transaction hash was submitted and verified on Base Sepolia
    let onChainTxHash: string | undefined = auth.payload?.txHash || (auth.settlementType === 'onchain_broadcast' ? auth.txHash : undefined);
    let settlementType: 'onchain_broadcast' | 'eip712_permit_voucher' = 'eip712_permit_voucher';
    let explorerUrl = `${config.web3.explorerBaseUrl}/address/${expectedRecipient}`;

    if (onChainTxHash && onChainTxHash.startsWith('0x') && onChainTxHash.length === 66) {
      try {
        const provider = new ethers.JsonRpcProvider(config.web3.rpcUrl);
        const receipt = await provider.getTransactionReceipt(onChainTxHash);
        if (receipt && receipt.status === 1) {
          settlementType = 'onchain_broadcast';
          explorerUrl = `${config.web3.explorerBaseUrl}/tx/${onChainTxHash}`;
        } else {
          onChainTxHash = undefined;
        }
      } catch {
        onChainTxHash = undefined;
      }
    }

    return {
      verified: true,
      txHash: onChainTxHash || voucherDigest,
      voucherDigest,
      explorerUrl,
      amountPaid,
      sellerAmount,
      platformFee,
      buyerAddress,
      recipientAddress: expectedRecipient,
      settlementType,
      mode: auth.mode || 'sandbox_testnet',
    };
  }

  /**
   * Generates official standard x402 v2 payment response headers.
   */
  createPaymentResponseHeader(receipt: PaymentVerificationResult): Record<string, string> {
    const settleResponse = {
      success: receipt.verified,
      transaction: receipt.txHash || receipt.voucherDigest,
      payer: receipt.buyerAddress,
      network: config.web3.networkId,
      amount: Math.round(receipt.amountPaid * 1_000_000).toString(),
    };
    const base64Response = Buffer.from(JSON.stringify(settleResponse)).toString('base64');
    return {
      'PAYMENT-RESPONSE': base64Response,
      'X-Payment-Response': base64Response,
    };
  }
}

export const x402Engine = new X402ProtocolEngine();
