import { defineConfig } from 'vite';

export default defineConfig({
    // Babylon.js can be large, so we might want to optimize chunks later
    build: {
        sourcemap: true,
    },
    // server: {
    //     port: 3000,
    // }
});
