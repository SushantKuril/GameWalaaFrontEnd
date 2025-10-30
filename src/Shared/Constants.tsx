const getBaseUrl = () => {
  if (window.location.hostname === "localhost") {
    return "http://localhost:8080";
  }
  // Use LAN IP if not localhost
  return "http://10.0.5.163:8080";
};

const Constants = {
  baseUrl: getBaseUrl(),
  games: "api/v1/games",
  fetchOrder: "api/v1/payment/order",
  gameStatus: "api/v1/games/status",
  orderDetails: "api/v1/payment/order/details",
  googleAnalytics: "G-7TQRK17RHX",
  razorpay_default: "ArcadeWala",
  razorpay_keyId: "rzp_test_RXadyqqjxcg8n8",
};

export default Constants;
