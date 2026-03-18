import { Handler } from '@netlify/functions';
import Stripe from 'stripe';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing API keys' }) };
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' as any });

  try {
    const { email } = JSON.parse(event.body || '{}');
    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) };
    }

    // 顧客を検索
    const customers = await stripe.customers.list({ email: email, limit: 1 });
    if (customers.data.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Customer not found' }) };
    }

    const customerId = customers.data[0].id;

    // カスタマーポータルのセッションを作成
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.URL || 'https://donburi65.netlify.app'}/`,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error: any) {
    console.error('Stripe Portal Error:', error.message);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};