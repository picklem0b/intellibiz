/** @type {import('next').NextConfig} */
const path = require('node:path');
const nextConfig = {
	outputFileTracingRoot: path.join(__dirname, '..'),
	reactStrictMode: true,
	output: 'export',
	images: {
		unoptimized: true
	}
};

module.exports = nextConfig;
