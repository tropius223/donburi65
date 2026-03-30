import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import Sitemap from 'vite-plugin-sitemap' // 追加

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    Sitemap({
      hostname: 'https://donburi.app',
      // publicディレクトリにある静的HTMLファイルをリストに追加
      dynamicRoutes: [
        '/manual.html',
        '/terms.html',
        '/privacy.html',
        '/precautions.html',
        '/legal-basis.html'
      ],
      // 末尾に .html をつけるかどうか、ドメイン直後のスラッシュなどの調整
      readable: true, // 出力されるXMLを見やすく整形する
    }),
  ],
  server: {
    host: true,
    strictPort: true,
  },
})