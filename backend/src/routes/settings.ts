import { Router, Request, Response } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler, Errors } from '../middleware/errorHandler';
import { query } from '../database';

const router = Router();

// ==========================================
// COMPANY SETTINGS
// ==========================================

router.get('/company',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await query(`
      SELECT * FROM company_settings
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (!result || result.length === 0) {
      // Return default settings
      return res.json({
        name: '',
        legalName: '',
        taxId: '',
        registrationNumber: '',
        email: '',
        phone: '',
        website: '',
        address: { street: '', city: '', state: '', zipCode: '', country: '' },
        timezone: 'UTC',
        currency: 'USD',
        dateFormat: 'MM/DD/YYYY',
        fiscalYearStart: '01-01',
      });
    }
    
    res.json(result[0]);
  })
);

router.put('/company',
  authenticateToken,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      name, legalName, taxId, registrationNumber,
      email, phone, website, address,
      timezone, currency, dateFormat, fiscalYearStart, logoUrl
    } = req.body;

    // Check if settings exist
    const existing = await query('SELECT id FROM company_settings LIMIT 1');
    
    if (existing && existing.length > 0) {
      // Update existing
      const result = await query(`
        UPDATE company_settings
        SET name = $1, legal_name = $2, tax_id = $3, registration_number = $4,
            email = $5, phone = $6, website = $7, address = $8,
            timezone = $9, currency = $10, date_format = $11, fiscal_year_start = $12,
            logo_url = $13, updated_at = CURRENT_TIMESTAMP
        WHERE id = $14
        RETURNING *
      `, [
        name, legalName, taxId, registrationNumber,
        email, phone, website, JSON.stringify(address),
        timezone, currency, dateFormat, fiscalYearStart,
        logoUrl, existing[0].id
      ]);
      res.json(result[0]);
    } else {
      // Create new
      const result = await query(`
        INSERT INTO company_settings (
          id, name, legal_name, tax_id, registration_number,
          email, phone, website, address, timezone, currency, 
          date_format, fiscal_year_start, logo_url, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING *
      `, [
        name, legalName, taxId, registrationNumber,
        email, phone, website, JSON.stringify(address),
        timezone, currency, dateFormat, fiscalYearStart, logoUrl
      ]);
      res.json(result[0]);
    }
  })
);

// ==========================================
// FLEET SETTINGS
// ==========================================

router.get('/fleet',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await query(`
      SELECT * FROM fleet_settings
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (!result || result.length === 0) {
      return res.json({
        defaultFuelType: 'Diesel',
        fuelUnit: 'liters',
        distanceUnit: 'km',
        currency: 'USD',
        maintenanceReminderDays: 7,
        insuranceReminderDays: 30,
        licenseReminderDays: 14,
        speedLimit: 80,
        idleTimeThreshold: 10,
        geofenceAlertEnabled: true,
        fuelEfficiencyTarget: 8,
        co2EmissionFactor: 2.68,
        defaultVehicleStatus: 'Active',
        autoArchiveAfterDays: 365,
      });
    }
    
    res.json(result[0]);
  })
);

router.put('/fleet',
  authenticateToken,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      defaultFuelType, fuelUnit, distanceUnit, currency,
      maintenanceReminderDays, insuranceReminderDays, licenseReminderDays,
      speedLimit, idleTimeThreshold, geofenceAlertEnabled,
      fuelEfficiencyTarget, co2EmissionFactor, defaultVehicleStatus, autoArchiveAfterDays
    } = req.body;

    const existing = await query('SELECT id FROM fleet_settings LIMIT 1');
    
    if (existing && existing.length > 0) {
      const result = await query(`
        UPDATE fleet_settings
        SET default_fuel_type = $1, fuel_unit = $2, distance_unit = $3, currency = $4,
            maintenance_reminder_days = $5, insurance_reminder_days = $6, license_reminder_days = $7,
            speed_limit = $8, idle_time_threshold = $9, geofence_alert_enabled = $10,
            fuel_efficiency_target = $11, co2_emission_factor = $12, default_vehicle_status = $13,
            auto_archive_after_days = $14, updated_at = CURRENT_TIMESTAMP
        WHERE id = $15
        RETURNING *
      `, [
        defaultFuelType, fuelUnit, distanceUnit, currency,
        maintenanceReminderDays, insuranceReminderDays, licenseReminderDays,
        speedLimit, idleTimeThreshold, geofenceAlertEnabled,
        fuelEfficiencyTarget, co2EmissionFactor, defaultVehicleStatus, autoArchiveAfterDays,
        existing[0].id
      ]);
      res.json(result[0]);
    } else {
      const result = await query(`
        INSERT INTO fleet_settings (
          id, default_fuel_type, fuel_unit, distance_unit, currency,
          maintenance_reminder_days, insurance_reminder_days, license_reminder_days,
          speed_limit, idle_time_threshold, geofence_alert_enabled,
          fuel_efficiency_target, co2_emission_factor, default_vehicle_status,
          auto_archive_after_days, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING *
      `, [
        defaultFuelType, fuelUnit, distanceUnit, currency,
        maintenanceReminderDays, insuranceReminderDays, licenseReminderDays,
        speedLimit, idleTimeThreshold, geofenceAlertEnabled,
        fuelEfficiencyTarget, co2EmissionFactor, defaultVehicleStatus, autoArchiveAfterDays
      ]);
      res.json(result[0]);
    }
  })
);

// ==========================================
// NOTIFICATION SETTINGS
// ==========================================

router.get('/notifications',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await query(`
      SELECT * FROM notification_settings
      WHERE user_id = $1
      LIMIT 1
    `, [req.user?.userId]);
    
    if (!result || result.length === 0) {
      return res.json({
        email: { enabled: true, dailyDigest: false, weeklyReport: true, maintenanceAlerts: true, accidentAlerts: true, fuelAlerts: true, requisitionUpdates: true },
        push: { enabled: true, maintenanceAlerts: true, accidentAlerts: true, geofenceAlerts: true, routeUpdates: false },
        sms: { enabled: false, criticalAlerts: true, driverAlerts: false, emergencyContacts: true },
        slack: { enabled: false, webhookUrl: '', channel: '#fleet-alerts' },
      });
    }
    
    res.json({
      email: result[0].email_settings,
      push: result[0].push_settings,
      sms: result[0].sms_settings,
      slack: result[0].slack_settings,
    });
  })
);

router.put('/notifications',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { email, push, sms, slack } = req.body;
    
    const existing = await query(
      'SELECT id FROM notification_settings WHERE user_id = $1',
      [req.user?.userId]
    );
    
    if (existing && existing.length > 0) {
      const result = await query(`
        UPDATE notification_settings
        SET email_settings = $1, push_settings = $2, sms_settings = $3, slack_settings = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $5
        RETURNING *
      `, [
        JSON.stringify(email), JSON.stringify(push), JSON.stringify(sms), JSON.stringify(slack),
        req.user?.userId
      ]);
      res.json(result[0]);
    } else {
      const result = await query(`
        INSERT INTO notification_settings (
          id, user_id, email_settings, push_settings, sms_settings, slack_settings,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING *
      `, [
        req.user?.userId, JSON.stringify(email), JSON.stringify(push), 
        JSON.stringify(sms), JSON.stringify(slack)
      ]);
      res.json(result[0]);
    }
  })
);

// Test notification
router.post('/notifications/test',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { type } = req.body;
    
    // In production, this would send actual test notifications
    // For now, just log and return success
    console.log(`Test ${type} notification requested by user ${req.user?.userId}`);
    
    res.json({ success: true, message: `Test ${type} notification sent` });
  })
);

// ==========================================
// USER PREFERENCES
// ==========================================

router.get('/user-preferences',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await query(`
      SELECT * FROM user_preferences
      WHERE user_id = $1
      LIMIT 1
    `, [req.user?.userId]);
    
    if (!result || result.length === 0) {
      return res.json({
        theme: 'light',
        language: 'en',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '24h',
        timezone: 'UTC',
        sidebarCollapsed: false,
        defaultDashboard: 'dashboard',
        emailNotifications: true,
        desktopNotifications: false,
      });
    }
    
    res.json(result[0]);
  })
);

router.put('/user-preferences',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      theme, language, dateFormat, timeFormat, timezone,
      sidebarCollapsed, defaultDashboard, emailNotifications, desktopNotifications
    } = req.body;
    
    const existing = await query(
      'SELECT id FROM user_preferences WHERE user_id = $1',
      [req.user?.userId]
    );
    
    if (existing && existing.length > 0) {
      const result = await query(`
        UPDATE user_preferences
        SET theme = $1, language = $2, date_format = $3, time_format = $4,
            timezone = $5, sidebar_collapsed = $6, default_dashboard = $7,
            email_notifications = $8, desktop_notifications = $9,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $10
        RETURNING *
      `, [
        theme, language, dateFormat, timeFormat, timezone,
        sidebarCollapsed, defaultDashboard, emailNotifications, desktopNotifications,
        req.user?.userId
      ]);
      res.json(result[0]);
    } else {
      const result = await query(`
        INSERT INTO user_preferences (
          id, user_id, theme, language, date_format, time_format, timezone,
          sidebar_collapsed, default_dashboard, email_notifications, desktop_notifications,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING *
      `, [
        req.user?.userId, theme, language, dateFormat, timeFormat, timezone,
        sidebarCollapsed, defaultDashboard, emailNotifications, desktopNotifications
      ]);
      res.json(result[0]);
    }
  })
);

// ==========================================
// SECURITY SETTINGS
// ==========================================

router.get('/security',
  authenticateToken,
  requireRole(['admin']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await query(`
      SELECT * FROM security_settings
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (!result || result.length === 0) {
      return res.json({
        twoFactorEnabled: false,
        twoFactorMethod: 'app',
        passwordExpiryDays: 90,
        minPasswordLength: 8,
        requireSpecialChars: true,
        requireNumbers: true,
        requireUppercase: true,
        maxLoginAttempts: 5,
        lockoutDurationMinutes: 30,
        sessionTimeoutMinutes: 60,
        ipWhitelist: [],
        apiKeyRotationDays: 90,
        auditLogEnabled: true,
        ssoEnabled: false,
        ssoProvider: '',
      });
    }
    
    res.json(result[0]);
  })
);

router.put('/security',
  authenticateToken,
  requireRole(['admin']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      twoFactorEnabled, twoFactorMethod, passwordExpiryDays, minPasswordLength,
      requireSpecialChars, requireNumbers, requireUppercase, maxLoginAttempts,
      lockoutDurationMinutes, sessionTimeoutMinutes, ipWhitelist,
      apiKeyRotationDays, auditLogEnabled, ssoEnabled, ssoProvider
    } = req.body;

    const existing = await query('SELECT id FROM security_settings LIMIT 1');
    
    if (existing && existing.length > 0) {
      const result = await query(`
        UPDATE security_settings
        SET two_factor_enabled = $1, two_factor_method = $2, password_expiry_days = $3,
            min_password_length = $4, require_special_chars = $5, require_numbers = $6,
            require_uppercase = $7, max_login_attempts = $8, lockout_duration_minutes = $9,
            session_timeout_minutes = $10, ip_whitelist = $11, api_key_rotation_days = $12,
            audit_log_enabled = $13, sso_enabled = $14, sso_provider = $15,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $16
        RETURNING *
      `, [
        twoFactorEnabled, twoFactorMethod, passwordExpiryDays, minPasswordLength,
        requireSpecialChars, requireNumbers, requireUppercase, maxLoginAttempts,
        lockoutDurationMinutes, sessionTimeoutMinutes, JSON.stringify(ipWhitelist),
        apiKeyRotationDays, auditLogEnabled, ssoEnabled, ssoProvider,
        existing[0].id
      ]);
      res.json(result[0]);
    } else {
      const result = await query(`
        INSERT INTO security_settings (
          id, two_factor_enabled, two_factor_method, password_expiry_days, min_password_length,
          require_special_chars, require_numbers, require_uppercase, max_login_attempts,
          lockout_duration_minutes, session_timeout_minutes, ip_whitelist, api_key_rotation_days,
          audit_log_enabled, sso_enabled, sso_provider, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING *
      `, [
        twoFactorEnabled, twoFactorMethod, passwordExpiryDays, minPasswordLength,
        requireSpecialChars, requireNumbers, requireUppercase, maxLoginAttempts,
        lockoutDurationMinutes, sessionTimeoutMinutes, JSON.stringify(ipWhitelist),
        apiKeyRotationDays, auditLogEnabled, ssoEnabled, ssoProvider
      ]);
      res.json(result[0]);
    }
  })
);

export default router;
