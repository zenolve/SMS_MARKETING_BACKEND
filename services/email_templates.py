from datetime import datetime

def get_scheduled_email_html(campaign_name: str, scheduled_time_str: str, recipient_count: int, restaurant_name: str) -> str:
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); }}
            .header {{ background-color: #2563eb; color: #ffffff; padding: 24px; text-align: center; }}
            .header h1 {{ margin: 0; font-size: 24px; font-weight: 600; }}
            .content {{ padding: 32px 24px; color: #3f3f46; line-height: 1.6; }}
            .content h2 {{ color: #18181b; font-size: 20px; margin-top: 0; }}
            .stats-box {{ background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 24px 0; }}
            .stat-row {{ display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }}
            .stat-row:last-child {{ border-bottom: none; margin-bottom: 0; padding-bottom: 0; }}
            .stat-label {{ font-weight: 500; color: #64748b; }}
            .stat-value {{ font-weight: 600; color: #0f172a; }}
            .footer {{ background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 13px; color: #64748b; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Campaign Scheduled</h1>
            </div>
            <div class="content">
                <h2>Hello {restaurant_name},</h2>
                <p>Your SMS campaign has been successfully scheduled and is queued for delivery.</p>
                
                <div class="stats-box">
                    <div class="stat-row">
                        <span class="stat-label">Campaign Name</span>
                        <span class="stat-value">{campaign_name}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Scheduled Time</span>
                        <span class="stat-value">{scheduled_time_str}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Target Audience</span>
                        <span class="stat-value">{recipient_count} Recipients</span>
                    </div>
                </div>
                
                <p>We'll send you another update once the campaign has finished sending.</p>
            </div>
            <div class="footer">
                &copy; {datetime.now().year} SMS Marketing Platform. All rights reserved.
            </div>
        </div>
    </body>
    </html>
    """

def get_completed_email_html(campaign_name: str, total_sent: int, total_failed: int, restaurant_name: str) -> str:
    total_attempted = total_sent + total_failed
    success_rate = round((total_sent / total_attempted * 100) if total_attempted > 0 else 0, 1)
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); }}
            .header {{ background-color: #10b981; color: #ffffff; padding: 24px; text-align: center; }}
            .header h1 {{ margin: 0; font-size: 24px; font-weight: 600; }}
            .content {{ padding: 32px 24px; color: #3f3f46; line-height: 1.6; }}
            .content h2 {{ color: #18181b; font-size: 20px; margin-top: 0; }}
            .stats-box {{ background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 24px 0; }}
            .stat-row {{ display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }}
            .stat-row:last-child {{ border-bottom: none; margin-bottom: 0; padding-bottom: 0; }}
            .stat-label {{ font-weight: 500; color: #64748b; }}
            .stat-value {{ font-weight: 600; color: #0f172a; }}
            .success {{ color: #10b981; }}
            .failed {{ color: #ef4444; }}
            .footer {{ background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 13px; color: #64748b; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Campaign Complete!</h1>
            </div>
            <div class="content">
                <h2>Hello {restaurant_name},</h2>
                <p>Your SMS campaign has finished sending. Here are your delivery results:</p>
                
                <div class="stats-box">
                    <div class="stat-row">
                        <span class="stat-label">Campaign Name</span>
                        <span class="stat-value">{campaign_name}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Total Attempted</span>
                        <span class="stat-value">{total_attempted} Message(s)</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Successfully Sent</span>
                        <span class="stat-value success">{total_sent}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Failed Deliveries</span>
                        <span class="stat-value failed">{total_failed}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Delivery Rate</span>
                        <span class="stat-value">{success_rate}%</span>
                    </div>
                </div>
                
                <p>You can view more detailed analytics inside your dashboard.</p>
            </div>
            <div class="footer">
                &copy; {datetime.now().year} SMS Marketing Platform. All rights reserved.
            </div>
        </div>
    </body>
    </html>
    """
