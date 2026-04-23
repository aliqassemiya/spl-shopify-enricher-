import axios from "axios";

export default async function handler(req, res) {
  try {
    const {
      order_id,
      latitude,
      longitude
    } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: "Missing order_id" });
    }

    let splData = null;

    // ===============================
    // 1. CALL SPL MAP API
    // ===============================
    if (latitude && longitude) {
      const response = await axios.get(
        `http://apina.address.gov.sa/NationalAddress/v3.1/maps/map-engine`,
        {
          params: {
            lat: latitude,
            lng: longitude
          }
        }
      );

      splData = response.data;
    }

    if (!splData) {
      return res.status(200).json({ message: "No SPL data found" });
    }

    // ===============================
    // 2. EXTRACT FIELDS
    // ===============================
    const spl_full_address =
      splData?.fullAddress ||
      splData?.FormattedAddress ||
      "";

    const spl_building_number =
      splData?.buildingNumber || "";

    const spl_additional_number =
      splData?.additionalNumber || "";

    const spl_short_address =
      splData?.shortAddress || "";

    // ===============================
    // 3. UPDATE SHOPIFY ORDER METAFIELDS
    // ===============================
    const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
    const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

    const mutation = `
    mutation {
      metafieldsSet(metafields: [
        {
          ownerId: "gid://shopify/Order/${order_id}",
          namespace: "custom",
          key: "spl_full_address",
          type: "single_line_text_field",
          value: "${spl_full_address}"
        },
        {
          ownerId: "gid://shopify/Order/${order_id}",
          namespace: "custom",
          key: "spl_building_number",
          type: "single_line_text_field",
          value: "${spl_building_number}"
        },
        {
          ownerId: "gid://shopify/Order/${order_id}",
          namespace: "custom",
          key: "spl_additional_number",
          type: "single_line_text_field",
          value: "${spl_additional_number}"
        },
        {
          ownerId: "gid://shopify/Order/${order_id}",
          namespace: "custom",
          key: "spl_short_address",
          type: "single_line_text_field",
          value: "${spl_short_address}"
        }
      ]) {
        metafields { key value }
        userErrors { field message }
      }
    }
    `;

    const shopifyResponse = await axios.post(
      `${SHOPIFY_STORE}/admin/api/2024-01/graphql.json`,
      { query: mutation },
      {
        headers: {
          "X-Shopify-Access-Token": TOKEN,
          "Content-Type": "application/json"
        }
      }
    );

    return res.status(200).json({
      success: true,
      splData,
      shopify: shopifyResponse.data
    });

  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).json({
      error: "SPL enrichment failed"
    });
  }
}
