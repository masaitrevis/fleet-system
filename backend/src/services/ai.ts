import OpenAI from 'openai';
import { query } from '../database';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const AI_ENABLED = !!process.env.OPENAI_API_KEY;

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

// ==================== EXPORT ====================

export default {
  generateFleetRecommendations,
  generateSlideNotes,
  processAnalyticsQuery,
  generateCorrectiveActions,
  AI_ENABLED
};
