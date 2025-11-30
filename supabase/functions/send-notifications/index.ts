import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotificationPayload {
  userId: string;
  type: "budget_alert" | "subscription_reminder" | "spending_anomaly" | "emi_reminder" | "salary_alert";
  title: string;
  message: string;
  data?: Record<string, any>;
}

interface EmailNotification {
  to: string;
  subject: string;
  body: string;
  htmlBody: string;
}

interface NotificationResult {
  success: boolean;
  message: string;
  channel?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const payload: NotificationPayload = await req.json();

    const results: NotificationResult[] = [];

    results.push(await sendPushNotification(payload));
    results.push(await sendEmailNotification(payload));

    return new Response(
      JSON.stringify({
        success: results.every((r) => r.success),
        notifications: results,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in send-notifications:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

async function sendPushNotification(payload: NotificationPayload): Promise<NotificationResult> {
  try {
    const message = {
      title: payload.title,
      body: payload.message,
      data: payload.data || {},
    };

    console.log(`Push notification queued for user ${payload.userId}:`, message);

    return {
      success: true,
      message: "Push notification would be sent via FCM",
      channel: "push",
    };
  } catch (error) {
    console.error("Push notification error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to send push notification",
      channel: "push",
    };
  }
}

async function sendEmailNotification(payload: NotificationPayload): Promise<NotificationResult> {
  try {
    const emailBody = buildEmailBody(payload);

    const emailPayload: EmailNotification = {
      to: `user-${payload.userId}@finance-tracker.local`,
      subject: payload.title,
      body: payload.message,
      htmlBody: emailBody,
    };

    console.log(`Email notification queued:`, emailPayload.subject);

    console.log(`Email would be sent to ${emailPayload.to}`);

    return {
      success: true,
      message: "Email notification would be sent",
      channel: "email",
    };
  } catch (error) {
    console.error("Email notification error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to send email notification",
      channel: "email",
    };
  }
}

function buildEmailBody(payload: NotificationPayload): string {
  const notificationStyles = `
    <style>
      body { font-family: Arial, sans-serif; color: #333; }
      .container { max-width: 600px; margin: 0 auto; }
      .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
      .content { padding: 20px; background: #f9fafb; }
      .alert { border-left: 4px solid; padding: 12px; margin: 10px 0; border-radius: 4px; }
      .alert.budget { border-color: #ef4444; background: #fef2f2; }
      .alert.subscription { border-color: #f59e0b; background: #fffbeb; }
      .alert.anomaly { border-color: #3b82f6; background: #eff6ff; }
      .footer { padding: 15px; background: #e5e7eb; text-align: center; font-size: 12px; color: #6b7280; }
      .cta-button { background: #10b981; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; display: inline-block; margin-top: 10px; }
    </style>
  `;

  const baseHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      ${notificationStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>${escapeHtml(payload.title)}</h2>
        </div>
        <div class="content">
          <p>${escapeHtml(payload.message)}</p>
          ${buildNotificationContent(payload)}
          <a href="https://finance-tracker.example.com/dashboard" class="cta-button">View Dashboard</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Finance Budget Tracker</p>
          <p><a href="https://finance-tracker.example.com/settings" style="color: #10b981; text-decoration: none;">Manage Notification Preferences</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return baseHtml;
}

function buildNotificationContent(payload: NotificationPayload): string {
  if (!payload.data) return "";

  switch (payload.type) {
    case "budget_alert":
      return `
        <div class="alert budget">
          <strong>Budget Status</strong><br/>
          Category: ${escapeHtml(payload.data.category || "N/A")}<br/>
          Spent: ₹${escapeHtml(String(payload.data.spent || 0))}<br/>
          Limit: ₹${escapeHtml(String(payload.data.limit || 0))}<br/>
          Percentage: ${escapeHtml(String(payload.data.percentage || 0))}%
        </div>
      `;

    case "subscription_reminder":
      return `
        <div class="alert subscription">
          <strong>Upcoming Subscription</strong><br/>
          Service: ${escapeHtml(payload.data.subscription || "N/A")}<br/>
          Amount: ₹${escapeHtml(String(payload.data.amount || 0))}<br/>
          Due: ${escapeHtml(payload.data.dueDate || "N/A")}
        </div>
      `;

    case "spending_anomaly":
      return `
        <div class="alert anomaly">
          <strong>Unusual Spending Detected</strong><br/>
          Category: ${escapeHtml(payload.data.category || "N/A")}<br/>
          Amount: ₹${escapeHtml(String(payload.data.amount || 0))}<br/>
          vs. Average: ₹${escapeHtml(String(payload.data.average || 0))}
        </div>
      `;

    case "emi_reminder":
      return `
        <div class="alert subscription">
          <strong>EMI Payment Due</strong><br/>
          Loan: ${escapeHtml(payload.data.loanName || "N/A")}<br/>
          Amount: ₹${escapeHtml(String(payload.data.emiAmount || 0))}<br/>
          Due: ${escapeHtml(payload.data.dueDate || "N/A")}
        </div>
      `;

    case "salary_alert":
      return `
        <div class="alert subscription">
          <strong>Salary Received</strong><br/>
          Amount: ₹${escapeHtml(String(payload.data.amount || 0))}<br/>
          Date: ${escapeHtml(payload.data.date || "N/A")}
        </div>
      `;

    default:
      return "";
  }
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}