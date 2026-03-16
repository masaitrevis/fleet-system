import OpenAI from 'openai';
import { query } from '../database';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * AI Service for Fleet Management
 * Provides intelligent insights, predictions, and recommendations
 */

// ==================== OPERATIONS AI ====================

/**
 * Generate AI-powered fleet recommendations
 */
export const generateFleetRecommendations = async (): Promise<string[]> => {
  if (!AI_ENABLED) {
    return getRuleBasedRecommendations();
  }

  try {
    // Get current fleet data
    const vehicles = await query(`
      SELECT 
        v.registration_num,
        v.current_mileage,
        v.next_service_due,
        v.defect_notes,
        COUNT(a.id) as accident_count
      FROM vehicles v
      LEFT JOIN accidents a ON a.vehicle_id = v.id AND a.accident_date > CURRENT_DATE - INTERVAL '90 days'
      WHERE v.deleted_at IS NULL AND v.status = 'Active'
      GROUP BY v.id
      LIMIT 20
    `);

    const fuelData = await query(`
      SELECT 
        AVG(km_per_liter) as avg_efficiency,
        vehicle_id
      FROM fuel_records 
      WHERE fuel_date > CURRENT_DATE - INTERVAL '30 days'
      GROUP BY vehicle_id
    `);

    const prompt = `Analyze this fleet data and provide 3-5 actionable recommendations:
    
Vehicles: ${JSON.stringify(vehicles)}
Fuel Efficiency: ${JSON.stringify(fuelData)}

Provide concise, actionable recommendations for fleet optimization. Format as bullet points.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a fleet management AI assistant. Provide practical, data-driven recommendations.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500
    });

    return response.choices[0].message.content?.split('\n').filter(line => line.trim()) || [];
  } catch (error) {
    console.error('AI recommendation error:', error);
    return getRuleBasedRecommendations();
  }
};

/**
 * Fallback rule-based recommendations when AI is unavailable
 */
const getRuleBasedRecommendations = async (): Promise<string[]> => {
  const recommendations: string[] = [];
  
  // Check for overdue services
  const overdue = await query(`
    SELECT COUNT(*) as count FROM vehicles 
    WHERE next_service_due <= CURRENT_DATE AND status = 'Active'
  `);
  if (overdue[0]?.count > 0) {
    recommendations.push(`⚠️ ${overdue[0].count} vehicle(s) are overdue for service. Schedule maintenance immediately.`);
  }

  // Check for fuel anomalies
  const fuelAnomalies = await query(`
    SELECT COUNT(*) as count FROM fuel_records fr
    JOIN vehicles v ON v.id = fr.vehicle_id
    WHERE fr.km_per_liter > v.target_consumption_rate * 1.3
    AND fr.fuel_date >= CURRENT_DATE - INTERVAL '7 days'
  `);
  if (fuelAnomalies[0]?.count > 0) {
    recommendations.push(`⛽ ${fuelAnomalies[0].count} fuel efficiency anomalies detected. Review driver behavior.`);
  }

  // Check for open job cards
  const openJobs = await query(`
    SELECT COUNT(*) as count FROM job_cards WHERE status IN ('Pending', 'Approved', 'In Progress')
  `);
  if (openJobs[0]?.count > 0) {
    recommendations.push(`🔧 ${openJobs[0].count} job card(s) awaiting completion. Prioritize repairs.`);
  }

  // Check for defective vehicles
  const defective = await query(`
    SELECT COUNT(*) as count FROM vehicles WHERE defect_notes IS NOT NULL AND status = 'Active'
  `);
  if (defective[0]?.count > 0) {
    recommendations.push(`🚨 ${defective[0].count} vehicle(s) reported with defects. Address safety issues.`);
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ Fleet is operating within normal parameters. Continue monitoring.');
  }

  return recommendations;
};

// ==================== TRAINING AI ====================

/**
 * Generate AI notes for training slides
 */
export const generateSlideNotes = async (slideTitle: string, content: string): Promise<string> => {
  if (!AI_ENABLED) {
    return `Key points:\n• Review ${slideTitle.toLowerCase()} carefully\n• Apply concepts in daily operations`;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are a training instructor. Create concise study notes (2-3 bullet points) highlighting key takeaways.' 
        },
        { 
          role: 'user', 
          content: `Slide Title: ${slideTitle}\n\nContent: ${content.substring(0, 1000)}\n\nGenerate 2-3 bullet point study notes:` 
        }
      ],
      max_tokens: 200
    });

    return response.choices[0].message.content || '';
  } catch (error) {
    console.error('Slide notes generation error:', error);
    return `Key points:\n• ${slideTitle}\n• Review content and apply in practice`;
  }
};

// ==================== ANALYTICS AI ====================

interface NaturalLanguageQuery {
  query: string;
  chartType?: 'bar' | 'line' | 'pie';
  data?: any[];
  title?: string;
  message?: string;
}

/**
 * Process natural language analytics queries
 */
export const processAnalyticsQuery = async (queryText: string): Promise<NaturalLanguageQuery> => {
  if (!AI_ENABLED) {
    return processRuleBasedQuery(queryText);
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: `You are a fleet analytics assistant. Parse natural language queries and convert to structured analysis.
          
Respond with JSON in this format:
{
  "intent": "fuel_consumption|maintenance_cost|driver_performance|vehicle_utilization|safety_incidents",
  "timeRange": "7d|30d|90d|1y",
  "chartType": "bar|line|pie",
  "groupBy": "vehicle|driver|department|month"
}` 
        },
        { role: 'user', content: queryText }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 300
    });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    return executeParsedQuery(parsed);
  } catch (error) {
    console.error('Analytics AI error:', error);
    return processRuleBasedQuery(queryText);
  }
};

/**
 * Rule-based query processing fallback
 */
const processRuleBasedQuery = async (queryText: string): Promise<NaturalLanguageQuery> => {
  const lowerQuery = queryText.toLowerCase();
  
  // Fuel consumption queries
  if (lowerQuery.includes('fuel') || lowerQuery.includes('consumption') || lowerQuery.includes('efficiency')) {
    const data = await query(`
      SELECT 
        v.registration_num as name,
        AVG(fr.km_per_liter) as value
      FROM fuel_records fr
      JOIN vehicles v ON v.id = fr.vehicle_id
      WHERE fr.fuel_date > CURRENT_DATE - INTERVAL '30 days'
      GROUP BY v.id, v.registration_num
      ORDER BY value DESC
      LIMIT 10
    `);
    
    return {
      query: queryText,
      chartType: 'bar',
      data: data.map((d: any) => ({ name: d.name, value: parseFloat(d.value).toFixed(2) })),
      title: 'Fuel Efficiency by Vehicle (Last 30 Days)',
      message: `Showing top ${data.length} vehicles by fuel efficiency`
    };
  }
  
  // Maintenance cost queries
  if (lowerQuery.includes('maintenance') || lowerQuery.includes('repair') || lowerQuery.includes('cost')) {
    const data = await query(`
      SELECT 
        v.registration_num as name,
        COALESCE(SUM(r.cost), 0) as value
      FROM repairs r
      JOIN vehicles v ON v.id = r.vehicle_id
      WHERE r.date_in > CURRENT_DATE - INTERVAL '90 days'
      GROUP BY v.id, v.registration_num
      ORDER BY value DESC
      LIMIT 10
    `);
    
    return {
      query: queryText,
      chartType: 'bar',
      data: data.map((d: any) => ({ name: d.name, value: parseFloat(d.value).toFixed(2) })),
      title: 'Maintenance Costs by Vehicle (Last 90 Days)',
      message: `Showing ${data.length} vehicles with highest maintenance costs`
    };
  }
  
  // Driver performance queries
  if (lowerQuery.includes('driver') || lowerQuery.includes('performance')) {
    const data = await query(`
      SELECT 
        s.staff_name as name,
        AVG(fr.km_per_liter) as value
      FROM fuel_records fr
      JOIN staff s ON s.id = fr.recorded_by
      WHERE fr.fuel_date > CURRENT_DATE - INTERVAL '30 days'
      GROUP BY s.id, s.staff_name
      ORDER BY value DESC
      LIMIT 10
    `);
    
    return {
      query: queryText,
      chartType: 'bar',
      data: data.map((d: any) => ({ name: d.name, value: parseFloat(d.value).toFixed(2) })),
      title: 'Driver Fuel Efficiency (Last 30 Days)',
      message: `Showing ${data.length} drivers by efficiency`
    };
  }
  
  // Default: vehicle utilization
  const data = await query(`
    SELECT 
      v.registration_num as name,
      COUNT(r.id) as value
    FROM vehicles v
    LEFT JOIN routes r ON r.vehicle_id = v.id AND r.route_date > CURRENT_DATE - INTERVAL '30 days'
    WHERE v.deleted_at IS NULL AND v.status = 'Active'
    GROUP BY v.id, v.registration_num
    ORDER BY value DESC
    LIMIT 10
  `);
  
  return {
    query: queryText,
    chartType: 'bar',
    data: data.map((d: any) => ({ name: d.name, value: parseInt(d.value) })),
    title: 'Vehicle Utilization (Routes in Last 30 Days)',
    message: 'Try asking about fuel consumption, maintenance costs, or driver performance'
  };
};

/**
 * Execute parsed AI query
 */
const executeParsedQuery = async (parsed: any): Promise<NaturalLanguageQuery> => {
  // Default implementation - can be extended
  return processRuleBasedQuery(parsed.intent || 'utilization');
};

// ==================== ACCIDENT AI ====================

/**
 * Generate corrective actions for accidents
 */
export const generateCorrectiveActions = async (accidentDescription: string, severity: string): Promise<string[]> => {
  if (!AI_ENABLED) {
    return getDefaultCorrectiveActions(severity);
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are a fleet safety expert. Suggest 3-5 specific corrective actions to prevent similar accidents.' 
        },
        { 
          role: 'user', 
          content: `Accident: ${accidentDescription}\nSeverity: ${severity}\n\nSuggest corrective actions:` 
        }
      ],
      max_tokens: 300
    });

    return response.choices[0].message.content?.split('\n').filter(line => line.trim().startsWith('•') || line.trim().startsWith('-')) || 
           getDefaultCorrectiveActions(severity);
  } catch (error) {
    console.error('Corrective actions error:', error);
    return getDefaultCorrectiveActions(severity);
  }
};

const getDefaultCorrectiveActions = (severity: string): string[] => {
  const actions = [
    '• Conduct refresher defensive driving training',
    '• Review and update driver safety protocols',
    '• Schedule vehicle safety inspection'
  ];
  
  if (severity === 'Major' || severity === 'Fatal') {
    actions.push('• Immediate suspension pending investigation');
    actions.push('• Comprehensive driver re-certification required');
  }
  
  return actions;
};

// ==================== DRIVER BEHAVIOR AI ====================

interface DriverBehaviorScore {
  driverId: string;
  driverName: string;
  overallScore: number;
  fuelEfficiencyScore: number;
  safetyScore: number;
  reliabilityScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  insights: string[];
  recommendations: string[];
}

/**
 * Analyze driver behavior using AI
 */
export const analyzeDriverBehavior = async (driverId?: string): Promise<DriverBehaviorScore | DriverBehaviorScore[] | null> => {
  const whereClause = driverId ? 'WHERE s.id = $1' : '';
  const params = driverId ? [driverId] : [];
  
  const drivers = await query(`
    SELECT 
      s.id,
      s.staff_name,
      s.staff_no,
      -- Fuel efficiency (30% weight)
      COALESCE(AVG(fr.km_per_liter), 0) as avg_fuel_efficiency,
      COUNT(fr.id) as fuel_records,
      -- Safety metrics (40% weight)
      COUNT(DISTINCT a.id) as accident_count_90d,
      COALESCE(SUM(CASE WHEN a.severity = 'Fatal' THEN 10 
                        WHEN a.severity = 'Major' THEN 5 
                        WHEN a.severity = 'Minor' THEN 2 ELSE 0 END), 0) as accident_severity_score,
      -- Reliability (30% weight)
      COUNT(DISTINCT r.id) as routes_completed_30d,
      COALESCE(AVG(CASE WHEN r.actual_km IS NOT NULL THEN 1 ELSE 0 END), 0) * 100 as route_completion_rate
    FROM staff s
    LEFT JOIN fuel_records fr ON fr.recorded_by = s.id AND fr.fuel_date > CURRENT_DATE - INTERVAL '90 days'
    LEFT JOIN accidents a ON a.driver_id = s.id AND a.accident_date > CURRENT_DATE - INTERVAL '90 days'
    LEFT JOIN routes r ON (r.driver1_id = s.id OR r.driver2_id = s.id) AND r.route_date > CURRENT_DATE - INTERVAL '30 days'
    ${whereClause}
    AND s.role = 'Driver'
    AND s.deleted_at IS NULL
    GROUP BY s.id, s.staff_name, s.staff_no
  `, params);

  const analyzeDriver = (d: any): DriverBehaviorScore => {
    let fuelScore = 50;
    let safetyScore = 100;
    let reliabilityScore = 50;
    const insights: string[] = [];
    const recommendations: string[] = [];

    // Fuel efficiency scoring (benchmark: 8 km/l)
    if (d.avg_fuel_efficiency > 0) {
      if (d.avg_fuel_efficiency >= 12) fuelScore = 100;
      else if (d.avg_fuel_efficiency >= 10) fuelScore = 90;
      else if (d.avg_fuel_efficiency >= 8) fuelScore = 75;
      else if (d.avg_fuel_efficiency >= 6) fuelScore = 50;
      else fuelScore = 25;
      
      insights.push(`Average fuel efficiency: ${parseFloat(d.avg_fuel_efficiency).toFixed(2)} km/l`);
    } else {
      insights.push('No fuel data recorded');
      recommendations.push('Start tracking fuel consumption for this driver');
    }

    // Safety scoring
    if (d.accident_count_90d > 0) {
      safetyScore -= d.accident_severity_score * 10;
      insights.push(`${d.accident_count_90d} accident(s) in last 90 days`);
      recommendations.push('Mandatory defensive driving refresher course');
    } else {
      insights.push('No accidents in last 90 days ✅');
    }

    // Reliability scoring
    if (d.route_completion_rate >= 95) reliabilityScore = 100;
    else if (d.route_completion_rate >= 80) reliabilityScore = 75;
    else if (d.route_completion_rate >= 60) reliabilityScore = 50;
    else reliabilityScore = 25;

    if (d.routes_completed_30d > 0) {
      insights.push(`${d.routes_completed_30d} routes completed (30 days)`);
    }

    // Cap scores
    fuelScore = Math.max(0, Math.min(100, fuelScore));
    safetyScore = Math.max(0, Math.min(100, safetyScore));
    reliabilityScore = Math.max(0, Math.min(100, reliabilityScore));

    // Overall score (weighted)
    const overallScore = Math.round(
      (fuelScore * 0.30) + (safetyScore * 0.40) + (reliabilityScore * 0.30)
    );

    // Risk level
    let riskLevel: DriverBehaviorScore['riskLevel'] = 'low';
    if (overallScore < 40) riskLevel = 'critical';
    else if (overallScore < 60) riskLevel = 'high';
    else if (overallScore < 80) riskLevel = 'medium';

    if (recommendations.length === 0 && overallScore >= 80) {
      recommendations.push('Excellent performance - consider as trainer/mentor');
    }

    return {
      driverId: d.id,
      driverName: d.staff_name,
      overallScore,
      fuelEfficiencyScore: Math.round(fuelScore),
      safetyScore: Math.round(safetyScore),
      reliabilityScore: Math.round(reliabilityScore),
      riskLevel,
      insights,
      recommendations
    };
  };

  if (driverId) {
    return drivers.length > 0 ? analyzeDriver(drivers[0]) : null;
  }
  
  return drivers.map(analyzeDriver);
};

// ==================== ANOMALY DETECTION AI ====================

interface Anomaly {
  type: 'fuel' | 'cost' | 'behavior' | 'maintenance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  entity: string;
  entityId: string;
  message: string;
  detectedAt: string;
  value: number;
  expectedRange: { min: number; max: number };
}

/**
 * Detect anomalies in fleet data using statistical analysis
 */
export const detectAnomalies = async (): Promise<Anomaly[]> => {
  const anomalies: Anomaly[] = [];

  // 1. Fuel consumption anomalies
  const fuelStats = await query(`
    SELECT 
      v.id as vehicle_id,
      v.registration_num,
      AVG(fr.km_per_liter) as avg_efficiency,
      STDDEV(fr.km_per_liter) as stddev_efficiency,
      COUNT(fr.id) as record_count
    FROM vehicles v
    JOIN fuel_records fr ON fr.vehicle_id = v.id
    WHERE fr.fuel_date > CURRENT_DATE - INTERVAL '30 days'
    AND v.deleted_at IS NULL
    GROUP BY v.id, v.registration_num
    HAVING COUNT(fr.id) >= 3
  `);

  for (const stat of fuelStats) {
    const avg = parseFloat(stat.avg_efficiency);
    const stddev = parseFloat(stat.stddev_efficiency) || 1;
    
    // Get recent entries
    const recent = await query(`
      SELECT km_per_liter, fuel_date
      FROM fuel_records
      WHERE vehicle_id = $1
      ORDER BY fuel_date DESC
      LIMIT 3
    `, [stat.vehicle_id]);

    for (const entry of recent) {
      const value = parseFloat(entry.km_per_liter);
      const zScore = Math.abs((value - avg) / stddev);
      
      if (zScore > 2.5) { // More than 2.5 standard deviations
        anomalies.push({
          type: 'fuel',
          severity: zScore > 3.5 ? 'critical' : zScore > 3 ? 'high' : 'medium',
          entity: stat.registration_num,
          entityId: stat.vehicle_id,
          message: `Unusual fuel efficiency: ${value.toFixed(2)} km/l (avg: ${avg.toFixed(2)})`,
          detectedAt: entry.fuel_date,
          value,
          expectedRange: { min: avg - 2 * stddev, max: avg + 2 * stddev }
        });
      }
    }
  }

  // 2. Cost anomalies
  const costStats = await query(`
    SELECT 
      v.id as vehicle_id,
      v.registration_num,
      AVG(r.cost) as avg_cost,
      STDDEV(r.cost) as stddev_cost
    FROM vehicles v
    JOIN repairs r ON r.vehicle_id = v.id
    WHERE r.date_in > CURRENT_DATE - INTERVAL '90 days'
    GROUP BY v.id, v.registration_num
    HAVING COUNT(r.id) >= 2
  `);

  for (const stat of costStats) {
    const avg = parseFloat(stat.avg_cost);
    const stddev = parseFloat(stat.stddev_cost) || 1000;
    
    const recent = await query(`
      SELECT cost, date_in
      FROM repairs
      WHERE vehicle_id = $1
      ORDER BY date_in DESC
      LIMIT 1
    `, [stat.vehicle_id]);

    if (recent.length > 0) {
      const value = parseFloat(recent[0].cost);
      const zScore = (value - avg) / stddev;
      
      if (zScore > 2) {
        anomalies.push({
          type: 'cost',
          severity: zScore > 3 ? 'high' : 'medium',
          entity: stat.registration_num,
          entityId: stat.vehicle_id,
          message: `High repair cost: $${value.toFixed(2)} (avg: $${avg.toFixed(2)})`,
          detectedAt: recent[0].date_in,
          value,
          expectedRange: { min: 0, max: avg + 2 * stddev }
        });
      }
    }
  }

  return anomalies.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
};

// ==================== PREDICTIVE COST ANALYSIS ====================

interface CostForecast {
  vehicleId: string;
  registrationNum: string;
  next30Days: number;
  next90Days: number;
  nextYear: number;
  confidence: 'low' | 'medium' | 'high';
  factors: string[];
}

/**
 * Predict future maintenance costs using trend analysis
 */
export const predictMaintenanceCosts = async (vehicleId?: string): Promise<CostForecast | CostForecast[] | null> => {
  const whereClause = vehicleId ? 'WHERE v.id = $1' : '';
  const params = vehicleId ? [vehicleId] : [];
  
  const vehicles = await query(`
    SELECT 
      v.id,
      v.registration_num,
      v.current_mileage,
      v.next_service_due,
      -- Historical costs
      COALESCE(SUM(CASE WHEN r.date_in > CURRENT_DATE - INTERVAL '30 days' THEN r.cost ELSE 0 END), 0) as cost_30d,
      COALESCE(SUM(CASE WHEN r.date_in > CURRENT_DATE - INTERVAL '90 days' THEN r.cost ELSE 0 END), 0) as cost_90d,
      COALESCE(SUM(CASE WHEN r.date_in > CURRENT_DATE - INTERVAL '1 year' THEN r.cost ELSE 0 END), 0) as cost_1y,
      -- Job cards
      COUNT(CASE WHEN jc.status != 'Completed' THEN 1 END) as open_job_cards,
      -- Accidents
      COUNT(CASE WHEN a.accident_date > CURRENT_DATE - INTERVAL '90 days' THEN 1 END) as recent_accidents
    FROM vehicles v
    LEFT JOIN repairs r ON r.vehicle_id = v.id
    LEFT JOIN job_cards jc ON jc.vehicle_id = v.id
    LEFT JOIN accidents a ON a.vehicle_id = v.id
    ${whereClause}
    AND v.deleted_at IS NULL
    AND v.status = 'Active'
    GROUP BY v.id, v.registration_num, v.current_mileage, v.next_service_due
  `, params);

  const forecast = (v: any): CostForecast => {
    const cost30d = parseFloat(v.cost_30d);
    const cost90d = parseFloat(v.cost_90d);
    const cost1y = parseFloat(v.cost_1y);
    
    // Calculate trend (increasing, stable, decreasing)
    const monthlyAvg = cost90d / 3;
    const trend = monthlyAvg > 0 ? (cost30d - monthlyAvg) / monthlyAvg : 0;
    
    // Base prediction
    let next30 = monthlyAvg;
    let next90 = monthlyAvg * 3;
    let nextYear = cost1y;

    // Adjust for risk factors
    const factors: string[] = [];
    
    if (v.open_job_cards > 0) {
      next30 += v.open_job_cards * 500; // Estimate $500 per open job
      factors.push(`${v.open_job_cards} open job card(s)`);
    }
    
    if (v.recent_accidents > 0) {
      next90 += v.recent_accidents * 1000;
      factors.push(`${v.recent_accidents} recent accident(s)`);
    }
    
    if (v.next_service_due) {
      const daysUntil = Math.ceil((new Date(v.next_service_due).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 30) {
        next30 += 300; // Estimated service cost
        factors.push('Service due within 30 days');
      }
    }
    
    // Adjust for trend
    if (trend > 0.2) {
      next30 *= 1.2;
      factors.push('Rising maintenance costs');
    }

    // Confidence based on data availability
    let confidence: CostForecast['confidence'] = 'low';
    if (cost90d > 0 && cost1y > 0) confidence = 'high';
    else if (cost90d > 0) confidence = 'medium';

    return {
      vehicleId: v.id,
      registrationNum: v.registration_num,
      next30Days: Math.round(next30),
      next90Days: Math.round(next90),
      nextYear: Math.round(nextYear * (1 + trend)),
      confidence,
      factors
    };
  };

  if (vehicleId) {
    return vehicles.length > 0 ? forecast(vehicles[0]) : null;
  }
  
  return vehicles.map(forecast);
};

// ==================== CHATBOT AI ====================

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Process chatbot queries about fleet data
 */
export const processChatQuery = async (messages: ChatMessage[]): Promise<string> => {
  if (!AI_ENABLED) {
    return processRuleBasedChat(messages[messages.length - 1]?.content || '');
  }

  try {
    // Get fleet summary data for context
    const [vehicleCount, driverCount, pendingRepairs, todayRoutes] = await Promise.all([
      query('SELECT COUNT(*) as count FROM vehicles WHERE status = $1', ['Active']),
      query("SELECT COUNT(*) as count FROM staff WHERE role = $1", ['Driver']),
      query("SELECT COUNT(*) as count FROM repairs WHERE status = $1", ['Pending']),
      query('SELECT COUNT(*) as count FROM routes WHERE route_date = CURRENT_DATE')
    ]);

    const fleetContext = `
Fleet Status:
- Active Vehicles: ${vehicleCount[0]?.count || 0}
- Drivers: ${driverCount[0]?.count || 0}
- Pending Repairs: ${pendingRepairs[0]?.count || 0}
- Today's Routes: ${todayRoutes[0]?.count || 0}
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: `You are FleetPro AI, a helpful fleet management assistant. ${fleetContext}
          
Respond concisely (2-3 sentences). If you need specific data, suggest using the relevant dashboard.` 
        },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ],
      max_tokens: 200
    });

    return response.choices[0].message.content || 'I apologize, I could not process that query.';
  } catch (error) {
    console.error('Chat AI error:', error);
    return processRuleBasedChat(messages[messages.length - 1]?.content || '');
  }
};

const processRuleBasedChat = async (queryText: string): Promise<string> => {
  const lowerQuery = queryText.toLowerCase();
  
  if (lowerQuery.includes('hello') || lowerQuery.includes('hi')) {
    return 'Hello! I\'m FleetPro AI. How can I help you with your fleet today?';
  }
  
  if (lowerQuery.includes('vehicle') && (lowerQuery.includes('how many') || lowerQuery.includes('count'))) {
    const result = await query('SELECT COUNT(*) as count FROM vehicles WHERE status = $1', ['Active']);
    return `You currently have ${result[0]?.count || 0} active vehicles in your fleet.`;
  }
  
  if (lowerQuery.includes('repair') || lowerQuery.includes('maintenance')) {
    const result = await query("SELECT COUNT(*) as count FROM repairs WHERE status = 'Pending'");
    return `There are ${result[0]?.count || 0} pending repairs. Check the Repairs module for details.`;
  }
  
  if (lowerQuery.includes('fuel')) {
    return 'Fuel data is available in the Fuel module and Analytics dashboard. You can view consumption by vehicle and driver.';
  }
  
  if (lowerQuery.includes('driver')) {
    const result = await query("SELECT COUNT(*) as count FROM staff WHERE role = 'Driver'");
    return `You have ${result[0]?.count || 0} drivers. View driver performance in the Analytics section.`;
  }
  
  if (lowerQuery.includes('help')) {
    return 'I can help with: vehicle counts, pending repairs, fuel info, driver stats, and general fleet questions. What would you like to know?';
  }
  
  return 'I understand you\'re asking about your fleet. For detailed information, please check the relevant dashboard or rephrase your question.';
};

// ==================== EXPORT ====================

export const AI_ENABLED = !!process.env.OPENAI_API_KEY;

export default {
  generateFleetRecommendations,
  generateSlideNotes,
  processAnalyticsQuery,
  generateCorrectiveActions,
  analyzeDriverBehavior,
  detectAnomalies,
  predictMaintenanceCosts,
  processChatQuery,
  AI_ENABLED
};
