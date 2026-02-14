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
      {/* HEADER: 清晰的大標題區 */}
      <header className="bg-[#0F172A] pt-12 pb-16 shadow-lg border-b-4 border-blue-600">
        <div className="container mx-auto px-6 text-center">
          <div className="inline-flex items-center justify-center bg-blue-600 p-4 rounded-3xl mb-6 shadow-lg shadow-blue-500/30">
            <Database className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl font-black text-white tracking-tight mb-2">
            全日庫存 <span className="text-blue-400 mx-2">VS</span> 同興庫存
          </h1>
          <p className="text-slate-400 text-lg font-bold">自動化數據比對系統 v2.0</p>
        </div>
      </header>

      <main className="container mx-auto px-6 -mt-10 max-w-7xl">
        {/* 上層：檔案上傳 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* 全日庫存表 */}
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-blue-600 px-8 py-5 flex items-center justify-between">
              <div className="flex items-center text-white">
                <FileSpreadsheet className="w-7 h-7 mr-3" />
                <h2 className="text-2xl font-black">全日庫存表</h2>
              </div>
              <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full font-bold">標題列於第一列</span>
            </div>
            <div className="p-10">
              <label className={`group flex flex-col items-center justify-center h-56 border-4 border-dashed rounded-[2rem] cursor-pointer transition-all duration-300 ${fileA ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-white'}`}>
                <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => setFileA(e.target.files[0])} />
                <Upload className={`w-14 h-14 mb-4 transition-transform group-hover:-translate-y-1 ${fileA ? 'text-blue-600' : 'text-slate-400'}`} />
                <p className={`text-xl font-black text-center px-6 leading-tight ${fileA ? 'text-blue-900' : 'text-slate-500'}`}>
                  {fileA ? fileA.name : "請選擇或拖曳全日 Excel"}
                </p>
              </label>
            </div>
          </div>

          {/* 同興庫存表 */}
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-emerald-600 px-8 py-5 flex items-center justify-between">
              <div className="flex items-center text-white">
                <FileSpreadsheet className="w-7 h-7 mr-3" />
                <h2 className="text-2xl font-black">同興庫存表</h2>
              </div>
              <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full font-bold">自動偵測第7-8列</span>
            </div>
            <div className="p-10">
              <label className={`group flex flex-col items-center justify-center h-56 border-4 border-dashed rounded-[2rem] cursor-pointer transition-all duration-300 ${fileB ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-white'}`}>
                <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => setFileB(e.target.files[0])} />
                <Upload className={`w-14 h-14 mb-4 transition-transform group-hover:-translate-y-1 ${fileB ? 'text-emerald-600' : 'text-slate-400'}`} />
                <p className={`text-xl font-black text-center px-6 leading-tight ${fileB ? 'text-emerald-900' : 'text-slate-500'}`}>
                  {fileB ? fileB.name : "請選擇或拖曳同興 Excel"}
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
              relative flex items-center justify-center px-28 py-8 rounded-[1.5rem]
              text-4xl font-black tracking-widest shadow-2xl transition-all active:scale-95
              ${isProcessing 
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-500 hover:shadow-blue-500/40'
              }
            `}
          >
            {isProcessing ? (
              <span className="flex items-center">
                <svg className="animate-spin h-8 w-8 mr-4 text-slate-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                比對中...
              </span>
            ) : "開始比對"}
          </button>
        </div>

        {/* 結果清單 */}
        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-10 py-8 border-b border-slate-200 flex flex-wrap justify-between items-center gap-6">
            <div className="flex items-center">
              <Search className="w-8 h-8 text-blue-600 mr-4" />
              <h3 className="text-3xl font-black text-slate-800 tracking-tight">比對結果清單</h3>
            </div>
            
            {hasCompared && (
              <div className="flex gap-4">
                <div className="bg-white border-2 border-slate-200 px-6 py-3 rounded-2xl flex flex-col items-center">
                  <span className="text-slate-400 text-xs font-black mb-1">總項次</span>
                  <span className="text-2xl font-black text-slate-800">{results.length}</span>
                </div>
                <div className="bg-red-50 border-2 border-red-500 px-6 py-3 rounded-2xl flex flex-col items-center">
                  <span className="text-red-500 text-xs font-black mb-1">數量異常</span>
                  <span className="text-2xl font-black text-red-600">{results.filter(r => !r.isMatch).length}</span>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto min-h-[500px]">
            {!hasCompared ? (
              <div className="flex flex-col items-center justify-center py-48 opacity-20">
                <Database className="w-24 h-24 mb-6" />
                <p className="text-3xl font-black tracking-tighter text-center">尚未進行比對</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="p-6 font-black text-lg border-r border-slate-700">貨號 / 貨品代號</th>
                    <th className="p-6 font-black text-lg text-right border-r border-slate-700">全日庫存</th>
                    <th className="p-6 font-black text-lg text-right border-r border-slate-700">同興庫存</th>
                    <th className="p-6 font-black text-lg text-right border-r border-slate-700">差異數值</th>
                    <th className="p-6 font-black text-lg text-center">比對狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((r, idx) => (
                    <tr key={idx} className={`hover:bg-blue-50/40 transition-colors ${!r.isMatch ? 'bg-red-50/50' : ''}`}>
                      <td className="p-6 font-mono font-black text-slate-700 text-xl tracking-tight">{r.id}</td>
                      <td className="p-6 text-right font-black text-2xl text-blue-700">{r.qA.toLocaleString()}</td>
                      <td className="p-6 text-right font-black text-2xl text-emerald-700">{r.qB.toLocaleString()}</td>
                      <td className={`p-6 text-right font-black text-2xl ${r.diff !== 0 ? 'text-red-600 underline' : 'text-slate-300'}`}>
                        {r.diff === 0 ? "0" : (r.diff > 0 ? `+${r.diff.toLocaleString()}` : r.diff.toLocaleString())}
                      </td>
                      <td className="p-6 text-center">
                        <span className={`inline-flex items-center px-6 py-2 rounded-full text-sm font-black border-2
                          ${r.isMatch 
                            ? 'bg-green-100 text-green-700 border-green-600' 
                            : 'bg-red-600 text-white border-red-700 animate-pulse'
                          }`}>
                          {r.isMatch ? <><CheckCircle className="w-4 h-4 mr-2" />一致</> : <><XCircle className="w-4 h-4 mr-2" />異常</>}
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

      {/* 彈窗 */}
      {popup.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-sm">
          <div className="bg-white rounded-[3rem] shadow-2xl max-w-lg w-full p-16 border-t-[12px] border-red-600">
            <div className="bg-red-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-10">
              <AlertCircle className="w-14 h-14 text-red-600" />
            </div>
            <h3 className="text-4xl font-black text-center text-slate-900 mb-6">發生錯誤</h3>
            <p className="text-slate-600 text-center font-bold text-xl mb-12 leading-relaxed">{popup.message}</p>
            <button 
              onClick={closeAlert} 
              className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black text-2xl hover:scale-[1.02] active:scale-95 transition-transform"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}