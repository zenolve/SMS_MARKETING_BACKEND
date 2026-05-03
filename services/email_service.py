import smtplib
from email.message import EmailMessage
import logging
from config import get_settings

logger = logging.getLogger(__name__)

def send_email_notification(to_email: str, subject: str, content: str, is_html: bool = False):
    """
    Sends an email notification using SMTP.
    """
    settings = get_settings()
    
    if not settings.smtp_host or not settings.smtp_user or not settings.smtp_password:
        logger.warning(f"SMTP credentials not configured. Skipping email: '{subject}' to {to_email}")
        return False
        
    try:
        msg = EmailMessage()
        msg['Subject'] = subject
        msg['From'] = settings.smtp_from_email or settings.smtp_user
        msg['To'] = to_email
        
        if is_html:
            # We must set a text fallback first then add HTML as alternative
            msg.set_content("Please view this email in an HTML-compatible client.")
            msg.add_alternative(content, subtype='html')
        else:
            msg.set_content(content)
            
        if settings.smtp_port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port) as server:
                server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
                server.ehlo()
                # If starttls is supported
                if server.has_extn('STARTTLS'):
                    server.starttls()
                    server.ehlo()
                server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
            
        logger.info(f"Successfully sent email notification to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email notification to {to_email}: {str(e)}")
        return False
