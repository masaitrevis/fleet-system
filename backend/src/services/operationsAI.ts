import { query } from '../database';
import { io } from '../index';

// Vehicle health score calculation
interface VehicleHealth {
  vehicleId: string;
  registrationNum: string;
  healthScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  predictedIssues: string[];
  recommendedActions: string[];
  nextServiceDue: Date | null;
  daysUntilService: number | null;
}

// Calculate predictive maintenance scores
export const analyzeVehicleHealth = async (vehicleId?: string): Promise<VehicleHealth | VehicleHealth[] | null> => {
  const whereClause = vehicleId ? 'WHERE v.id = $1' : '';
  const params = vehicleId ? [vehicleId] : [];
  
  const vehicles = await query(`
    SELECT 
      v.id,
      v.registration_num,
      v.current_mileage,
      v.last_service_date,
      v.next_service_due,
      v.minor_service_interval,
      v.medium_service_interval,
      v.major_service_interval,
      v.status,
      v.defect_notes,
      v.defect_reported_at,
      -- Count recent accidents
      (SELECT COUNT(*) FROM accidents WHERE vehicle_id = v.id AND accident_date > CURRENT_DATE - INTERVAL '90 days') as accident_count_90d,
      -- Count recent inspections with defects
      (SELECT COUNT(*) FROM requisitions WHERE vehicle_id = v.id AND inspection_passed = false AND created_at > CURRENT_DATE - INTERVAL '30 days') as failed_inspections_30d,
      -- Count recent job cards
      (SELECT COUNT(*) FROM job_cards WHERE vehicle_id = v.id AND status != 'Completed' AND created_at > CURRENT_DATE - INTERVAL '30 days') as open_job_cards,
      -- Average fuel consumption trend
      (SELECT AVG(km_per_liter) FROM fuel_records WHERE vehicle_id = v.id AND fuel_date > CURRENT_DATE - INTERVAL '30 days') as avg_fuel_efficiency,
      -- Recent routes count
      (SELECT COUNT(*) FROM routes WHERE vehicle_id = v.id AND route_date > CURRENT_DATE - INTERVAL '30 days') as routes_30d,
      -- Total repair costs last 90 days
      (SELECT COALESCE(SUM(cost), 0) FROM repairs WHERE vehicle_id = v.id AND date_in > CURRENT_DATE - INTERVAL '90 days') as repair_costs_90d
    FROM vehicles v
    ${whereClause}
    AND v.deleted_at IS NULL
    AND v.status = 'Active'
  `, params);
  
  const analyzeVehicle = (v: any): VehicleHealth => {
    let healthScore = 100;
    const predictedIssues: string[] = [];
    const recommendedActions: string[] = [];
    
    // Mileage-based deductions
    if (v.next_service_due) {
      const daysUntil = Math.ceil((new Date(v.next_service_due).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntil < 0) {
        healthScore -= 25;
        predictedIssues.push('Service overdue');
        recommendedActions.push(`Schedule immediate service for ${v.registration_num}`);
      } else if (daysUntil < 7) {
        healthScore -= 15;
        predictedIssues.push('Service due within 7 days');
        recommendedActions.push(`Schedule service for ${v.registration_num} within this week`);
      } else if (daysUntil < 14) {
        healthScore -= 5;
        predictedIssues.push('Service approaching');
      }
    }
    
    // Accident impact
    if (v.accident_count_90d > 0) {
      healthScore -= v.accident_count_90d * 10;
      predictedIssues.push(`${v.accident_count_90d} accident(s) in last 90 days`);
      recommendedActions.push(`Review driver training for ${v.registration_num}`);
    }
    
    // Failed inspections
    if (v.failed_inspections_30d > 0) {
      healthScore -= v.failed_inspections_30d * 15;
      predictedIssues.push(`${v.failed_inspections_30d} failed inspection(s) recently`);
      recommendedActions.push(`Conduct thorough inspection of ${v.registration_num}`);
    }
    
    // Open job cards
    if (v.open_job_cards > 0) {
      healthScore -= v.open_job_cards * 8;
      predictedIssues.push(`${v.open_job_cards} open repair job(s)`);
    }
    
    // Repair costs
    if (v.repair_costs_90d > 5000) {
      healthScore -= 10;
      predictedIssues.push('High repair costs - potential chronic issues');
      recommendedActions.push(`Consider vehicle replacement evaluation for ${v.registration_num}`);
    }
    
    // Defect flags
    if (v.defect_notes) {
      healthScore -= 20;
      predictedIssues.push('Active defect reported');
      recommendedActions.push(`Address reported defect on ${v.registration_num}`);
    }
    
    // Usage pattern (low usage might indicate issues)
    if (v.routes_30d === 0) {
      healthScore -= 5;
      predictedIssues.push('No routes in last 30 days - possible downtime');
    }
    
    // Determine risk level
    let riskLevel: VehicleHealth['riskLevel'] = 'low';
    if (healthScore < 40) riskLevel = 'critical';
    else if (healthScore < 60) riskLevel = 'high';
    else if (healthScore < 80) riskLevel = 'medium';
    
    // Cap score at 0
    healthScore = Math.max(0, healthScore);
    
    return {
      vehicleId: v.id,
      registrationNum: v.registration_num,
      healthScore,
      riskLevel,
      predictedIssues,
      recommendedActions,
      nextServiceDue: v.next_service_due,
      daysUntilService: v.next_service_due ? Math.ceil((new Date(v.next_service_due).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
    };
  };
  
  if (vehicleId) {
    return vehicles.length > 0 ? analyzeVehicle(vehicles[0]) : null;
  }
  
  return vehicles.map(analyzeVehicle);
};

// Get fleet-wide health summary
export const getFleetHealthSummary = async () => {
  const allVehicles = await analyzeVehicleHealth() as VehicleHealth[];
  
  const total = allVehicles.length;
  const critical = allVehicles.filter(v => v.riskLevel === 'critical').length;
  const high = allVehicles.filter(v => v.riskLevel === 'high').length;
  const medium = allVehicles.filter(v => v.riskLevel === 'medium').length;
  const low = allVehicles.filter(v => v.riskLevel === 'low').length;
  
  const avgHealth = allVehicles.reduce((sum, v) => sum + v.healthScore, 0) / total;
  
  // Get all recommended actions
  const allRecommendations = allVehicles
    .flatMap(v => v.recommendedActions.map(action => ({
      action,
      vehicle: v.registrationNum,
      priority: v.riskLevel
    })))
    .slice(0, 10); // Top 10
  
  return {
    total,
    critical,
    high,
    medium,
    low,
    averageHealth: Math.round(avgHealth),
    atRiskVehicles: allVehicles.filter(v => v.riskLevel !== 'low').sort((a, b) => a.healthScore - b.healthScore),
    topRecommendations: allRecommendations
  };
};

// Route optimization using basic algorithm
interface RouteOptimizationRequest {
  vehicleId: string;
  stops: Array<{
    id: string;
    lat: number;
    lng: number;
    priority: number;
    timeWindow?: { start: string; end: string };
  }>;
  startLocation: { lat: number; lng: number };
  endLocation?: { lat: number; lng: number };
  constraints?: {
    maxDrivingHours?: number;
    fuelStops?: boolean;
    restBreaks?: boolean;
  };
}

// Calculate distance between two points (Haversine formula)
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Nearest neighbor algorithm for route optimization
export const optimizeRoute = async (request: RouteOptimizationRequest) => {
  const { stops, startLocation, endLocation, constraints } = request;
  
  if (stops.length === 0) {
    return { optimizedStops: [], totalDistance: 0, estimatedTime: 0 };
  }
  
  // Simple nearest neighbor algorithm
  const unvisited = [...stops];
  const optimized: typeof stops = [];
  let current = startLocation;
  let totalDistance = 0;
  
  while (unvisited.length > 0) {
    // Find nearest stop
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    
    for (let i = 0; i < unvisited.length; i++) {
      const distance = calculateDistance(
        current.lat, current.lng,
        unvisited[i].lat, unvisited[i].lng
      );
      
      // Add priority weight (higher priority = lower effective distance)
      const priorityWeight = (5 - unvisited[i].priority) * 10;
      const effectiveDistance = distance + priorityWeight;
      
      if (effectiveDistance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }
    
    const next = unvisited.splice(nearestIndex, 1)[0];
    optimized.push(next);
    totalDistance += nearestDistance;
    current = { lat: next.lat, lng: next.lng };
  }
  
  // Add distance to end location if provided
  if (endLocation) {
    totalDistance += calculateDistance(
      current.lat, current.lng,
      endLocation.lat, endLocation.lng
    );
  }
  
  // Estimate time (assuming average 40 km/h for delivery routes)
  const estimatedTime = (totalDistance / 40) * 60; // minutes
  
  // Add fuel stop recommendations if route is long
  const fuelStops: Array<{ lat: number; lng: number; reason: string }> = [];
  if (constraints?.fuelStops && totalDistance > 400) {
    fuelStops.push({
      lat: startLocation.lat + (endLocation?.lat || startLocation.lat - startLocation.lat) * 0.5,
      lng: startLocation.lng + (endLocation?.lng || startLocation.lng - startLocation.lng) * 0.5,
      reason: 'Recommended fuel stop (long route)'
    });
  }
  
  return {
    optimizedStops: optimized,
    totalDistance: Math.round(totalDistance * 100) / 100,
    estimatedTime: Math.round(estimatedTime),
    fuelStops,
    savings: {
      distanceKm: 0, // Would compare to original order
      timeMinutes: 0,
      fuelLiters: Math.round(totalDistance * 0.35 * 100) / 100 // Assuming 35L/100km
    }
  };
};

// Get live fleet status for operations dashboard
export const getLiveFleetStatus = async () => {
  const today = new Date().toISOString().split('T')[0];
  
  // Today's routes
  const todaysRoutes = await query(`
    SELECT 
      r.id,
      r.route_name,
      r.route_date,
      v.registration_num,
      d.staff_name as driver_name,
      r.actual_km,
      r.target_km,
      CASE 
        WHEN r.actual_km IS NOT NULL THEN 'Completed'
        WHEN r.route_date = CURRENT_DATE THEN 'In Progress'
        ELSE 'Scheduled'
      END as status
    FROM routes r
    JOIN vehicles v ON v.id = r.vehicle_id
    LEFT JOIN staff d ON d.id = r.driver1_id
    WHERE r.route_date = CURRENT_DATE
    ORDER BY r.route_name
  `);
  
  // Active vehicles (on routes today)
  const activeVehicles = todaysRoutes.filter((r: any) => r.status === 'In Progress' || r.status === 'Completed').length;
  
  // Available vehicles
  const availableVehicles = await query(`
    SELECT COUNT(*) as count 
    FROM vehicles 
    WHERE status = 'Active' 
    AND deleted_at IS NULL
    AND id NOT IN (
      SELECT vehicle_id FROM routes 
      WHERE route_date = CURRENT_DATE 
      AND actual_km IS NULL
    )
  `);
  
  // Pending requisitions
  const pendingRequisitions = await query(`
    SELECT COUNT(*) as count 
    FROM requisitions 
    WHERE status = 'pending'
  `);
  
  // Critical alerts
  const criticalAlerts = await query(`
    SELECT 
      'maintenance_due' as type,
      COUNT(*) as count,
      'Maintenance Due' as title
    FROM vehicles 
    WHERE next_service_due <= CURRENT_DATE + INTERVAL '7 days'
    AND status = 'Active'
    UNION ALL
    SELECT 
      'defective_vehicles' as type,
      COUNT(*) as count,
      'Defective Vehicles' as title
    FROM vehicles 
    WHERE defect_notes IS NOT NULL
    UNION ALL
    SELECT 
      'open_job_cards' as type,
      COUNT(*) as count,
      'Open Job Cards' as title
    FROM job_cards 
    WHERE status IN ('Pending', 'Approved', 'In Progress')
    UNION ALL
    SELECT 
      'fuel_anomaly' as type,
      COUNT(*) as count,
      'Fuel Anomalies' as title
    FROM fuel_records fr
    JOIN vehicles v ON v.id = fr.vehicle_id
    WHERE fr.km_per_liter > v.target_consumption_rate * 1.3
    AND fr.fuel_date >= CURRENT_DATE - INTERVAL '7 days'
  `);
  
  // Recent accidents
  const recentAccidents = await query(`
    SELECT 
      a.id,
      a.case_number,
      a.accident_date,
      a.severity,
      a.status,
      v.registration_num,
      d.staff_name as driver_name
    FROM accidents a
    JOIN vehicles v ON v.id = a.vehicle_id
    LEFT JOIN staff d ON d.id = a.driver_id
    WHERE a.accident_date >= CURRENT_DATE - INTERVAL '7 days'
    ORDER BY a.accident_date DESC
    LIMIT 5
  `);
  
  return {
    summary: {
      totalRoutes: todaysRoutes.length,
      activeVehicles,
      availableVehicles: parseInt(availableVehicles[0]?.count || 0),
      pendingRequisitions: parseInt(pendingRequisitions[0]?.count || 0)
    },
    todaysRoutes,
    criticalAlerts,
    recentAccidents
  };
};

// Broadcast live updates via WebSocket
export const broadcastOperationsUpdate = async () => {
  if (!io) return;
  
  const status = await getLiveFleetStatus();
  const health = await getFleetHealthSummary();
  
  io.emit('operations:update', {
    timestamp: new Date().toISOString(),
    status,
    health
  });
};
