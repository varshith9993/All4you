const { S3Client, PutBucketCorsCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// 1. Manually Load .env
const envPath = path.resolve(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    console.error("❌ .env file not found in functions directory!");
    process.exit(1);
}

const envConfig = fs.readFileSync(envPath, 'utf8');
envConfig.split('\n').forEach(line => {
    if (!line || line.startsWith('#')) return;
    const parts = line.split('=');
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    if (key && value) {
        process.env[key] = value;
    }
});

// Verify Env Vars
const requiredVars = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
const missingVars = requiredVars.filter(key => !process.env[key]);
if (missingVars.length > 0) {
    console.error("❌ Missing required environment variables:", missingVars.join(', '));
    process.exit(1);
}

const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const run = async () => {
    console.log("Configuring CORS for bucket:", process.env.R2_BUCKET_NAME);

    try {
        await r2.send(new PutBucketCorsCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            CORSConfiguration: {
                CORSRules: [
                    {
                        AllowedHeaders: ["*"],
                        AllowedMethods: ["PUT", "GET", "HEAD", "DELETE"],
                        AllowedOrigins: ["*"], // Allow all for smooth migration/dev
                        ExposeHeaders: ["ETag"],
                        MaxAgeSeconds: 3000
                    }
                ]
            }
        }));
        console.log("✅ CORS configured successfully!");
    } catch (error) {
        console.error("❌ Error configuring CORS:", error);
    }
};

run();
