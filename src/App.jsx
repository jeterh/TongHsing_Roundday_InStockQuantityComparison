import React, { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, ArrowRightLeft, X } from 'lucide-react';

// -----------------------------------------------------------------------------
// UI Components
// -----------------------------------------------------------------------------

const Modal = ({ message, onClose }) => {
  if (!message) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4">
        <div className="flex items-center text-red-600 mb-4">
          <AlertCircle className="w-6 h-6 mr-2" />
          <h3 className="text-lg font-bold">錯誤提示</h3>
        </div>
        <p className="text-gray-700 mb-6">{message}</p>
        <button
          onClick={onClose}
          className="w-full bg-slate-800 text-white py-2 rounded hover:bg-slate-700 transition-colors"
        >
          關閉
        </button>
      </div>
    </div>
  );
};

const FileUploadZone = ({ title, file, setFile, colorClass, disabled }) => {
  const handleDrop = (e) => {
    e.preventDefault();
    if (disabled) return;
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) setFile(droppedFile);
  };

  return (
    <div className={`flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className={`p-3 font-bold text-white ${colorClass} flex items-center`}>
        <FileSpreadsheet className="w-5 h-5 mr-2" />
        {title}
      </div>
      <div 
        className="flex-1 p-6 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 m-4 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer relative"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          accept=".xlsx, .xls" 
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={(e) => setFile(e.target.files[0])}
        />
        {file ? (
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">{file.name}</p>
            <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
          </div>
        ) : (
          <div className="text-center text-slate-400">
            <Upload className="w-12 h-12 mx-auto mb-2" />
            <p>點擊或拖曳上傳 Excel</p>
          </div>
        )}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Main Application
// -----------------------------------------------------------------------------

export default function App() {
  const [fileA, setFileA] = useState(null); // 全日
  const [fileB, setFileB] = useState(null); // 同興
  const [errorMsg, setErrorMsg] = useState('');
  const [results, setResults] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);

  // 動態載入 XLSX Library
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.async = true;
    script.onload = () => {
      console.log('XLSX Library loaded');
      setIsLibraryLoaded(true);
    };
    script.onerror = () => {
      setErrorMsg('無法載入 Excel 處理元件，請檢查網路連線。');
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    }
  }, []);

  // 讀取 Excel 檔案並轉為 JSON
  const readExcel = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          if (!window.XLSX) {
            reject(new Error("XLSX library not loaded"));
            return;
          }
          const data = new Uint8Array(e.target.result);
          const workbook = window.XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          resolve(worksheet);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  // 標準化資料並進行 Group By 加總
  const processData = (rawData, keyField, qtyField) => {
    const map = new Map();
    
    rawData.forEach(row => {
      // 確保欄位存在且轉為字串去除空白
      const key = String(row[keyField] || '').trim();
      // 轉為數字，若非數字則為 0
      const qty = parseFloat(row[qtyField]) || 0;

      if (key) {
        if (map.has(key)) {
          map.set(key, map.get(key) + qty);
        } else {
          map.set(key, qty);
        }
      }
    });
    return map;
  };

  // 搜尋 Header 所在的列 (針對同興庫存表)
  const findHeaderRow = (sheetData, targetColumnName) => {
    // 搜尋前 15 列
    for (let i = 0; i < Math.min(sheetData.length, 15); i++) {
      const row = sheetData[i];
      // 檢查這一列的任何一個 Cell 是否包含目標欄位名稱
      if (row.some(cell => String(cell).trim() === targetColumnName)) {
        return i; // 回傳 Index
      }
    }
    return 0; // 預設第一列
  };

  const handleCompare = async () => {
    if (!isLibraryLoaded) {
      setErrorMsg('系統尚未準備完成，請稍候...');
      return;
    }

    // 1. 驗證檔案
    if (!fileA) {
      setErrorMsg('請上傳「全日庫存表」Excel檔案');
      return;
    }
    if (!fileB) {
      setErrorMsg('請上傳「同興庫存表」Excel檔案');
      return;
    }

    setIsProcessing(true);
    setResults([]);
    setSummary(null);

    try {
      // 2. 處理「全日庫存表」
      const sheetA = await readExcel(fileA);
      // 全日直接讀取，預設第一列為 Header
      const jsonA = window.XLSX.utils.sheet_to_json(sheetA);
      // 欄位名稱映射： 貨號, 庫存數量
      const mapA = processData(jsonA, '貨號', '庫存數量');

      // 3. 處理「同興庫存表」
      const sheetB = await readExcel(fileB);
      // 先轉為 Array of Arrays 來尋找 Header
      const arrayB = window.XLSX.utils.sheet_to_json(sheetB, { header: 1 });
      // 尋找包含 '貨品代號' 的列 (預期在第7或8列)
      const headerRowIndex = findHeaderRow(arrayB, '貨品代號');
      
      // 使用正確的 Header 列重新解析
      const jsonB = window.XLSX.utils.sheet_to_json(sheetB, { range: headerRowIndex });
      // 欄位名稱映射： 貨品代號, 副單位數量
      const mapB = processData(jsonB, '貨品代號', '副單位數量');

      // 4. 進行比對邏輯
      const comparisonResults = [];
      let diffCount = 0;

      // 找出所有唯一的 Key (聯集)
      const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);

      allKeys.forEach(key => {
        const qtyA = mapA.get(key) || 0;
        const qtyB = mapB.get(key) || 0;

        // 邏輯: 找出相同「貨品代號」 但「庫存數量」數量不相同的
        // 如果某一邊不存在 (qty=0)，也視為數量不相同
        if (qtyA !== qtyB) {
          diffCount++;
          comparisonResults.push({
            id: key,
            qtyA: qtyA,
            qtyB: qtyB,
            diff: qtyA - qtyB,
            // 標記狀態
            status: qtyA === 0 ? '全日缺漏' : (qtyB === 0 ? '同興缺漏' : '數量不符')
          });
        }
      });

      setResults(comparisonResults);
      setSummary({
        totalItems: allKeys.size,
        diffItems: diffCount
      });

    } catch (err) {
      console.error(err);
      setErrorMsg('檔案解析失敗，請確認 Excel 格式是否正確。');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans pb-10">
      {/* Header */}
      <header className="bg-slate-800 text-white p-4 shadow-md">
        <div className="container mx-auto flex items-center">
          <ArrowRightLeft className="mr-3" />
          <h1 className="text-xl font-bold tracking-wider">全日庫存 vs 同興庫存 比對工具</h1>
        </div>
      </header>

      <main className="container mx-auto p-4 max-w-6xl">
        
        {/* 上半部：檔案上傳區 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 h-64">
          {/* 左邊：全日庫存表 */}
          <FileUploadZone 
            title="全日庫存表 (讀取第一列標題)" 
            file={fileA} 
            setFile={setFileA} 
            colorClass="bg-blue-600"
            disabled={!isLibraryLoaded}
          />
          
          {/* 右邊：同興庫存表 */}
          <FileUploadZone 
            title="同興庫存表 (自動偵測第7-8列標題)" 
            file={fileB} 
            setFile={setFileB} 
            colorClass="bg-emerald-600"
            disabled={!isLibraryLoaded}
          />
        </div>

        {/* 動作按鈕 */}
        <div className="flex justify-center mb-8">
          <button
            onClick={handleCompare}
            disabled={isProcessing || !isLibraryLoaded}
            className={`
              px-8 py-3 rounded-full font-bold text-lg shadow-lg transform transition-all 
              ${(isProcessing || !isLibraryLoaded)
                ? 'bg-slate-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105 text-white active:scale-95'}
            `}
          >
            {!isLibraryLoaded ? '載入系統中...' : (isProcessing ? '處理中...' : '開始比對')}
          </button>
        </div>

        {/* 下半部：比對結果 */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 min-h-[400px] flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center rounded-t-lg">
            <h2 className="text-lg font-bold text-slate-700 flex items-center">
              <FileSpreadsheet className="w-5 h-5 mr-2 text-indigo-600" />
              比對結果
            </h2>
            {summary && (
              <span className="text-sm bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-medium">
                總品項: {summary.totalItems} | 差異品項: {summary.diffItems}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-auto p-4">
            {results.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-slate-100 sticky top-0 z-10">
                    <tr>
                      <th className="border border-slate-300 px-4 py-2 text-left w-1/4">貨號 / 貨品代號</th>
                      <th className="border border-slate-300 px-4 py-2 text-right w-1/5 text-blue-700">全日庫存 (A)</th>
                      <th className="border border-slate-300 px-4 py-2 text-right w-1/5 text-emerald-700">同興庫存 (B)</th>
                      <th className="border border-slate-300 px-4 py-2 text-right w-1/5 text-red-600">差異 (A - B)</th>
                      <th className="border border-slate-300 px-4 py-2 text-center w-1/6">狀態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50 even:bg-slate-50/50">
                        <td className="border border-slate-300 px-4 py-2 font-mono font-medium">{item.id}</td>
                        <td className="border border-slate-300 px-4 py-2 text-right">{item.qtyA}</td>
                        <td className="border border-slate-300 px-4 py-2 text-right">{item.qtyB}</td>
                        <td className={`border border-slate-300 px-4 py-2 text-right font-bold ${item.diff > 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
                          {item.diff > 0 ? `+${item.diff}` : item.diff}
                        </td>
                        <td className="border border-slate-300 px-4 py-2 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-bold
                            ${item.status === '數量不符' ? 'bg-yellow-100 text-yellow-800' : ''}
                            ${item.status === '全日缺漏' ? 'bg-emerald-100 text-emerald-800' : ''}
                            ${item.status === '同興缺漏' ? 'bg-blue-100 text-blue-800' : ''}
                          `}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                {summary ? (
                   <div className="text-green-500 font-bold text-lg flex flex-col items-center">
                     <CheckCircle className="w-12 h-12 mb-2" />
                     恭喜！所有庫存數量皆一致。
                   </div>
                ) : (
                  <p>請上傳檔案並點擊「開始比對」以查看結果</p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Error Popup */}
      <Modal message={errorMsg} onClose={() => setErrorMsg('')} />
    </div>
  );
}