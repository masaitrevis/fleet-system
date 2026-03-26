-- Migration: Add integration providers and settings tables
-- Created: 2026-03-18

-- ==========================================
-- INTEGRATION PROVIDERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS integration_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('erp', 'telematics', 'fuel_card', 'payment', 'analytics', 'custom')),
    provider VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('connected', 'disconnected', 'error', 'pending')),
    description TEXT,
    config JSONB DEFAULT '{}',
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    next_sync_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_integration_providers_status ON integration_providers(status);
CREATE INDEX idx_integration_providers_type ON integration_providers(type);
CREATE INDEX idx_integration_providers_active ON integration_providers(is_active) WHERE deleted_at IS NULL;

-- ==========================================
-- COMPANY SETTINGS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS company_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    legal_name VARCHAR(255),
    tax_id VARCHAR(100),
    registration_number VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(255),
    address JSONB DEFAULT '{}',
    logo_url TEXT,
    timezone VARCHAR(100) DEFAULT 'UTC',
    currency VARCHAR(10) DEFAULT 'USD',
    date_format VARCHAR(50) DEFAULT 'MM/DD/YYYY',
    fiscal_year_start VARCHAR(10) DEFAULT '01-01',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- FLEET SETTINGS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS fleet_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    default_fuel_type VARCHAR(50) DEFAULT 'Diesel',
    fuel_unit VARCHAR(20) DEFAULT 'liters' CHECK (fuel_unit IN ('liters', 'gallons')),
    distance_unit VARCHAR(20) DEFAULT 'km' CHECK (distance_unit IN ('km', 'miles')),
    currency VARCHAR(10) DEFAULT 'USD',
    maintenance_reminder_days INTEGER DEFAULT 7,
    insurance_reminder_days INTEGER DEFAULT 30,
    license_reminder_days INTEGER DEFAULT 14,
    speed_limit INTEGER DEFAULT 80,
    idle_time_threshold INTEGER DEFAULT 10,
    geofence_alert_enabled BOOLEAN DEFAULT true,
    fuel_efficiency_target DECIMAL(5,2) DEFAULT 8.0,
    co2_emission_factor DECIMAL(5,2) DEFAULT 2.68,
    default_vehicle_status VARCHAR(50) DEFAULT 'Active',
    auto_archive_after_days INTEGER DEFAULT 365,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- NOTIFICATION SETTINGS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_settings JSONB DEFAULT '{"enabled": true, "dailyDigest": false, "weeklyReport": true, "maintenanceAlerts": true, "accidentAlerts": true, "fuelAlerts": true, "requisitionUpdates": true}',
    push_settings JSONB DEFAULT '{"enabled": true, "maintenanceAlerts": true, "accidentAlerts": true, "geofenceAlerts": true, "routeUpdates": false}',
    sms_settings JSONB DEFAULT '{"enabled": false, "criticalAlerts": true, "driverAlerts": false, "emergencyContacts": true}',
    slack_settings JSONB DEFAULT '{"enabled": false, "webhookUrl": "", "channel": "#fleet-alerts"}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE INDEX idx_notification_settings_user ON notification_settings(user_id);

-- ==========================================
-- USER PREFERENCES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
    language VARCHAR(10) DEFAULT 'en',
    date_format VARCHAR(50) DEFAULT 'MM/DD/YYYY',
    time_format VARCHAR(10) DEFAULT '24h' CHECK (time_format IN ('12h', '24h')),
    timezone VARCHAR(100) DEFAULT 'UTC',
    sidebar_collapsed BOOLEAN DEFAULT false,
    default_dashboard VARCHAR(50) DEFAULT 'dashboard',
    email_notifications BOOLEAN DEFAULT true,
    desktop_notifications BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE INDEX idx_user_preferences_user ON user_preferences(user_id);

-- ==========================================
-- SECURITY SETTINGS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS security_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_method VARCHAR(20) DEFAULT 'app' CHECK (two_factor_method IN ('app', 'sms', 'email')),
    password_expiry_days INTEGER DEFAULT 90,
    min_password_length INTEGER DEFAULT 8,
    require_special_chars BOOLEAN DEFAULT true,
    require_numbers BOOLEAN DEFAULT true,
    require_uppercase BOOLEAN DEFAULT true,
    max_login_attempts INTEGER DEFAULT 5,
    lockout_duration_minutes INTEGER DEFAULT 30,
    session_timeout_minutes INTEGER DEFAULT 60,
    ip_whitelist JSONB DEFAULT '[]',
    api_key_rotation_days INTEGER DEFAULT 90,
    audit_log_enabled BOOLEAN DEFAULT true,
    sso_enabled BOOLEAN DEFAULT false,
    sso_provider VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- AUDIT LOG TABLE (for security events)
-- ==========================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- ==========================================
-- USER SESSIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device VARCHAR(255),
    browser VARCHAR(255),
    ip_address INET,
    is_active BOOLEAN DEFAULT true,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active) WHERE is_active = true;

-- ==========================================
-- TRIGGERS FOR UPDATED_AT
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON company_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fleet_settings_updated_at BEFORE UPDATE ON fleet_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_security_settings_updated_at BEFORE UPDATE ON security_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integration_providers_updated_at BEFORE UPDATE ON integration_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
