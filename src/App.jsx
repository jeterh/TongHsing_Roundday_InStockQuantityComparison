import React, { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, ArrowRightLeft, Search } from 'lucide-react';

/**
 * 庫存比對工具主組件
 * 規則驗證：
 * 1. 全日表欄位：[貨號] vs [庫存數量]
 * 2. 同興表欄位：[貨品代號] vs [副單位數量] (自動偵測第7-8列標題)
 * 3. 邏輯：自動對重複貨號進行加總 (Group By)，並找出 A !== B 的所有品項
 */
export default function App() {
  const [fileA, setFileA] = useState(null); 
  const [fileB, setFileB] = useState(null); 
  const [errorMsg, setErrorMsg] = useState('');
  const [results, setResults] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);
  const [hasCompared, setHasCompared] = useState(false);

  // 動態載入 XLSX Library
  useEffect(() => {
    if (window.XLSX) {
      setIsLibraryLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.async = true;
    script.onload = () => setIsLibraryLoaded(true);
    script.onerror = () => setErrorMsg('無法載入 Excel 處理元件，請檢查網路連線。');
    document.body.appendChild(script);
  }, []);

  const readExcel = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = window.XLSX.read(data, { type: 'array' });
          resolve(workbook.Sheets[workbook.SheetNames[0]]);
        } catch (error) { reject(error); }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  // 核心比對規則：Group By 加總處理
  const processData = (rawData, keyField, qtyField) => {
    const map = new Map();
    const json = window.XLSX.utils.sheet_to_json(rawData);
    json.forEach(row => {
      const key = String(row[keyField] || '').trim();
      const qty = parseFloat(row[qtyField]) || 0;
      if (key) {
        map.set(key, (map.get(key) || 0) + qty);
      }
    });
    return map;
  };

  const handleCompare = async () => {
    if (!fileA || !fileB) {
      setErrorMsg('請確認已上傳「全日」與「同興」兩份 Excel 檔案');
      return;
    }

    setIsProcessing(true);
    setHasCompared(true);
    try {
      // 1. 處理全日庫存表
      const sheetA = await readExcel(fileA);
      const mapA = processData(sheetA, '貨號', '庫存數量');

      // 2. 處理同興庫存表 (需跳過表頭偵測標題)
      const sheetB = await readExcel(fileB);
      const arrayB = window.XLSX.utils.sheet_to_json(sheetB, { header: 1 });
      let headerIdx = -1;
      for (let i = 0; i < Math.min(arrayB.length, 20); i++) {
        if (arrayB[i] && arrayB[i].some(c => String(c).trim() === '貨品代號')) {
          headerIdx = i;
          break;
        }
      }
      
      if (headerIdx === -1) {
        throw new Error('找不到同興表的標題列「貨品代號」');
      }

      const jsonB = window.XLSX.utils.sheet_to_json(sheetB, { range: headerIdx });
      const mapB = processData(jsonB, '貨品代號', '副單位數量');

      // 3. 比對數據
      const comparison = [];
      const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
      
      allKeys.forEach(key => {
        const qA = mapA.get(key) || 0;
        const qB = mapB.get(key) || 0;
        // 嚴格比對：數量不相等則紀錄
        if (Math.abs(qA - qB) > 0.0001) { 
          comparison.push({
            id: key, 
            qA: qA.toLocaleString(), 
            qB: qB.toLocaleString(), 
            diff: (qA - qB).toLocaleString(),
            status: qA === 0 ? '全日缺漏' : (qB === 0 ? '同興缺漏' : '數量不符')
          });
        }
      });

      setResults(comparison);
      setSummary({ total: allKeys.size, diff: comparison.length });
    } catch (err) {
      setErrorMsg(err.message || '解析失敗，請確認檔案內容是否正確');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 pb-10">
      <header className="bg-slate-800 text-white p-5 shadow-lg flex flex-col items-center justify-center">
        <div className="flex items-center mb-1">
          <ArrowRightLeft className="mr-3 w-6 h-6 text-indigo-400" />
          <h1 className="text-2xl font-bold tracking-tight">自動化庫存比對系統</h1>
        </div>
        <p className="text-slate-400 text-sm">全日 [貨號/庫存數量] vs 同興 [貨品代號/副單位數量]</p>
      </header>

      <main className="container mx-auto p-6 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* 全日卡片 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
               <h2 className="text-lg font-bold flex items-center text-blue-700">
                <FileSpreadsheet className="mr-2" /> 全日庫存表
              </h2>
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">格式：A1為標題</span>
            </div>
            <input 
              type="file" 
              accept=".xlsx,.xls"
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all cursor-pointer"
              onChange={(e) => setFileA(e.target.files[0])}
            />
            {fileA && <p className="mt-3 text-sm text-slate-600 flex items-center"><CheckCircle className="w-4 h-4 mr-1 text-green-500"/> {fileA.name}</p>}
          </div>

          {/* 同興卡片 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
             <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center text-emerald-700">
                <FileSpreadsheet className="mr-2" /> 同興庫存表
              </h2>
              <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded">格式：自動偵測標題</span>
            </div>
            <input 
              type="file" 
              accept=".xlsx,.xls"
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 transition-all cursor-pointer"
              onChange={(e) => setFileB(e.target.files[0])}
            />
            {fileB && <p className="mt-3 text-sm text-slate-600 flex items-center"><CheckCircle className="w-4 h-4 mr-1 text-green-500"/> {fileB.name}</p>}
          </div>
        </div>

        <div className="flex justify-center mb-10">
          <button 
            onClick={handleCompare}
            disabled={isProcessing || !isLibraryLoaded}
            className="group relative flex items-center bg-indigo-600 text-white px-12 py-4 rounded-full font-bold shadow-xl hover:bg-indigo-700 hover:-translate-y-1 transition-all disabled:bg-slate-300 disabled:transform-none"
          >
            {isProcessing ? '正在讀取並計算數據...' : '執行自動化比對'}
            <ArrowRightLeft className="ml-2 w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
          </button>
        </div>

        {/* 結果顯示區塊 - 始終保留結構防止閃爍 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[300px]">
          <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
            <h3 className="font-bold text-slate-700 flex items-center">
              <Search className="w-4 h-4 mr-2" /> 差異詳細清單
            </h3>
            {summary && (
              <div className="flex gap-2">
                <span className="text-xs font-medium bg-slate-200 text-slate-700 px-2 py-1 rounded-md">總品項 {summary.total}</span>
                <span className="text-xs font-medium bg-red-100 text-red-600 px-2 py-1 rounded-md">異常品項 {summary.diff}</span>
              </div>
            )}
          </div>
          
          <div className="p-0">
            {!hasCompared ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                <Upload className="w-12 h-12 mb-4 opacity-20" />
                <p>請上傳兩份 Excel 檔案後點擊執行比對</p>
              </div>
            ) : results.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase text-xs border-b">
                      <th className="p-4 font-bold">貨號 / 代號</th>
                      <th className="p-4 font-bold text-right text-blue-600">全日 (A)</th>
                      <th className="p-4 font-bold text-right text-emerald-600">同興 (B)</th>
                      <th className="p-4 font-bold text-right">差異數</th>
                      <th className="p-4 font-bold text-center">狀態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {results.map(r => (
                      <tr key={r.id} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="p-4 font-mono font-medium text-slate-900">{r.id}</td>
                        <td className="p-4 text-right text-slate-600">{r.qA}</td>
                        <td className="p-4 text-right text-slate-600">{r.qB}</td>
                        <td className={`p-4 text-right font-bold ${parseFloat(r.diff) > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                          {r.diff}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold shadow-sm
                            ${r.status === '數量不符' ? 'bg-orange-100 text-orange-700' : ''}
                            ${r.status === '全日缺漏' ? 'bg-rose-100 text-rose-700' : ''}
                            ${r.status === '同興缺漏' ? 'bg-cyan-100 text-cyan-700' : ''}
                          `}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-green-500">
                <CheckCircle className="w-16 h-16 mb-4 animate-pulse" />
                <p className="text-xl font-bold">完美一致！沒有發現任何庫存差異。</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 錯誤彈窗 */}
      {errorMsg && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl z-50 border border-slate-700">
          <AlertCircle className="mr-3 text-red-400 w-6 h-6" />
          <span className="font-medium mr-4">{errorMsg}</span>
          <button 
            className="hover:text-slate-400 text-slate-500 transition-colors" 
            onClick={() => setErrorMsg('')}
          >
            <Search className="w-5 h-5 rotate-45" />
          </button>
        </div>
      )}
    </div>
  );
}