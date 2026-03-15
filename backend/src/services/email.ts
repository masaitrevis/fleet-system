import nodemailer from 'nodemailer';

// Your email address
const OWNER_EMAIL = 'masatrevis@gmail.com';

// Create transporter - uses environment variables or defaults to Ethereal for testing
const createTransporter = () => {
  // If SendGrid or other service is configured, use it
  if (process.env.SENDGRID_API_KEY) {
    return nodemailer.createTransport({
      service: 'SendGrid',
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
      },
      connectionTimeout: 5000, // 5 seconds
      socketTimeout: 5000
    });
  }
  
  // If Gmail credentials are provided
  if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
      },
      connectionTimeout: 5000,
      socketTimeout: 5000
    });
  }
  
  // Default: No email - just log to console (non-blocking)
  console.log('Email: No SMTP configured, logging to console only');
  return null;
};

const transporter = createTransporter();

// Send requisition request notification
export const sendRequisitionRequest = async (staffName: string, details: any) => {
  // If no transporter configured, just log and return
  if (!transporter) {
    console.log('📧 Email (logged): New requisition from', staffName, 'to', details.destination);
    return { success: true, messageId: 'logged-to-console' };
  }

  const mailOptions = {
    from: '"Fleet System" <fleet@system.com>',
    to: OWNER_EMAIL,
    subject: `🚗 New Vehicle Requisition from ${staffName}`,
    html: `
      <h2>New Vehicle Requisition Request</h2>
      <p><strong>Requester:</strong> ${staffName}</p>
      <p><strong>From:</strong> ${details.place_of_departure}</p>
      <p><strong>To:</strong> ${details.destination}</p>
      <p><strong>Purpose:</strong> ${details.purpose}</p>
      <p><strong>Date:</strong> ${details.travel_date} at ${details.travel_time}</p>
      <p><strong>Passengers:</strong> ${details.num_passengers}</p>
      <hr>
      <p>Please log in to approve or reject this request.</p>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email failed:', error);
    return { success: false, error: String(error) };
  }
};

// Send approval notification
export const sendApprovalNotification = async (staffName: string, status: 'approved' | 'rejected', reason?: string) => {
  if (!transporter) {
    console.log(`📧 Email (logged): Requisition ${status} for ${staffName}`);
    return { success: true };
  }

  const mailOptions = {
    from: '"Fleet System" <fleet@system.com>',
    to: OWNER_EMAIL,
    subject: `✅ Requisition ${status === 'approved' ? 'Approved' : 'Rejected'}`,
    html: `
      <h2>Requisition ${status === 'approved' ? 'Approved' : 'Rejected'}</h2>
      <p><strong>Requester:</strong> ${staffName}</p>
      <p><strong>Status:</strong> ${status.toUpperCase()}</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <hr>
      <p>Check the system for more details.</p>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true };
  } catch (error) {
    console.error('Email failed:', error);
    return { success: false };
  }
};

// Send vehicle allocated notification
export const sendVehicleAllocated = async (staffName: string, vehicleReg: string, driverName: string) => {
  if (!transporter) {
    console.log(`📧 Email (logged): Vehicle ${vehicleReg} allocated to ${staffName}, driver: ${driverName}`);
    return { success: true };
  }

  const mailOptions = {
    from: '"Fleet System" <fleet@system.com>',
    to: OWNER_EMAIL,
    subject: `🚗 Vehicle Allocated`,
    html: `
      <h2>Vehicle Allocated</h2>
      <p><strong>Requester:</strong> ${staffName}</p>
      <p><strong>Vehicle:</strong> ${vehicleReg}</p>
      <p><strong>Driver:</strong> ${driverName}</p>
      <hr>
      <p>The driver will conduct inspection before departure.</p>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true };
  } catch (error) {
    console.error('Email failed:', error);
    return { success: false };
  }
};

// Send inspection notification
export const sendInspectionNotification = async (vehicleReg: string, driverName: string, passed: boolean) => {
  if (!transporter) {
    console.log(`📧 Email (logged): Inspection ${passed ? 'PASSED' : 'FAILED'} for ${vehicleReg}`);
    return { success: true };
  }

  const mailOptions = {
    from: '"Fleet System" <fleet@system.com>',
    to: OWNER_EMAIL,
    subject: `🔍 Vehicle Inspection ${passed ? 'Passed' : 'Failed'}`,
    html: `
      <h2>Vehicle Inspection ${passed ? 'Passed' : 'Failed'}</h2>
      <p><strong>Vehicle:</strong> ${vehicleReg}</p>
      <p><strong>Driver:</strong> ${driverName}</p>
      <p><strong>Result:</strong> ${passed ? '✅ PASSED - Ready for departure' : '❌ FAILED - Defects found'}</p>
      <hr>
      <p>Check the system for inspection details.</p>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true };
  } catch (error) {
    console.error('Email failed:', error);
    return { success: false };
  }
};

// Send trip completed notification
export const sendTripCompleted = async (staffName: string, vehicleReg: string, distance: number) => {
  if (!transporter) {
    console.log(`📧 Email (logged): Trip completed by ${staffName}, ${distance}km`);
    return { success: true };
  }

  const mailOptions = {
    from: '"Fleet System" <fleet@system.com>',
    to: OWNER_EMAIL,
    subject: `✅ Trip Completed`,
    html: `
      <h2>Trip Completed</h2>
      <p><strong>Requester:</strong> ${staffName}</p>
      <p><strong>Vehicle:</strong> ${vehicleReg}</p>
      <p><strong>Distance:</strong> ${distance} km</p>
      <hr>
      <p>Please rate the driver.</p>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true };
  } catch (error) {
    console.error('Email failed:', error);
    return { success: false };
  }
};

// Send maintenance notification (when inspection fails)
export const sendMaintenanceNotification = async (vehicleReg: string, driverName: string, defects: string) => {
  if (!transporter) {
    console.log(`📧 Email (logged): MAINTENANCE NEEDED for ${vehicleReg}: ${defects}`);
    return { success: true };
  }

  const mailOptions = {
    from: '"Fleet System" <fleet@system.com>',
    to: OWNER_EMAIL,
    subject: `🚨 MAINTENANCE REQUIRED: ${vehicleReg}`,
    html: `
      <h2 style="color: #dc2626;">🚨 Maintenance Required</h2>
      <p><strong>Vehicle:</strong> ${vehicleReg}</p>
      <p><strong>Reported By:</strong> ${driverName}</p>
      <p><strong>Issue:</strong></p>
      <div style="background: #fee2e2; padding: 10px; border-radius: 5px; margin: 10px 0;">
        ${defects}
      </div>
      <hr>
      <p><strong>Action Required:</strong> Please arrange for vehicle inspection/repair before next use.</p>
      <p>Trip has been halted until vehicle is fixed and re-inspected.</p>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Maintenance email sent:', info.messageId);
    return { success: true };
  } catch (error) {
    console.error('Maintenance email failed:', error);
    return { success: false };
  }
};

export default {
  sendRequisitionRequest,
  sendApprovalNotification,
  sendVehicleAllocated,
  sendInspectionNotification,
  sendTripCompleted,
  sendMaintenanceNotification
};
