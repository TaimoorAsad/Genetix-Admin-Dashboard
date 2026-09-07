/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@whiskeysockets/baileys", "pino", "ws", "qrcode.react"],
  },
};

export default nextConfig;
