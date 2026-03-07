import { Handler } from '@netlify/functions';
import Stripe from 'stripe';

export const handler: Handler = async (event) => {
  // メソッドチェック
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // 環境変数の取得
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.VITE_STRIPE_PRICE_ID;

  // 環境変数の存在確認（ここでガードすることで Stripe 初期化エラーを防ぐ）
  if (!secretKey || !priceId) {
    console.error('Missing Environment Variables: STRIPE_SECRET_KEY or VITE_STRIPE_PRICE_ID');
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'Server configuration error: Missing API keys.' }) 
    };
  }

  // ハンドラー内で初期化
  const stripe = new Stripe(secretKey, {
    apiVersion: '2023-10-16' as any,
  });

  try {
    const { email } = JSON.parse(event.body || '{}');
    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) };
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.URL || 'https://donburi65.netlify.app'}/?payment=success`,
      cancel_url: `${process.env.URL || 'https://donburi65.netlify.app'}/?payment=cancel`,
      customer_email: email,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error: any) {
    console.error('Stripe Session Error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};