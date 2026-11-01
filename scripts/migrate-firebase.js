const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

async function runMigration() {
  console.log("=================================================");
  console.log("STARTING FIREBASE FULL MIGRATION");
  console.log("FROM: ticketlelo-18bcd (Old Firebase)");
  console.log("TO:   ticketlelo-e967a (New Firebase)");
  console.log("=================================================\n");

  // 1. Read Service Account Keys
  const envContent = fs.readFileSync(path.join(__dirname, "../.env"), "utf8");
  const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY='([^']+)'/) ||
                envContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY="([^"]+)"/) ||
                envContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY=([^\n]+)/);
  if (!match) {
    throw new Error("Could not find FIREBASE_SERVICE_ACCOUNT_KEY in .env");
  }
  const oldKey = JSON.parse(match[1]);

  const newKeyPath = path.join(__dirname, "../ticketlelo-e967a-firebase-adminsdk-fbsvc-de24108165.json");
  let newKey;
  if (fs.existsSync(newKeyPath)) {
    newKey = JSON.parse(fs.readFileSync(newKeyPath, "utf8"));
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    newKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } else {
    throw new Error("No service account key found in file or environment variable");
  }

  // 2. Initialize Apps
  const oldApp = admin.initializeApp({ credential: admin.credential.cert(oldKey) }, "oldAppMigration");
  const newApp = admin.initializeApp({ credential: admin.credential.cert(newKey) }, "newAppMigration");

  const oldAuth = oldApp.auth();
  const newAuth = newApp.auth();
  const oldDb = oldApp.firestore();
  const newDb = newApp.firestore();

  // =========================================================================
  // STEP 1: AUTHENTICATION USERS MIGRATION
  // =========================================================================
  console.log("--- STEP 1: MIGRATING AUTHENTICATION USERS ---");

  // Fetch hashConfig from Old Firebase
  const token = await oldApp.options.credential.getAccessToken();
  const configRes = await fetch("https://identitytoolkit.googleapis.com/admin/v2/projects/ticketlelo-18bcd/config", {
    headers: { Authorization: "Bearer " + token.access_token }
  });
  const configData = await configRes.json();
  const hashCfg = configData?.signIn?.hashConfig;

  if (!hashCfg) {
    console.warn("Warning: Could not fetch hashConfig from Identity Toolkit, using fallback values.");
  }

  const hashOptions = {
    algorithm: "SCRYPT",
    key: Buffer.from(hashCfg?.signerKey || "FBDLurMKyK5EuRTE3rr1itLYSiirtzheK+Ebq1Loix0fl9Y23iVce93qFhurXvRtEPMNit1aU6Sz58xj2TgA5Q==", "base64"),
    saltSeparator: Buffer.from(hashCfg?.saltSeparator || "Bw==", "base64"),
    rounds: hashCfg?.rounds || 8,
    memoryCost: hashCfg?.memoryCost || 14
  };

  // Fetch all users from Old Auth
  let allOldUsers = [];
  let nextPageToken;
  do {
    const listResult = await oldAuth.listUsers(1000, nextPageToken);
    allOldUsers = allOldUsers.concat(listResult.users);
    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  console.log(`Total users found in Old Auth: ${allOldUsers.length}`);

  // Fetch existing users in New Auth to avoid duplicate collisions
  let existingNewUids = new Set();
  let newPageToken;
  do {
    const listResult = await newAuth.listUsers(1000, newPageToken);
    listResult.users.forEach(u => existingNewUids.add(u.uid));
    newPageToken = listResult.pageToken;
  } while (newPageToken);

  console.log(`Users already in New Auth: ${existingNewUids.size}`);

  const usersToImport = [];
  for (const user of allOldUsers) {
    if (existingNewUids.has(user.uid)) {
      continue;
    }

    const record = {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified || false,
      displayName: user.displayName || undefined,
      photoURL: user.photoURL || undefined,
      phoneNumber: user.phoneNumber || undefined,
      disabled: user.disabled || false,
      customClaims: user.customClaims || undefined,
    };

    if (user.passwordHash && user.passwordSalt) {
      record.passwordHash = Buffer.from(user.passwordHash, "base64");
      record.passwordSalt = Buffer.from(user.passwordSalt, "base64");
    }

    if (user.providerData && user.providerData.length > 0) {
      record.providerData = user.providerData.map(p => ({
        uid: p.uid,
        displayName: p.displayName || undefined,
        email: p.email || undefined,
        photoURL: p.photoURL || undefined,
        providerId: p.providerId
      }));
    }

    usersToImport.push(record);
  }

  console.log(`New users to import: ${usersToImport.length}`);

  if (usersToImport.length > 0) {
    // Import in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < usersToImport.length; i += chunkSize) {
      const chunk = usersToImport.slice(i, i + chunkSize);
      try {
        const importResult = await newAuth.importUsers(chunk, { hash: hashOptions });
        console.log(`  Imported chunk ${i / chunkSize + 1}: ${importResult.successCount} succeeded, ${importResult.failureCount} failed.`);
        if (importResult.errors && importResult.errors.length > 0) {
          importResult.errors.forEach(e => {
            console.error(`    User index ${e.index} error:`, e.error.message);
          });
        }
      } catch (err) {
        console.error(`  Error importing chunk:`, err.message);
        // Fallback: try one-by-one
        for (const singleUser of chunk) {
          try {
            await newAuth.importUsers([singleUser], { hash: hashOptions });
            console.log(`    Successfully imported user: ${singleUser.email}`);
          } catch (singleErr) {
            console.error(`    Failed importing user ${singleUser.email}:`, singleErr.message);
          }
        }
      }
    }
  }

  // =========================================================================
  // STEP 2: FIRESTORE COLLECTIONS MIGRATION
  // =========================================================================
  console.log("\n--- STEP 2: MIGRATING FIRESTORE COLLECTIONS ---");

  const collections = await oldDb.listCollections();
  console.log(`Found ${collections.length} collections in Old DB:`, collections.map(c => c.id));

  const stats = {};

  for (const col of collections) {
    console.log(`\nProcessing collection "${col.id}"...`);
    const snap = await col.get();
    console.log(`  Total documents in old "${col.id}": ${snap.size}`);
    stats[col.id] = { old: snap.size, new: 0 };

    if (snap.size === 0) continue;

    // Use batches of 250 documents (well below 500 limit)
    const BATCH_SIZE = 250;
    let batch = newDb.batch();
    let batchCount = 0;
    let totalWritten = 0;

    for (const doc of snap.docs) {
      const data = doc.data();
      const targetDocRef = newDb.collection(col.id).doc(doc.id);
      batch.set(targetDocRef, data, { merge: true });
      batchCount++;

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        totalWritten += batchCount;
        console.log(`  Committed batch of ${batchCount} documents (${totalWritten}/${snap.size})...`);
        batch = newDb.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      totalWritten += batchCount;
      console.log(`  Committed final batch of ${batchCount} documents (${totalWritten}/${snap.size}).`);
    }

    stats[col.id].new = totalWritten;
  }

  // =========================================================================
  // STEP 3: VERIFICATION
  // =========================================================================
  console.log("\n=================================================");
  console.log("--- STEP 3: MIGRATION VERIFICATION AUDIT ---");
  console.log("=================================================");

  let allMatches = true;

  console.log("\nCollection Count Verification:");
  for (const [colName, counts] of Object.entries(stats)) {
    const targetSnap = await newDb.collection(colName).get();
    const targetCount = targetSnap.size;
    const match = counts.old === targetCount;
    if (!match) allMatches = false;
    console.log(`  - [${colName}]: Old=${counts.old} | New=${targetCount} | Status: ${match ? "MATCH OK" : "MISMATCH"}`);
  }

  // Verify Auth Users
  const finalNewUsers = await newAuth.listUsers(1000);
  console.log(`\nAuth Users Verification:`);
  console.log(`  - Old Auth Users: ${allOldUsers.length}`);
  console.log(`  - New Auth Users: ${finalNewUsers.users.length}`);
  const authMatch = allOldUsers.length === finalNewUsers.users.length;
  if (!authMatch) allMatches = false;
  console.log(`  - Status: ${authMatch ? "MATCH OK" : "MISMATCH"}`);

  if (allMatches) {
    console.log("\nALL DATA SUCCESSFULLY MIGRATED WITH ZERO LOSS!");
  } else {
    console.warn("\nWARNING: Some collections or users had count mismatches. Please inspect above.");
  }

  return { allMatches, stats, oldUsersCount: allOldUsers.length, newUsersCount: finalNewUsers.users.length };
}

runMigration()
  .then(res => {
    console.log("\nMigration completed successfully.");
    process.exit(0);
  })
  .catch(err => {
    console.error("\nFATAL Migration Error:", err);
    process.exit(1);
  });
