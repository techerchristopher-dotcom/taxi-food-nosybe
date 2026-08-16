/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Dashboard 100% client-side → export statique (dossier out/), déployable tel quel
  // sur Netlify sans le runtime Next. La RLS + le rôle admin protègent les données.
  output: 'export',
};

export default nextConfig;
