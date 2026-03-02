import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

/* ======================
   PHONE NORMALIZER
====================== */
function normalizeSomaliPhone(phone) {
  let cleaned = phone.replace(/[^\d]/g, "");

  if (cleaned.startsWith("0")) {
    cleaned = "252" + cleaned.slice(1);
  }

  if (cleaned.startsWith("252252")) {
    cleaned = cleaned.slice(3);
  }

  return cleaned;
}

function isValidSomaliPhone(phone) {
  return /^252\d{9}$/.test(phone);
}

/* ======================
   HEALTH CHECK
====================== */
app.get("/health", (req, res) => {
  res.send("✅ WaafiPay backend is alive");
});

/* ======================
   WAAFIPAY CONFIRM
====================== */
app.post("/waafipay/confirm", async (req, res) => {
  try {
    let { phone, total, district, items } = req.body;

    if (!phone || !total || !district || !items?.length) {
      return res.status(400).json({
        status: "ERROR",
        message: "Missing fields",
      });
    }

    phone = normalizeSomaliPhone(phone);

    if (!isValidSomaliPhone(phone)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Invalid Somali phone",
      });
    }

    const {
      WAAFIPAY_ENV,
      WAAFIPAY_MERCHANT_UID,
      WAAFIPAY_API_USER_ID,
      WAAFIPAY_API_KEY,
    } = process.env;

    if (
      !WAAFIPAY_MERCHANT_UID ||
      !WAAFIPAY_API_USER_ID ||
      !WAAFIPAY_API_KEY
    ) {
      return res.status(500).json({
        status: "ERROR",
        message: "Missing WaafiPay ENV",
      });
    }

    const payload = {
      schemaVersion: "1.0",
      requestId: Date.now().toString(),
      timestamp: new Date().toISOString(),
      channelName: "WEB",
      serviceName: "API_PURCHASE",
      serviceParams: {
        merchantUid: WAAFIPAY_MERCHANT_UID,
        apiUserId: WAAFIPAY_API_USER_ID,
        apiKey: WAAFIPAY_API_KEY,
        paymentMethod: "MWALLET_ACCOUNT",
        payerInfo: {
          accountNo: phone,
        },
        transactionInfo: {
          referenceId: `ORDER-${Date.now()}`,
          invoiceId: `INV-${Date.now()}`,
          amount: total,
          currency: "USD",
          description: "Vitmiin Order Payment",
          items: items.map((i) => ({
            itemId: i.id,
            description: i.title,
            quantity: i.qty,
            price: i.price,
          })),
        },
      },
    };

    const waafiUrl =
      WAAFIPAY_ENV === "live"
        ? "https://api.waafipay.net/asm"
        : "https://sandbox.waafipay.net/asm";

    const response = await fetch(waafiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log("WaafiPay:", result);

    if (result.responseCode !== "2001") {
      if (WAAFIPAY_ENV !== "live") {
        return res.json({
          status: "SUCCESS",
          simulated: true,
        });
      }

      return res.status(400).json({
        status: "ERROR",
        message: result.responseMsg,
      });
    }

    return res.json({
      status: "SUCCESS",
      waafipay: result,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: "ERROR",
      message: "Server error",
    });
  }
});

/* ======================
   SERVER START
====================== */
const PORT = process.env.PORT || 3000;

// log ENV safely
console.log("ENV CHECK:", {
  env: process.env.WAAFIPAY_ENV,
  merchant: process.env.WAAFIPAY_MERCHANT_UID,
  userId: process.env.WAAFIPAY_API_USER_ID,
  key: process.env.WAAFIPAY_API_KEY ? "SET" : "MISSING",
});

app.listen(PORT, () => {
  console.log(`🚀 WaafiPay backend running on port ${PORT}`);
});