import React, { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, XCircle, Search, Database, ArrowRightLeft } from 'lucide-react';

// -----------------------------------------------------------------------------
// UI 元件：錯誤彈窗
// -----------------------------------------------------------------------------
const ErrorModal = ({ message, onClose }) => {
  if (!message) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/95 backdrop-blur-md">
      <div className="bg-white rounded-[3.5rem] shadow-2xl max-w-xl w-full p-20 border-t-[16px] border-red-600 animate-in fade-in zoom-in duration-300">
        <div className="bg-red-100 w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-10 shadow-inner">
          <AlertCircle className="w-16 h-16 text-red-600" />
        </div>
        <h3 className="text-5xl font-black text-center text-slate-900 mb-6">發生錯誤</h3>
        <p className="text-slate-600 text-center font-bold text-2xl mb-14 leading-relaxed px-4">{message}</p>
        <button 
          onClick={onClose} 
          className="w-full bg-red-600 text-white py-8 rounded-3xl font-black text-3xl hover:bg-red-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-red-500/30"
        >
          返回修改
        </button>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 主程式
// -----------------------------------------------------------------------------
export default function App() {
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [results, setResults] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasCompared, setHasCompared] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 動態載入外部工具庫
  useEffect(() => {
    if (!window.XLSX) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const getSheetData = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = window.XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          resolve(rows);
        } catch (error) { reject(error); }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleCompare = async () => {
    if (!fileA || !fileB) {
      setErrorMsg('請先完成兩個 Excel 檔案的上傳。');
      return;
    }

    setIsProcessing(true);
    setHasCompared(true);

    try {
      // 1. 處理全日庫存
      const rowsA = await getSheetData(fileA);
      const headerA = rowsA[0] || [];
      const colIdxA_Key = headerA.findIndex(c => String(c).trim() === '貨號');
      const colIdxA_Qty = headerA.findIndex(c => String(c).trim() === '庫存數量');

      if (colIdxA_Key === -1 || colIdxA_Qty === -1) throw new Error('全日 Excel 格式不符：找不到「貨號」或「庫存數量」');

      const mapA = new Map();
      rowsA.slice(1).forEach(row => {
        const key = String(row[colIdxA_Key] || '').trim();
        const qty = parseFloat(row[colIdxA_Qty]) || 0;
        if (key) mapA.set(key, (mapA.get(key) || 0) + qty);
      });

      // 2. 處理同興庫存 (自動偵測第 7-8 列)
      const rowsB = await getSheetData(fileB);
      let colIdxB_Key = -1, colIdxB_Qty = -1, startRow = 8;
      
      for (let i = 0; i < 15; i++) {
        const row = rowsB[i] || [];
        const keyIdx = row.findIndex(c => String(c).trim() === '貨品代號');
        const qtyIdx = row.findIndex(c => String(c).trim() === '副單位數量');
        if (keyIdx !== -1 && qtyIdx !== -1) {
          colIdxB_Key = keyIdx;
          colIdxB_Qty = qtyIdx;
          startRow = i + 1;
          break;
        }
      }

      if (colIdxB_Key === -1) throw new Error('同興 Excel 格式不符：找不到「貨品代號」或「副單位數量」');

      const mapB = new Map();
      rowsB.slice(startRow).forEach(row => {
        const key = String(row[colIdxB_Key] || '').trim();
        const qty = parseFloat(row[colIdxB_Qty]) || 0;
        if (key && key !== 'undefined') mapB.set(key, (mapB.get(key) || 0) + qty);
      });

      // 3. 比對
      const comparison = [];
      const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
      allKeys.forEach(key => {
        const qA = mapA.get(key) || 0;
        const qB = mapB.get(key) || 0;
        const isMatch = Math.abs(qA - qB) < 0.0001;
        comparison.push({ id: key, qA, qB, diff: qA - qB, isMatch });
      });

      comparison.sort((a, b) => (a.isMatch === b.isMatch) ? a.id.localeCompare(b.id) : a.isMatch ? 1 : -1);
      setResults(comparison);
    } catch (err) { 
      setErrorMsg(err.message); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 font-sans antialiased text-slate-900">
      {/* 頂部標頭 - 確保與設計圖完全一致的深色對比 */}
      <header className="bg-[#0F172A] pt-12 pb-16 shadow-lg border-b-8 border-blue-600">
        <div className="container mx-auto px-6 text-center">
          <div className="inline-flex items-center justify-center bg-blue-600 p-5 rounded-[2rem] mb-6 shadow-xl shadow-blue-500/40">
            <Database className="w-14 h-14 text-white" />
          </div>
          <h1 className="text-6xl font-black text-white tracking-tighter mb-3">
            全日庫存 <span className="text-blue-400 mx-2">VS</span> 同興庫存
          </h1>
          <p className="text-slate-400 text-xl font-bold tracking-widest">庫存比對工具</p>
        </div>
      </header>

      <main className="container mx-auto px-6 -mt-12 max-w-7xl">
        {/* 上傳卡片區 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
          {/* 全日 */}
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden group">
            <div className="bg-blue-600 px-10 py-6 flex items-center justify-between border-b-4 border-blue-700">
              <div className="flex items-center text-white">
                <FileSpreadsheet className="w-8 h-8 mr-4" />
                <h2 className="text-3xl font-black tracking-tight">全日庫存表</h2>
              </div>
            </div>
            <div className="p-10">
              <label className={`flex flex-col items-center justify-center h-64 border-4 border-dashed rounded-[2rem] cursor-pointer transition-all ${fileA ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}>
                <input type="file" className="hidden" onChange={(e) => setFileA(e.target.files[0])} />
                <Upload className={`w-12 h-12 mb-4 ${fileA ? 'text-blue-600' : 'text-slate-300'}`} />
                <p className="text-2xl font-black text-slate-700 text-center px-6 truncate max-w-full">
                  {fileA ? fileA.name : "上傳 全日 Excel"}
                </p>
              </label>
            </div>
          </div>

          {/* 同興 */}
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-emerald-600 px-10 py-6 flex items-center justify-between border-b-4 border-emerald-700">
              <div className="flex items-center text-white">
                <FileSpreadsheet className="w-8 h-8 mr-4" />
                <h2 className="text-3xl font-black tracking-tight">同興庫存表</h2>
              </div>
            </div>
            <div className="p-10">
              <label className={`flex flex-col items-center justify-center h-64 border-4 border-dashed rounded-[2rem] cursor-pointer transition-all ${fileB ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}>
                <input type="file" className="hidden" onChange={(e) => setFileB(e.target.files[0])} />
                <Upload className={`w-12 h-12 mb-4 ${fileB ? 'text-emerald-600' : 'text-slate-300'}`} />
                <p className="text-2xl font-black text-slate-700 text-center px-6 truncate max-w-full">
                  {fileB ? fileB.name : "上傳 同興 Excel"}
                </p>
              </label>
            </div>
          </div>
        </div>

        {/* 按鈕 */}
        <div className="flex justify-center mb-16">
          <button 
            onClick={handleCompare} 
            disabled={isProcessing}
            className="group relative flex items-center justify-center px-32 py-10 bg-blue-600 text-white text-4xl font-black tracking-[0.2em] rounded-[2rem] shadow-2xl hover:bg-blue-500 hover:-translate-y-1 active:scale-95 transition-all disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isProcessing ? "處理中..." : <><ArrowRightLeft className="w-10 h-10 mr-6" />開始比對</>}
          </button>
        </div>

        {/* 結果表格 */}
        <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden mb-20">
          <div className="bg-slate-900 px-12 py-10 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-4xl font-black text-white flex items-center">
              <Search className="w-8 h-8 mr-4 text-blue-500" /> 差異分析報告
            </h3>
            {hasCompared && (
              <div className="flex gap-4">
                <div className="bg-slate-800 px-6 py-2 rounded-2xl border border-slate-700 text-center">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">異常數</p>
                  <p className="text-2xl font-black text-red-500">{results.filter(r => !r.isMatch).length}</p>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto min-h-[400px]">
            {!hasCompared ? (
              <div className="flex flex-col items-center justify-center py-40 text-slate-300">
                <Database className="w-20 h-20 mb-4 opacity-20" />
                <p className="text-3xl font-black">等待上傳檔案進行分析</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-slate-200 text-slate-600">
                    <th className="p-8 font-black text-xl">貨號</th>
                    <th className="p-8 font-black text-xl text-right">全日 (A)</th>
                    <th className="p-8 font-black text-xl text-right">同興 (B)</th>
                    <th className="p-8 font-black text-xl text-right">差異</th>
                    <th className="p-8 font-black text-xl text-center">狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((r, i) => (
                    <tr key={i} className={`hover:bg-blue-50/50 transition-colors ${!r.isMatch ? 'bg-red-50/30' : ''}`}>
                      <td className="p-8 font-mono font-black text-2xl text-slate-800">{r.id}</td>
                      <td className="p-8 text-right font-black text-3xl text-blue-700">{r.qA.toLocaleString()}</td>
                      <td className="p-8 text-right font-black text-3xl text-emerald-700">{r.qB.toLocaleString()}</td>
                      <td className={`p-8 text-right font-black text-3xl ${r.diff !== 0 ? 'text-red-600' : 'text-slate-300'}`}>
                        {r.diff > 0 ? `+${r.diff}` : r.diff}
                      </td>
                      <td className="p-8 text-center">
                        <span className={`inline-flex items-center px-6 py-2 rounded-xl text-lg font-black ${r.isMatch ? 'bg-green-100 text-green-700' : 'bg-red-600 text-white animate-pulse'}`}>
                          {r.isMatch ? <><CheckCircle className="w-5 h-5 mr-2" />一致</> : <><XCircle className="w-5 h-5 mr-2" />異常</>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      <ErrorModal message={errorMsg} onClose={() => setErrorMsg('')} />
    </div>
  );
}