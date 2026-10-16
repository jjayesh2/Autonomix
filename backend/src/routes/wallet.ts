import { Router, Request, Response } from 'express';
import { db } from '../db/supabase.js';
import { config } from '../config/index.js';
import { v4 as uuidv4 } from 'uuid';

export const walletRouter = Router();

// In-memory store for funding orders during sandbox/development
const fundingOrders: Map<string, any[]> = new Map();

// GET /api/wallet/summary - Returns wallet summary and balance
walletRouter.get('/summary', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId ? String(req.query.userId) : 'c0000000-0000-0000-0000-000000000001';
    const profile = await db.getProfile(userId);
    const tasks = await db.getTasks(userId);
    const transactions = await db.getTransactions();

    const userTxs = transactions.filter((t) => tasks.some((task) => task.id === t.task_id));
    const totalSpent = tasks.reduce((sum, t) => sum + (t.total_cost || 0), 0);

    // Initial mock deposit balance for demonstration
    const orders = fundingOrders.get(userId) || [];
    const totalDeposited = orders
      .filter((o) => o.status === 'completed')
      .reduce((sum, o) => sum + (o.credited_usdc || 0), 0);

    const baseBalance = 5.00; // Demo faucet starting balance
    const availableBalance = Number(Math.max(0, baseBalance + totalDeposited - totalSpent).toFixed(4));

    res.json({
      walletAddress: profile?.wallet_address || '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      network: 'Base Sepolia Testnet',
      chainId: config.web3.chainId,
      tokenSymbol: 'USDC',
      tokenContract: config.web3.usdcAddress,
      availableBalanceUsdc: availableBalance,
      totalSpentUsdc: Number(totalSpent.toFixed(4)),
      totalDepositedUsdc: Number(totalDeposited.toFixed(4)),
      recentTransactions: userTxs.slice(0, 5),
      fundingOrders: orders.slice(0, 5),
      faucetUrl: 'https://faucet.circle.com/',
      basescanUrl: config.web3.explorerBaseUrl,
      paymentArchitectureNote: 'Service payments are settled in Base Sepolia testnet USDC via x402 v2. Fiat payment rails (UPI, Card, Net Banking) simulate checkout and require a payment gateway (e.g. Razorpay / Stripe) in production.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/wallet/add-funds - Create and process a funding order
walletRouter.post('/add-funds', async (req: Request, res: Response) => {
  try {
    const { userId, amount, currency, method, paymentDetails } = req.body;
    if (!userId || !amount || amount <= 0) {
      res.status(400).json({ error: 'Valid userId and amount are required' });
      return;
    }

    if (!['upi', 'card', 'netbanking', 'faucet'].includes(method)) {
      res.status(400).json({ error: 'Unsupported payment method' });
      return;
    }

    // Convert INR to estimated USDC (approx 1 USD = 86 INR) or direct 1:1 if USD
    const numericAmount = parseFloat(amount);
    let creditedUsdc = numericAmount;
    let fee = 0;

    if (currency === 'INR') {
      creditedUsdc = Number((numericAmount / 86).toFixed(4));
      fee = Number((numericAmount * 0.02).toFixed(2)); // 2% gateway processing fee
    } else {
      fee = Number((numericAmount * 0.015).toFixed(2));
    }

    const orderId = `fund_${Date.now()}_${uuidv4().slice(0, 6)}`;
    const gatewayRef = `gate_${method.toUpperCase()}_${Date.now().toString(36)}`;

    const order = {
      id: orderId,
      user_id: userId,
      amount: numericAmount,
      currency: currency || 'USD',
      method,
      payment_details: paymentDetails || {},
      status: 'completed', // Auto-completed in demo sandbox mode
      fee,
      gateway_reference: gatewayRef,
      credited_usdc: creditedUsdc,
      created_at: new Date().toISOString(),
    };

    const userOrders = fundingOrders.get(userId) || [];
    userOrders.unshift(order);
    fundingOrders.set(userId, userOrders);

    await db.createFundingOrder(order);

    res.status(201).json({
      success: true,
      order,
      message: `Successfully processed ${method.toUpperCase()} funding order for ${numericAmount} ${currency}. Credited ${creditedUsdc} USDC to task balance.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
