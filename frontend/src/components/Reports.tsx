import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface ReportsProps {
  apiUrl: string;
}

interface Vehicle {
  id: string;
  registration_num: string;
  make_model: string;
  status: string;
  current_mileage: number;
}

interface FuelRecord {
  id: string;
  fuel_date: string;
  registration_num: string;
  distance_km: number;
  quantity_liters: number;
  km_per_liter: number;
  amount: number;
}

export default function Reports({ apiUrl }: ReportsProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fuelRecords, setFuelRecords] = useState<FuelRecord[]>([]);
  const [reportType, setReportType] = useState('fleet');
  const [dateRange, setDateRange] = useState('30');

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const headers = { 'Authorization': `Bearer ${token}` };
    
    const [vRes, fRes] = await Promise.all([
      fetch(`${apiUrl}/vehicles`, { headers }),
      fetch(`${apiUrl}/fuel`, { headers })
    ]);
    
    if (vRes.ok) setVehicles(await vRes.json());
    if (fRes.ok) setFuelRecords(await fRes.json());
  };

  const exportToExcel = () => {
    let data: any[] = [];
    let filename = '';

    switch (reportType) {
      case 'fleet':
        data = (vehicles || []).map(v => ({
          'Registration': v.registration_num,
          'Make/Model': v.make_model,
          'Status': v.status,
          'Current Mileage': v.current_mileage
        }));
        filename = 'fleet-report.xlsx';
        break;
      case 'fuel':
        data = (fuelRecords || []).map(f => ({
          'Date': f.fuel_date,
          'Vehicle': f.registration_num,
          'Distance (km)': f.distance_km,
          'Fuel (L)': f.quantity_liters,
          'Efficiency (km/L)': f.km_per_liter,
          'Cost': f.amount
        }));
        filename = 'fuel-report.xlsx';
        break;
      default:
        alert('Excel export not available for this report type');
        return;
    }

    if (data.length === 0) {
      alert('No data to export');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, filename);
  };

  const exportToCSV = () => {
    let data: any[] = [];
    let filename = '';

    switch (reportType) {
      case 'fleet':
        data = vehicles || [];
        filename = 'fleet-report.csv';
        break;
      case 'fuel':
        data = fuelRecords || [];
        filename = 'fuel-report.csv';
        break;
      default:
        alert('CSV export not available for this report type');
        return;
    }

    if (data.length === 0) {
      alert('No data to export');
      return;
    }

    if (data.length === 0) {
      alert('No data to export');
      return;
    }
    
    const headers = Object.keys(data[0] || {}).join(',');
    const rows = data.map(row => Object.values(row).join(','));
    const csv = [headers, ...rows].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    let title = '';
    let headers: string[] = [];
    let data: any[][] = [];

    switch (reportType) {
      case 'fleet':
        title = 'Fleet Report';
        headers = ['Registration', 'Make/Model', 'Status', 'Mileage'];
        data = (vehicles || []).map(v => [v.registration_num, v.make_model, v.status, v.current_mileage]);
        break;
      case 'fuel':
        title = 'Fuel Report';
        headers = ['Date', 'Vehicle', 'Distance', 'Fuel', 'Efficiency', 'Cost'];
        data = (fuelRecords || []).map(f => [f.fuel_date, f.registration_num, f.distance_km, f.quantity_liters, f.km_per_liter, f.amount]);
        break;
      default:
        alert('PDF export not available for this report type');
        return;
    }

    if (data.length === 0) {
      alert('No data to export');
      return;
    }

    doc.text(title, 14, 15);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
    
    (doc as any).autoTable({
      head: [headers],
      body: data,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] }
    });

    doc.save(`${reportType}-report.pdf`);
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Reports & Exports</h2>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Generate Report</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
            <select 
              value={reportType} 
              onChange={(e) => setReportType(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="fleet">Fleet Inventory</option>
              <option value="fuel">Fuel Records</option>
              <option value="routes">Route History</option>
              <option value="repairs">Maintenance History</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 3 months</option>
              <option value="365">Last year</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={exportToExcel}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            📊 Export Excel
          </button>
          <button 
            onClick={exportToCSV}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            📄 Export CSV
          </button>
          <button 
            onClick={exportToPDF}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
          >
            📕 Export PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Report Preview</h3>
        <div className="overflow-x-auto">
          {reportType === 'fleet' && (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Registration</th>
                  <th className="text-left p-3">Make/Model</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Mileage</th>
                </tr>
              </thead>
              <tbody>
                {vehicles?.slice(0, 10).map(v => (
                  <tr key={v.id} className="border-b">
                    <td className="p-3">{v.registration_num}</td>
                    <td className="p-3">{v.make_model}</td>
                    <td className="p-3">{v.status}</td>
                    <td className="p-3">{v.current_mileage?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'fuel' && (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Vehicle</th>
                  <th className="text-left p-3">Distance</th>
                  <th className="text-left p-3">Fuel</th>
                  <th className="text-left p-3">Efficiency</th>
                  <th className="text-left p-3">Cost</th>
                </tr>
              </thead>
              <tbody>
                {fuelRecords?.slice(0, 10).map(f => (
                  <tr key={f.id} className="border-b">
                    <td className="p-3">{f.fuel_date}</td>
                    <td className="p-3">{f.registration_num}</td>
                    <td className="p-3">{f.distance_km}</td>
                    <td className="p-3">{f.quantity_liters}</td>
                    <td className="p-3">{f.km_per_liter?.toFixed(2)} km/L</td>
                    <td className="p-3">${f.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}