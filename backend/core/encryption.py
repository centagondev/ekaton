from cryptography.fernet import Fernet
from django.conf import settings

cipher = Fernet(settings.MESSAGE_ENCRYPTION_KEY.encode())


def encrypt_message(message: str) -> str:
    """Encrypt a plaintext message string and return the ciphertext as a string."""
    return cipher.encrypt(message.encode()).decode()


def decrypt_message(message: str) -> str:
    """Decrypt a ciphertext string and return the original plaintext string."""
    return cipher.decrypt(message.encode()).decode()
