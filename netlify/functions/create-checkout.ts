import { Handler } from '@netlify/functions';
import Stripe from 'stripe';

// Stripeの初期化
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-10-16' as any,
});

export const handler: Handler = async (event) => {
  // POSTメソッド以外は弾く
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email, referralId } = JSON.parse(event.body || '{}');

    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) };
    }

    // Checkoutセッションの作成
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.VITE_STRIPE_PRICE_ID, // .envに設定した価格ID
          quantity: 1,
        },
      ],
      mode: 'subscription',
      // ローカル開発環境とNetlify本番環境の両方に対応するURL設定
      success_url: `${process.env.URL || 'http://localhost:8888'}/?payment=success`,
      cancel_url: `${process.env.URL || 'http://localhost:8888'}/?payment=cancel`,
      customer_email: email,
      client_reference_id: referralId, // アフィリエイト連携（将来拡張用）
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error: any) {
    console.error('Checkout error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};