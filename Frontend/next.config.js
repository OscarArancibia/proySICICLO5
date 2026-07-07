module.exports = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ["reflex-vagrantly-pettiness.ngrok-free.dev"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:5001/api/:path*",
      },
    ];
  },
};
