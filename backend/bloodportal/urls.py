"""
URL configuration for bloodportal project.
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def api_root_index(request):
    return JsonResponse({
        "project": "Blood Donor and Blood Bank Management Portal API",
        "course": "CCS375 - Web Technologies",
        "academic_year": "2026-2027",
        "team": "Team 1",
        "version": "1.0.0",
        "documentation": "/api/health/",
        "endpoints": {
            "health": "/health/",
            "api_health": "/api/health/",
            "auth_register": "/api/auth/register/",
            "auth_login": "/api/auth/login/",
            "auth_me": "/api/auth/me/",
            "donor_profile": "/api/donors/profile/",
            "blood_search": "/api/search/?blood_group=O%2B&district=Chennai",
            "inventory": "/api/inventory/",
            "donations": "/api/donations/",
            "requests": "/api/requests/",
            "admin_dashboard": "/api/admin/dashboard/"
        }
    })

def health_check(request):
    """
    Lightweight public health-check endpoint for monitoring services (e.g. UptimeRobot, Render).
    Returns HTTP 200 without connecting to or querying Supabase/database to ensure zero overhead.
    """
    return JsonResponse({
        "status": "ok",
        "message": "Blood Bank Backend is running"
    }, status=200)

urlpatterns = [
    path('', api_root_index, name='api-root-index'),
    path('health/', health_check, name='health-check'),
    path('health', health_check, name='health-check-noslash'),
    path('admin/', admin.site.urls),
    path('api/', include('bloodbank.urls')),
]
