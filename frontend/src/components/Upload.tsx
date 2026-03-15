import { useState } from 'react';

interface UploadProps {
  apiUrl: string;
}

export default function Upload({ apiUrl }: UploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const token = localStorage.getItem('token');

  const handleReLogin = () => {
    localStorage.removeItem('token');
    window.location.reload();
  };

  const handleUpload = async () => {
    if (!file) return;

    // Check if token exists
    if (!token) {
      setError('No authentication token found. Please login again.');
      return;
    }

    setUploading(true);
    setError(null);

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

      const data = await response.json();
      
      if (response.ok) {
        setResult(data.imported);
      } else if (response.status === 401 || response.status === 403) {
        setError('Your session has expired. Please logout and login again to get a new token.');
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Excel Import</h2>

      <div className="bg-white rounded-xl shadow p-8">
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Import Master Data</h3>
          <p className="text-gray-600 mb-4">
            Upload your Excel file with the following sheets:
          </p>
          <ul className="list-disc list-inside text-gray-600 mb-4">
            <li>Fleet — Vehicle inventory</li>
            <li>Staff — Drivers and personnel</li>
            <li>Routes — Route assignments</li>
            <li>TOTAL FUEL TEMPLATE — Fuel records</li>
            <li>Repairs Template — Maintenance records</li>
          </ul>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <input
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
            <div className="text-6xl mb-4">📊</div>
            <p className="text-gray-600 mb-2">
              {file ? file.name : 'Click to select Excel file'}
            </p>
            <p className="text-sm text-gray-400">
              Supports .xlsx and .xls files
            </p>
          </label>
        </div>

        {file && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {uploading ? 'Uploading...' : 'Import Data'}
          </button>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg">
            <p className="mb-3">❌ {error}</p>
            {(error.includes('expired') || error.includes('token')) && (
              <button
                onClick={handleReLogin}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
              >
                🔑 Click to Re-Login
              </button>
            )}
          </div>
        )}

        {result && (
          <div className="mt-6">
            <h4 className="font-semibold text-green-700 mb-3">✅ Import Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(result).map(([key, value]: [string, any]) => (
                value > 0 && (
                  <div key={key} className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">{value}</div>
                    <div className="text-sm text-green-600 capitalize">{key} imported</div>
                  </div>
                )
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 bg-blue-50 rounded-xl p-6">
        <h4 className="font-semibold text-blue-800 mb-2">💡 Pro Tip</h4>
        <p className="text-blue-700">
          Make sure your Excel sheets match the expected column headers. 
          The system will automatically map and import data from recognized sheets.
          Duplicate entries (based on registration numbers or staff IDs) will be updated rather than duplicated.
        </p>
      </div>
    </div>
  );
}