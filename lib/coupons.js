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
export const validateCoupon = async (couponCode, eventId, totalAmount = 0) => {
  try {
    const couponsRef = collection(db, "coupons");
    const q = query(
      couponsRef,
      where("code", "==", couponCode),
      where("eventId", "==", eventId),
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { valid: false, isValid: false, message: "Invalid Coupon Code", discountAmount: 0 };
    }

    const couponDoc = querySnapshot.docs[0];
    const coupon = couponDoc.data();

    if (coupon.isUsed) {
      return { valid: false, isValid: false, message: "Coupon Already Used", discountAmount: 0 };
    }

    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      discountAmount = (totalAmount * (Number(coupon.discountValue) || 0)) / 100;
    } else {
      discountAmount = Number(coupon.discountValue || 0);
    }

    return {
      valid: true,
      isValid: true,
      message: "Coupon Applied Successfully",
      coupon: { id: couponDoc.id, ...coupon },
      discountAmount,
    };
  } catch (error) {
    console.error("Error validating coupon:", error);
    return { valid: false, isValid: false, message: "Error validating coupon", discountAmount: 0 };
  }
};

export const validateCouponCode = validateCoupon;

// Mark coupon as used
export const markCouponAsUsed = async (couponId, userId) => {
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

export const useCoupon = markCouponAsUsed;

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
