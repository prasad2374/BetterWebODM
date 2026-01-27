import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/

const hasDevFlag = process.argv.includes("--dev");
export default defineConfig({
	plugins: [react()],
	define: {
		__USE_DEV_ADDR__: hasDevFlag,
	},
});
