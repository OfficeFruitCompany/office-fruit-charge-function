// netlify/functions/charge-card.js
const Stripe = require("stripe");
// The secret key will be pulled from Netlify’s environment variables:
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const qs = require("querystring");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Parse the URL-encoded form data from event.body
  const data = qs.parse(event.body);
  const {
    contactName,
    email,
    phone,
    companyName,
    quantity,
    deliveryDate,
    orderFrequency,
    address,
    notes,
    promoCode,
    basketType,
    stripeToken,
  } = data;

  if (!stripeToken) {
    return {
      statusCode: 400,
      body: "Missing Stripe token. Please try again.",
    };
  }

  // Calculate total in cents based on basket type + promo
  function calculateAmountCents(basketType, quantity, promoCode) {
    let unitPriceCents = 0;
    if (basketType === "Small") {
      unitPriceCents = 3999;
    } else if (basketType === "Medium") {
      unitPriceCents = 5999;
    } else if (basketType === "Large") {
      unitPriceCents = 7999;
    } else {
      throw new Error("Invalid basketType");
    }
    const qty = parseInt(quantity, 10) || 1;
    let total = unitPriceCents * qty;
    if (promoCode && promoCode.trim().toUpperCase() === "201FRUIT") {
      total = Math.floor(total * 0.5);
    }
    return total;
  }

  try {
    const amountCents = calculateAmountCents(basketType, quantity, promoCode);
    const charge = await stripe.charges.create({
      amount: amountCents,
      currency: "cad",
      source: stripeToken,
      description: `${basketType} Basket × ${quantity} for ${companyName}`,
      receipt_email: email,
    });

    // If successful, return a simple success HTML snippet
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: `
        <h2>Payment Successful</h2>
        <p>Thanks, ${contactName}! We charged \$${(
        amountCents / 100
      ).toFixed(2)} to your card ending in ${
        charge.payment_method_details.card.last4
      }.</p>
        <p>Receipt sent to ${email}.</p>
      `,
    };
  } catch (err) {
    console.error("Stripe error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/html" },
      body: `
        <h2>Payment Failed</h2>
        <p>We couldn’t process your payment: ${err.message}</p>
        <p><a href="/">Go back and try again</a></p>
      `,
    };
  }
};
