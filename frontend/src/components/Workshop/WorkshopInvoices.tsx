import { useState, useEffect } from 'react';

interface WorkshopInvoicesProps {
  apiUrl: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name?: string;
  invoice_date: string;
  due_date?: string;
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Partial';
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  item_count: number;
}

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-800',
  Sent: 'bg-blue-100 text-blue-800',
  Paid: 'bg-green-100 text-green-800',
  Partial: 'bg-yellow-100 text-yellow-800',
  Overdue: 'bg-red-100 text-red-800'
};

export default function WorkshopInvoices({ apiUrl }: WorkshopInvoicesProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [financials, setFinancials] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchInvoices();
    fetchFinancials();
  }, [statusFilter]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      let url = `${apiUrl}/workshop/invoices`;
      if (statusFilter) url += `?status=${statusFilter}`;
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setInvoices(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancials = async () => {
    try {
      const res = await fetch(`${apiUrl}/workshop/financial-summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setFinancials(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch financials:', err);
    }
  };

  const viewInvoice = async (id: string) => {
    try {
      const res = await fetch(`${apiUrl}/workshop/invoices/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSelectedInvoice(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch invoice:', err);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`${apiUrl}/workshop/invoices/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      
      if (res.ok) {
        fetchInvoices();
        if (selectedInvoice?.id === id) {
          viewInvoice(id);
        }
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const recordPayment = async (invoiceId: string, amount: number, method: string) => {
    try {
      const res = await fetch(`${apiUrl}/workshop/invoices/${invoiceId}/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount, payment_method: method })
      });
      
      if (res.ok) {
        fetchInvoices();
        fetchFinancials();
        viewInvoice(invoiceId);
      }
    } catch (err) {
      console.error('Failed to record payment:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Financial Summary */}
      {financials && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            title="Total Revenue"
            value={`$${parseFloat(financials.invoices?.total_value || 0).toFixed(2)}`}
            icon="💰"
          />
          <SummaryCard
            title="Outstanding"
            value={`$${parseFloat(financials.invoices?.total_outstanding || 0).toFixed(2)}`}
            icon="⏳"
            color="text-orange-600"
          />
          <SummaryCard
            title="Paid Invoices"
            value={financials.invoices?.paid_count || 0}
            icon="✅"
            color="text-green-600"
          />
          <SummaryCard
            title="Overdue"
            value={financials.invoices?.overdue_count || 0}
            icon="⚠️"
            color="text-red-600"
          />
        </div>
      )}

      <div className="flex justify-between items-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2"
        >
          <option value="">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Sent">Sent</option>
          <option value="Paid">Paid</option>
          <option value="Overdue">Overdue</option>
        </select>
        
        <button
          onClick={() => {}}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Create Invoice
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Invoice #</th>
                <th className="text-left p-3">Customer</th>
                <th className="text-left p-3">Date</th>
                <th className="text-right p-3">Total</th>
                <th className="text-right p-3">Paid</th>
                <th className="text-center p-3">Status</th>
                <th className="text-center p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t">
                  <td className="p-3 font-mono">{inv.invoice_number}</td>
                  <td className="p-3">{inv.customer_name || 'Walk-in Customer'}</td>
                  <td className="p-3">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                  <td className="p-3 text-right font-medium">${parseFloat(inv.total as any).toFixed(2)}</td>
                  <td className="p-3 text-right">${parseFloat(String(inv.amount_paid || 0)).toFixed(2)}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => viewInvoice(inv.id)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onUpdateStatus={updateStatus}
          onRecordPayment={recordPayment}
        />
      )}
    </div>
  );
}

function SummaryCard({ title, value, icon, color = '' }: {
  title: string;
  value: string | number;
  icon: string;
  color?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
        <span>{icon}</span>
        {title}
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function InvoiceDetailModal({ invoice, onClose, onUpdateStatus, onRecordPayment }: {
  invoice: any;
  onClose: () => void;
  onUpdateStatus: (id: string, status: string) => void;
  onRecordPayment: (id: string, amount: number, method: string) => void;
}) {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  
  const remaining = parseFloat(invoice.total) - parseFloat(invoice.amount_paid || 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold">{invoice.invoice_number}</h2>
              <p className="text-gray-500">{invoice.customer_name || 'Walk-in Customer'}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm text-gray-500">Invoice Date</p>
              <p className="font-medium">{new Date(invoice.invoice_date).toLocaleDateString()}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm text-gray-500">Due Date</p>
              <p className="font-medium">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '-'}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm text-gray-500">Status</p>
              <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[invoice.status]}`}>
                {invoice.status}
              </span>
            </div>
          </div>

          {/*  Items  */}
          <div className="border rounded-lg overflow-hidden mb-6">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Description</th>
                  <th className="text-right p-3">Qty</th>
                  <th className="text-right p-3">Price</th>
                  <th className="text-right p-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items?.map((item: any) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-3">{item.description}</td>
                    <td className="p-3 text-right">{item.quantity}</td>
                    <td className="p-3 text-right">${parseFloat(item.unit_price).toFixed(2)}</td>
                    <td className="p-3 text-right font-medium">${(item.quantity * item.unit_price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-start mb-6">
            <div className="space-y-2">
              <p>
                <span className="text-gray-500">Subtotal: </span>
                <span className="font-medium">${parseFloat(invoice.subtotal).toFixed(2)}</span>
              </p>
              <p>
                <span className="text-gray-500">Tax: </span>
                <span className="font-medium">${parseFloat(invoice.tax_amount).toFixed(2)}</span>
              </p>
              <p className="text-xl">
                <span className="text-gray-500">Total: </span>
                <span className="font-bold">${parseFloat(invoice.total).toFixed(2)}</span>
              </p>
              {invoice.amount_paid > 0 && (
                <>
                  <p>
                    <span className="text-gray-500">Paid: </span>
                    <span className="font-medium text-green-600">${parseFloat(invoice.amount_paid).toFixed(2)}</span>
                  </p>
                  <p>
                    <span className="text-gray-500">Remaining: </span>
                    <span className="font-bold text-orange-600">${remaining.toFixed(2)}</span>
                  </p>
                </>
              )}
            </div>

            <div className="space-y-2">
              {invoice.status !== 'Paid' && invoice.status !== 'Cancelled' && (
                <>
                  <button
                    onClick={() => onUpdateStatus(invoice.id, 'Sent')}
                    className="block w-full px-4 py-2 bg-blue-600 text-white rounded"
                  >
                    Mark as Sent
                  </button>
                  <button
                    onClick={() => onUpdateStatus(invoice.id, 'Paid')}
                    className="block w-full px-4 py-2 bg-green-600 text-white rounded"
                  >
                    Mark as Paid
                  </button>
                </>
              )}
            </div>
          </div>

          {/*  Record Payment  */}
          {remaining > 0 && (
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Record Payment</h4>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Amount"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="border rounded-lg px-3 py-2"
                  max={remaining}
                />
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="border rounded-lg px-3 py-2"
                >
                  <option>Cash</option>
                  <option>Credit Card</option>
                  <option>Bank Transfer</option>
                  <option>Check</option>
                </select>
                <button
                  onClick={() => {
                    onRecordPayment(invoice.id, parseFloat(paymentAmount), paymentMethod);
                    setPaymentAmount('');
                  }}
                  disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  Record
                </button>
              </div>
            </div>
          )}

          {/*  Payment History  */}
          {invoice.payments?.length > 0 && (
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold mb-3">Payment History</h4>
              <div className="space-y-2">
                {invoice.payments.map((payment: any) => (
                  <div key={payment.id} className="flex justify-between bg-gray-50 p-2 rounded">
                    <span>{new Date(payment.payment_date).toLocaleDateString()} - {payment.payment_method}</span>
                    <span className="font-medium">${parseFloat(payment.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
