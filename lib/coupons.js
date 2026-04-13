import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

// Validate coupon code
export const validateCoupon = async (couponCode, eventId) => {
  try {
    const couponsRef = collection(db, "coupons");
    const q = query(
      couponsRef,
      where("code", "==", couponCode),
      where("eventId", "==", eventId),
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { valid: false, message: "Invalid Coupon Code" };
    }

    const couponDoc = querySnapshot.docs[0];
    const coupon = couponDoc.data();

    if (coupon.isUsed) {
      return { valid: false, message: "Coupon Already Used" };
    }

    return {
      valid: true,
      message: "Coupon Applied Successfully",
      coupon: { id: couponDoc.id, ...coupon },
    };
  } catch (error) {
    console.error("Error validating coupon:", error);
    return { valid: false, message: "Error validating coupon" };
  }
};

// Mark coupon as used
export const useCoupon = async (couponId, userId) => {
  try {
    await updateDoc(doc(db, "coupons", couponId), {
      isUsed: true,
      usedBy: userId,
      usedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error marking coupon as used:", error);
    throw new Error("Failed to use coupon");
  }
};

// Create coupons (Super Admin only)
export const createCoupons = async (eventId, codes) => {
  try {
    const couponsRef = collection(db, "coupons");
    const promises = codes.map((code) =>
      addDoc(couponsRef, {
        code,
        eventId,
        isUsed: false,
        createdAt: Timestamp.now(),
      }),
    );
    await Promise.all(promises);
  } catch (error) {
    console.error("Error creating coupons:", error);
    throw new Error("Failed to create coupons");
  }
};

// Get coupons for an event
export const getCouponsByEvent = async (eventId) => {
  try {
    const couponsRef = collection(db, "coupons");
    const q = query(couponsRef, where("eventId", "==", eventId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error fetching coupons:", error);
    throw new Error("Failed to fetch coupons");
  }
};
