/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/database", "@workspace/auth"],
  serverExternalPackages: ['@prisma/client'],
}

export default nextConfig
