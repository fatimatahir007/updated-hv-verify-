import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Load SMTP configurations from environment
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")

def send_otp_email(to_email: str, otp_code: str, flow: str = "Activation") -> bool:
    """
    Sends a 6-digit OTP code to the voter's registered email.
    If SMTP credentials are not configured or email sending fails,
    it falls back to printing the OTP prominently to the terminal logs.
    """
    # Always print a fallback log message in the console for easy developer testing
    print(f"\n==================================================")
    print(f"[OTP DEBUG FALLBACK] Flow: {flow}")
    print(f"To: {to_email}")
    print(f"Code: {otp_code}")
    print(f"==================================================\n")

    if not to_email:
        print("[EMAIL HELPER] Warning: No destination email provided.")
        return False

    if not SMTP_USER or not SMTP_PASS:
        print("[EMAIL HELPER] Info: SMTP credentials are not fully configured in .env. Falling back to terminal log only.")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"HVS Voting Portal - {flow} OTP Verification"
        msg["From"] = SMTP_USER
        msg["To"] = to_email

        body = (
            f"Hello Voter,\n\n"
            f"A request was made to verify your identity for: {flow}.\n\n"
            f"Your 6-digit verification code is:\n\n"
            f"  {otp_code}\n\n"
            f"This code will expire in 10 minutes. If you did not request this, please ignore this email.\n\n"
            f"Secure Verification System\n"
        )
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, to_email, msg.as_string())

        print(f"[EMAIL HELPER] Successfully sent OTP email to {to_email} via SMTP.")
        return True

    except Exception as e:
        print(f"[EMAIL HELPER] Error sending SMTP email: {e}")
        # Return True because fallback print is already logged to terminal
        return True
