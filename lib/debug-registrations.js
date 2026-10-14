// Debug helper to check registration issues
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

export const debugUserRegistrations = async (userEmail) => {
  try {
    console.log(` Debugging registrations for email: ${userEmail}`);

    // Find all users with this email
    const usersQuery = query(
      collection(db, "users"),
      where("email", "==", userEmail),
    );
    const usersSnapshot = await getDocs(usersQuery);

    console.log(` Found ${usersSnapshot.size} user accounts:`);
    usersSnapshot.forEach((doc) => {
      console.log(`  - User ID: ${doc.id}`, doc.data());
    });

    // Find all registrations with this email
    const regsByEmailQuery = query(
      collection(db, "registrations"),
      where("email", "==", userEmail),
    );
    const regsByEmailSnapshot = await getDocs(regsByEmailQuery);

    console.log(` Found ${regsByEmailSnapshot.size} registrations by email:`);
    regsByEmailSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`  - Registration ID: ${doc.id}`, {
        userId: data.userId,
        ticketId: data.ticketId,
        eventId: data.eventId,
        status: data.status,
      });
    });

    // Find registrations by user IDs
    for (const userDoc of usersSnapshot.docs) {
      const regsByUserQuery = query(
        collection(db, "registrations"),
        where("userId", "==", userDoc.id),
      );
      const regsByUserSnapshot = await getDocs(regsByUserQuery);

      console.log(
        ` Found ${regsByUserSnapshot.size} registrations for user ${userDoc.id}:`,
      );
      regsByUserSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`  - Registration ID: ${doc.id}`, {
          email: data.email,
          ticketId: data.ticketId,
          eventId: data.eventId,
          status: data.status,
        });
      });
    }
  } catch (error) {
    console.error("Debug error:", error);
  }
};

// Call this in browser console to debug:
// import { debugUserRegistrations } from '@/lib/debug-registrations';
// debugUserRegistrations('user@example.com');
