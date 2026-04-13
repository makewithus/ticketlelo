import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

// ===== Events =====
export const createEvent = async (event, userId = null) => {
  try {
    const eventRef = doc(collection(db, "events"));
    const eventData = {
      ...event,
      id: eventRef.id,
      createdBy: userId, // Link event to organiser
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    await setDoc(eventRef, eventData);
    
    // Increment eventsCreated count for organiser
    if (userId) {
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const currentCount = userDoc.data().eventsCreated || 0;
        await updateDoc(userRef, {
          eventsCreated: currentCount + 1,
        });
        console.log(`✅ Incremented eventsCreated for ${userId}: ${currentCount} → ${currentCount + 1}`);
      }
    }
    
    return eventData;
  } catch (error) {
    console.error("Create event error:", error.message);
    throw error;
  }
};

export const getEvent = async (eventId) => {
  try {
    const docSnap = await getDoc(doc(db, "events", eventId));
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    console.error("Get event error:", error);
    return null;
  }
};

export const getAllEvents = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "events"));
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Get all events error:", error.message);
    return [];
  }
};

export const getActiveEvents = async () => {
  try {
    const q = query(collection(db, "events"), where("isActive", "==", true));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Get active events error:", error.message);
    return [];
  }
};

export const updateEvent = async (eventId, updates) => {
  try {
    await updateDoc(doc(db, "events", eventId), {
      ...updates,
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error("Update event error:", error.message);
    throw error;
  }
};

// Get events created by a specific organiser
export const getEventsByOrganiser = async (organiserId) => {
  try {
    const q = query(collection(db, "events"), where("createdBy", "==", organiserId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Get events by organiser error:", error.message);
    return [];
  }
};

// Check if organiser has already created an event
export const hasOrganiserCreatedEvent = async (organiserId) => {
  try {
    const events = await getEventsByOrganiser(organiserId);
    return events.length > 0;
  } catch (error) {
    console.error("Check organiser event error:", error.message);
    return false;
  }
};

// Check if organiser can create more events (based on eventsAllowed limit)
export const canOrganiserCreateEvent = async (organiserId) => {
  try {
    const userDoc = await getDoc(doc(db, "users", organiserId));
    if (!userDoc.exists()) {
      console.error("User document not found for:", organiserId);
      return false;
    }
    
    const userData = userDoc.data();
    const eventsAllowed = userData.eventsAllowed || 0;
    const eventsCreated = userData.eventsCreated || 0;
    
    console.log(`🔍 Checking event creation eligibility for ${organiserId}:`, {
      eventsAllowed,
      eventsCreated,
      canCreate: eventsCreated < eventsAllowed,
    });
    
    return eventsCreated < eventsAllowed;
  } catch (error) {
    console.error("Check organiser eligibility error:", error.message);
    return false;
  }
};

export const deleteEvent = async (eventId) => {
  try {
    console.log(`🗑️ Deleting event: ${eventId}`);
    
    // Get event data before deletion to find the organizer
    const eventRef = doc(db, "events", eventId);
    const eventDoc = await getDoc(eventRef);
    
    if (eventDoc.exists()) {
      const eventData = eventDoc.data();
      const organizerId = eventData.createdBy;
      
      // Delete the event
      await deleteDoc(eventRef);
      console.log(`✅ Event ${eventId} deleted`);
      
      // Decrease eventsCreated count for organizer
      if (organizerId) {
        const userRef = doc(db, "users", organizerId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const currentCount = userDoc.data().eventsCreated || 0;
          const newCount = Math.max(0, currentCount - 1); // Ensure it doesn't go below 0
          
          await updateDoc(userRef, {
            eventsCreated: newCount,
          });
          
          console.log(`✅ Decreased eventsCreated for organizer ${organizerId}: ${currentCount} → ${newCount}`);
        }
      }
      
      // Delete associated custom forms
      const formsRef = collection(db, "customForms");
      const formsQuery = query(formsRef, where("eventId", "==", eventId));
      const formsSnapshot = await getDocs(formsQuery);
      
      if (!formsSnapshot.empty) {
        const batch = writeBatch(db);
        let deletedFormsCount = 0;
        
        formsSnapshot.forEach((formDoc) => {
          batch.delete(formDoc.ref);
          deletedFormsCount++;
        });
        
        await batch.commit();
        console.log(`✅ Deleted ${deletedFormsCount} custom form(s) associated with event ${eventId}`);
      }
      
      // Note: We keep registrations for history/audit purposes
      console.log(`ℹ️ Registrations for event ${eventId} are kept for audit purposes`);
      
    } else {
      console.warn(`⚠️ Event ${eventId} not found`);
    }
  } catch (error) {
    console.error("Delete event error:", error.message);
    throw error;
  }
};

// ===== Registrations =====
export const createRegistration = async (registration) => {
  try {
    const registrationRef = doc(collection(db, "registrations"));
    const registrationData = {
      ...registration,
      id: registrationRef.id,
      createdAt: Timestamp.now(),
    };
    await setDoc(registrationRef, registrationData);
    return registrationData;
  } catch (error) {
    console.error("Create registration error:", error.message);
    throw error;
  }
};

export const checkDuplicateRegistration = async (emailOrUserId, eventId) => {
  try {
    // Check by email first (for new registrations)
    const qByEmail = query(
      collection(db, "registrations"),
      where("email", "==", emailOrUserId),
      where("eventId", "==", eventId),
    );
    const emailSnapshot = await getDocs(qByEmail);
    if (emailSnapshot.size > 0) return true;

    // Also check by userId (for logged-in users)
    const qByUser = query(
      collection(db, "registrations"),
      where("userId", "==", emailOrUserId),
      where("eventId", "==", eventId),
    );
    const userSnapshot = await getDocs(qByUser);
    if (userSnapshot.size > 0) return true;

    // If emailOrUserId looks like an email, also check if any user with that email has registrations
    if (emailOrUserId.includes("@")) {
      // Get user by email and check their registrations
      const usersRef = collection(db, "users");
      const userQuery = query(usersRef, where("email", "==", emailOrUserId));
      const userSnapshot = await getDocs(userQuery);

      for (const userDoc of userSnapshot.docs) {
        const qByFoundUserId = query(
          collection(db, "registrations"),
          where("userId", "==", userDoc.id),
          where("eventId", "==", eventId),
        );
        const foundUserSnapshot = await getDocs(qByFoundUserId);
        if (foundUserSnapshot.size > 0) return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Check duplicate registration error:", error.message);
    return false;
  }
};

// Check if phone number is already registered for an event
export const checkDuplicatePhoneForEvent = async (phone, eventId) => {
  try {
    if (!phone || !eventId) return false;
    
    // Clean phone number - remove all non-digits
    const cleanPhone = phone.replace(/\D/g, "");
    
    // Get all registrations for this event
    const q = query(
      collection(db, "registrations"),
      where("eventId", "==", eventId)
    );
    const snapshot = await getDocs(q);
    
    // Check if any registration has matching phone number
    for (const doc of snapshot.docs) {
      const regData = doc.data();
      const regPhone = regData.whatsappPhone?.replace(/\D/g, "") || "";
      
      // Compare cleaned phone numbers
      if (regPhone === cleanPhone || 
          regPhone.endsWith(cleanPhone) || 
          cleanPhone.endsWith(regPhone)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error("Check duplicate phone error:", error.message);
    return false;
  }
};

export const getRegistrationsByUser = async (userId) => {
  try {
    // Get registrations by userId
    const qByUserId = query(
      collection(db, "registrations"),
      where("userId", "==", userId),
    );
    const userIdSnapshot = await getDocs(qByUserId);
    let registrations = userIdSnapshot.docs.map((doc) => doc.data());

    // Also get user's email and check for registrations by email
    // This handles cases where user might have multiple accounts
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const qByEmail = query(
          collection(db, "registrations"),
          where("email", "==", userData.email),
        );
        const emailSnapshot = await getDocs(qByEmail);
        const emailRegistrations = emailSnapshot.docs.map((doc) => doc.data());

        // Combine and remove duplicates based on ticketId
        const allRegistrations = [...registrations, ...emailRegistrations];
        registrations = allRegistrations.filter(
          (reg, index, self) =>
            index === self.findIndex((r) => r.ticketId === reg.ticketId),
        );
      }
    } catch (emailError) {
      console.warn(
        "Could not fetch registrations by email:",
        emailError.message,
      );
    }

    return registrations;
  } catch (error) {
    console.error("Get user registrations error:", error.message);
    return [];
  }
};

export const getRegistrationsByEvent = async (eventId) => {
  try {
    const q = query(
      collection(db, "registrations"),
      where("eventId", "==", eventId),
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => doc.data());
  } catch (error) {
    console.error("Get event registrations error:", error.message);
    return [];
  }
};

export const updateRegistration = async (registrationId, updates) => {
  try {
    await updateDoc(doc(db, "registrations", registrationId), updates);
  } catch (error) {
    console.error("Update registration error:", error.message);
    throw error;
  }
};

export const getRegistrationByTicketId = async (ticketId) => {
  try {
    const q = query(
      collection(db, "registrations"),
      where("ticketId", "==", ticketId),
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.size > 0) {
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
      };
    }
    return null;
  } catch (error) {
    console.error("Get registration by ticket ID error:", error.message);
    return null;
  }
};

// Helper function to migrate registrations from old user IDs to current user ID
export const migrateUserRegistrations = async (currentUserId, userEmail) => {
  try {
    // Find registrations with the same email but different userId
    const qByEmail = query(
      collection(db, "registrations"),
      where("email", "==", userEmail),
    );
    const emailSnapshot = await getDocs(qByEmail);

    const batch = writeBatch(db);
    let migratedCount = 0;

    for (const regDoc of emailSnapshot.docs) {
      const regData = regDoc.data();
      // If registration has different userId, migrate it
      if (regData.userId !== currentUserId) {
        const regRef = doc(db, "registrations", regDoc.id);
        batch.update(regRef, {
          userId: currentUserId,
          migratedAt: Timestamp.now(),
        });
        migratedCount++;
      }
    }

    if (migratedCount > 0) {
      await batch.commit();
      console.log(
        `Migrated ${migratedCount} registrations for user ${currentUserId}`,
      );
    }

    return migratedCount;
  } catch (error) {
    console.error("Migration error:", error.message);
    return 0;
  }
};

export const subscribeToUserRegistrations = (userId, callback) => {
  try {
    if (!userId) {
      console.error("Subscribe to registrations error: userId is required");
      callback([]);
      return () => {};
    }

    // Query by both userId and email to catch all registrations
    // This handles cases where user might have multiple accounts
    const unsubscribeCallbacks = [];
    let allRegistrations = [];

    // Get user data first to get email
    getDoc(doc(db, "users", userId)).then((userDoc) => {
      if (userDoc.exists()) {
        const userData = userDoc.data();

        // Query by userId
        const qByUserId = query(
          collection(db, "registrations"),
          where("userId", "==", userId),
        );

        // Query by email
        const qByEmail = query(
          collection(db, "registrations"),
          where("email", "==", userData.email),
        );

        const combineResults = () => {
          // Remove duplicates based on ticketId
          const uniqueRegistrations = allRegistrations.filter(
            (reg, index, self) =>
              index === self.findIndex((r) => r.ticketId === reg.ticketId),
          );
          callback(uniqueRegistrations);
        };

        // Subscribe to both queries
        const unsubscribe1 = onSnapshot(qByUserId, (querySnapshot) => {
          const userIdRegistrations = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          allRegistrations = [
            ...userIdRegistrations,
            ...allRegistrations.filter((reg) => reg.userId !== userId),
          ];
          combineResults();
        });

        const unsubscribe2 = onSnapshot(qByEmail, (querySnapshot) => {
          const emailRegistrations = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          allRegistrations = [
            ...emailRegistrations.filter((reg) => reg.userId !== userId),
            ...allRegistrations.filter((reg) => reg.userId === userId),
          ];
          combineResults();
        });

        unsubscribeCallbacks.push(unsubscribe1, unsubscribe2);
      } else {
        // Fallback to original query if user doc doesn't exist
        const q = query(
          collection(db, "registrations"),
          where("userId", "==", userId),
        );
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
          const registrations = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          callback(registrations);
        });
        unsubscribeCallbacks.push(unsubscribe);
      }
    });

    // Return combined unsubscribe function
    return () => {
      unsubscribeCallbacks.forEach((unsub) => unsub());
    };
  } catch (error) {
    console.error("Subscribe to registrations error:", error.message);
    return () => {};
  }
};

export const subscribeToEventRegistrations = (eventId, callback) => {
  try {
    if (!eventId) {
      console.error(
        "Subscribe to event registrations error: eventId is required",
      );
      callback([]);
      return () => {};
    }

    const q = query(
      collection(db, "registrations"),
      where("eventId", "==", eventId),
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const registrations = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(registrations);
    });
    return unsubscribe;
  } catch (error) {
    console.error("Subscribe to event registrations error:", error.message);
    return () => {};
  }
};

// ===== Tickets =====
export const createTicket = async (ticket) => {
  try {
    const ticketRef = doc(collection(db, "tickets"));
    const ticketData = {
      ...ticket,
      id: ticketRef.id,
      createdAt: new Date(),
    };
    await setDoc(ticketRef, ticketData);
    return ticketData;
  } catch (error) {
    console.error("Create ticket error:", error.message);
    throw error;
  }
};

export const getTicket = async (ticketId) => {
  try {
    const docSnap = await getDoc(doc(db, "tickets", ticketId));
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    console.error("Get ticket error:", error);
    return null;
  }
};

export const updateTicketStatus = async (ticketId, status) => {
  try {
    const updates = { status };
    if (status === "Used") {
      updates.usedAt = new Date();
    }
    await updateDoc(doc(db, "tickets", ticketId), updates);
  } catch (error) {
    console.error("Update ticket status error:", error.message);
    throw error;
  }
};

// ===== Users =====
export const getUserById = async (userId) => {
  try {
    const docSnap = await getDoc(doc(db, "users", userId));
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    console.error("Get user error:", error);
    return null;
  }
};
