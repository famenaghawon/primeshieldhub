import fs from "fs";
import https from "https";

const CONFIG = {
  url: "https://primeshieldhub-production.primeshieldhub-a74.workers.dev",
  cookieFile: "./auth-cookies.json",
  fingerprintFile: "./fingerprint.json",
};

// Load cookie
const cookies = JSON.parse(fs.readFileSync(CONFIG.cookieFile, "utf8"));
const cookieHeader = Object.entries(cookies)
  .map(([k, v]) => `${k}=${v}`)
  .join("; ");

// Load fingerprint
const { fingerprint } = JSON.parse(fs.readFileSync(CONFIG.fingerprintFile, "utf8"));

console.log("🍪 Cookie:", cookieHeader.substring(0, 50) + "...");
console.log("🔑 Fingerprint:", fingerprint);

const data = JSON.stringify({
  type: "deploy",
  status: "success",
  message: "Manual deploy test",
  timestamp: new Date().toISOString(),
});

const req = https.request(
  CONFIG.url + "/api/deploy/log",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookieHeader,
      "x-device-fingerprint": fingerprint,
    },
  },
  (res) => {
    let body = "";
    res.on("data", (chunk) => (body += chunk));
    res.on("end", () => {
      console.log("Status:", res.statusCode);
      console.log("Response:", body);
    });
  }
);

req.on("error", console.error);
req.write(data);
req.end();

