import { Router, Request, Response } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// ==================== STOCK/PARTS MANAGEMENT ====================

// Get all stock parts
router.get('/parts',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { category, low_stock } = req.query;
    
    let sql = `
      SELECT sp.*, 
        COALESCE(SUM(su.quantity_used), 0) as total_used,
        COALESCE(SUM(su.quantity_used * su.unit_cost), 0) as total_cost
      FROM stock_parts sp
      LEFT JOIN stock_usage su ON su.part_id = sp.id
      WHERE sp.deleted_at IS NULL
    `;
    const params: any[] = [];
    
    if (category) {
      sql += ` AND sp.category = $${params.length + 1}`;
      params.push(category);
    }
    
    if (low_stock === 'true') {
      sql += ` AND sp.quantity_on_hand <= sp.reorder_level`;
    }
    
    sql += ` GROUP BY sp.id ORDER BY sp.part_number`;
    
    const result = await query(sql, params);
    res.json(result);
  })
);

// Get single part
router.get('/parts/:id',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const part = await query(`
      SELECT sp.*, 
        COALESCE(SUM(su.quantity_used), 0) as total_used,
        COALESCE(SUM(su.quantity_used * su.unit_cost), 0) as total_cost
      FROM stock_parts sp
      LEFT JOIN stock_usage su ON su.part_id = sp.id
      WHERE sp.id = $1 AND sp.deleted_at IS NULL
      GROUP BY sp.id
    `, [(req as any).params.id]);
    
    if (part.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }
    
    // Get usage history
    const usage = await query(`
      SELECT su.*, r.date_in as repair_date, v.registration_num, jc.job_card_number
      FROM stock_usage su
      LEFT JOIN repairs r ON r.id = su.repair_id
      LEFT JOIN job_cards jc ON jc.id = su.job_card_id
      LEFT JOIN vehicles v ON v.id = COALESCE(r.vehicle_id, jc.vehicle_id)
      WHERE su.part_id = $1
      ORDER BY su.created_at DESC
      LIMIT 20
    `, [(req as any).params.id]);
    
    res.json({ ...part[0], usage_history: usage });
  })
);

// Create new part
router.post('/parts',
  authenticateToken,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      part_number, part_name, description, category,
      manufacturer, supplier, unit_cost, quantity_on_hand,
      reorder_level, location_bin, compatible_vehicles
    } = req.body as any;
    
    if (!part_number || !part_name) {
      return res.status(400).json({ error: 'Part number and name are required' });
    }
    
    const id = uuidv4();
    await query(`
      INSERT INTO stock_parts (
        id, part_number, part_name, description, category,
        manufacturer, supplier, unit_cost, quantity_on_hand,
        reorder_level, location_bin, compatible_vehicles, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      id, part_number, part_name, description, category,
      manufacturer, supplier, unit_cost || 0, quantity_on_hand || 0,
      reorder_level || 5, location_bin, JSON.stringify(compatible_vehicles || []),
      (req as any).user?.userId
    ]);
    
    const result = await query('SELECT * FROM stock_parts WHERE id = $1', [id]);
    res.status(201).json(result[0]);
  })
);

// Update part
router.put('/parts/:id',
  authenticateToken,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req: Request, res: Response) => {
    const updates = req.body as any;
    const allowedFields = [
      'part_name', 'description', 'category', 'manufacturer', 'supplier',
      'unit_cost', 'quantity_on_hand', 'reorder_level', 'location_bin', 'compatible_vehicles'
    ];
    
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(key === 'compatible_vehicles' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    }
    
    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    values.push(req.params.id);
    
    await query(`
      UPDATE stock_parts 
      SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $${paramIndex} AND deleted_at IS NULL
    `, values);
    
    const result = await query('SELECT * FROM stock_parts WHERE id = $1', [(req as any).params.id]);
    res.json(result[0]);
  })
);

// Adjust stock quantity (stock in/out)
router.post('/parts/:id/adjust',
  authenticateToken,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req: Request, res: Response) => {
    const { adjustment, reason } = req.body as any;
    
    if (!adjustment || isNaN(adjustment)) {
      return res.status(400).json({ error: 'Valid adjustment amount required' });
    }
    
    await query(`
      UPDATE stock_parts 
      SET quantity_on_hand = quantity_on_hand + $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [adjustment, req.params.id]);
    
    // Log the adjustment
    await query(`
      INSERT INTO stock_adjustments (id, part_id, adjustment, reason, adjusted_by, created_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `, [uuidv4(), req.params.id, adjustment, reason, (req as any).user?.userId]);
    
    const result = await query('SELECT * FROM stock_parts WHERE id = $1', [(req as any).params.id]);
    res.json(result[0]);
  })
);

// Record stock usage for a repair/job card
router.post('/usage',
  authenticateToken,
  requireRole(['admin', 'manager', 'transport_supervisor']),
  asyncHandler(async (req: Request, res: Response) => {
    const { part_id, quantity_used, unit_cost, repair_id, job_card_id, notes } = req.body as any;
    
    if (!part_id || !quantity_used) {
      return res.status(400).json({ error: 'Part ID and quantity are required' });
    }
    
    if (!repair_id && !job_card_id) {
      return res.status(400).json({ error: 'Either repair_id or job_card_id is required' });
    }
    
    // Check stock availability
    const stock = await query('SELECT quantity_on_hand, unit_cost FROM stock_parts WHERE id = $1', [part_id]);
    if (stock.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }
    
    if (stock[0].quantity_on_hand < quantity_used) {
      return res.status(400).json({ 
        error: 'Insufficient stock', 
        available: stock[0].quantity_on_hand 
      });
    }
    
    // Create usage record
    const id = uuidv4();
    await query(`
      INSERT INTO stock_usage (id, part_id, quantity_used, unit_cost, repair_id, job_card_id, notes, used_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      id, part_id, quantity_used, unit_cost || stock[0].unit_cost,
      repair_id || null, job_card_id || null, notes, (req as any).user?.userId
    ]);
    
    // Deduct from stock
    await query(`
      UPDATE stock_parts 
      SET quantity_on_hand = quantity_on_hand - $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [quantity_used, part_id]);
    
    const result = await query('SELECT * FROM stock_usage WHERE id = $1', [id]);
    res.status(201).json(result[0]);
  })
);

// Get stock usage report
router.get('/usage-report',
  authenticateToken,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req: Request, res: Response) => {
    const { start_date, end_date, category } = req.query;
    
    let sql = `
      SELECT 
        sp.part_number,
        sp.part_name,
        sp.category,
        COALESCE(SUM(su.quantity_used), 0) as total_quantity,
        COALESCE(SUM(su.quantity_used * su.unit_cost), 0) as total_value,
        COUNT(DISTINCT su.repair_id) as repairs_count,
        COUNT(DISTINCT su.job_card_id) as job_cards_count
      FROM stock_parts sp
      LEFT JOIN stock_usage su ON su.part_id = sp.id
      WHERE sp.deleted_at IS NULL
    `;
    const params: any[] = [];
    
    if (start_date) {
      sql += ` AND su.created_at >= $${params.length + 1}`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND su.created_at <= $${params.length + 1}`;
      params.push(end_date);
    }
    if (category) {
      sql += ` AND sp.category = $${params.length + 1}`;
      params.push(category);
    }
    
    sql += ` GROUP BY sp.id, sp.part_number, sp.part_name, sp.category ORDER BY total_value DESC`;
    
    const result = await query(sql, params);
    res.json(result);
  })
);

// ==================== INVOICING ====================

// Get all invoices
router.get('/invoices',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { status, customer_id, start_date, end_date } = req.query;
    
    let sql = `
      SELECT i.*, 
        c.customer_name,
        c.customer_email,
        COUNT(ii.id) as item_count,
        COALESCE(SUM(ii.quantity * ii.unit_price), 0) as subtotal
      FROM invoices i
      LEFT JOIN customers c ON c.id = i.customer_id
      LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
      WHERE i.deleted_at IS NULL
    `;
    const params: any[] = [];
    
    if (status) {
      sql += ` AND i.status = $${params.length + 1}`;
      params.push(status);
    }
    if (customer_id) {
      sql += ` AND i.customer_id = $${params.length + 1}`;
      params.push(customer_id);
    }
    if (start_date) {
      sql += ` AND i.invoice_date >= $${params.length + 1}`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND i.invoice_date <= $${params.length + 1}`;
      params.push(end_date);
    }
    
    sql += ` GROUP BY i.id, c.customer_name, c.customer_email ORDER BY i.invoice_date DESC`;
    
    const result = await query(sql, params);
    res.json(result);
  })
);

// Get single invoice
router.get('/invoices/:id',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const invoice = await query(`
      SELECT i.*, c.customer_name, c.customer_email, c.customer_phone, c.customer_address
      FROM invoices i
      LEFT JOIN customers c ON c.id = i.customer_id
      WHERE i.id = $1 AND i.deleted_at IS NULL
    `, [(req as any).params.id]);
    
    if (invoice.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const items = await query(`
      SELECT ii.*, sp.part_number, sp.part_name
      FROM invoice_items ii
      LEFT JOIN stock_parts sp ON sp.id = ii.part_id
      WHERE ii.invoice_id = $1
    `, [(req as any).params.id]);
    
    const payments = await query(`
      SELECT * FROM invoice_payments WHERE invoice_id = $1 ORDER BY payment_date DESC
    `, [(req as any).params.id]);
    
    res.json({ ...invoice[0], items, payments });
  })
);

// Create invoice from job card
router.post('/invoices/from-job-card',
  authenticateToken,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req: Request, res: Response) => {
    const { job_card_id, customer_id, labor_hours, labor_rate } = req.body as any;
    
    if (!job_card_id) {
      return res.status(400).json({ error: 'Job card ID is required' });
    }
    
    // Get job card details
    const jobCard = await query(`
      SELECT jc.*, v.registration_num, v.make_model
      FROM job_cards jc
      JOIN vehicles v ON v.id = jc.vehicle_id
      WHERE jc.id = $1
    `, [job_card_id]);
    
    if (jobCard.length === 0) {
      return res.status(404).json({ error: 'Job card not found' });
    }
    
    // Get stock usage for this job card
    const stockUsage = await query(`
      SELECT su.*, sp.part_number, sp.part_name, sp.unit_cost
      FROM stock_usage su
      JOIN stock_parts sp ON sp.id = su.part_id
      WHERE su.job_card_id = $1
    `, [job_card_id]);
    
    // Generate invoice number
    const year = new Date().getFullYear();
    const countResult = await query(
      "SELECT COUNT(*) as count FROM invoices WHERE EXTRACT(YEAR FROM invoice_date) = $1",
      [year]
    );
    const invoiceNumber = `INV-${year}-${String(parseInt(countResult[0].count) + 1).padStart(4, '0')}`;
    
    const invoiceId = uuidv4();
    
    // Calculate totals
    const partsTotal = stockUsage.reduce((sum: number, item: any) => 
      sum + (parseFloat(item.quantity_used) * parseFloat(item.unit_cost)), 0
    );
    const laborTotal = (labor_hours || jobCard[0].actual_hours || 0) * (labor_rate || 50);
    const subtotal = partsTotal + laborTotal;
    const taxRate = 0.15; // 15% VAT
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;
    
    // Create invoice
    await query(`
      INSERT INTO invoices (
        id, invoice_number, customer_id, job_card_id, vehicle_id,
        invoice_date, due_date, status, subtotal, tax_amount, total,
        labor_hours, labor_rate, labor_total, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 
        'Draft', $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      invoiceId, invoiceNumber, customer_id || null, job_card_id, jobCard[0].vehicle_id,
      subtotal, taxAmount, total, labor_hours || jobCard[0].actual_hours, 
      labor_rate || 50, laborTotal,
      `Repair work for ${jobCard[0].registration_num} - ${jobCard[0].make_model}`,
      (req as any).user?.userId
    ]);
    
    // Add invoice items from stock usage
    for (const item of stockUsage) {
      await query(`
        INSERT INTO invoice_items (id, invoice_id, part_id, description, quantity, unit_price)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        uuidv4(), invoiceId, item.part_id, `${item.part_number} - ${item.part_name}`,
        item.quantity_used, item.unit_cost
      ]);
    }
    
    // Add labor line item
    if (laborTotal > 0) {
      await query(`
        INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        uuidv4(), invoiceId, 'Labor - Repair Services',
        labor_hours || jobCard[0].actual_hours || 1, labor_rate || 50
      ]);
    }
    
    // Update job card
    await query(
      'UPDATE job_cards SET invoice_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [invoiceId, job_card_id]
    );
    
    const result = await query('SELECT * FROM invoices WHERE id = $1', [invoiceId]);
    res.status(201).json(result[0]);
  })
);

// Update invoice status
router.patch('/invoices/:id/status',
  authenticateToken,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body as any;
    const validStatuses = ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    await query(`
      UPDATE invoices 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [status, req.params.id]);
    
    res.json({ success: true, status });
  })
);

// Record payment
router.post('/invoices/:id/payments',
  authenticateToken,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { amount, payment_method, reference, notes } = req.body as any;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid payment amount required' });
    }
    
    const invoice = await query('SELECT total, amount_paid FROM invoices WHERE id = $1', [(req as any).params.id]);
    if (invoice.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const remaining = parseFloat(invoice[0].total) - parseFloat(invoice[0].amount_paid || 0);
    if (amount > remaining) {
      return res.status(400).json({ error: 'Payment exceeds remaining balance', remaining });
    }
    
    const paymentId = uuidv4();
    await query(`
      INSERT INTO invoice_payments (id, invoice_id, amount, payment_method, reference, notes, received_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      paymentId, (req as any).params.id, amount, payment_method || 'Cash',
      reference, notes, req.user?.userId
    ]);
    
    // Update invoice payment status
    const newPaid = parseFloat(invoice[0].amount_paid || 0) + amount;
    const newStatus = newPaid >= parseFloat(invoice[0].total) ? 'Paid' : 'Partial';
    
    await query(`
      UPDATE invoices 
      SET amount_paid = $1, status = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [newPaid, newStatus, (req as any).params.id]);
    
    const result = await query('SELECT * FROM invoice_payments WHERE id = $1', [paymentId]);
    res.status(201).json(result[0]);
  })
);

// Get financial summary
router.get('/financial-summary',
  authenticateToken,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req: Request, res: Response) => {
    const { period } = req.query as { period?: string }; // 'month', 'quarter', 'year'
    
    let dateFilter = '';
    if (period === 'month') {
      dateFilter = "WHERE invoice_date >= CURRENT_DATE - INTERVAL '30 days'";
    } else if (period === 'quarter') {
      dateFilter = "WHERE invoice_date >= CURRENT_DATE - INTERVAL '90 days'";
    } else if (period === 'year') {
      dateFilter = "WHERE invoice_date >= CURRENT_DATE - INTERVAL '1 year'";
    }
    
    // Invoice summary
    const invoiceSummary = await query(`
      SELECT 
        COUNT(*) as total_invoices,
        COALESCE(SUM(total), 0) as total_value,
        COALESCE(SUM(amount_paid), 0) as total_paid,
        COALESCE(SUM(total - amount_paid), 0) as total_outstanding,
        COUNT(*) FILTER (WHERE status = 'Paid') as paid_count,
        COUNT(*) FILTER (WHERE status = 'Overdue') as overdue_count
      FROM invoices
      ${dateFilter}
    `);
    
    // Stock value
    const stockValue = await query(`
      SELECT 
        COALESCE(SUM(quantity_on_hand * unit_cost), 0) as total_stock_value,
        COUNT(*) FILTER (WHERE quantity_on_hand <= reorder_level) as low_stock_count
      FROM stock_parts
      WHERE deleted_at IS NULL
    `);
    
    // Monthly trend
    const monthlyTrend = await query(`
      SELECT 
        DATE_TRUNC('month', invoice_date) as month,
        COUNT(*) as invoices,
        COALESCE(SUM(total), 0) as revenue
      FROM invoices
      WHERE invoice_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', invoice_date)
      ORDER BY month
    `);
    
    res.json({
      invoices: invoiceSummary[0],
      stock: stockValue[0],
      monthlyTrend
    });
  })
);

export default router;
