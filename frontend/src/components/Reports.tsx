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

interface Route {
  id: string;
  route_date: string;
  vehicle_id: string;
  registration_num?: string;
  start_location: string;
  destination: string;
  distance_km: number;
  driver_name?: string;
  status: string;
}

interface Repair {
  id: string;
  repair_date: string;
  registration_num: string;
  description: string;
  repair_type: string;
  cost: number;
  status: string;
  service_provider: string;
}

export default function Reports({ apiUrl }: ReportsProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fuelRecords, setFuelRecords] = useState<FuelRecord[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('fleet');
  const [dateRange, setDateRange] = useState('30');

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const headers = { 'Authorization': `Bearer ${token}` };
    
    try {
      const [vRes, fRes, rRes, repRes] = await Promise.all([
        fetch(`${apiUrl}/vehicles`, { headers }),
        fetch(`${apiUrl}/fuel`, { headers }),
        fetch(`${apiUrl}/routes`, { headers }),
        fetch(`${apiUrl}/repairs`, { headers })
      ]);
      
      if (vRes.ok) setVehicles(await vRes.json());
      if (fRes.ok) setFuelRecords(await fRes.json());
      if (rRes.ok) setRoutes(await rRes.json());
      if (repRes.ok) setRepairs(await repRes.json());
    } catch (err) {
      console.error('Failed to fetch report data');
    } finally {
      setLoading(false);
    }
  };

  const filterByDateRange = (data: any[], dateField: string) => {
    if (dateRange === 'all') return data;
    
    const days = parseInt(dateRange);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    return data.filter(item => new Date(item[dateField]) >= cutoff);
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
        data = filterByDateRange(fuelRecords || [], 'fuel_date').map(f => ({
          'Date': f.fuel_date,
          'Vehicle': f.registration_num,
          'Distance (km)': f.distance_km,
          'Fuel (L)': f.quantity_liters,
          'Efficiency (km/L)': f.km_per_liter,
          'Cost': f.amount
        }));
        filename = 'fuel-report.xlsx';
        break;
      case 'routes':
        data = filterByDateRange(routes || [], 'route_date').map(r => ({
          'Date': r.route_date,
          'Vehicle': r.registration_num || r.vehicle_id,
          'From': r.start_location,
          'To': r.destination,
          'Distance (km)': r.distance_km,
          'Driver': r.driver_name || '-',
          'Status': r.status
        }));
        filename = 'routes-report.xlsx';
        break;
      case 'repairs':
        data = filterByDateRange(repairs || [], 'repair_date').map(r => ({
          'Date': r.repair_date,
          'Vehicle': r.registration_num,
          'Type': r.repair_type,
          'Description': r.description,
          'Provider': r.service_provider,
          'Cost': r.cost,
          'Status': r.status
        }));
        filename = 'repairs-report.xlsx';
        break;
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
        data = filterByDateRange(fuelRecords || [], 'fuel_date');
        filename = 'fuel-report.csv';
        break;
      case 'routes':
        data = filterByDateRange(routes || [], 'route_date');
        filename = 'routes-report.csv';
        break;
      case 'repairs':
        data = filterByDateRange(repairs || [], 'repair_date');
        filename = 'repairs-report.csv';
        break;
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
        data = filterByDateRange(fuelRecords || [], 'fuel_date').map(f => [f.fuel_date, f.registration_num, f.distance_km, f.quantity_liters, f.km_per_liter, f.amount]);
        break;
      case 'routes':
        title = 'Route History Report';
        headers = ['Date', 'Vehicle', 'From', 'To', 'Distance', 'Status'];
        data = filterByDateRange(routes || [], 'route_date').map(r => [r.route_date, r.registration_num || r.vehicle_id, r.start_location, r.destination, r.distance_km, r.status]);
        break;
      case 'repairs':
        title = 'Maintenance Report';
        headers = ['Date', 'Vehicle', 'Type', 'Provider', 'Cost', 'Status'];
        data = filterByDateRange(repairs || [], 'repair_date').map(r => [r.repair_date, r.registration_num, r.repair_type, r.service_provider, r.cost, r.status]);
        break;
    }

    if (data.length === 0) {
      alert('No data to export');
      return;
    }

    doc.text(title, 14, 15);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
    doc.text(`Period: ${dateRange === 'all' ? 'All Time' : `Last ${dateRange} days`}`, 14, 32);
    
    (doc as any).autoTable({
      head: [headers],
      body: data,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] }
    });

    doc.save(`${reportType}-report.pdf`);
  };

  const getFilteredData = () => {
    switch (reportType) {
      case 'fleet': return vehicles || [];
      case 'fuel': return filterByDateRange(fuelRecords || [], 'fuel_date');
      case 'routes': return filterByDateRange(routes || [], 'route_date');
      case 'repairs': return filterByDateRange(repairs || [], 'repair_date');
      default: return [];
    }
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
          
          <div className="flex items-end">
            <div className="text-sm text-gray-500">
              {loading ? 'Loading...' : `${getFilteredData().length} records found`}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={exportToExcel}
            disabled={loading}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
          >
            📊 Export Excel
          </button>
          <button 
            onClick={exportToCSV}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            📄 Export CSV
          </button>
          <button 
            onClick={exportToPDF}
            disabled={loading}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
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
                {filterByDateRange(fuelRecords || [], 'fuel_date').slice(0, 10).map(f => (
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

          {reportType === 'routes' && (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Vehicle</th>
                  <th className="text-left p-3">From</th>
                  <th className="text-left p-3">To</th>
                  <th className="text-left p-3">Distance</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filterByDateRange(routes || [], 'route_date').slice(0, 10).map(r => (
                  <tr key={r.id} className="border-b">
                    <td className="p-3">{r.route_date}</td>
                    <td className="p-3">{r.registration_num || r.vehicle_id}</td>
                    <td className="p-3">{r.start_location}</td>
                    <td className="p-3">{r.destination}</td>
                    <td className="p-3">{r.distance_km} km</td>
                    <td className="p-3">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'repairs' && (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Vehicle</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Provider</th>
                  <th className="text-left p-3">Cost</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filterByDateRange(repairs || [], 'repair_date').slice(0, 10).map(r => (
                  <tr key={r.id} className="border-b">
                    <td className="p-3">{r.repair_date}</td>
                    <td className="p-3">{r.registration_num}</td>
                    <td className="p-3">{r.repair_type}</td>
                    <td className="p-3">{r.service_provider}</td>
                    <td className="p-3">${r.cost}</td>
                    <td className="p-3">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          
          {getFilteredData().length === 0 && (
            <p className="text-center py-8 text-gray-500">No data available for selected period</p>
          )}
        </div>
      </div>
    </div>
  );
}
