import { MongoClient, ObjectId } from 'mongodb';
import connectDB from '../db.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import WalletTransaction from '../models/WalletTransaction.js';

const COMMISSION_LEVELS = {
    1: 0.10, 2: 0.08, 3: 0.06, 4: 0.05, 5: 0.04,
    ...Object.fromEntries(Array.from({ length: 5 }, (_, i) => [6 + i, 0.03])),
    ...Object.fromEntries(Array.from({ length: 20 }, (_, i) => [11 + i, 0.01])),
    ...Object.fromEntries(Array.from({ length: 30 }, (_, i) => [31 + i, 0.005])),
    ...Object.fromEntries(Array.from({ length: 40 }, (_, i) => [61 + i, 0.002])),
};

const MIN_COMMISSION_PAYOUT = 0.10;
const COMPANY_MARGIN_SHARE = 0.50;

const CommissionService = {
  async distribute(order) {
    const db = await connectDB();
    const client = db.client;
    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        const buyer = await User.findById(order.user);
        if (!buyer) throw new Error('Buyer not found');

        let totalMargin = 0;
        for (const item of order.items) {
          const productCost = item.cost || (item.price * 0.8); // Assume 80% cost if not specified
          totalMargin += (item.price * item.quantity) - (productCost * item.quantity);
        }

        if (totalMargin <= 0) {
          console.log(`Order ${order.orderNumber} has no positive margin. No commissions distributed.`);
          return;
        }

        const companyTake = totalMargin * COMPANY_MARGIN_SHARE;
        const remainingMarginPool = totalMargin - companyTake;
        const buyerCashback = remainingMarginPool * 0.5;
        const mlmCommissionPool = remainingMarginPool * 0.5;

        // 1. Credit buyer's cashback
        if (buyerCashback > 0) {
          const cashbackToBuyer = buyerCashback;
          await User.updateWalletBalance(buyer._id, cashbackToBuyer, session);
          const cashbackTransaction = {
            userId: buyer._id,
            amount: cashbackToBuyer,
            type: 'cashback',
            description: `Cashback for order ${order.orderNumber}`,
            status: 'completed',
            relatedOrderId: order._id
          };
          await WalletTransaction.create(db, cashbackTransaction, session);

          // Create notification for cashback
          await Notification.create({
            userId: buyer._id,
            userName: buyer.name,
            type: 'cashback',
            message: `Cashback of ₹${buyerCashback.toFixed(2)} for order ${order.orderNumber}`,
            relatedData: {
              orderNumber: order.orderNumber,
              amount: buyerCashback,
              companyProfit: totalMargin, 
              companyShare: companyTake, 
            }
          });
        }

        // 2. Distribute MLM commissions
        if (mlmCommissionPool > 0 && buyer.upline && buyer.upline.length > 0) {
          for (let i = 0; i < buyer.upline.length; i++) {
            const level = i + 1;
            const uplineUserId = buyer.upline[i];
            const commissionRate = COMMISSION_LEVELS[level];

            if (!commissionRate) continue;

            const commissionAmount = mlmCommissionPool * commissionRate;

            if (commissionAmount >= MIN_COMMISSION_PAYOUT) {
              await User.updateWalletBalance(uplineUserId, commissionAmount, session);
              const commissionTransaction = {
                userId: uplineUserId,
                amount: commissionAmount,
                type: 'mlm_commission',
                description: `Level ${level} commission from order ${order.orderNumber}`,
                status: 'completed',
                relatedOrderId: order._id,
                relatedUserId: buyer._id
              };
              await WalletTransaction.create(db, commissionTransaction, session);

              // Create notification for commission
              const uplineUser = await User.findById(uplineUserId);
              if(uplineUser) {
                await Notification.create({
                  userId: uplineUser._id,
                  userName: uplineUser.name,
                  type: 'commission',
                  message: `Lvl ${level} commission of ₹${commissionAmount.toFixed(2)} from ${buyer.name}`,
                  relatedData: {
                    orderNumber: order.orderNumber,
                    commissionAmount: commissionAmount,
                    fromUser: buyer.name,
                    level: level,
                    companyProfit: totalMargin,
                    companyShare: companyTake
                  }
                });
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Commission distribution failed:', error);
      // The transaction will be aborted automatically on error
      throw new Error('Failed to distribute commissions.');
    } finally {
      await session.endSession();
    }
  }
};

export default CommissionService;
