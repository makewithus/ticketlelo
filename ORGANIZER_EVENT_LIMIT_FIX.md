# Organizer Event Limit System - Fix for Existing Organizers

## 🚨 Issue

Existing organizers created before the event limit system was implemented are missing the required fields (`eventsAllowed` and `eventsCreated`). This causes them to be unable to create events even after approval.

## ✅ Solution

You need to add the missing fields to existing organizer accounts in Firebase Firestore.

---

## 📋 Manual Fix (Firebase Console)

### Step 1: Go to Firebase Console

1. Visit [Firebase Console](https://console.firebase.google.com/)
2. Select your TicketLelo project
3. Click on **Firestore Database** in the left sidebar

### Step 2: Find the Organizer

1. Click on the **`users`** collection
2. Find the organizer document (e.g., `techsprint@ticketlelo.com`)
3. Click on the document ID to open it

### Step 3: Add Required Fields

Click "**Add field**" for each of the following:

| Field Name      | Type   | Value      | Description                                |
| --------------- | ------ | ---------- | ------------------------------------------ |
| `eventsAllowed` | number | `1` or `2` | Number of events they can create           |
| `eventsCreated` | number | `0` or `1` | Number of events they have already created |

**Example for "Tech Sprint" organizer:**

- If they've already created 1 event: `eventsCreated: 1`
- If you want them to create 1 more: `eventsAllowed: 2`
- This means they can create `2 - 1 = 1` more event

### Step 4: Save

Click "**Update**" to save the changes.

---

## 🔧 Automated Fix (Using Firestore)

Run this script in Firebase Console → Firestore → Rules → Run in Console:

```javascript
// Get reference to the organizer's user document
const userRef = db.collection("users").doc("ORGANIZER_USER_ID"); // Replace with actual user ID

// Update the document
await userRef.update({
  eventsAllowed: 2, // Number of events they can create (adjust as needed)
  eventsCreated: 1, // Number of events already created (count their existing events)
});

console.log("✅ Updated organizer with event limits");
```

---

## 🎯 How It Works Now

### For Existing Organizers:

1. **Organizer submits hosting request**
2. **Super Admin approves**
3. **System checks**: Does this organizer already exist?
   - ✅ **YES** → Increase `eventsAllowed` by 1 (e.g., 1 → 2)
   - ❌ **NO** → Create new account with `eventsAllowed: 1`, `eventsCreated: 0`

### When Creating Events:

1. **System checks**: `eventsCreated < eventsAllowed`?
   - ✅ **YES** → Allow event creation
   - ❌ **NO** → Show "Event Creation Limit Reached" message

2. **After creating event**: Increment `eventsCreated` by 1

---

## 📊 Example Scenarios

### Scenario 1: New Organizer

```
Initial state: eventsAllowed: 1, eventsCreated: 0
Can create: 1 event ✅

After creating 1 event: eventsAllowed: 1, eventsCreated: 1
Can create: 0 more ❌

After approval of 2nd request: eventsAllowed: 2, eventsCreated: 1
Can create: 1 more ✅
```

### Scenario 2: Tech Sprint Organizer (Already Created 1 Event)

```
Before fix: Missing fields → Can't create events ❌

After manual fix: eventsAllowed: 2, eventsCreated: 1
Can create: 1 more ✅

After approval of 3rd request: eventsAllowed: 3, eventsCreated: 1
Can create: 2 more ✅
```

---

## 🔍 Verify the Fix

### Check in Firebase Console:

1. Go to Firestore → `users` collection
2. Click on the organizer's document
3. Verify these fields exist:
   - `eventsAllowed`: number (should be ≥ 1)
   - `eventsCreated`: number (should be ≥ 0)
   - `role`: "organiser"

### Check in Application:

1. Login as the organizer
2. Go to **Admin Dashboard** → **Create Event**
3. You should see:
   - ✅ If `eventsCreated < eventsAllowed`: "Create Event" button is **enabled**
   - ❌ If `eventsCreated >= eventsAllowed`: "Event Creation Limit Reached" warning

---

## 🛠️ For Super Admin

When approving hosting requests, the system now automatically:

1. **Checks if organizer exists** (by email or phone)
2. **If existing**:
   - Increases `eventsAllowed` by 1
   - Updates password
   - Shows message: "Organiser already exists. Password updated and event limit increased!"
3. **If new**:
   - Creates new account
   - Sets `eventsAllowed: 1`, `eventsCreated: 0`
   - Shows message: "New organiser account created"

---

## 💡 Quick Fix for "techsprint@ticketlelo.com"

1. Open Firebase Console → Firestore → `users` collection
2. Find the user document for "techsprint@ticketlelo.com"
3. Add fields:
   ```
   eventsAllowed: 2    (they've created 1, want to create 1 more)
   eventsCreated: 1    (they've already created "Tech Sprint 4.0")
   ```
4. Save
5. **Done!** They can now create 1 more event without submitting a hosting request.

If they want to create even more events, they should:

1. Submit a new hosting request
2. Wait for super admin approval
3. System will automatically increase `eventsAllowed` by 1

---

## 📞 Support

If issues persist after adding these fields:

- Check browser console for errors
- Verify the organizer is logged in with the correct account
- Clear browser cache and hard refresh (Ctrl+Shift+R)
- Check that `role: "organiser"` is set correctly

---

**Last Updated**: April 12, 2026  
**Version**: 1.0
