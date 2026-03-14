// SMS Service using Twilio
import twilio from 'twilio';

// Your phone number
const OWNER_PHONE = '+254740125664'; // Format for Kenya

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const fromNumber = process.env.TWILIO_PHONE_NUMBER;

// Helper to format phone number
const formatPhone = (phone: string): string => {
  // If starts with 0, replace with +254
  if (phone.startsWith('0')) {
    return '+254' + phone.substring(1);
  }
  // If doesn't have +, add it
  if (!phone.startsWith('+')) {
    return '+' + phone;
  }
  return phone;
};

// Send SMS for new requisition
export const sendSMS = async (message: string) => {
  // If Twilio is not configured, just log to console
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log('📱 SMS (not configured - would send to', OWNER_PHONE, '):');
    console.log(message);
    return { success: true, sid: 'console-log' };
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: formatPhone(OWNER_PHONE)
    });
    console.log('SMS sent:', result.sid);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('SMS failed:', error);
    // Don't block the flow if SMS fails
    console.log('📱 SMS (failed - logged):', message);
    return { success: true, sid: 'failed-logged' };
  }
};

// Send requisition request SMS
export const sendRequisitionSMS = async (staffName: string, from: string, to: string) => {
  const message = `🚗 NEW REQUEST: ${staffName} wants a vehicle from ${from} to ${to}. Check email for details.`;
  return sendSMS(message);
};

// Send approval SMS
export const sendApprovalSMS = async (status: 'approved' | 'rejected') => {
  const message = `✅ REQUISITION ${status.toUpperCase()}: Your vehicle request has been ${status}. Check email for details.`;
  return sendSMS(message);
};

// Send vehicle allocated SMS
export const sendVehicleAllocatedSMS = async (vehicleReg: string, driverName: string) => {
  const message = `🚗 VEHICLE READY: ${vehicleReg} assigned with driver ${driverName}. Check email for details.`;
  return sendSMS(message);
};

// Send inspection SMS
export const sendInspectionSMS = async (vehicleReg: string, passed: boolean) => {
  const status = passed ? 'PASSED ✅' : 'FAILED ❌';
  const message = `🔍 INSPECTION ${status}: Vehicle ${vehicleReg} inspection complete. Check email for details.`;
  return sendSMS(message);
};

// Send trip completed SMS
export const sendTripCompletedSMS = async (vehicleReg: string, distance: number) => {
  const message = `✅ TRIP DONE: ${vehicleReg} completed ${distance}km. Please rate the driver.`;
  return sendSMS(message);
};

export default {
  sendSMS,
  sendRequisitionSMS,
  sendApprovalSMS,
  sendVehicleAllocatedSMS,
  sendInspectionSMS,
  sendTripCompletedSMS
};
