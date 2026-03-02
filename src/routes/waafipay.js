import express from "express";
import axios from "axios";

const router = express.Router();

/* ======================
   CONFIRM PAYMENT
====================== */
router.post("/confirm", async (req, res) => {
  try {
    const {
      phone,
      total,
      district,
      items,
    } = req.body;

    /* ======================
       BASIC VALIDATION
    ====================== */
    if (!phone || !total || !items?.length) {
      return res.status(400).json({
        status: "ERROR",
        message: "Missing required fields",
      });
    }

    const {
      WAAFIPAY_API_USER,
      WAAFIPAY_API_KEY,
      WAAFIPAY_MERCHANT_UID,
      WAAFIPAY_BASE_URL,
    } = process.env;

    if (
      !WAAFIPAY_API_USER ||
      !WAAFIPAY_API_KEY ||
      !WAAFIPAY_MERCHANT_UID ||
      !WAAFIPAY_BASE_URL
    ) {
      return res.status(500).json({
        status: "ERROR",
        message: "Missing WaafiPay ENV",
      });
    }

    /* ======================
       WAAFIPAY REQUEST
    ====================== */
    const payload = {
      schemaVersion: "1.0",
      requestId: Date.now().toString(),
      timestamp: new Date().toISOString(),
      channelName: "WEB",
      serviceName: "API_PURCHASE",
      serviceParams: {
        merchantUid: WAAFIPAY_MERCHANT_UID,
        apiUserId: WAAFIPAY_API_USER,
        apiKey: WAAFIPAY_API_KEY,
        paymentMethod: "mwallet_account",
        payerInfo: {
          accountNo: phone,
        },
        transactionInfo: {
          referenceId: "ORDER_" + Date.now(),
          invoiceId: "INV_" + Date.now(),
          amount: total,
          currency: "USD",
          description: `Delivery to ${district}`,
        },
      },
    };

    const response = await axios.post(
      WAAFIPAY_BASE_URL,
      payload,
      { timeout: 15000 }
    );

    return res.json({
      status: "SUCCESS",
      waafipay: response.data,
    });

  } catch (error) {
    return res.status(500).json({
      status: "ERROR",
      message: error.response?.data || error.message,
    });
  }
});

export default router;