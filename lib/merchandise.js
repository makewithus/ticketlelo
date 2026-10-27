import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

/**
 * Lightweight Creator Store & Merchandise Engine (P15, STORE-001–015)
 * Manages event merchandise, stock limits, checkout add-ons, and pickup vouchers.
 */

/**
 * Calculate merchandise add-on totals during checkout
 * @param {Array<Object>} catalogItems - Available event merchandise
 * @param {Array<{ itemId: string, quantity: number }>} selectedAddons - User selections
 * @returns {{ valid: boolean, items: Array<Object>, totalAmount: number, error?: string }}
 */
export function calculateMerchandiseAddons(catalogItems = [], selectedAddons = []) {
  if (!Array.isArray(selectedAddons) || selectedAddons.length === 0) {
    return { valid: true, items: [], totalAmount: 0 };
  }

  const catalogMap = new Map();
  catalogItems.forEach((item) => catalogMap.set(item.id, item));

  let totalAmount = 0;
  const processedItems = [];
  const requestedByItem = new Map();

  for (const addon of selectedAddons) {
    const item = catalogMap.get(addon.itemId);
    if (!item) {
      return { valid: false, error: `Merchandise item ${addon.itemId} not found in catalog.` };
    }

    const qty = Number(addon.quantity ?? 1);
    if (!Number.isSafeInteger(qty) || qty < 1) return { valid: false, error: "Merchandise quantity must be a positive integer." };
    const stockAvailable = Number(item.stock || 0);
    const totalRequested = (requestedByItem.get(item.id) || 0) + qty;
    requestedByItem.set(item.id, totalRequested);

    if (!Number.isSafeInteger(stockAvailable) || stockAvailable < totalRequested) {
      return {
        valid: false,
        error: `Insufficient stock for "${item.name}". Requested: ${qty}, Available: ${stockAvailable}.`,
      };
    }

    const unitPrice = Number(item.price || 0);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return { valid: false, error: "Invalid merchandise price." };
    const itemSubtotal = unitPrice * qty;
    totalAmount += itemSubtotal;

    processedItems.push({
      itemId: item.id,
      name: item.name,
      unitPrice,
      quantity: qty,
      subtotal: itemSubtotal,
      size: addon.size || item.defaultSize || null,
    });
  }

  return {
    valid: true,
    items: processedItems,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

/**
 * Generates an immutable pickup voucher for merchandise fulfillment
 * @param {Object} params
 * @param {string} params.orderId
 * @param {string} params.buyerName
 * @param {Array<Object>} params.items
 * @returns {Object} Pickup voucher record
 */
export function generatePickupVoucher({ orderId, buyerName, items = [] }) {
  const randomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
  const voucherCode = `VOUCHER-${(orderId || "ORD").slice(-6).toUpperCase()}-${randomCode}`;

  return {
    voucherCode,
    orderId,
    buyerName,
    items,
    status: "Ready for Pickup", // "Ready for Pickup" | "Claimed" | "Cancelled"
    generatedAt: new Date().toISOString(),
    claimedAt: null,
  };
}

/**
 * Create merchandise product in catalog
 */
export async function createMerchandiseItem(eventId, productData) {
  if (!eventId) throw new Error("eventId required");
  const merchRef = doc(collection(db, "merchandise"));
  const record = {
    id: merchRef.id,
    eventId,
    name: productData.name || "Event Merchandise",
    description: productData.description || "",
    price: Number(productData.price || 0),
    stock: Number(productData.stock || 0),
    imageUrl: productData.imageUrl || "",
    sizes: Array.isArray(productData.sizes) ? productData.sizes : ["S", "M", "L", "XL"],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await setDoc(merchRef, record);
  return record;
}

/**
 * Fetch merchandise catalog for an event
 */
export async function getMerchandiseByEvent(eventId) {
  if (!eventId) return [];
  const q = query(collection(db, "merchandise"), where("eventId", "==", eventId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
