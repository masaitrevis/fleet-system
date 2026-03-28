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
  console.log('🤖 processChatQuery called, AI_ENABLED:', AI_ENABLED);
  console.log('🤖 Messages:', JSON.stringify(messages));
  
  if (!AI_ENABLED) {
    console.log('🤖 Using rule-based fallback (no OpenAI key)');
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

    console.log('🤖 Calling OpenAI API...');
    
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

    console.log('🤖 OpenAI response received');
    return response.choices[0].message.content || 'I apologize, I could not process that query.';
  } catch (error: any) {
    console.error('🤖 Chat AI error:', error.message);
    console.log('🤖 Falling back to rule-based response');
    return processRuleBasedChat(messages[messages.length - 1]?.content || '');
  }
};

const processRuleBasedChat = async (queryText: string): Promise<string> => {
  const lowerQuery = queryText.toLowerCase();
  
  // Greeting only when explicitly said
  if (lowerQuery.match(/^(hello|hi|hey|greetings)$/)) {
    return 'Hello! How can I help you with your fleet today?';
  }
  
  // Vehicles under maintenance
  if (lowerQuery.includes('maintenance') && lowerQuery.includes('vehicle')) {
    const result = await query(
      "SELECT COUNT(*) as count FROM vehicles WHERE status = 'Maintenance' AND deleted_at IS NULL"
    );
    const vehicles = await query(
      "SELECT registration_num, current_mileage FROM vehicles WHERE status = 'Maintenance' AND deleted_at IS NULL LIMIT 5"
    );
    const count = result[0]?.count || 0;
    if (count === 0) return 'No vehicles are currently under maintenance.';
    let response = `${count} vehicle(s) currently under maintenance:`;
    vehicles.forEach((v: any) => {
      response += `\n• ${v.registration_num} (${v.current_mileage?.toLocaleString()} km)`;
    });
    return response;
  }
  
  // Vehicle count/status
  if (lowerQuery.includes('vehicle') && (lowerQuery.includes('how many') || lowerQuery.includes('count') || lowerQuery.includes('total'))) {
    const total = await query('SELECT COUNT(*) as count FROM vehicles WHERE deleted_at IS NULL');
    const active = await query("SELECT COUNT(*) as count FROM vehicles WHERE status = 'Active' AND deleted_at IS NULL");
    const maintenance = await query("SELECT COUNT(*) as count FROM vehicles WHERE status = 'Maintenance' AND deleted_at IS NULL");
    return `Fleet Status:\n• Total: ${total[0]?.count || 0}\n• Active: ${active[0]?.count || 0}\n• Maintenance: ${maintenance[0]?.count || 0}`;
  }
  
  // Routes today
  if (lowerQuery.includes('route') && (lowerQuery.includes('today') || lowerQuery.includes('schedule'))) {
    const result = await query(
      'SELECT COUNT(*) as count FROM routes WHERE route_date = CURRENT_DATE'
    );
    const routes = await query(`
      SELECT r.route_name, v.registration_num, s.staff_name as driver
      FROM routes r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN staff s ON r.driver1_id = s.id
      WHERE r.route_date = CURRENT_DATE
      LIMIT 5
    `);
    const count = result[0]?.count || 0;
    if (count === 0) return 'No routes scheduled for today.';
    let response = `${count} route(s) scheduled today:`;
    routes.forEach((r: any) => {
      response += `\n• ${r.route_name} - ${r.registration_num || 'No vehicle'} (${r.driver || 'No driver'})`;
    });
    return response;
  }
  
  // Inspections/Audits
  if (lowerQuery.includes('inspection') || lowerQuery.includes('audit')) {
    const pending = await query(
      "SELECT COUNT(*) as count FROM audit_sessions WHERE status = 'Pending'"
    );
    const completed = await query(
      "SELECT COUNT(*) as count FROM audit_sessions WHERE status = 'Completed' AND DATE(updated_at) = CURRENT_DATE"
    );
    return `Inspection Status:\n• Pending: ${pending[0]?.count || 0}\n• Completed today: ${completed[0]?.count || 0}`;
  }
  
  // Repairs
  if (lowerQuery.includes('repair') || lowerQuery.includes('breakdown')) {
    const pending = await query("SELECT COUNT(*) as count FROM repairs WHERE status = 'Pending'");
    const inProgress = await query("SELECT COUNT(*) as count FROM repairs WHERE status = 'In Progress'");
    const recent = await query(`
      SELECT r.description, v.registration_num, r.cost
      FROM repairs r
      JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.date_in > CURRENT_DATE - INTERVAL '7 days'
      ORDER BY r.date_in DESC
      LIMIT 3
    `);
    let response = `Repair Status:\n• Pending: ${pending[0]?.count || 0}\n• In Progress: ${inProgress[0]?.count || 0}`;
    if (recent.length > 0) {
      response += '\n\nRecent repairs (7 days):';
      recent.forEach((r: any) => {
        response += `\n• ${r.registration_num}: ${r.description?.substring(0, 30)}... ($${r.cost})`;
      });
    }
    return response;
  }
  
  // Fuel
  if (lowerQuery.includes('fuel')) {
    const today = await query('SELECT COALESCE(SUM(amount), 0) as total FROM fuel_records WHERE fuel_date = CURRENT_DATE');
    const month = await query("SELECT COALESCE(SUM(amount), 0) as total FROM fuel_records WHERE fuel_date > CURRENT_DATE - INTERVAL '30 days'");
    const avgEfficiency = await query("SELECT AVG(km_per_liter) as avg FROM fuel_records WHERE fuel_date > CURRENT_DATE - INTERVAL '30 days' AND km_per_liter IS NOT NULL");
    return `Fuel Summary (30 days):\n• Total cost: $${parseFloat(month[0]?.total || 0).toFixed(2)}\n• Today: $${parseFloat(today[0]?.total || 0).toFixed(2)}\n• Avg efficiency: ${parseFloat(avgEfficiency[0]?.avg || 0).toFixed(2)} km/L`;
  }
  
  // Drivers
  if (lowerQuery.includes('driver')) {
    const total = await query("SELECT COUNT(*) as count FROM staff WHERE role = 'Driver' AND deleted_at IS NULL");
    const active = await query(`
      SELECT COUNT(DISTINCT driver1_id) as count 
      FROM routes 
      WHERE route_date = CURRENT_DATE AND driver1_id IS NOT NULL
    `);
    return `Driver Status:\n• Total drivers: ${total[0]?.count || 0}\n• On duty today: ${active[0]?.count || 0}`;
  }
  
  // Analytics/Reports
  if (lowerQuery.includes('report') || lowerQuery.includes('analytics')) {
    return 'Reports available:\n• Fleet Summary\n• Fuel Consumption\n• Route History\n• Maintenance Records\n\nAccess these from the Reports menu.';
  }
  
  // Training
  if (lowerQuery.includes('training') || lowerQuery.includes('course')) {
    const courses = await query('SELECT COUNT(*) as count FROM training_courses');
    const enrollments = await query("SELECT COUNT(*) as count FROM training_enrollments WHERE status = 'in_progress'");
    return `Training Overview:\n• Available courses: ${courses[0]?.count || 0}\n• Active enrollments: ${enrollments[0]?.count || 0}\n\nAccess the Training module to view courses and enroll.`;
  }
  
  // Help
  if (lowerQuery.includes('help') || lowerQuery.includes('what can you do')) {
    return 'I can help you with:\n• Vehicle counts and status\n• Routes scheduled today\n• Pending repairs and maintenance\n• Fuel consumption summary\n• Driver statistics\n• Inspection/Audit status\n• Training information\n\nWhat would you like to know?';
  }
  
  // Default - try to give a helpful response
  return 'I can help with fleet information like vehicle status, routes, repairs, fuel, and more. Try asking:\n• "Which vehicles are under maintenance?"\n• "What routes are scheduled today?"\n• "How many pending repairs?"\n• "Show fuel summary"';
};

// ==================== FLEET COPILOT AI ====================

interface FleetContext {
  vehicles?: any[];
  drivers?: any[];
  routes?: any[];
  inspections?: any[];
  maintenance?: any[];
  accidents?: any[];
  training?: any[];
  analytics?: any;
}

const SYSTEM_PROMPT = `You are the AI assistant for NextBotics Fleet Management System. Your role is to help users understand and manage fleet operations.

CRITICAL INSTRUCTIONS:
- NEVER introduce yourself. NEVER say "I am an AI assistant" or similar.
- ALWAYS answer operational questions directly using the provided data.
- Use bullet points (•) for lists.
- Use tables for multiple entries with columns.
- Keep responses short and actionable.
- If data shows issues, highlight them clearly.
- If no data found, provide useful guidance or next steps.
- Focus on operational insights, not generic statements.`;

/**
 * Fetch fleet data based on query context
 */
const fetchFleetContext = async (queryText: string): Promise<FleetContext> => {
  const lowerQuery = queryText.toLowerCase();
  const context: FleetContext = {};
  
  // Vehicles data
  if (lowerQuery.includes('vehicle') || lowerQuery.includes('fleet') || lowerQuery.includes('car') || lowerQuery.includes('truck')) {
    context.vehicles = await query(`
      SELECT v.registration_num, v.status, v.current_mileage, v.next_service_due, 
             v.department, v.branch, v.make_model
      FROM vehicles v
      WHERE v.deleted_at IS NULL
      ORDER BY v.registration_num
      LIMIT 50
    `);
  }
  
  // Drivers data
  if (lowerQuery.includes('driver') || lowerQuery.includes('operator') || lowerQuery.includes('staff')) {
    context.drivers = await query(`
      SELECT s.id, s.staff_name, s.role, s.department, s.branch, s.status
      FROM staff s
      WHERE s.deleted_at IS NULL
      ORDER BY s.staff_name
      LIMIT 50
    `);
  }
  
  // Routes data
  if (lowerQuery.includes('route') || lowerQuery.includes('trip') || lowerQuery.includes('delivery')) {
    const dateFilter = lowerQuery.includes('today') ? 'CURRENT_DATE' : 
                      lowerQuery.includes('week') ? 'CURRENT_DATE - INTERVAL \'7 days\'' :
                      lowerQuery.includes('month') ? 'CURRENT_DATE - INTERVAL \'30 days\'' : 'CURRENT_DATE - INTERVAL \'7 days\'';
    
    context.routes = await query(`
      SELECT r.route_name, r.route_date, r.actual_km, r.target_km,
             v.registration_num, s.staff_name as driver_name
      FROM routes r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN staff s ON r.driver1_id = s.id
      WHERE r.route_date >= ${dateFilter}
      ORDER BY r.route_date DESC
      LIMIT 30
    `);
  }
  
  // Inspections/Audits data
  if (lowerQuery.includes('inspection') || lowerQuery.includes('audit') || lowerQuery.includes('check')) {
    context.inspections = await query(`
      SELECT audit.audit_number, audit.status, audit.audit_date, 
             v.registration_num, t.template_name
      FROM audit_sessions audit
      LEFT JOIN audit_templates t ON audit.template_id = t.id
      LEFT JOIN LATERAL jsonb_array_elements_text(audit.vehicle_ids) vid ON true
      LEFT JOIN vehicles v ON vid = v.id::text
      WHERE audit.created_at > CURRENT_DATE - INTERVAL '30 days'
      ORDER BY audit.created_at DESC
      LIMIT 30
    `);
  }
  
  // Maintenance/Job Cards data
  if (lowerQuery.includes('maintenance') || lowerQuery.includes('repair') || lowerQuery.includes('service') || lowerQuery.includes('job card')) {
    context.maintenance = await query(`
      SELECT jc.id, jc.status, jc.priority, jc.defect_description, jc.created_at,
             v.registration_num, s.staff_name as assigned_to
      FROM job_cards jc
      LEFT JOIN vehicles v ON jc.vehicle_id = v.id
      LEFT JOIN staff s ON jc.assigned_to = s.id
      WHERE jc.created_at > CURRENT_DATE - INTERVAL '30 days'
      ORDER BY jc.created_at DESC
      LIMIT 30
    `);
  }
  
  // Accidents data
  if (lowerQuery.includes('accident') || lowerQuery.includes('incident') || lowerQuery.includes('crash')) {
    context.accidents = await query(`
      SELECT a.id, a.accident_date, a.accident_cause, a.damage_severity,
             v.registration_num, s.staff_name as driver_name
      FROM accidents a
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN staff s ON a.driver_id = s.id
      WHERE a.accident_date > CURRENT_DATE - INTERVAL '90 days'
      ORDER BY a.accident_date DESC
      LIMIT 20
    `);
  }
  
  // Training data
  if (lowerQuery.includes('training') || lowerQuery.includes('course') || lowerQuery.includes('certification')) {
    context.training = await query(`
      SELECT tc.course_name, tc.category, tc.mandatory, 
             COUNT(te.id) as enrolled_count
      FROM training_courses tc
      LEFT JOIN training_enrollments te ON te.course_id = tc.id AND te.status = 'in_progress'
      GROUP BY tc.id, tc.course_name, tc.category, tc.mandatory
      ORDER BY tc.mandatory DESC, tc.course_name
      LIMIT 30
    `);
  }
  
  // Analytics summary
  if (lowerQuery.includes('analytics') || lowerQuery.includes('report') || lowerQuery.includes('statistics') || lowerQuery.includes('summary')) {
    const [vehicleStats, driverStats, fuelStats, repairStats] = await Promise.all([
      query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'Active' THEN 1 END) as active,
          COUNT(CASE WHEN status = 'Maintenance' THEN 1 END) as maintenance
        FROM vehicles WHERE deleted_at IS NULL
      `),
      query(`
        SELECT COUNT(*) as total FROM staff WHERE deleted_at IS NULL
      `),
      query(`
        SELECT COALESCE(SUM(amount), 0) as total_cost, 
               COALESCE(SUM(quantity_liters), 0) as total_liters
        FROM fuel_records WHERE fuel_date > CURRENT_DATE - INTERVAL '30 days'
      `),
      query(`
        SELECT COUNT(*) as pending FROM repairs WHERE status != 'Completed'
      `)
    ]);
    
    context.analytics = {
      vehicles: vehicleStats[0],
      drivers: driverStats[0],
      fuel: fuelStats[0],
      repairs: repairStats[0]
    };
  }
  
  return context;
};

/**
 * Process fleet copilot query with comprehensive context
 */
export const processFleetCopilotQuery = async (userQuestion: string): Promise<string> => {
  console.log('🤖 Fleet Copilot query:', userQuestion);
  
  try {
    // Fetch relevant fleet context based on the question
    const fleetContext = await fetchFleetContext(userQuestion);
    
    // Build context string for AI
    let contextString = '';
    
    if (fleetContext.vehicles?.length) {
      contextString += `\n\nVEHICLES (${fleetContext.vehicles.length} total):\n`;
      fleetContext.vehicles.slice(0, 15).forEach((v: any) => {
        contextString += `• ${v.registration_num} | ${v.status} | ${v.make_model || 'N/A'} | ${v.current_mileage?.toLocaleString() || 0} km${v.next_service_due ? ' | Service: ' + v.next_service_due : ''}\n`;
      });
      if (fleetContext.vehicles.length > 15) contextString += `... and ${fleetContext.vehicles.length - 15} more\n`;
    }
    
    if (fleetContext.drivers?.length) {
      contextString += `\n\nDRIVERS (${fleetContext.drivers.length} total):\n`;
      fleetContext.drivers.slice(0, 10).forEach((d: any) => {
        contextString += `• ${d.staff_name} | ${d.role} | ${d.department || 'N/A'}\n`;
      });
    }
    
    if (fleetContext.routes?.length) {
      contextString += `\n\nROUTES (${fleetContext.routes.length} recent):\n`;
      fleetContext.routes.slice(0, 10).forEach((r: any) => {
        const status = r.actual_km ? `Completed (${r.actual_km} km)` : 'Scheduled';
        contextString += `• ${r.route_name} | ${r.route_date} | ${status} | ${r.registration_num || 'No vehicle'}\n`;
      });
    }
    
    if (fleetContext.inspections?.length) {
      contextString += `\n\nINSPECTIONS/AUDITS (${fleetContext.inspections.length} recent):\n`;
      fleetContext.inspections.slice(0, 10).forEach((i: any) => {
        contextString += `• ${i.audit_number} | ${i.status} | ${i.registration_num || 'N/A'} | ${i.template_name}\n`;
      });
    }
    
    if (fleetContext.maintenance?.length) {
      contextString += `\n\nMAINTENANCE/JOB CARDS (${fleetContext.maintenance.length} recent):\n`;
      fleetContext.maintenance.slice(0, 10).forEach((m: any) => {
        contextString += `• ${m.registration_num || 'N/A'} | ${m.status} | ${m.priority} | ${m.defect_description?.substring(0, 40) || 'N/A'}...\n`;
      });
    }
    
    if (fleetContext.accidents?.length) {
      contextString += `\n\nACCIDENTS (${fleetContext.accidents.length} recent):\n`;
      fleetContext.accidents.slice(0, 10).forEach((a: any) => {
        contextString += `• ${a.accident_date} | ${a.registration_num} | ${a.accident_cause} | ${a.damage_severity}\n`;
      });
    }
    
    if (fleetContext.training?.length) {
      contextString += `\n\nTRAINING COURSES (${fleetContext.training.length}):\n`;
      fleetContext.training.forEach((t: any) => {
        contextString += `• ${t.course_name} | ${t.category} | ${t.mandatory ? 'Mandatory' : 'Optional'} | ${t.enrolled_count} enrolled\n`;
      });
    }
    
    if (fleetContext.analytics) {
      contextString += `\n\nANALYTICS SUMMARY:\n`;
      if (fleetContext.analytics.vehicles) {
        contextString += `• Vehicles: ${fleetContext.analytics.vehicles.total} total (${fleetContext.analytics.vehicles.active} active, ${fleetContext.analytics.vehicles.maintenance} in maintenance)\n`;
      }
      if (fleetContext.analytics.drivers) {
        contextString += `• Staff: ${fleetContext.analytics.drivers.total} total\n`;
      }
      if (fleetContext.analytics.fuel) {
        contextString += `• Fuel (30 days): $${parseFloat(fleetContext.analytics.fuel.total_cost).toFixed(2)} | ${parseFloat(fleetContext.analytics.fuel.total_liters).toFixed(0)} liters\n`;
      }
      if (fleetContext.analytics.repairs) {
        contextString += `• Pending Repairs: ${fleetContext.analytics.repairs.pending}\n`;
      }
    }
    
    // If AI is enabled, use OpenAI with full context
    if (AI_ENABLED) {
      console.log('🤖 Calling OpenAI Fleet Copilot...');
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { 
            role: 'user', 
            content: `User Question: ${userQuestion}\n\nFleet Data Context:${contextString || '\nNo specific fleet data available for this query.'}\n\nProvide a direct, actionable answer based on the data above. Use bullet points or a table if listing multiple items.`
          }
        ],
        max_tokens: 800,
        temperature: 0.3
      });
      
      console.log('🤖 OpenAI response received');
      return response.choices[0].message.content || 'Unable to process query. Please try again.';
    }
    
    // Fallback to enhanced rule-based response
    console.log('🤖 Using rule-based Fleet Copilot fallback');
    return processRuleBasedCopilot(userQuestion, fleetContext);
    
  } catch (error: any) {
    console.error('🤖 Fleet Copilot error:', error.message);
    // Fall back to simple rule-based
    return processRuleBasedChat(userQuestion);
  }
};

/**
 * Enhanced rule-based copilot with full context
 */
const processRuleBasedCopilot = async (queryText: string, context: FleetContext): Promise<string> => {
  const lowerQuery = queryText.toLowerCase();
  
  // Vehicles under maintenance
  if ((lowerQuery.includes('maintenance') || lowerQuery.includes('under repair')) && lowerQuery.includes('vehicle')) {
    const maintenanceVehicles = context.vehicles?.filter((v: any) => v.status === 'Maintenance') || [];
    if (maintenanceVehicles.length === 0) {
      return '✅ No vehicles currently under maintenance.';
    }
    let response = `🔧 ${maintenanceVehicles.length} vehicle(s) under maintenance:\n`;
    maintenanceVehicles.forEach((v: any) => {
      response += `• **${v.registration_num}** - ${v.make_model || 'N/A'} (${v.current_mileage?.toLocaleString() || 0} km)\n`;
    });
    return response;
  }
  
  // Overdue inspections/audits
  if (lowerQuery.includes('overdue') && (lowerQuery.includes('inspection') || lowerQuery.includes('audit'))) {
    const overdue = context.inspections?.filter((i: any) => i.status === 'Pending' || i.status === 'Overdue') || [];
    if (overdue.length === 0) {
      return '✅ No overdue inspections. All audits are up to date.';
    }
    let response = `⚠️ ${overdue.length} overdue inspection(s):\n`;
    overdue.forEach((i: any) => {
      response += `• **${i.audit_number}** - ${i.registration_num || 'No vehicle'} - ${i.template_name}\n`;
    });
    response += '\n**Action:** Schedule these inspections immediately.';
    return response;
  }
  
  // Route delays
  if (lowerQuery.includes('delay') || lowerQuery.includes('late') || lowerQuery.includes('missed')) {
    const completedRoutes = context.routes?.filter((r: any) => r.actual_km && r.target_km) || [];
    const delayed = completedRoutes.filter((r: any) => r.actual_km < r.target_km * 0.8);
    
    if (delayed.length === 0) {
      return '✅ No route delays detected. All recent routes completed as planned.';
    }
    
    let response = `⚠️ ${delayed.length} route(s) with potential delays:\n`;
    delayed.forEach((r: any) => {
      const completion = ((r.actual_km / r.target_km) * 100).toFixed(0);
      response += `• **${r.route_name}** (${r.route_date}) - ${completion}% completion | ${r.registration_num}\n`;
    });
    return response;
  }
  
  // Drivers with most trips
  if (lowerQuery.includes('driver') && (lowerQuery.includes('most') || lowerQuery.includes('trip') || lowerQuery.includes('completed'))) {
    const driverTrips: Record<string, { name: string; count: number; km: number }> = {};
    
    context.routes?.forEach((r: any) => {
      if (r.driver_name) {
        if (!driverTrips[r.driver_name]) {
          driverTrips[r.driver_name] = { name: r.driver_name, count: 0, km: 0 };
        }
        driverTrips[r.driver_name].count++;
        driverTrips[r.driver_name].km += parseFloat(r.actual_km || 0);
      }
    });
    
    const sorted = Object.values(driverTrips).sort((a, b) => b.count - a.count).slice(0, 5);
    
    if (sorted.length === 0) {
      return 'No route data available for driver analysis.';
    }
    
    let response = `🏆 Top Drivers by Trips:\n`;
    sorted.forEach((d, i) => {
      response += `${i + 1}. **${d.name}** - ${d.count} trips | ${d.km.toFixed(0)} km\n`;
    });
    return response;
  }
  
  // Pending maintenance/repairs
  if (lowerQuery.includes('pending') && (lowerQuery.includes('repair') || lowerQuery.includes('maintenance'))) {
    const pending = context.maintenance?.filter((m: any) => m.status !== 'Completed' && m.status !== 'Closed') || [];
    if (pending.length === 0) {
      return '✅ No pending maintenance. All job cards are completed.';
    }
    let response = `🔧 ${pending.length} pending maintenance item(s):\n`;
    pending.slice(0, 10).forEach((m: any) => {
      response += `• **${m.registration_num || 'N/A'}** | ${m.status} | ${m.priority} | ${m.defect_description?.substring(0, 30)}...\n`;
    });
    if (pending.length > 10) response += `... and ${pending.length - 10} more\n`;
    return response;
  }
  
  // Vehicle count/status
  if (lowerQuery.includes('how many') || lowerQuery.includes('count') || lowerQuery.includes('total')) {
    const active = context.vehicles?.filter((v: any) => v.status === 'Active').length || 0;
    const maintenance = context.vehicles?.filter((v: any) => v.status === 'Maintenance').length || 0;
    const total = context.vehicles?.length || 0;
    
    return `📊 Fleet Status:\n• **Total:** ${total} vehicles\n• **Active:** ${active} vehicles\n• **Maintenance:** ${maintenance} vehicles`;
  }
  
  // Today's routes
  if (lowerQuery.includes('today') && lowerQuery.includes('route')) {
    const todayRoutes = context.routes?.filter((r: any) => r.route_date === new Date().toISOString().split('T')[0]) || [];
    if (todayRoutes.length === 0) {
      return '📅 No routes scheduled for today.';
    }
    
    let response = `📅 Today's Routes (${todayRoutes.length}):\n`;
    todayRoutes.forEach((r: any) => {
      const status = r.actual_km ? '✅ Completed' : '⏳ Scheduled';
      response += `• **${r.route_name}** | ${status} | ${r.registration_num || 'No vehicle'} | ${r.driver_name || 'No driver'}\n`;
    });
    return response;
  }
  
  // Recent accidents
  if (lowerQuery.includes('accident') || lowerQuery.includes('incident')) {
    if (!context.accidents || context.accidents.length === 0) {
      return '✅ No accidents reported in the last 90 days.';
    }
    let response = `🚨 ${context.accidents.length} accident(s) in last 90 days:\n`;
    context.accidents.slice(0, 5).forEach((a: any) => {
      response += `• **${a.accident_date}** | ${a.registration_num} | ${a.accident_cause} | ${a.damage_severity}\n`;
    });
    return response;
  }
  
  // Fuel summary
  if (lowerQuery.includes('fuel')) {
    if (!context.analytics?.fuel) {
      return '⛽ Fuel data not available.';
    }
    const cost = parseFloat(context.analytics.fuel.total_cost || 0).toFixed(2);
    const liters = parseFloat(context.analytics.fuel.total_liters || 0).toFixed(0);
    return `⛽ Fuel Summary (30 days):\n• **Total Cost:** $${cost}\n• **Total Volume:** ${liters} liters`;
  }
  
  // Default response with available context
  if (context.analytics) {
    return `📊 Fleet Overview:\n• Vehicles: ${context.analytics.vehicles?.total || 0} total\n• Staff: ${context.analytics.drivers?.total || 0} total\n• Pending Repairs: ${context.analytics.repairs?.pending || 0}\n\nAsk me about specific areas like vehicles, routes, maintenance, or accidents.`;
  }
  
  return 'I can help with fleet operations. Try asking:\n• "Which vehicles are under maintenance?"\n• "Show overdue inspections"\n• "Which routes had delays today?"\n• "Which drivers completed the most trips?"';
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
  processFleetCopilotQuery,
  AI_ENABLED
};

// ==================== FLEET RISK INTELLIGENCE ====================

export interface VehicleRiskProfile {
  vehicleId: string;
  registrationNum: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  factors: RiskFactor[];
  recommendations: string[];
  lastUpdated: string;
}

export interface RiskFactor {
  type: 'defects' | 'maintenance' | 'accidents' | 'inspection' | 'usage' | 'driver';
  severity: 'low' | 'medium' | 'high';
  description: string;
  count?: number;
}

export interface RiskAlert {
  id: string;
  type: 'vehicle' | 'driver' | 'inspection' | 'maintenance' | 'route';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  entityId: string;
  entityName: string;
  createdAt: string;
  acknowledged: boolean;
}

export interface FleetIntelligenceSummary {
  totalVehiclesAtRisk: number;
  criticalAlerts: number;
  highAlerts: number;
  mediumAlerts: number;
  overdueInspections: number;
  maintenanceDueSoon: number;
  driverSafetyAlerts: number;
  vehiclesByRiskLevel: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

/**
 * Calculate vehicle risk score based on multiple factors
 */
export const calculateVehicleRisk = async (vehicleId?: string): Promise<VehicleRiskProfile | VehicleRiskProfile[] | null> => {
  const whereClause = vehicleId ? 'WHERE v.id = $1 AND v.deleted_at IS NULL' : 'WHERE v.deleted_at IS NULL';
  const params = vehicleId ? [vehicleId] : [];
  
  const vehicles = await query(`
    SELECT 
      v.id,
      v.registration_num,
      v.current_mileage,
      v.next_service_due,
      v.last_service_date,
      v.defect_notes,
      v.defect_reported_at,
      v.status,
      -- Defect count (30 days) from job_cards
      COUNT(DISTINCT CASE WHEN jc.defect_description IS NOT NULL AND jc.created_at > CURRENT_DATE - INTERVAL '30 days' THEN jc.id END) as defect_count_30d,
      -- Accident count (90 days)
      COUNT(DISTINCT CASE WHEN a.id IS NOT NULL AND a.accident_date > CURRENT_DATE - INTERVAL '90 days' THEN a.id END) as accident_count_90d,
      -- Maintenance frequency (repairs in last 90 days)
      COUNT(DISTINCT CASE WHEN r.id IS NOT NULL AND r.date_in > CURRENT_DATE - INTERVAL '90 days' THEN r.id END) as repair_count_90d,
      -- Overdue inspection check (using audit_sessions)
      MAX(audit.last_completed_audit) as last_audit_date,
      -- Route completion rate
      COUNT(DISTINCT CASE WHEN rt.route_date > CURRENT_DATE - INTERVAL '30 days' THEN rt.id END) as routes_30d,
      COUNT(DISTINCT CASE WHEN rt.route_date > CURRENT_DATE - INTERVAL '30 days' AND rt.actual_km IS NOT NULL THEN rt.id END) as completed_routes_30d
    FROM vehicles v
    LEFT JOIN job_cards jc ON jc.vehicle_id = v.id
    LEFT JOIN accidents a ON a.vehicle_id = v.id
    LEFT JOIN repairs r ON r.vehicle_id = v.id
    LEFT JOIN LATERAL (
      SELECT MAX(audit_date) as last_audit_date, MAX(CASE WHEN status = 'Completed' THEN audit_date END) as last_completed_audit
      FROM audit_sessions 
      WHERE vehicle_ids @> jsonb_build_array(v.id)
    ) audit ON true
    LEFT JOIN routes rt ON rt.vehicle_id = v.id
    ${whereClause}
    GROUP BY v.id, v.registration_num, v.current_mileage, v.next_service_due, v.last_service_date, v.defect_notes, v.defect_reported_at, v.status
  `, params);

  const analyzeRisk = (v: any): VehicleRiskProfile => {
    const factors: RiskFactor[] = [];
    let riskScore = 0;
    
    // Defect analysis (0-25 points)
    const defectCount = parseInt(v.defect_count_30d) || 0;
    if (defectCount >= 3) {
      riskScore += 25;
      factors.push({
        type: 'defects',
        severity: 'high',
        description: `${defectCount} defects reported in last 30 days`,
        count: defectCount
      });
    } else if (defectCount >= 1) {
      riskScore += 10;
      factors.push({
        type: 'defects',
        severity: 'medium',
        description: `${defectCount} defect(s) reported recently`,
        count: defectCount
      });
    }
    
    // Accident analysis (0-25 points)
    const accidentCount = parseInt(v.accident_count_90d) || 0;
    if (accidentCount >= 2) {
      riskScore += 25;
      factors.push({
        type: 'accidents',
        severity: 'high',
        description: `${accidentCount} accidents in last 90 days`,
        count: accidentCount
      });
    } else if (accidentCount === 1) {
      riskScore += 10;
      factors.push({
        type: 'accidents',
        severity: 'medium',
        description: '1 accident in last 90 days',
        count: 1
      });
    }
    
    // Maintenance threshold (0-25 points)
    const repairCount = parseInt(v.repair_count_90d) || 0;
    const daysUntilService = v.next_service_due 
      ? Math.ceil((new Date(v.next_service_due).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;
    
    if (daysUntilService !== null && daysUntilService < 0) {
      riskScore += 25;
      factors.push({
        type: 'maintenance',
        severity: 'high',
        description: `Service overdue by ${Math.abs(daysUntilService)} days`
      });
    } else if (daysUntilService !== null && daysUntilService <= 7) {
      riskScore += 15;
      factors.push({
        type: 'maintenance',
        severity: 'medium',
        description: `Service due in ${daysUntilService} days`
      });
    } else if (repairCount >= 3) {
      riskScore += 15;
      factors.push({
        type: 'maintenance',
        severity: 'medium',
        description: `High maintenance frequency (${repairCount} repairs in 90 days)`,
        count: repairCount
      });
    }
    
    // Inspection check (0-15 points) - based on last audit date (assuming quarterly audits)
    if (v.last_audit_date) {
      const daysSinceAudit = Math.ceil((Date.now() - new Date(v.last_audit_date).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceAudit > 90) {
        riskScore += 15;
        factors.push({
          type: 'inspection',
          severity: 'high',
          description: `Last audit was ${daysSinceAudit} days ago (overdue)`
        });
      } else if (daysSinceAudit > 75) {
        riskScore += 5;
        factors.push({
          type: 'inspection',
          severity: 'low',
          description: `Last audit was ${daysSinceAudit} days ago (due soon)`
        });
      }
    } else {
      // No audit record found
      riskScore += 10;
      factors.push({
        type: 'inspection',
        severity: 'medium',
        description: 'No audit record found for this vehicle'
      });
    }
    
    // Usage pattern analysis (0-10 points)
    const totalRoutes = parseInt(v.routes_30d) || 0;
    const completedRoutes = parseInt(v.completed_routes_30d) || 0;
    if (totalRoutes > 0) {
      const completionRate = completedRoutes / totalRoutes;
      if (completionRate < 0.7) {
        riskScore += 10;
        factors.push({
          type: 'usage',
          severity: 'medium',
          description: `Low route completion rate (${(completionRate * 100).toFixed(0)}%)`
        });
      }
    }
    
    // Determine risk level
    let riskLevel: VehicleRiskProfile['riskLevel'] = 'low';
    if (riskScore >= 60) riskLevel = 'critical';
    else if (riskScore >= 40) riskLevel = 'high';
    else if (riskScore >= 20) riskLevel = 'medium';
    
    // Generate recommendations
    const recommendations: string[] = [];
    if (factors.some(f => f.type === 'defects' && f.severity === 'high')) {
      recommendations.push('Schedule comprehensive mechanical inspection immediately');
    }
    if (factors.some(f => f.type === 'accidents' && f.severity === 'high')) {
      recommendations.push('Review vehicle safety systems and driver assignment');
    }
    if (factors.some(f => f.type === 'maintenance' && f.severity === 'high')) {
      recommendations.push('Prioritize overdue maintenance - risk of breakdown');
    }
    if (factors.some(f => f.type === 'inspection' && f.severity === 'high')) {
      recommendations.push('Complete overdue inspection before next route assignment');
    }
    if (recommendations.length === 0 && riskLevel === 'medium') {
      recommendations.push('Monitor vehicle closely - schedule preventative check');
    }
    if (recommendations.length === 0) {
      recommendations.push('Vehicle performing well - continue regular maintenance schedule');
    }
    
    return {
      vehicleId: v.id,
      registrationNum: v.registration_num,
      riskLevel,
      riskScore,
      factors,
      recommendations,
      lastUpdated: new Date().toISOString()
    };
  };

  if (vehicleId) {
    return vehicles.length > 0 ? analyzeRisk(vehicles[0]) : null;
  }
  
  return vehicles.map(analyzeRisk);
};

/**
 * Generate risk alerts for the fleet
 */
export const generateRiskAlerts = async (): Promise<RiskAlert[]> => {
  const alerts: RiskAlert[] = [];
  
  // 1. Vehicles with repeated defects
  const repeatedDefects = await query(`
    SELECT 
      v.id,
      v.registration_num,
      COUNT(jc.id) as defect_count,
      STRING_AGG(DISTINCT jc.defect_description, '; ') as defect_types
    FROM vehicles v
    JOIN job_cards jc ON jc.vehicle_id = v.id
    WHERE jc.created_at > CURRENT_DATE - INTERVAL '30 days'
    AND v.deleted_at IS NULL
    GROUP BY v.id, v.registration_num
    HAVING COUNT(jc.id) >= 3
  `);
  
  for (const v of repeatedDefects) {
    alerts.push({
      id: `defect-${v.id}`,
      type: 'vehicle',
      severity: 'high',
      title: 'Repeated Defects Detected',
      description: `Vehicle ${v.registration_num} has reported ${v.defect_count} defects this month. A full mechanical inspection is recommended.`,
      entityId: v.id,
      entityName: v.registration_num,
      createdAt: new Date().toISOString(),
      acknowledged: false
    });
  }
  
  // 2. Drivers with frequent incidents
  const riskyDrivers = await query(`
    SELECT 
      s.id,
      s.staff_name,
      COUNT(a.id) as incident_count,
      COUNT(DISTINCT a.vehicle_id) as vehicles_involved
    FROM staff s
    JOIN accidents a ON a.driver_id = s.id
    WHERE a.accident_date > CURRENT_DATE - INTERVAL '30 days'
    AND s.deleted_at IS NULL
    GROUP BY s.id, s.staff_name
    HAVING COUNT(a.id) >= 2
  `);
  
  for (const d of riskyDrivers) {
    alerts.push({
      id: `driver-${d.id}`,
      type: 'driver',
      severity: 'high',
      title: 'Driver Safety Alert',
      description: `Driver ${d.staff_name} has been involved in ${d.incident_count} incident(s) in the past 30 days. Consider reviewing driver safety training.`,
      entityId: d.id,
      entityName: d.staff_name,
      createdAt: new Date().toISOString(),
      acknowledged: false
    });
  }
  
  // 3. Overdue audits (no audit in last 90 days)
  const overdueAudits = await query(`
    SELECT 
      v.id,
      v.registration_num,
      MAX(audit.audit_date) as last_audit_date
    FROM vehicles v
    LEFT JOIN audit_sessions audit ON audit.vehicle_ids @> jsonb_build_array(v.id) AND audit.status = 'Completed'
    WHERE v.deleted_at IS NULL
    AND v.status = 'Active'
    GROUP BY v.id, v.registration_num
    HAVING MAX(audit.audit_date) IS NULL OR MAX(audit.audit_date) < CURRENT_DATE - INTERVAL '90 days'
  `);
  
  for (const v of overdueAudits) {
    const daysOverdue = v.last_audit_date 
      ? Math.ceil((Date.now() - new Date(v.last_audit_date).getTime()) / (1000 * 60 * 60 * 24)) - 90
      : 999;
    alerts.push({
      id: `audit-${v.id}`,
      type: 'inspection',
      severity: daysOverdue > 30 ? 'critical' : 'high',
      title: 'Overdue Audit',
      description: v.last_audit_date 
        ? `Vehicle ${v.registration_num} has not had a completed audit in over 90 days (${daysOverdue} days overdue).`
        : `Vehicle ${v.registration_num} has no audit record. Schedule initial audit.`,
      entityId: v.id,
      entityName: v.registration_num,
      createdAt: new Date().toISOString(),
      acknowledged: false
    });
  }
  
  // 4. Maintenance due soon
  const maintenanceDue = await query(`
    SELECT 
      v.id,
      v.registration_num,
      v.next_service_due,
      v.current_mileage
    FROM vehicles v
    WHERE v.next_service_due <= CURRENT_DATE + INTERVAL '7 days'
    AND v.status = 'Active'
    AND v.deleted_at IS NULL
  `);
  
  for (const v of maintenanceDue) {
    const daysUntil = Math.ceil((new Date(v.next_service_due).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    alerts.push({
      id: `maintenance-${v.id}`,
      type: 'maintenance',
      severity: daysUntil < 0 ? 'critical' : 'medium',
      title: daysUntil < 0 ? 'Overdue Maintenance' : 'Maintenance Due Soon',
      description: daysUntil < 0 
        ? `Vehicle ${v.registration_num} service is overdue by ${Math.abs(daysUntil)} days.`
        : `Vehicle ${v.registration_num} has scheduled maintenance in ${daysUntil} days.`,
      entityId: v.id,
      entityName: v.registration_num,
      createdAt: new Date().toISOString(),
      acknowledged: false
    });
  }
  
  // 5. Vehicles with abnormal usage (high repair rate)
  const highRepairRate = await query(`
    SELECT 
      v.id,
      v.registration_num,
      COUNT(r.id) as repair_count
    FROM vehicles v
    JOIN repairs r ON r.vehicle_id = v.id
    WHERE r.date_in > CURRENT_DATE - INTERVAL '90 days'
    AND v.deleted_at IS NULL
    GROUP BY v.id, v.registration_num
    HAVING COUNT(r.id) >= 4
  `);
  
  for (const v of highRepairRate) {
    alerts.push({
      id: `usage-${v.id}`,
      type: 'vehicle',
      severity: 'medium',
      title: 'High Maintenance Frequency',
      description: `Vehicle ${v.registration_num} shows increasing defect frequency (${v.repair_count} repairs in 90 days). Scheduling preventative maintenance may reduce future downtime.`,
      entityId: v.id,
      entityName: v.registration_num,
      createdAt: new Date().toISOString(),
      acknowledged: false
    });
  }
  
  return alerts.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
};

/**
 * Get fleet intelligence summary for dashboard
 */
export const getFleetIntelligenceSummary = async (): Promise<FleetIntelligenceSummary> => {
  const riskProfiles = await calculateVehicleRisk() as VehicleRiskProfile[];
  const alerts = await generateRiskAlerts();
  
  const vehiclesByRiskLevel = {
    low: riskProfiles.filter(v => v.riskLevel === 'low').length,
    medium: riskProfiles.filter(v => v.riskLevel === 'medium').length,
    high: riskProfiles.filter(v => v.riskLevel === 'high').length,
    critical: riskProfiles.filter(v => v.riskLevel === 'critical').length
  };
  
  const overdueAudits = await query(`
    SELECT COUNT(DISTINCT v.id) as count
    FROM vehicles v
    LEFT JOIN audit_sessions audit ON audit.vehicle_ids @> jsonb_build_array(v.id) AND audit.status = 'Completed'
    WHERE v.deleted_at IS NULL
    AND v.status = 'Active'
    GROUP BY v.id
    HAVING MAX(audit.audit_date) IS NULL OR MAX(audit.audit_date) < CURRENT_DATE - INTERVAL '90 days'
  `);
  
  const maintenanceDueSoon = await query(`
    SELECT COUNT(*) as count
    FROM vehicles
    WHERE next_service_due <= CURRENT_DATE + INTERVAL '7 days'
    AND status = 'Active'
    AND deleted_at IS NULL
  `);
  
  const driverSafetyAlerts = await query(`
    SELECT COUNT(DISTINCT driver_id) as count
    FROM accidents
    WHERE accident_date > CURRENT_DATE - INTERVAL '30 days'
  `);
  
  return {
    totalVehiclesAtRisk: riskProfiles.filter(v => v.riskLevel !== 'low').length,
    criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
    highAlerts: alerts.filter(a => a.severity === 'high').length,
    mediumAlerts: alerts.filter(a => a.severity === 'medium').length,
    overdueInspections: parseInt(overdueAudits[0]?.count) || 0,
    maintenanceDueSoon: parseInt(maintenanceDueSoon[0]?.count) || 0,
    driverSafetyAlerts: parseInt(driverSafetyAlerts[0]?.count) || 0,
    vehiclesByRiskLevel
  };
};

/**
 * Get predictive maintenance suggestions
 */
export const getPredictiveMaintenanceSuggestions = async (): Promise<Array<{
  vehicleId: string;
  registrationNum: string;
  suggestion: string;
  priority: 'low' | 'medium' | 'high';
  predictedSavings?: string;
}>> => {
  const suggestions: Array<{
    vehicleId: string;
    registrationNum: string;
    suggestion: string;
    priority: 'low' | 'medium' | 'high';
    predictedSavings?: string;
  }> = [];
  
  // Analyze defect trends
  const defectTrends = await query(`
    SELECT 
      v.id,
      v.registration_num,
      COUNT(jc.id) as defect_count_30d,
      COUNT(CASE WHEN jc.created_at > CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as defect_count_7d
    FROM vehicles v
    LEFT JOIN job_cards jc ON jc.vehicle_id = v.id AND jc.created_at > CURRENT_DATE - INTERVAL '30 days'
    WHERE v.deleted_at IS NULL
    AND v.status = 'Active'
    GROUP BY v.id, v.registration_num
    HAVING COUNT(jc.id) >= 2
  `);
  
  for (const v of defectTrends) {
    const recentDefects = parseInt(v.defect_count_7d) || 0;
    const totalDefects = parseInt(v.defect_count_30d) || 0;
    
    if (recentDefects >= 2) {
      suggestions.push({
        vehicleId: v.id,
        registrationNum: v.registration_num,
        suggestion: `Increasing defect frequency detected (${totalDefects} in 30 days). Proactive maintenance recommended to prevent breakdown.`,
        priority: 'high',
        predictedSavings: 'Prevent ~$2,000 in emergency repair costs'
      });
    } else if (totalDefects >= 3) {
      suggestions.push({
        vehicleId: v.id,
        registrationNum: v.registration_num,
        suggestion: `Multiple defects reported. Consider comprehensive inspection during next service.`,
        priority: 'medium',
        predictedSavings: 'Reduce future downtime by 40%'
      });
    }
  }
  
  // Analyze accident patterns
  const accidentPatterns = await query(`
    SELECT 
      v.id,
      v.registration_num,
      COUNT(a.id) as accident_count_90d,
      STRING_AGG(DISTINCT a.accident_cause, ', ') as causes
    FROM vehicles v
    JOIN accidents a ON a.vehicle_id = v.id
    WHERE a.accident_date > CURRENT_DATE - INTERVAL '90 days'
    AND v.deleted_at IS NULL
    GROUP BY v.id, v.registration_num
    HAVING COUNT(a.id) >= 2
  `);
  
  for (const v of accidentPatterns) {
    suggestions.push({
      vehicleId: v.id,
      registrationNum: v.registration_num,
      suggestion: `Vehicle involved in ${v.accident_count_90d} incidents. Recommend safety system check and possible driver reassignment review.`,
      priority: 'high'
    });
  }
  
  return suggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
};

/**
 * Generate training quiz questions based on course content
 */
export const generateTrainingQuestions = async (content: string, numQuestions: number = 5): Promise<Array<{
  question: string;
  options: string[];
  correctAnswer: string;
}>> => {
  // If no OpenAI API key, return rule-based questions
  if (!AI_ENABLED) {
    return getRuleBasedQuestions(content, numQuestions);
  }

  try {
    const prompt = `Based on the following training course content, generate ${numQuestions} multiple-choice quiz questions.

Course Content:
${content.substring(0, 3000)}

Generate questions that:
1. Test understanding of key concepts
2. Are based specifically on the content provided
3. Have 4 options each (A, B, C, D)
4. Have only one correct answer

Return ONLY a JSON array in this exact format:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "A"
  }
]`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are a training quiz generator. Generate questions based ONLY on the provided content. Return valid JSON.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1500,
      temperature: 0.7
    });

    const responseContent = response.choices[0].message.content || '[]';
    // Extract JSON from possible markdown code blocks
    const jsonMatch = responseContent.match(/```json\n?([\s\S]*?)\n?```/) || responseContent.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : responseContent;
    
    const questions = JSON.parse(jsonStr);
    
    // Validate question format
    return questions.filter((q: any) => 
      q.question && 
      Array.isArray(q.options) && 
      q.options.length === 4 && 
      ['A', 'B', 'C', 'D'].includes(q.correctAnswer)
    ).slice(0, numQuestions);
  } catch (error) {
    console.error('AI question generation error:', error);
    return getRuleBasedQuestions(content, numQuestions);
  }
};

/**
 * Fallback rule-based questions when AI is unavailable
 */
const getRuleBasedQuestions = (content: string, numQuestions: number): Array<{
  question: string;
  options: string[];
  correctAnswer: string;
}> => {
  const questions: Array<{
    question: string;
    options: string[];
    correctAnswer: string;
  }> = [];

  // Extract key topics from content
  const has3SecondRule = content.toLowerCase().includes('3-second');
  const hasScanning = content.toLowerCase().includes('scan') || content.toLowerCase().includes('mirror');
  const hasDistraction = content.toLowerCase().includes('distraction') || content.toLowerCase().includes('phone');
  const hasHOS = content.toLowerCase().includes('hours of service') || content.toLowerCase().includes('hos');
  const hasDVIR = content.toLowerCase().includes('dvir') || content.toLowerCase().includes('inspection');
  const hasFatigue = content.toLowerCase().includes('fatigue') || content.toLowerCase().includes('tired');
  const hasAccident = content.toLowerCase().includes('accident');
  const hasDrug = content.toLowerCase().includes('drug') || content.toLowerCase().includes('alcohol');

  if (has3SecondRule) {
    questions.push({
      question: "What is the minimum following distance recommended under normal driving conditions?",
      options: ["1 second", "2 seconds", "3 seconds", "5 seconds"],
      correctAnswer: "C"
    });
    questions.push({
      question: "In wet conditions, how should you adjust your following distance?",
      options: ["Keep 3 seconds", "Increase to 4-5 seconds", "Decrease to 2 seconds", "Follow closer to see better"],
      correctAnswer: "B"
    });
  }

  if (hasScanning) {
    questions.push({
      question: "How often should you check your mirrors while driving?",
      options: ["Every 30 seconds", "Every 5-8 seconds", "Only when changing lanes", "Once per minute"],
      correctAnswer: "B"
    });
    questions.push({
      question: "How far ahead should you look when driving in the city?",
      options: ["1-1.5 blocks", "500 meters", "Just the car ahead", "As far as possible"],
      correctAnswer: "A"
    });
  }

  if (hasDistraction) {
    questions.push({
      question: "At 60 km/h, how far do you travel during a 2-second glance at your phone?",
      options: ["10 meters", "17 meters", "33 meters", "50 meters"],
      correctAnswer: "C"
    });
    questions.push({
      question: "Which of the following is NOT a recommended way to manage distractions?",
      options: ["Use hands-free devices", "Program GPS before driving", "Eat while driving when careful", "Pull over for complex tasks"],
      correctAnswer: "C"
    });
  }

  if (hasHOS) {
    questions.push({
      question: "What is the maximum daily driving time allowed?",
      options: ["8 hours", "10 hours", "11 hours", "14 hours"],
      correctAnswer: "C"
    });
    questions.push({
      question: "How many consecutive hours off-duty are required before driving?",
      options: ["8 hours", "10 hours", "11 hours", "12 hours"],
      correctAnswer: "B"
    });
  }

  if (hasDVIR) {
    questions.push({
      question: "When should you complete a DVIR (Daily Vehicle Inspection Report)?",
      options: ["Only when defects are found", "At the beginning of each workday", "At the beginning and end of each workday", "Once per week"],
      correctAnswer: "C"
    });
    questions.push({
      question: "What should you do if you find a critical defect during inspection?",
      options: ["Drive carefully to the garage", "Note it for next inspection", "Do not operate the vehicle", "Fix it yourself"],
      correctAnswer: "C"
    });
  }

  if (hasFatigue) {
    questions.push({
      question: "Which is a warning sign of driver fatigue?",
      options: ["Increased alertness", "Frequent yawning", "Better fuel efficiency", "Improved reaction time"],
      correctAnswer: "B"
    });
    questions.push({
      question: "What should you do if you experience fatigue while driving?",
      options: ["Open the window for fresh air", "Stop and rest immediately", "Drink coffee and continue", "Turn up the radio"],
      correctAnswer: "B"
    });
  }

  if (hasAccident) {
    questions.push({
      question: "What is the first priority after an accident?",
      options: ["Call your insurance company", "Check for injuries and call emergency services", "Take photos of the damage", "Exchange insurance information"],
      correctAnswer: "B"
    });
    questions.push({
      question: "Within how long must you notify your supervisor after an accident?",
      options: ["30 minutes", "1 hour", "2 hours", "End of shift"],
      correctAnswer: "B"
    });
  }

  if (hasDrug) {
    questions.push({
      question: "How many hours before duty should you refrain from alcohol?",
      options: ["4 hours", "8 hours", "12 hours", "24 hours"],
      correctAnswer: "B"
    });
    questions.push({
      question: "What should you do if you suspect a coworker is impaired?",
      options: ["Confront them directly", "Report to supervisor", "Ignore it if they're driving carefully", "Ask them to take a break"],
      correctAnswer: "B"
    });
  }

  // Shuffle and return requested number
  return questions.sort(() => Math.random() - 0.5).slice(0, numQuestions);
};
