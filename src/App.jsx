import React, { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, XCircle, Search, Database, ArrowRightLeft } from 'lucide-react';

export default function App() {
  const [fileA, setFileA] = useState(null); // 全日
  const [fileB, setFileB] = useState(null); // 同興
  const [results, setResults] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasCompared, setHasCompared] = useState(false);
  const [popup, setPopup] = useState({ show: false, message: '' });

  useEffect(() => {
    if (!window.XLSX) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const showAlert = (msg) => setPopup({ show: true, message: msg });
  const closeAlert = () => setPopup({ show: false, message: '' });

  const getFirstSheetData = (file) => {
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
    if (!fileA) return showAlert('請上傳全日庫存表');
    if (!fileB) return showAlert('請上傳同興庫存表');

    setIsProcessing(true);
    setHasCompared(true);

    try {
      const rowsA = await getFirstSheetData(fileA);
      const headerA = rowsA[0] || [];
      const colIdxA_Key = headerA.findIndex(c => String(c).trim() === '貨號');
      const colIdxA_Qty = headerA.findIndex(c => String(c).trim() === '庫存數量');

      if (colIdxA_Key === -1 || colIdxA_Qty === -1) throw new Error('全日 Excel 格式錯誤：找不到「貨號」或「庫存數量」');

      const mapA = new Map();
      rowsA.slice(1).forEach(row => {
        const key = String(row[colIdxA_Key] || '').trim();
        const qty = parseFloat(row[colIdxA_Qty]) || 0;
        if (key) mapA.set(key, (mapA.get(key) || 0) + qty);
      });

      const rowsB = await getFirstSheetData(fileB);
      const row7 = rowsB[6] || [];
      const row8 = rowsB[7] || [];
      let colIdxB_Key = row7.findIndex(c => String(c).trim() === '貨品代號');
      if (colIdxB_Key === -1) colIdxB_Key = row8.findIndex(c => String(c).trim() === '貨品代號');
      let colIdxB_Qty = row7.findIndex(c => String(c).trim() === '副單位數量');
      if (colIdxB_Qty === -1) colIdxB_Qty = row8.findIndex(c => String(c).trim() === '副單位數量');

      if (colIdxB_Key === -1 || colIdxB_Qty === -1) throw new Error('同興 Excel 格式錯誤：找不到「貨品代號」或「副單位數量」');

      const mapB = new Map();
      rowsB.slice(8).forEach(row => {
        const key = String(row[colIdxB_Key] || '').trim();
        const qty = parseFloat(row[colIdxB_Qty]) || 0;
        if (key && key !== 'undefined') mapB.set(key, (mapB.get(key) || 0) + qty);
      });

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
    } catch (err) { showAlert(err.message); } finally { setIsProcessing(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 font-sans antialiased text-slate-900">
      {/* HEADER: 深色主題背景 */}
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
        {/* 上層：檔案上傳 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
          {/* 全日庫存表 */}
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden transform transition-transform hover:scale-[1.01]">
            <div className="bg-blue-600 px-10 py-6 flex items-center justify-between border-b-4 border-blue-700">
              <div className="flex items-center text-white">
                <FileSpreadsheet className="w-8 h-8 mr-4" />
                <h2 className="text-3xl font-black tracking-tight">全日庫存表</h2>
              </div>
              <span className="bg-white/20 text-white text-sm px-4 py-1.5 rounded-full font-black border border-white/30 backdrop-blur-sm">
                讀取第一列標題
              </span>
            </div>
            <div className="p-10">
              <label className={`group flex flex-col items-center justify-center h-64 border-4 border-dashed rounded-[2rem] cursor-pointer transition-all duration-300 ${fileA ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-white'}`}>
                <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => setFileA(e.target.files[0])} />
                <div className={`p-6 rounded-full mb-4 transition-all ${fileA ? 'bg-blue-600 text-white rotate-0' : 'bg-slate-200 text-slate-400 group-hover:scale-110'}`}>
                   <Upload className="w-10 h-10" />
                </div>
                <p className={`text-2xl font-black text-center px-6 leading-tight ${fileA ? 'text-blue-900' : 'text-slate-500'}`}>
                  {fileA ? fileA.name : "點擊或拖曳上傳 全日 Excel"}
                </p>
              </label>
            </div>
          </div>

          {/* 同興庫存表 */}
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden transform transition-transform hover:scale-[1.01]">
            <div className="bg-emerald-600 px-10 py-6 flex items-center justify-between border-b-4 border-emerald-700">
              <div className="flex items-center text-white">
                <FileSpreadsheet className="w-8 h-8 mr-4" />
                <h2 className="text-3xl font-black tracking-tight">同興庫存表</h2>
              </div>
              <span className="bg-white/20 text-white text-sm px-4 py-1.5 rounded-full font-black border border-white/30 backdrop-blur-sm">
                自動偵測第 7-8 列
              </span>
            </div>
            <div className="p-10">
              <label className={`group flex flex-col items-center justify-center h-64 border-4 border-dashed rounded-[2rem] cursor-pointer transition-all duration-300 ${fileB ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 bg-slate-50 hover:border-emerald-400 hover:bg-white'}`}>
                <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => setFileB(e.target.files[0])} />
                <div className={`p-6 rounded-full mb-4 transition-all ${fileB ? 'bg-emerald-600 text-white rotate-0' : 'bg-slate-200 text-slate-400 group-hover:scale-110'}`}>
                   <Upload className="w-10 h-10" />
                </div>
                <p className={`text-2xl font-black text-center px-6 leading-tight ${fileB ? 'text-emerald-900' : 'text-slate-500'}`}>
                  {fileB ? fileB.name : "點擊或拖曳上傳 同興 Excel"}
                </p>
              </label>
            </div>
          </div>
        </div>

        {/* 核心按鈕區 */}
        <div className="flex justify-center mb-16">
          <button 
            onClick={handleCompare} 
            disabled={isProcessing} 
            className={`
              relative flex items-center justify-center px-32 py-10 rounded-[2rem]
              text-4xl font-black tracking-[0.2em] shadow-2xl transition-all active:scale-95
              ${isProcessing 
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-500 hover:shadow-blue-500/50 hover:-translate-y-1'
              }
            `}
          >
            {isProcessing ? (
              <span className="flex items-center">
                <svg className="animate-spin h-10 w-10 mr-6 text-slate-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                正在處理中...
              </span>
            ) : (
              <>
                <ArrowRightLeft className="w-10 h-10 mr-6" />
                開始比對
              </>
            )}
          </button>
        </div>

        {/* 結果清單 */}
        <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 px-12 py-10 border-b border-slate-800 flex flex-wrap justify-between items-center gap-8">
            <div className="flex items-center">
              <div className="bg-blue-600 p-3 rounded-2xl mr-5">
                <Search className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-4xl font-black text-white tracking-tight">差異分析報告</h3>
            </div>
            
            {hasCompared && (
              <div className="flex gap-6">
                <div className="bg-slate-800 border border-slate-700 px-8 py-4 rounded-3xl flex flex-col items-center min-w-[120px]">
                  <span className="text-slate-400 text-sm font-black mb-1 uppercase tracking-widest">總品項</span>
                  <span className="text-3xl font-black text-white">{results.length}</span>
                </div>
                <div className="bg-red-950 border border-red-800 px-8 py-4 rounded-3xl flex flex-col items-center min-w-[120px]">
                  <span className="text-red-400 text-sm font-black mb-1 uppercase tracking-widest">異常數</span>
                  <span className="text-3xl font-black text-red-500">{results.filter(r => !r.isMatch).length}</span>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto min-h-[600px] bg-white">
            {!hasCompared ? (
              <div className="flex flex-col items-center justify-center py-60">
                <div className="bg-slate-100 p-10 rounded-full mb-8">
                   <Database className="w-24 h-24 text-slate-300" />
                </div>
                <p className="text-4xl font-black tracking-tighter text-slate-300">請先上傳檔案並點擊開始比對</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 border-b-2 border-slate-200">
                    <th className="p-8 font-black text-xl">貨號 / 貨品代號</th>
                    <th className="p-8 font-black text-xl text-right">全日庫存 (A)</th>
                    <th className="p-8 font-black text-xl text-right">同興庫存 (B)</th>
                    <th className="p-8 font-black text-xl text-right">差異數值 (A-B)</th>
                    <th className="p-8 font-black text-xl text-center">狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((r, idx) => (
                    <tr key={idx} className={`group hover:bg-blue-50/60 transition-colors ${!r.isMatch ? 'bg-red-50/40' : ''}`}>
                      <td className="p-8 font-mono font-black text-slate-800 text-2xl tracking-tighter">{r.id}</td>
                      <td className="p-8 text-right font-black text-3xl text-blue-700">{r.qA.toLocaleString()}</td>
                      <td className="p-8 text-right font-black text-3xl text-emerald-700">{r.qB.toLocaleString()}</td>
                      <td className={`p-8 text-right font-black text-3xl ${r.diff !== 0 ? 'text-red-600 bg-red-100/50 rounded-2xl' : 'text-slate-300'}`}>
                        {r.diff === 0 ? "0" : (r.diff > 0 ? `+${r.diff.toLocaleString()}` : r.diff.toLocaleString())}
                      </td>
                      <td className="p-8 text-center">
                        <span className={`inline-flex items-center px-8 py-3 rounded-2xl text-lg font-black shadow-sm
                          ${r.isMatch 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-600 text-white animate-pulse shadow-red-200'
                          }`}>
                          {r.isMatch ? <><CheckCircle className="w-5 h-5 mr-3" />數據一致</> : <><XCircle className="w-5 h-5 mr-3" />數據異常</>}
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

      {/* 錯誤彈窗 */}
      {popup.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/95 backdrop-blur-md">
          <div className="bg-white rounded-[3.5rem] shadow-2xl max-w-xl w-full p-20 border-t-[16px] border-red-600">
            <div className="bg-red-100 w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-10 shadow-inner">
              <AlertCircle className="w-16 h-16 text-red-600" />
            </div>
            <h3 className="text-5xl font-black text-center text-slate-900 mb-6">發生錯誤</h3>
            <p className="text-slate-600 text-center font-bold text-2xl mb-14 leading-relaxed px-4">{popup.message}</p>
            <button 
              onClick={closeAlert} 
              className="w-full bg-red-600 text-white py-8 rounded-3xl font-black text-3xl hover:bg-red-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-red-500/30"
            >
              返回修改
            </button>
          </div>
        </div>
      )}
    </div>
  );
}