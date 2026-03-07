import { Handler } from '@netlify/functions';
import Stripe from 'stripe';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.VITE_STRIPE_PRICE_ID;

  if (!secretKey || !priceId) {
    console.error('Missing Environment Variables: STRIPE_SECRET_KEY or VITE_STRIPE_PRICE_ID');
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'Server configuration error: Missing API keys.' }) 
    };
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: '2023-10-16' as any,
  });

  try {
    const { email } = JSON.parse(event.body || '{}');
    
    // セッション作成のオプションを構築
    const sessionOptions: any = {
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.URL || 'https://donburi65.netlify.app'}/?payment=success`,
      cancel_url: `${process.env.URL || 'https://donburi65.netlify.app'}/?payment=cancel`,
    };

    // メールアドレスが有効な形式（@が含まれる）場合のみ、customer_emailを設定する
    if (email && typeof email === 'string' && email.includes('@')) {
      sessionOptions.customer_email = email;
    } else {
      console.warn('Invalid or missing email address provided to Stripe session:', email);
    }

    const session = await stripe.checkout.sessions.create(sessionOptions);

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