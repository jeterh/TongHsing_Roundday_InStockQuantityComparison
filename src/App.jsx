import React, { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, XCircle, ArrowRightLeft, Search, Database } from 'lucide-react';

export default function App() {
  const [fileA, setFileA] = useState(null); // 全日
  const [fileB, setFileB] = useState(null); // 同興
  const [results, setResults] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasCompared, setHasCompared] = useState(false);
  const [popup, setPopup] = useState({ show: false, message: '' });

  // 確保 XLSX 函式庫載入
  useEffect(() => {
    if (!window.XLSX) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Popup 顯示函式
  const showAlert = (msg) => {
    setPopup({ show: true, message: msg });
  };

  const closeAlert = () => {
    setPopup({ show: false, message: '' });
  };

  // 讀取 Excel 的第一個 Sheet
  const getFirstSheetData = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = window.XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          // 轉換為二維陣列以便精確處理行列
          const rows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          resolve(rows);
        } catch (error) { reject(error); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleCompare = async () => {
    // 7. 驗證檔案是否存在
    if (!fileA) return showAlert('請上傳全日庫存表Excel檔案');
    if (!fileB) return showAlert('請上傳同興庫存表Excel檔案');

    setIsProcessing(true);
    setHasCompared(true);

    try {
      // 8(1)(2) 處理全日庫存表
      const rowsA = await getFirstSheetData(fileA);
      const headerA = rowsA[0] || [];
      const colIdxA_Key = headerA.findIndex(c => String(c).trim() === '貨號');
      const colIdxA_Qty = headerA.findIndex(c => String(c).trim() === '庫存數量');

      if (colIdxA_Key === -1 || colIdxA_Qty === -1) {
        throw new Error('全日庫存表格式錯誤：找不到「貨號」或「庫存數量」欄位');
      }

      const mapA = new Map();
      rowsA.slice(1).forEach(row => {
        const key = String(row[colIdxA_Key] || '').trim();
        const qty = parseFloat(row[colIdxA_Qty]) || 0;
        if (key) mapA.set(key, (mapA.get(key) || 0) + qty);
      });

      // 8(3)(4) 處理同興庫存表 (讀取第7, 8列作為標題判斷)
      const rowsB = await getFirstSheetData(fileB);
      // SPEC: 判斷第七列(Index 6)或第八列(Index 7)
      const row7 = rowsB[6] || [];
      const row8 = rowsB[7] || [];
      
      let colIdxB_Key = row7.findIndex(c => String(c).trim() === '貨品代號');
      if (colIdxB_Key === -1) colIdxB_Key = row8.findIndex(c => String(c).trim() === '貨品代號');
      
      let colIdxB_Qty = row7.findIndex(c => String(c).trim() === '副單位數量');
      if (colIdxB_Qty === -1) colIdxB_Qty = row8.findIndex(c => String(c).trim() === '副單位數量');

      if (colIdxB_Key === -1 || colIdxB_Qty === -1) {
        throw new Error('同興庫存表格式錯誤：第7-8列找不到「貨品代號」或「副單位數量」');
      }

      const mapB = new Map();
      // 從標題列之後開始讀取資料 (從第9列開始，Index 8)
      rowsB.slice(8).forEach(row => {
        const key = String(row[colIdxB_Key] || '').trim();
        const qty = parseFloat(row[colIdxB_Qty]) || 0;
        if (key && key !== 'undefined') mapB.set(key, (mapB.get(key) || 0) + qty);
      });

      // 8(5)(6) 執行比對邏輯
      const comparison = [];
      const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);

      allKeys.forEach(key => {
        const qA = mapA.get(key) || 0;
        const qB = mapB.get(key) || 0;
        const isMatch = Math.abs(qA - qB) < 0.0001;

        // SPEC 8(6): 找出相同代號但數量不相同的品項
        // 我們列出所有項目，但將不一致的標記出來
        comparison.push({
          id: key,
          qA: qA,
          qB: qB,
          diff: qA - qB,
          isMatch: isMatch
        });
      });

      // 排序：不一致的優先
      comparison.sort((a, b) => (a.isMatch === b.isMatch) ? a.id.localeCompare(b.id) : a.isMatch ? 1 : -1);
      setResults(comparison);

    } catch (err) {
      showAlert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-slate-800 text-white p-6 shadow-md border-b-4 border-indigo-500">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Database className="w-8 h-8 text-indigo-400" />
            <h1 className="text-2xl font-black tracking-wider text-white">全日/同興庫存比對工具</h1>
          </div>
          <div className="text-sm text-slate-400 font-mono">Senior Dev Version 2.0</div>
        </div>
      </header>

      <main className="container mx-auto p-6 max-w-7xl">
        {/* 5. 上半部區塊 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* (1) 上半部左邊：全日庫存表 */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="bg-blue-600 p-4">
              <h2 className="text-white font-bold flex items-center">
                <FileSpreadsheet className="mr-2" /> 全日庫存表
              </h2>
            </div>
            <div className="p-8">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-blue-200 border-dashed rounded-lg cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-3 text-blue-500" />
                  <p className="mb-2 text-sm text-blue-700 font-bold">
                    {fileA ? fileA.name : "點擊或拖拽上傳全日 Excel"}
                  </p>
                </div>
                <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => setFileA(e.target.files[0])} />
              </label>
            </div>
          </div>

          {/* (2) 上半部右邊：同興庫存表 */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="bg-emerald-600 p-4">
              <h2 className="text-white font-bold flex items-center">
                <FileSpreadsheet className="mr-2" /> 同興庫存表
              </h2>
            </div>
            <div className="p-8">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-emerald-200 border-dashed rounded-lg cursor-pointer bg-emerald-50 hover:bg-emerald-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-3 text-emerald-500" />
                  <p className="mb-2 text-sm text-emerald-700 font-bold">
                    {fileB ? fileB.name : "點擊或拖拽上傳同興 Excel"}
                  </p>
                </div>
                <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => setFileB(e.target.files[0])} />
              </label>
            </div>
          </div>
        </div>

        {/* 6. 開始比對按鈕 */}
        <div className="flex justify-center mb-10">
          <button 
            onClick={handleCompare}
            disabled={isProcessing}
            className="group flex items-center bg-slate-900 text-white px-20 py-5 rounded-full text-2xl font-black shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all disabled:bg-slate-400"
          >
            {isProcessing ? '數據處理中...' : '開始比對'}
            <ArrowRightLeft className="ml-3 w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
          </button>
        </div>

        {/* 5(3) 下半部區塊：比對結果 */}
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 overflow-hidden min-h-[500px]">
          <div className="bg-slate-100 p-6 border-b flex justify-between items-center">
            <h3 className="text-xl font-black text-slate-800 flex items-center">
              <Search className="w-6 h-6 mr-2 text-indigo-600" /> 比對結果
            </h3>
            {hasCompared && (
              <div className="flex space-x-4">
                <div className="bg-white px-4 py-2 rounded-lg border border-slate-300 shadow-sm text-sm font-bold">
                  異常品項：<span className="text-red-600 text-lg">{results.filter(r => !r.isMatch).length}</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="overflow-x-auto">
            {!hasCompared ? (
              <div className="py-40 text-center flex flex-col items-center justify-center">
                <Database className="w-20 h-20 text-slate-200 mb-4" />
                <p className="text-slate-400 text-xl font-bold font-sans">請上傳檔案並啟動比對系統</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white text-sm uppercase tracking-wider">
                    <th className="p-5 font-bold border-r border-slate-700">貨號/貨品代號</th>
                    <th className="p-5 font-bold text-right border-r border-slate-700">全日(庫存數量)</th>
                    <th className="p-5 font-bold text-right border-r border-slate-700">同興(副單位數量)</th>
                    <th className="p-5 font-bold text-right border-r border-slate-700">差異數</th>
                    <th className="p-5 font-bold text-center">比對狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {results.map((r, idx) => (
                    <tr key={idx} className={`hover:bg-slate-50 transition-colors ${!r.isMatch ? 'bg-red-50/50' : ''}`}>
                      <td className="p-5 font-mono font-bold text-slate-700 border-r">{r.id}</td>
                      <td className="p-5 text-right font-bold text-blue-700 border-r">{r.qA.toLocaleString()}</td>
                      <td className="p-5 text-right font-bold text-emerald-700 border-r">{r.qB.toLocaleString()}</td>
                      <td className={`p-5 text-right font-black border-r ${!r.isMatch ? 'text-red-600' : 'text-slate-400'}`}>
                        {r.diff.toLocaleString()}
                      </td>
                      <td className="p-5 text-center">
                        <div className={`inline-flex items-center px-5 py-2 rounded-full text-sm font-black shadow-sm border-2
                          ${r.isMatch 
                            ? 'bg-green-100 text-green-800 border-green-400' 
                            : 'bg-red-100 text-red-800 border-red-400'
                          }`}>
                          {r.isMatch ? (
                            <><CheckCircle className="w-4 h-4 mr-2" />一致</>
                          ) : (
                            <><XCircle className="w-4 h-4 mr-2" />不一致</>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* 7. Popup 彈窗 */}
      {popup.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 transform transition-all animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <h3 className="text-xl font-black text-center text-slate-900 mb-2">比對中斷</h3>
            <p className="text-slate-600 text-center font-bold mb-8">{popup.message}</p>
            <button 
              onClick={closeAlert}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-black hover:bg-slate-800 transition-colors shadow-lg"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}