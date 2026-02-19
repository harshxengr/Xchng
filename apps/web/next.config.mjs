/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/database"],
  serverExternalPackages: ['@prisma/client'],
}

export default nextConfig
