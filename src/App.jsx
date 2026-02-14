import React, { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, XCircle, Search, Database, PlayCircle } from 'lucide-react';

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
    if (!fileA) return showAlert('請上傳全日庫存表Excel檔案');
    if (!fileB) return showAlert('請上傳同興庫存表Excel檔案');

    setIsProcessing(true);
    setHasCompared(true);

    try {
      const rowsA = await getFirstSheetData(fileA);
      const headerA = rowsA[0] || [];
      const colIdxA_Key = headerA.findIndex(c => String(c).trim() === '貨號');
      const colIdxA_Qty = headerA.findIndex(c => String(c).trim() === '庫存數量');

      if (colIdxA_Key === -1 || colIdxA_Qty === -1) throw new Error('全日庫存表格式錯誤：找不到「貨號」或「庫存數量」欄位');

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

      if (colIdxB_Key === -1 || colIdxB_Qty === -1) throw new Error('同興庫存表格式錯誤：第7-8列找不到「貨品代號」或「副單位數量」');

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
    <div className="min-h-screen bg-slate-50 pb-20 font-sans antialiased text-slate-900">
      <header className="bg-slate-900 py-12 shadow-xl border-b-4 border-blue-600">
        <div className="container mx-auto px-6 text-center">
          <div className="inline-flex items-center justify-center bg-blue-600 p-3 rounded-2xl mb-4 shadow-lg">
            <Database className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">全日庫存 vs 同興庫存 比對系統</h1>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-16">
          <section className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden transform transition-all hover:scale-[1.01]">
            <div className="bg-blue-700 px-6 py-4 flex items-center text-white">
              <FileSpreadsheet className="w-6 h-6 mr-3" />
              <h2 className="text-xl font-black">全日庫存表</h2>
            </div>
            <div className="p-8">
              <label className={`relative flex flex-col items-center justify-center h-52 border-4 border-dashed rounded-3xl cursor-pointer transition-all duration-300 ${fileA ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:bg-white hover:border-blue-400'}`}>
                <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => setFileA(e.target.files[0])} />
                <Upload className={`w-12 h-12 mb-4 ${fileA ? 'text-blue-600' : 'text-slate-400'}`} />
                <p className={`text-lg font-black text-center px-4 ${fileA ? 'text-blue-900' : 'text-slate-500'}`}>
                  {fileA ? fileA.name : "上傳全日 Excel"}
                </p>
              </label>
            </div>
          </section>

          <section className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden transform transition-all hover:scale-[1.01]">
            <div className="bg-emerald-700 px-6 py-4 flex items-center text-white">
              <FileSpreadsheet className="w-6 h-6 mr-3" />
              <h2 className="text-xl font-black">同興庫存表</h2>
            </div>
            <div className="p-8">
              <label className={`relative flex flex-col items-center justify-center h-52 border-4 border-dashed rounded-3xl cursor-pointer transition-all duration-300 ${fileB ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50 hover:bg-white hover:border-emerald-400'}`}>
                <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => setFileB(e.target.files[0])} />
                <Upload className={`w-12 h-12 mb-4 ${fileB ? 'text-emerald-600' : 'text-slate-400'}`} />
                <p className={`text-lg font-black text-center px-4 ${fileB ? 'text-emerald-900' : 'text-slate-500'}`}>
                  {fileB ? fileB.name : "上傳同興 Excel"}
                </p>
              </label>
            </div>
          </section>
        </div>

        <div className="flex flex-col items-center justify-center mb-20">
          <button 
            onClick={handleCompare} 
            disabled={isProcessing} 
            className={`
              relative flex items-center justify-center px-24 py-8 rounded-2xl
              text-4xl font-black tracking-widest transition-all duration-200
              ${isProcessing 
                ? 'bg-slate-400 cursor-not-allowed translate-y-0 shadow-none' 
                : 'bg-blue-600 hover:bg-blue-500 active:translate-y-1 active:shadow-inner'
              }
              text-white shadow-[0_12px_0_0_#1e40af] hover:shadow-[0_8px_0_0_#1e40af]
            `}
          >
            {isProcessing ? "比對中..." : "開始比對"}
          </button>
        </div>

        <section className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 px-8 py-8 border-b border-slate-700 flex flex-wrap justify-between items-center gap-6 text-white">
            <div className="flex items-center">
              <div className="bg-blue-500/20 p-2.5 rounded-xl mr-4 border border-blue-500/30 text-blue-400">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black tracking-wider">比對分析明細</h3>
            </div>
            
            {hasCompared && (
              <div className="flex gap-4">
                <div className="bg-slate-800 px-6 py-2.5 rounded-2xl border border-slate-700">
                  <span className="text-slate-500 text-[10px] block font-black uppercase">總項目數</span>
                  <span className="text-2xl font-black text-white">{results.length}</span>
                </div>
                <div className="bg-red-500/10 px-6 py-2.5 rounded-2xl border border-red-500/30">
                  <span className="text-red-400 text-[10px] block font-black uppercase">數量異常</span>
                  <span className="text-2xl font-black text-red-500">{results.filter(r => !r.isMatch).length}</span>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto min-h-[400px]">
            {!hasCompared ? (
              <div className="py-40 text-center">
                <Database className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 text-2xl font-black">請上傳檔案後點擊「開始比對」</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-900 border-b-2 border-slate-200">
                    <th className="p-6 font-black text-sm">貨號 / 貨品代號</th>
                    <th className="p-6 font-black text-sm text-right">全日庫存</th>
                    <th className="p-6 font-black text-sm text-right">同興庫存</th>
                    <th className="p-6 font-black text-sm text-right">差異數值</th>
                    <th className="p-6 font-black text-sm text-center">狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((r, idx) => (
                    <tr key={idx} className={`group transition-colors ${!r.isMatch ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-slate-50/50'}`}>
                      <td className="p-6 font-mono font-black text-slate-800">{r.id}</td>
                      <td className="p-6 text-right font-bold text-blue-700">{r.qA.toLocaleString()}</td>
                      <td className="p-6 text-right font-bold text-emerald-700">{r.qB.toLocaleString()}</td>
                      <td className={`p-6 text-right font-black ${!r.isMatch ? 'text-red-600' : 'text-slate-400'}`}>
                        {r.diff === 0 ? '-' : r.diff.toLocaleString()}
                      </td>
                      <td className="p-6 text-center">
                        <div className={`inline-flex items-center px-5 py-1.5 rounded-full text-xs font-black border-2
                          ${r.isMatch 
                            ? 'bg-green-100 text-green-800 border-green-500' 
                            : 'bg-red-100 text-red-800 border-red-500'
                          }`}>
                          {r.isMatch ? "一致" : "不一致"}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      {popup.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-12 border-b-8 border-red-500">
            <AlertCircle className="w-14 h-14 text-red-600 mx-auto mb-8" />
            <h3 className="text-3xl font-black text-center text-slate-900 mb-4">提醒</h3>
            <p className="text-slate-600 text-center font-bold text-lg mb-10 leading-relaxed">{popup.message}</p>
            <button onClick={closeAlert} className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black text-xl active:scale-95">確定</button>
          </div>
        </div>
      )}
    </div>
  );
}