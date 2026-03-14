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
      }
    });
  }
  
  // If Gmail credentials are provided
  if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
      }
    });
  }
  
  // Default: use Ethereal for testing (fake emails that get logged)
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
      user: process.env.ETHEREAL_USER || 'test@ethereal.email',
      pass: process.env.ETHEREAL_PASS || 'testpass'
    }
  });
};

const transporter = createTransporter();

// Send requisition request notification
export const sendRequisitionRequest = async (staffName: string, details: any) => {
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
    // Still return success so the request isn't blocked
    return { success: true, messageId: 'logged-to-console' };
  }
};

// Send approval notification
export const sendApprovalNotification = async (staffName: string, status: 'approved' | 'rejected', reason?: string) => {
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
    return { success: true };
  }
};

// Send vehicle allocated notification
export const sendVehicleAllocated = async (staffName: string, vehicleReg: string, driverName: string) => {
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
    return { success: true };
  }
};

// Send inspection notification
export const sendInspectionNotification = async (vehicleReg: string, driverName: string, passed: boolean) => {
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
    return { success: true };
  }
};

// Send trip completed notification
export const sendTripCompleted = async (staffName: string, vehicleReg: string, distance: number) => {
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
    return { success: true };
  }
};

export default {
  sendRequisitionRequest,
  sendApprovalNotification,
  sendVehicleAllocated,
  sendInspectionNotification,
  sendTripCompleted
};
