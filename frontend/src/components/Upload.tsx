import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';

interface UploadProps {
  apiUrl: string;
}

interface ImportResult {
  [key: string]: number;
}

interface ValidationError {
  sheet: string;
  row: number;
  column: string;
  message: string;
  value?: string;
}

interface ImportPreview {
  sheetName: string;
  rowCount: number;
  columns: string[];
  sample: any[];
}

const EXPECTED_SHEETS = [
  { name: 'Fleet', label: 'Vehicle Inventory', requiredColumns: ['registration', 'type', 'status'] },
  { name: 'Staff', label: 'Drivers & Personnel', requiredColumns: ['name', 'employee_id', 'role'] },
  { name: 'Routes', label: 'Route Assignments', requiredColumns: ['route_name', 'origin', 'destination'] },
  { name: 'TOTAL FUEL TEMPLATE', label: 'Fuel Records', requiredColumns: ['vehicle_reg', 'date', 'liters'] },
  { name: 'Repairs Template', label: 'Maintenance Records', requiredColumns: ['vehicle_reg', 'repair_date', 'description'] },
  { name: 'Accidents', label: 'Incident Reports', requiredColumns: ['vehicle_reg', 'date', 'driver'] },
  { name: 'Assignments', label: 'Vehicle Assignments', requiredColumns: ['vehicle_reg', 'driver_id', 'start_date'] },
  { name: 'Insurance', label: 'Policy Data', requiredColumns: ['vehicle_reg', 'policy_number', 'expiry_date'] },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function Upload({ apiUrl }: UploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [preview, setPreview] = useState<ImportPreview[] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'preview' | 'template'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const token = localStorage.getItem('token');

  const validateFile = (file: File): string | null => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      return 'Please upload a valid Excel file (.xlsx or .xls)';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds 10MB limit. Your file: ${(file.size / 1024 / 1024).toFixed(2)}MB`;
    }
    return null;
  };

  const analyzeFile = async (file: File) => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    
    const previews: ImportPreview[] = [];
    const errors: ValidationError[] = [];

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      if (jsonData.length === 0) return;

      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));

      // Check for expected sheet
      const expectedSheet = EXPECTED_SHEETS.find(s => 
        s.name.toLowerCase() === sheetName.toLowerCase() ||
        sheetName.toLowerCase().includes(s.name.toLowerCase())
      );

      if (expectedSheet) {
        const missingColumns = expectedSheet.requiredColumns.filter(col => 
          !headers.some(h => h?.toString().toLowerCase().includes(col.toLowerCase()))
        );

        if (missingColumns.length > 0) {
          errors.push({
            sheet: sheetName,
            row: 1,
            column: 'headers',
            message: `Missing required columns: ${missingColumns.join(', ')}`
          });
        }
      }

      previews.push({
        sheetName,
        rowCount: rows.length,
        columns: headers,
        sample: rows.slice(0, 3)
      });
    });

    setPreview(previews);
    setValidationErrors(errors);
    return { previews, errors };
  };

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResult(null);
    setUploadProgress(0);
    
    // Analyze file locally before upload
    try {
      await analyzeFile(selectedFile);
      setActiveTab('preview');
    } catch (err) {
      console.error('Preview error:', err);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleReLogin = () => {
    localStorage.removeItem('token');
    window.location.reload();
  };

  const simulateProgress = () => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);
    return interval;
  };

  const handleUpload = async () => {
    if (!file) return;

    if (!token) {
      setError('No authentication token found. Please login again.');
      return;
    }

    setUploading(true);
    setError(null);
    const progressInterval = simulateProgress();

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${apiUrl}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();
      
      if (response.ok) {
        setResult(data.imported);
        setActiveTab('upload'); // Switch back to show results
      } else if (response.status === 401 || response.status === 403) {
        setError('Your session has expired. Please logout and login again to get a new token.');
      } else {
        setError(data.error || data.message || 'Upload failed. Check server logs for details.');
        if (data.errors) {
          setValidationErrors(data.errors);
        }
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      setError(err.message || 'Network error. Please check your connection.');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = (sheetType: string) => {
    const templates: Record<string, any[][]> = {
      'Fleet': [
        ['registration', 'type', 'make', 'model', 'year', 'status', 'department', 'fuel_type'],
        ['KCA 123A', 'Truck', 'Toyota', 'Hilux', '2023', 'active', 'Logistics', 'diesel'],
        ['KCB 456B', 'Van', 'Nissan', 'NV350', '2022', 'active', 'Sales', 'petrol']
      ],
      'Staff': [
        ['name', 'employee_id', 'role', 'department', 'phone', 'email', 'license_number', 'license_expiry'],
        ['John Doe', 'EMP001', 'driver', 'Logistics', '+254712345678', 'john@example.com', 'DL123456', '2025-12-31'],
        ['Jane Smith', 'EMP002', 'manager', 'Operations', '+254723456789', 'jane@example.com', '', '']
      ],
      'Fuel': [
        ['vehicle_reg', 'date', 'liters', 'cost', 'station', 'odometer', 'driver_id'],
        ['KCA 123A', '2024-01-15', '45.5', '7500', 'Shell Ngong Rd', '45200', 'EMP001'],
        ['KCB 456B', '2024-01-16', '38.2', '6200', 'Total Mombasa Rd', '23100', 'EMP001']
      ]
    };

    const template = templates[sheetType] || templates['Fleet'];
    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetType);
    XLSX.writeFile(wb, `FleetPro_${sheetType}_Template.xlsx`);
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setValidationErrors([]);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const totalImported = result ? Object.values(result).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">📤 Data Import</h2>
          <p className="text-gray-500 mt-1">Import fleet data from Excel files</p>
        </div>
        <div className="flex gap-2">
          {(['upload', 'preview', 'template'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="bg-white rounded-xl shadow p-8">
          {/* Drag & Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="excel-upload"
            />
            <label
              htmlFor="excel-upload"
              className="cursor-pointer block"
            >
              <div className="text-6xl mb-4">{isDragging ? '📂' : '📊'}</div>
              <p className="text-lg text-gray-700 mb-2">
                {isDragging ? 'Drop file here' : 'Drag & drop Excel file here'}
              </p>
              <p className="text-gray-500 mb-4">—or—</p>
              <button
                type="button"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Browse Files
              </button>
              <p className="text-sm text-gray-400 mt-4">
                Supports .xlsx and .xls (max 10MB)
              </p>
            </label>
          </div>

          {/* Selected File */}
          {file && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">📄</div>
                  <div>
                    <p className="font-medium text-gray-800">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={clearFile}
                  className="text-red-500 hover:text-red-700 p-2"
                  disabled={uploading}
                >
                  ✕
                </button>
              </div>

              {/* Progress Bar */}
              {uploading && (
                <div className="mt-4">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : 'Processing...'}
                  </p>
                </div>
              )}

              {/* Upload Button */}
              <button
                onClick={handleUpload}
                disabled={uploading || validationErrors.length > 0}
                className="mt-4 w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? 'Importing...' : validationErrors.length > 0 ? 'Fix Errors to Import' : '🚀 Import Data'}
              </button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">❌</span>
                <div className="flex-1">
                  <p className="text-red-700 font-medium">{error}</p>
                  {(error.includes('expired') || error.includes('token')) && (
                    <button
                      onClick={handleReLogin}
                      className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      🔑 Re-Login
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-800 mb-3">⚠️ Validation Issues</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {validationErrors.map((err, idx) => (
                  <div key={idx} className="text-sm text-yellow-700">
                    <span className="font-medium">{err.sheet}</span> — {err.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success Result */}
          {result && totalImported > 0 && (
            <div className="mt-6 p-6 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">✅</span>
                <h4 className="text-lg font-semibold text-green-800">
                  Import Successful
                </h4>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(result).map(([key, value]: [string, any]) => (
                  value > 0 && (
                    <div key={key} className="bg-white p-4 rounded-lg shadow-sm">
                      <div className="text-3xl font-bold text-green-600">{value}</div>
                      <div className="text-sm text-gray-600 capitalize">{key.replace(/_/g, ' ')}</div>
                    </div>
                  )
                ))}
              </div>

              <div className="mt-4 text-center">
                <button
                  onClick={clearFile}
                  className="text-green-700 hover:text-green-800 font-medium"
                >
                  Import Another File →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview Tab */}
      {activeTab === 'preview' && preview && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold mb-4">📋 File Preview</h3>
          
          <div className="space-y-6">
            {preview.map((sheet) => {
              const isRecognized = EXPECTED_SHEETS.some(s => 
                s.name.toLowerCase() === sheet.sheetName.toLowerCase() ||
                sheet.sheetName.toLowerCase().includes(s.name.toLowerCase())
              );

              return (
                <div key={sheet.sheetName} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{sheet.sheetName}</span>
                      {isRecognized ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                          Recognized
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          Unknown
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">{sheet.rowCount} rows</span>
                  </div>

                  <div className="text-sm text-gray-600 mb-2">
                    Columns: {sheet.columns.slice(0, 5).join(', ')}
                    {sheet.columns.length > 5 && ` +${sheet.columns.length - 5} more`}
                  </div>

                  {sheet.sample.length > 0 && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            {sheet.columns.slice(0, 4).map((col) => (
                              <th key={col} className="px-3 py-2 text-left font-medium text-gray-600">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sheet.sample.map((row, idx) => (
                            <tr key={idx} className="border-t">
                              {sheet.columns.slice(0, 4).map((_col, colIdx) => (
                                <td key={colIdx} className="px-3 py-2 text-gray-700 truncate max-w-[150px]">
                                  {row[colIdx]?.toString() || '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {file && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setActiveTab('upload')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Back to Upload
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'preview' && !preview && (
        <div className="bg-white rounded-xl shadow p-12 text-center">
          <div className="text-6xl mb-4">👀</div>
          <p className="text-gray-600">Select a file to see preview</p>
          <button
            onClick={() => setActiveTab('upload')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Upload
          </button>
        </div>
      )}

      {/* Template Tab */}
      {activeTab === 'template' && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold mb-4">📥 Download Templates</h3>
          
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { key: 'Fleet', icon: '🚛', desc: 'Vehicle inventory with specs' },
              { key: 'Staff', icon: '👥', desc: 'Employee and driver records' },
              { key: 'Fuel', icon: '⛽', desc: 'Fuel consumption logs' }
            ].map(({ key, icon, desc }) => (
              <div key={key} className="border rounded-lg p-4 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{icon}</span>
                      <span className="font-medium">{key} Template</span>
                    </div>
                    <p className="text-sm text-gray-500">{desc}</p>
                  </div>
                  <button
                    onClick={() => downloadTemplate(key)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">💡 Tips</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Use exact sheet names (Fleet, Staff, Fuel, etc.)</li>
              <li>• First row must contain column headers</li>
              <li>• Dates should be in YYYY-MM-DD format</li>
              <li>• Duplicate records will be updated, not duplicated</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
