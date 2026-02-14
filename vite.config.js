import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 注意：這裡的路徑必須與你的 GitHub 儲存庫名稱一致
  base: '/TongHsing_Roundday_InStockQuantityComparison/', 
})