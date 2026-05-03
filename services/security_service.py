from cryptography.fernet import Fernet
from config import get_settings

settings = get_settings()

def get_fernet() -> Fernet:
    """Initialize Fernet with the encryption key from settings."""
    if not settings.encryption_key:
        # Fallback or error based on environment
        # In production, this should definitely be set
        return None
    return Fernet(settings.encryption_key.strip().encode())

def encrypt_value(plain_text: str) -> str:
    """Encrypt a string value."""
    if not plain_text:
        return plain_text
    
    fernet = get_fernet()
    if not fernet:
        return plain_text # Or raise error
    
    return fernet.encrypt(plain_text.encode()).decode()

def decrypt_value(cipher_text: str) -> str:
    """Decrypt a string value."""
    if not cipher_text:
        return cipher_text
    
    fernet = get_fernet()
    if not fernet:
        return cipher_text
    
    try:
        return fernet.decrypt(cipher_text.encode()).decode()
    except:
        # If decryption fails for any reason, return the original value.
        return cipher_text
