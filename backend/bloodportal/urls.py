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
            "health": "/api/health/",
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

urlpatterns = [
    path('', api_root_index, name='api-root-index'),
    path('admin/', admin.site.urls),
    path('api/', include('bloodbank.urls')),
]
