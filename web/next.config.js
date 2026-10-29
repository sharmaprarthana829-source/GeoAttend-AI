const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, "../"),
  allowedDevOrigins: ["192.168.31.68", "localhost:3000"],
};

module.exports = nextConfig;
