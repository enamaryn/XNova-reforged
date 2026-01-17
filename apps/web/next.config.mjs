import os from "node:os";

const envOrigins = process.env.DEV_ALLOWED_ORIGINS ?? "";
const extraOrigins = envOrigins
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const localIps = Object.values(os.networkInterfaces())
  .flatMap((interfaces) => interfaces ?? [])
  .filter((iface) => iface && iface.family === "IPv4" && !iface.internal)
  .map((iface) => `http://${iface.address}:3000`);

const allowedDevOrigins = Array.from(
  new Set([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...localIps,
    ...extraOrigins,
  ])
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins,
};

export default nextConfig;
