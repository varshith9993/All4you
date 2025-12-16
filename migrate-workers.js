// Migration Script: Add createdBy field to existing workers
// Run this ONCE to update all existing workers in Firebase

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDn52J3u3BZicSgsLBDGoZ0kjPZIHtVutk",
    authDomain: "g-maps-api-472115.firebaseapp.com",
    projectId: "g-maps-api-472115",
    storageBucket: "g-maps-api-472115.firebasestorage.app",
    messagingSenderId: "687085939527",
    appId: "1:687085939527:web:9082b5bb1a5843df7efa62",
    databaseURL: "https://g-maps-api-472115-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateWorkers() {
    try {
        console.log("🔄 Starting migration...");

        // Get all workers
        const workersSnapshot = await getDocs(collection(db, 'workers'));
        console.log(`📊 Found ${workersSnapshot.size} workers to migrate`);

        let updated = 0;
        let skipped = 0;

        // Prompt for the user ID to assign to workers without createdBy
        const defaultUserId = prompt("Enter the USER ID to assign to existing workers (your current user ID):");

        if (!defaultUserId) {
            console.error("❌ No user ID provided. Migration cancelled.");
            return;
        }

        for (const workerDoc of workersSnapshot.docs) {
            const workerData = workerDoc.data();

            // Check if createdBy already exists
            if (workerData.createdBy) {
                console.log(`⏭️  Skipping worker ${workerDoc.id} - already has createdBy`);
                skipped++;
                continue;
            }

            // Update the worker with createdBy field
            await updateDoc(doc(db, 'workers', workerDoc.id), {
                createdBy: defaultUserId
            });

            console.log(`✅ Updated worker ${workerDoc.id}`);
            updated++;
        }

        console.log("\n🎉 Migration complete!");
        console.log(`✅ Updated: ${updated} workers`);
        console.log(`⏭️  Skipped: ${skipped} workers (already had createdBy)`);

    } catch (error) {
        console.error("❌ Migration failed:", error);
    }
}

// Run the migration
migrateWorkers();
