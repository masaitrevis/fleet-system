import { Router, Request, Response } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { query } from '../database';
import * as aiService from '../services/ai';

const router = Router();

// ==================== FLEET RISK INTELLIGENCE ====================

/**
 * Get fleet intelligence summary for dashboard widget
 * GET /api/risk-intelligence/summary
 */
router.get('/summary',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const summary = await aiService.getFleetIntelligenceSummary();
    res.json(summary);
  })
);

/**
 * Get all vehicle risk profiles
 * GET /api/risk-intelligence/vehicles
 */
router.get('/vehicles',
  authenticateToken,
  requireRole(['admin', 'manager', 'transport_supervisor', 'hod']),
  asyncHandler(async (req: Request, res: Response) => {
    const riskProfiles = await aiService.calculateVehicleRisk() as aiService.VehicleRiskProfile[];
    res.json({
      count: riskProfiles.length,
      vehicles: riskProfiles.sort((a, b) => b.riskScore - a.riskScore)
    });
  })
);

/**
 * Get single vehicle risk profile
 * GET /api/risk-intelligence/vehicles/:id
 */
router.get('/vehicles/:id',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const profile = await aiService.calculateVehicleRisk(id) as aiService.VehicleRiskProfile;
    
    if (!profile) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    res.json(profile);
  })
);

/**
 * Get risk alerts
 * GET /api/risk-intelligence/alerts
 */
router.get('/alerts',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { severity, acknowledged } = req.query;
    
    let alerts = await aiService.generateRiskAlerts();
    
    // Filter by severity if provided
    if (severity) {
      alerts = alerts.filter(a => a.severity === severity);
    }
    
    // Filter by acknowledged status
    if (acknowledged !== undefined) {
      const isAcknowledged = acknowledged === 'true';
      alerts = alerts.filter(a => a.acknowledged === isAcknowledged);
    }
    
    res.json({
      count: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      high: alerts.filter(a => a.severity === 'high').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      low: alerts.filter(a => a.severity === 'low').length,
      alerts
    });
  })
);

/**
 * Acknowledge a risk alert
 * POST /api/risk-intelligence/alerts/:id/acknowledge
 */
router.post('/alerts/:id/acknowledge',
  authenticateToken,
  requireRole(['admin', 'manager', 'transport_supervisor']),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    
    await query(`
      UPDATE risk_alerts 
      SET acknowledged = TRUE, 
          acknowledged_by = $1, 
          acknowledged_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [userId, id]);
    
    res.json({ message: 'Alert acknowledged' });
  })
);

/**
 * Get predictive maintenance suggestions
 * GET /api/risk-intelligence/maintenance-suggestions
 */
router.get('/maintenance-suggestions',
  authenticateToken,
  requireRole(['admin', 'manager', 'transport_supervisor', 'hod']),
  asyncHandler(async (req: Request, res: Response) => {
    const suggestions = await aiService.getPredictiveMaintenanceSuggestions();
    res.json({
      count: suggestions.length,
      suggestions
    });
  })
);

/**
 * Get driver safety alerts
 * GET /api/risk-intelligence/driver-alerts
 */
router.get('/driver-alerts',
  authenticateToken,
  requireRole(['admin', 'manager', 'transport_supervisor', 'hod']),
  asyncHandler(async (req: Request, res: Response) => {
    // Get drivers with incidents in last 30 days
    const driverAlerts = await query(`
      SELECT 
        s.id,
        s.staff_name,
        s.staff_no,
        COUNT(a.id) as incident_count_30d,
        COUNT(a.id) FILTER (WHERE a.severity = 'Fatal' OR a.severity = 'Major') as severe_incidents,
        STRING_AGG(DISTINCT a.accident_cause, '; ') as incident_causes,
        MAX(a.accident_date) as last_incident_date
      FROM staff s
      LEFT JOIN accidents a ON a.driver_id = s.id 
        AND a.accident_date > CURRENT_DATE - INTERVAL '30 days'
      WHERE s.role = 'Driver'
      AND s.deleted_at IS NULL
      GROUP BY s.id, s.staff_name, s.staff_no
      HAVING COUNT(a.id) > 0
      ORDER BY COUNT(a.id) DESC
    `);
    
    const alerts = driverAlerts.map((d: any) => ({
      id: `driver-${d.id}`,
      type: 'driver',
      severity: d.severe_incidents > 0 ? 'critical' : d.incident_count_30d >= 2 ? 'high' : 'medium',
      title: d.severe_incidents > 0 ? 'Critical Driver Safety Alert' : 'Driver Safety Alert',
      description: `Driver ${d.staff_name} has been involved in ${d.incident_count_30d} incident(s) in the past 30 days.${d.incident_causes ? ` Causes: ${d.incident_causes}` : ''}`,
      entityId: d.id,
      entityName: d.staff_name,
      incidentCount: parseInt(d.incident_count_30d),
      lastIncidentDate: d.last_incident_date,
      createdAt: new Date().toISOString(),
      acknowledged: false
    }));
    
    res.json({
      count: alerts.length,
      critical: alerts.filter((a: any) => a.severity === 'critical').length,
      high: alerts.filter((a: any) => a.severity === 'high').length,
      alerts
    });
  })
);

/**
 * Refresh risk calculations
 * POST /api/risk-intelligence/refresh
 */
router.post('/refresh',
  authenticateToken,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req: Request, res: Response) => {
    // Trigger risk recalculation
    const riskProfiles = await aiService.calculateVehicleRisk() as aiService.VehicleRiskProfile[];
    const alerts = await aiService.generateRiskAlerts();
    
    // Store risk profiles in database
    for (const profile of riskProfiles) {
      await query(`
        INSERT INTO vehicle_risk_profiles (vehicle_id, risk_level, risk_score, factors, recommendations, calculated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (vehicle_id) DO UPDATE SET
          risk_level = EXCLUDED.risk_level,
          risk_score = EXCLUDED.risk_score,
          factors = EXCLUDED.factors,
          recommendations = EXCLUDED.recommendations,
          calculated_at = EXCLUDED.calculated_at,
          updated_at = CURRENT_TIMESTAMP
      `, [
        profile.vehicleId,
        profile.riskLevel,
        profile.riskScore,
        JSON.stringify(profile.factors),
        JSON.stringify(profile.recommendations)
      ]);
    }
    
    // Store alerts
    for (const alert of alerts) {
      await query(`
        INSERT INTO risk_alerts (alert_type, severity, title, description, entity_id, entity_type, entity_name, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING
      `, [
        alert.type,
        alert.severity,
        alert.title,
        alert.description,
        alert.entityId,
        alert.type,
        alert.entityName,
        alert.createdAt
      ]);
    }
    
    res.json({
      message: 'Risk intelligence refreshed',
      vehiclesAnalyzed: riskProfiles.length,
      alertsGenerated: alerts.length
    });
  })
);

export default router;