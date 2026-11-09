"""
Custom Authentication classes for LifePulse Blood Bank Portal.
Supports:
1. CsrfExemptSessionAuthentication: Session cookies without blocking cross-origin SPA requests.
2. SessionTokenAuthentication: Bearer / Token headers using Django's session store, ensuring
   third-party cookie blocking in modern browsers (Chrome/Safari) does not break user sessions.
"""
from django.contrib.sessions.models import Session
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.authentication import SessionAuthentication, BaseAuthentication
from rest_framework import exceptions


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    SessionAuthentication that skips CSRF validation.
    Safe for API endpoints protected by strict CORS headers (allowed origins).
    """
    def enforce_csrf(self, request):
        # Skip CSRF check for API calls; CORS already restricts allowed origins
        return


class SessionTokenAuthentication(BaseAuthentication):
    """
    Authenticates requests via 'Authorization: Bearer <session_key>' or 'Authorization: Token <session_key>'.
    Resolves the user from Django's session store.
    """
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return None

        parts = auth_header.split()
        if len(parts) != 2:
            return None

        prefix = parts[0].lower()
        if prefix not in ('bearer', 'token', 'session'):
            return None

        session_key = parts[1].strip()
        if not session_key:
            return None

        try:
            session = Session.objects.get(session_key=session_key)
        except Session.DoesNotExist:
            return None

        # Check if session has expired
        if session.expire_date and session.expire_date < timezone.now():
            return None

        session_data = session.get_decoded()
        user_id = session_data.get('_auth_user_id')
        if not user_id:
            return None

        try:
            user = User.objects.select_related('profile', 'donor_profile').get(pk=user_id)
        except User.DoesNotExist:
            return None

        if not user.is_active:
            raise exceptions.AuthenticationFailed('User account is inactive.')

        return (user, None)

