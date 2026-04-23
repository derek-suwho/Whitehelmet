def test_keycloak_settings_have_defaults():
    from app.core.config import Settings
    s = Settings(
        keycloak_url="https://auth.example.com",
        keycloak_realm="pif",
        auth_mode="keycloak",
    )
    assert s.keycloak_url == "https://auth.example.com"
    assert s.keycloak_realm == "pif"
    assert s.auth_mode == "keycloak"
    assert s.db_ssl_ca == ""  # default empty = SSL disabled


def test_auth_mode_default_is_local():
    from app.core.config import Settings
    s = Settings()
    assert s.auth_mode == "local"
