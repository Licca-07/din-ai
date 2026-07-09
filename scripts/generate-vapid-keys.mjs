import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("Add these to Vercel / .env.local:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:n_ku_ag77@outlook.jp");
