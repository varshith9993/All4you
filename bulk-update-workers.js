// Bulk Update Script for Workers
// This will add createdBy field to ALL workers at once

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = {
    "type": "service_account",
    "project_id": "g-maps-api-472115",
    "private_key_id": "f71fbd7288dd66ffb30e211e6da313d6ebe04843",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDCJJj6jDm6diX+\nrUIy1Jg0QCry0leesbaVdvKHjmzhZrflThPib+n6kJGFeqOCAJoOGhdyxIs1B0lT\nwVdfOBHW/RV0kwCTlyOKVZUHHrw1SMDzWKVw42aBZlKlKdAwrplp/mgfA5P3t3u1\ninGdwDdza+Gy5t5KMqC6VeasbBD615PrGXxYqGEY7v8gBjIrcxZ/jEIs6LokJT9v\nIQOSvXLzWhbqWGl3+wwkkF9v7+36TM8IyYA1T+KrWAksUiemkhc6RE68iCWV6FRO\nci0bceNhF6g+OkoR1CmfMZAqZa9oN+myNl5XvbJD4qpQpABLAclYR9taVFY20AzE\n67uystOlAgMBAAECggEABS18W6OVaeN7GZgy/Zpi4XMxUgmJvFnpUIImxLZn2/kP\n1Xs9bNq8PD+nyeNel08pzKTQfvHpSTBDud/xqGtH5S/EZzgBGhk79uqtD064CURt\nSkV7yrod1+dL3qDHWc0GRWfmDKcH8WGA2J4eb+0aQtHxPS1gEfguBi+CopLn6bCo\nj0bX25+KZgaHHkaMS/Gcd2Wa/j2G07TH6CKrY3zSl7MEh196xF273jmXvZwq/TTn\nHZG4XofcntkmzxsnxZu5FewMYCG77E/J60e33zmdBFIZ6G9g+L0mK4SWLLUZmJ5R\nzg6llNqreiJ3KC0YRj0DJNgFAiJbzLtE87b2/pCMLwKBgQDy+yfGi1HT7a+SOsAC\nKVSQ6lXRjO+N1IwoXEueMOMidHIQFBTPmGAtIqs+DpmAJp+eE/VL3IikcmxrtCfB\nU+Bf3eB0jJJKGQJyd//ImNqj1HrmPcXzYnGHzCj7wu+sFUtLxzPtJm9PLsKJzS7H\npvIxI1MoZMBsSuLuhmAMyiEPCwKBgQDMi44kRID/0YwnLoH7/UAf7vyHQJJRpnxq\nNLSCudL6ti535rEKTzy1EzVTfbd/a9jjjXi+rC6NrKNoghsvW/igcSTzLrMJNAxk\nxOZGTCGyiRqvnWaVmZGD0q23rx3LnCuPYxIeRIehrVAsoAfqTjBx4MMeARIOVHHd\nF925FWgWDwKBgCNGBq4yB30GolhOIxWtPlOTUUYMebJTSs2JKIkce7zCvtRKtgK1\nEjE7OTTXFb2e3ckrCI8swsFswwSXsLXGIWqJYU5KIeqT2uEXPpC2b/ccn4LRMO12\nOxkFsGVsFTMcHEQx9P3WeI48MY2jtcjSGZK8mBPjHHQcIvmRlFwG8+mlAoGBAMTU\nckbSKPSDWAQITAsJ66APILCiYWry83xcFWxKlwytLVAyDSFnmHqC7mjWbDLQvBhU\n9eE93Vp1y5Vwxeov7bOuzSi6QozTqi16EEGLV03vg1+E7sd8zLt2i7ZbbCeXs486\nfZ/kwEPDfIhEwvkknpem+vuvegmSFzPzmGhXgh7fAoGAQh9TQ5eTcpDijnKwnB0E\nU8M1eNz1nWc6i2v/PNUZg7ULNwrGCvPxhGvKRToeMpd7hv15AgQoVQgqamx8t7tx\ny2X/7FeBd8K+KMYe2AZRY9Cr1PD/I/BYjf4L/UH+gmDeH1iPua0+Q7wM3Hwjs04Y\nsgkD34RyhTkDl9QgyTjC2bM=\n-----END PRIVATE KEY-----\n",
    "client_email": "firebase-adminsdk-fbsvc@g-maps-api-472115.iam.gserviceaccount.com",
    "client_id": "109305832172358972382",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40g-maps-api-472115.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function bulkUpdateWorkers() {
    try {
        console.log("🔄 Starting bulk update of workers...\n");

        // Your User ID
        const YOUR_USER_ID = "bfxN4cGn8PUonTZuYLjhP7WiTcs1";

        // Get all workers
        const workersSnapshot = await db.collection('workers').get();
        console.log(`📊 Found ${workersSnapshot.size} workers\n`);

        if (workersSnapshot.empty) {
            console.log("⚠️  No workers found in database");
            return;
        }

        let updated = 0;
        let skipped = 0;

        // Create a batch for efficient updates
        const batch = db.batch();
        let batchCount = 0;
        const MAX_BATCH_SIZE = 500; // Firestore limit

        for (const doc of workersSnapshot.docs) {
            const workerData = doc.data();

            // Skip if already has createdBy
            if (workerData.createdBy) {
                console.log(`⏭️  Skipping ${doc.id} - already has createdBy: ${workerData.createdBy}`);
                skipped++;
                continue;
            }

            // Add to batch
            batch.update(doc.ref, { createdBy: YOUR_USER_ID });
            batchCount++;
            updated++;

            console.log(`✅ Queued ${doc.id} for update (${updated}/${workersSnapshot.size - skipped})`);

            // Commit batch if we hit the limit
            if (batchCount >= MAX_BATCH_SIZE) {
                console.log("\n💾 Committing batch...");
                await batch.commit();
                console.log("✅ Batch committed\n");
                batchCount = 0;
            }
        }

        // Commit remaining updates
        if (batchCount > 0) {
            console.log("\n💾 Committing final batch...");
            await batch.commit();
            console.log("✅ Final batch committed\n");
        }

        console.log("\n🎉 BULK UPDATE COMPLETE!");
        console.log("═══════════════════════════");
        console.log(`✅ Updated: ${updated} workers`);
        console.log(`⏭️  Skipped: ${skipped} workers (already had createdBy)`);
        console.log("═══════════════════════════\n");

        console.log("✨ All workers now have the createdBy field!");
        console.log("🔄 Refresh your Workers page to see the changes\n");

        process.exit(0);

    } catch (error) {
        console.error("\n❌ BULK UPDATE FAILED:");
        console.error(error);
        process.exit(1);
    }
}

// Run the bulk update
bulkUpdateWorkers();
