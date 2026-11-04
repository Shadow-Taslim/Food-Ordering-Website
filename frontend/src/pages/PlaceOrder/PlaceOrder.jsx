import React, { useContext, useEffect, useState } from "react";
import "./PlaceOrder.css";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;
const DELIVERY_FEE = 2;

// Card form rendered once the backend has created the PaymentIntent.
// confirmPayment redirects back to /verify, where the order state is confirmed
// (the Stripe webhook on the server is the authoritative paid-state updater).
const PaymentForm = ({ orderId, total, onBack }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const payNow = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/verify?orderId=${orderId}`,
      },
    });
    // confirmPayment only returns here if the redirect did not happen (error)
    if (error) {
      toast.error(error.message || "Payment failed");
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={payNow} className="checkout-pay">
      <div className="checkout-pay-header">
        <p className="title">Pay with</p>
        <button type="button" className="back-link" onClick={onBack}>
          ← Edit delivery info
        </button>
      </div>
      <div className="payment-element-card">
        {/* Stripe renders wallet tabs (Link / Apple Pay / Google Pay) here
            automatically when the browser supports them */}
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      <button className="pay-btn" type="submit" disabled={!stripe || processing}>
        {processing ? "Processing…" : `Pay $${total}`}
      </button>
      <p className="secure-note">
        Payments are encrypted and processed securely by Stripe. Test card:
        4242 4242 4242 4242, any future date, any CVC.
      </p>
    </form>
  );
};

// Right-hand summary sidebar shown on the payment step.
const OrderSummary = ({ items, subtotal }) => (
  <aside className="checkout-summary">
    <h2>Order summary</h2>
    <div className="summary-items">
      {items.map((item) => (
        <div className="summary-item" key={item._id}>
          <p className="summary-item-name">
            {item.name} <span>× {item.quantity}</span>
          </p>
          <p className="summary-item-price">${item.price * item.quantity}</p>
        </div>
      ))}
    </div>
    <hr />
    <div className="cart-total-details">
      <p>Subtotal</p>
      <p>${subtotal}</p>
    </div>
    <div className="cart-total-details">
      <p>Delivery fee</p>
      <p>${subtotal === 0 ? 0 : DELIVERY_FEE}</p>
    </div>
    <hr />
    <div className="cart-total-details summary-grand">
      <b>Total due</b>
      <b>${subtotal === 0 ? 0 : subtotal + DELIVERY_FEE}</b>
    </div>
    <p className="summary-note">
      Your order is confirmed the moment Stripe verifies the payment — you can
      track it afterwards from the My Orders page.
    </p>
  </aside>
);

const PlaceOrder = () => {
  const navigate = useNavigate();

  const { getTotalCartAmount, token, food_list, cartItems, url } =
    useContext(StoreContext);
  const [payment, setPayment] = useState(null); // { clientSecret, orderId }
  const [data, setData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    street: "",
    city: "",
    state: "",
    zipcode: "",
    country: "",
    phone: "",
  });

  const getOrderItems = () => {
    let orderItems = [];
    food_list.map((item) => {
      if (cartItems[item._id] > 0) {
        let itemInfo = { ...item };
        itemInfo["quantity"] = cartItems[item._id];
        orderItems.push(itemInfo);
      }
    });
    return orderItems;
  };

  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;
    setData((data) => ({ ...data, [name]: value }));
  };

  const placeOrder = async (event) => {
    event.preventDefault();
    let orderData = {
      address: data,
      items: getOrderItems(),
      amount: getTotalCartAmount() + DELIVERY_FEE,
    };

    let response = await axios.post(url + "/api/order/place", orderData, {
      headers: { token },
    });
    if (response.data.success && response.data.clientSecret) {
      setPayment({
        clientSecret: response.data.clientSecret,
        orderId: response.data.orderId,
      });
      window.scrollTo(0, 0);
    } else {
      toast.error(response.data.message || "Errors!");
    }
  };

  useEffect(() => {
    if (!token) {
      toast.error("Please Login first");
      navigate("/cart");
    } else if (getTotalCartAmount() === 0) {
      toast.error("Please Add Items to Cart");
      navigate("/cart");
    }
  }, [token]);

  // step 2: payment step once the PaymentIntent exists
  if (payment) {
    if (!stripePromise) {
      return (
        <div className="place-order">
          <p className="title">
            Stripe publishable key is not configured. Set
            VITE_STRIPE_PUBLISHABLE_KEY in frontend/.env and restart Vite.
          </p>
        </div>
      );
    }
    const subtotal = getTotalCartAmount();
    return (
      <div className="checkout">
        <Elements
          stripe={stripePromise}
          options={{ clientSecret: payment.clientSecret }}
        >
          <PaymentForm
            orderId={payment.orderId}
            total={subtotal === 0 ? 0 : subtotal + DELIVERY_FEE}
            onBack={() => setPayment(null)}
          />
        </Elements>
        <OrderSummary items={getOrderItems()} subtotal={subtotal} />
      </div>
    );
  }

  return (
    <form className="place-order" onSubmit={placeOrder}>
      <div className="place-order-left">
        <p className="title">Delivery Information</p>
        <div className="multi-fields">
          <input
            required
            name="firstName"
            value={data.firstName}
            onChange={onChangeHandler}
            type="text"
            placeholder="First name"
          />
          <input
            required
            name="lastName"
            value={data.lastName}
            onChange={onChangeHandler}
            type="text"
            placeholder="Last name"
          />
        </div>
        <input
          required
          name="email"
          value={data.email}
          onChange={onChangeHandler}
          type="text"
          placeholder="Email Address"
        />
        <input
          required
          name="street"
          value={data.street}
          onChange={onChangeHandler}
          type="text"
          placeholder="Street"
        />
        <div className="multi-fields">
          <input
            required
            name="city"
            value={data.city}
            onChange={onChangeHandler}
            type="text"
            placeholder="City"
          />
          <input
            required
            name="state"
            value={data.state}
            onChange={onChangeHandler}
            type="text"
            placeholder="State"
          />
        </div>
        <div className="multi-fields">
          <input
            required
            name="zipcode"
            value={data.zipcode}
            onChange={onChangeHandler}
            type="text"
            placeholder="Zip Code"
          />
          <input
            required
            name="country"
            value={data.country}
            onChange={onChangeHandler}
            type="text"
            placeholder="Country"
          />
        </div>
        <input
          required
          name="phone"
          value={data.phone}
          onChange={onChangeHandler}
          type="text"
          placeholder="Phone"
        />
      </div>
      <div className="place-order-right">
        <div className="cart-total">
          <h2>Cart Totals</h2>
          <div>
            <div className="cart-total-details">
              <p>Subtotals</p>
              <p>${getTotalCartAmount()}</p>
            </div>
            <hr />
            <div className="cart-total-details">
              <p>Delivery Fee</p>
              <p>${getTotalCartAmount() === 0 ? 0 : DELIVERY_FEE}</p>
            </div>
            <hr />
            <div className="cart-total-details">
              <b>Total</b>
              <b>
                ${getTotalCartAmount() === 0 ? 0 : getTotalCartAmount() + DELIVERY_FEE}
              </b>
            </div>
          </div>
          <button type="submit">PROCEED TO PAYMENT</button>
        </div>
      </div>
    </form>
  );
};

export default PlaceOrder;
