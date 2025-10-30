import { useEffect, useState } from "react";
import GameTile from "../Components/gameTile";
import FloatingActionButton from "../Components/FloatingActionButton";
import KonamiCodeModal from "../Components/KonamiCodeModal";
import "./Catalog.css";
import axios from "axios";
import Constants from "../Shared/Constants";
import { gamesModel } from "../Shared/Models";
import { loadRazorpayScript } from "../Utils/loadRazorpayScript";
import logo from "/cusic-logo.png";

type KonamiCode = {
  gameName: string;
  gameId: string;
  konamiCode: string;
};

const Catalog = () => {
  const [Games, setGames] = useState<gamesModel[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [konamiCodes, setKonamiCodes] = useState<KonamiCode[]>([]);

  useEffect(() => {
    fetchGames();

    const savedCodes = localStorage.getItem("konamiCodes");
    if (savedCodes) {
      try {
        const parsedCodes = JSON.parse(savedCodes);
        if (Array.isArray(parsedCodes)) {
          setKonamiCodes(parsedCodes);
        }
      } catch (error) {
        console.error("Failed to parse konamiCodes from localStorage", error);
      }
    }
  }, []);

  const fetchGames = async () => {
    try {
      const response = await axios.get(
        `${Constants.baseUrl}/${Constants.games}`
      );
      setGames(response.data.games);
    } catch (error) {}
  };

  const normalizePrices = (price: any) => {
    if (price.ByLevel) {
      return price.ByLevel.map((p: any) => ({
        value: `${p.Level} Levels - ₹${p.Price}`,
        Based: "Level",
      }));
    } else if (price.ByTime) {
      return price.ByTime.map((p: any) => ({
        value: `${p.Time} mins - ₹${p.Price}`,
        Based: "Time",
      }));
    }
    return [];
  };

  const handleGamePayment = async (gameData: any) => {
    const gamePrice = Number(gameData.selectedPrice.match(/₹\s*(\d+)/)[1]);
    const timeInMins = Number(gameData.selectedPrice.match(/(\d+)\s*mins/)[1]);

    const isLoaded = await loadRazorpayScript();
    if (!isLoaded) {
      alert("Razorpay SDK failed to load.");
      return;
    }

    const price = gamePrice * 100;
    const result = await axios.get(
      `${Constants.baseUrl}/${Constants.fetchOrder}/${price}`
    );

    const order_id: number = result.data.details.id;
    const currency: string = result.data.details.currency;

    const options: any = {
      key: Constants.razorpay_keyId,
      currency: currency,
      name: Constants.razorpay_default,
      order_id: order_id,
      description: `Payment for ${gameData.gameName}`,
      image: logo,
      handler: async (response: any) => {
        // Handle payment success without navigating away from the catalog.
        // We wrap calls in try/catch to ensure failures don't trigger navigation.
        try {
          const date = new Date();
          // Get deviceId from localStorage or generate if not present
          let deviceId = localStorage.getItem("deviceId");
          if (!deviceId) {
            // Fallback for browsers without crypto.randomUUID
            if (window.crypto && window.crypto.getRandomValues) {
              deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c: string) {
                const r = window.crypto.getRandomValues(new Uint8Array(1))[0] % 16;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
              });
            } else {
              // Last resort: use Date.now and Math.random
              deviceId = 'dev-' + Date.now() + '-' + Math.floor(Math.random() * 1e9);
            }
            localStorage.setItem("deviceId", deviceId || "");
          }

          // Send deviceId to local launcher server for automation
          try {
            await fetch('http://localhost:5000/set-device-id', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ deviceId })
            });
            console.log('[PAYMENT-DEBUG] Sent deviceId to local launcher server:', deviceId);
          } catch (err) {
            console.error('[PAYMENT-ERROR] Could not send deviceId to launcher server:', err);
          }

          const data = {
            orderCreationId: order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            razorpaySignature: response.razorpay_signature,
            userId: deviceId,
            timeLimit: timeInMins,
          };

          const data2 = {
            name: gameData.gameName,
            gameId: Number(gameData.gameId),
            price: gamePrice,
            isTimed: true,
            levels: 0,
            currentTime: date.toISOString(),
            played: false,
            playTime: timeInMins,
            paymentId: response.razorpay_payment_id,
          };

          console.log('[PAYMENT-DEBUG] Sending payment details to backend:', data);
          try {
            const detailsResp = await axios.post(
              `${Constants.baseUrl}/${Constants.orderDetails}`,
              data
            );
            console.log('[PAYMENT-DEBUG] Backend response for payment details:', detailsResp.status, detailsResp.data);
          } catch (err) {
            console.error('[PAYMENT-ERROR] Error sending payment details:', err);
          }
          setKonamiCodes([]);

          // this only runs if the above succeeds
          const result = await axios.post(
            `${Constants.baseUrl}/${Constants.gameStatus}`,
            data2
          );

          const konami = {
            gameName: gameData.gameName,
            gameId: gameData.gameId,
            konamiCode: result.data.Code,
          };

          setKonamiCodes((prev) => {
            const updated = [...prev, konami];
            localStorage.setItem("konamiCodes", JSON.stringify(updated));
            return updated;
          });

          // Inform the user but stay on the catalog page
          alert("Payment successful — your game token is saved. You will remain on this page.");
        } catch (err) {
          console.error("Error handling payment success:", err);
          // Notify user of problem but do not navigate away
          alert("Payment succeeded but we had an issue recording it. Please contact support.");
        }
      },
      // Prevent any default redirect behaviour on modal close
      modal: {
        ondismiss: () => {
          // Do nothing special on dismiss. Stay on the Catalog page.
          console.log("Razorpay modal dismissed — remaining on catalog page.");
        },
      },
      theme: {
        color: "#FDD226",
      },
    };

    new (window as any).Razorpay(options).open();
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="game-catalog-page">
      <div className="catalog-container">
        {Games.map((x) => (
          <div className="game-tile" key={x.GameId}>
            <GameTile
              gameId={x.GameId}
              gameName={x.Name}
              gameProfile={x.Thumbnail}
              pricesList={normalizePrices(x.Price)}
              infoMessage={
                x.Price.ByLevel
                  ? "Prices are based on levels. Please select."
                  : "Prices are based on time. Please select."
              }
              handleGamePayment={handleGamePayment}
            />
          </div>
        ))}
      </div>

      <KonamiCodeModal
        codes={konamiCodes}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      ></KonamiCodeModal>

      <FloatingActionButton
        onClick={handleOpenModal}
        count={konamiCodes.length}
      />
    </div>
  );
};

export default Catalog;
