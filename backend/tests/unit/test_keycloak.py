# backend/tests/unit/test_keycloak.py
import json
import time
import pytest
from unittest.mock import patch, MagicMock
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend
from jose import jwt, jwk


# --- Helpers ---

def make_rsa_key_pair():
    private_key = rsa.generate_private_key(
        public_exponent=65537, key_size=2048, backend=default_backend()
    )
    return private_key, private_key.public_key()


def make_token(claims: dict, private_key, algorithm="RS256") -> str:
    from cryptography.hazmat.primitives.serialization import Encoding, PrivateFormat, NoEncryption
    pem_bytes = private_key.private_bytes(Encoding.PEM, PrivateFormat.TraditionalOpenSSL, NoEncryption())
    return jwt.encode(claims, pem_bytes, algorithm=algorithm)


def make_jwks(public_key) -> dict:
    """Convert RSA public key to JWKS format."""
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
    pub_bytes = public_key.public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo)
    key_dict = jwk.construct(pub_bytes, algorithm="RS256").to_dict()
    # Convert any bytes values to strings
    key_dict = {k: v.decode() if isinstance(v, bytes) else v for k, v in key_dict.items()}
    key_dict["kid"] = "test-key-1"
    key_dict["use"] = "sig"
    key_dict["alg"] = "RS256"
    return {"keys": [key_dict]}


# --- Tests ---

def test_decode_valid_token():
    from app.core.keycloak import decode_token
    private_key, public_key = make_rsa_key_pair()
    jwks = make_jwks(public_key)
    claims = {
        "sub": "user-123",
        "email": "alice@pif.gov.sa",
        "preferred_username": "alice",
        "realm_access": {"roles": ["Org_Super_Admin"]},
        "exp": int(time.time()) + 3600,
        "iss": "https://auth.example.com/realms/pif",
        "aud": "whitehelmet",
    }
    token = make_token(claims, private_key)
    with patch("app.core.keycloak._fetch_jwks", return_value=jwks):
        decoded = decode_token(token, issuer="https://auth.example.com/realms/pif", audience="whitehelmet")
    assert decoded["sub"] == "user-123"
    assert decoded["email"] == "alice@pif.gov.sa"


def test_decode_expired_token():
    from app.core.keycloak import decode_token, TokenError
    private_key, public_key = make_rsa_key_pair()
    jwks = make_jwks(public_key)
    claims = {
        "sub": "user-123",
        "exp": int(time.time()) - 60,  # expired
        "iss": "https://auth.example.com/realms/pif",
        "aud": "whitehelmet",
    }
    token = make_token(claims, private_key)
    with patch("app.core.keycloak._fetch_jwks", return_value=jwks):
        with pytest.raises(TokenError, match="expired"):
            decode_token(token, issuer="https://auth.example.com/realms/pif", audience="whitehelmet")


def test_decode_wrong_signature():
    from app.core.keycloak import decode_token, TokenError
    private_key1, _ = make_rsa_key_pair()
    _, public_key2 = make_rsa_key_pair()  # different key pair
    jwks = make_jwks(public_key2)
    claims = {"sub": "user-123", "exp": int(time.time()) + 3600, "iss": "https://auth.example.com/realms/pif", "aud": "whitehelmet"}
    token = make_token(claims, private_key1)
    with patch("app.core.keycloak._fetch_jwks", return_value=jwks):
        with pytest.raises(TokenError):
            decode_token(token, issuer="https://auth.example.com/realms/pif", audience="whitehelmet")


def test_extract_roles():
    from app.core.keycloak import extract_roles
    claims = {"realm_access": {"roles": ["Org_Super_Admin", "offline_access", "uma_authorization"]}}
    roles = extract_roles(claims)
    assert "Org_Super_Admin" in roles
    assert "offline_access" not in roles  # internal Keycloak roles filtered out


def test_map_role_to_system_role():
    from app.core.keycloak import map_system_role
    assert map_system_role(["Org_Super_Admin"]) == "pif_admin"
    assert map_system_role(["Org_Admin"]) == "devco_admin"
    assert map_system_role(["Org_Member"]) == "devco_user"
    assert map_system_role(["unknown_role"]) is None
