from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RegisterView, LoginView, LogoutView, CurrentUserView,
    DonorProfileView, DonorAdminListView, BloodGroupSearchView,
    DonationRecordViewSet, BloodInventoryView, InventoryTransactionListView,
    BloodRequestViewSet, AdminDashboardKPIView, AuditLogListView,
    DistrictsListView, health_check
)

router = DefaultRouter()
router.register(r'donations', DonationRecordViewSet, basename='donations')
router.register(r'requests', BloodRequestViewSet, basename='requests')

urlpatterns = [
    # Health check for Render deployment
    path('health/', health_check, name='health-check'),

    # Authentication
    path('auth/register/', RegisterView.as_view(), name='auth-register'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('auth/me/', CurrentUserView.as_view(), name='auth-me'),

    # Module 1: Donor Registration & Profile
    path('donors/profile/', DonorProfileView.as_view(), name='donor-profile'),
    path('donors/admin-list/', DonorAdminListView.as_view(), name='donor-admin-list'),

    # Module 2: Blood Group Search (Privacy-Preserved Discovery)
    path('search/', BloodGroupSearchView.as_view(), name='blood-search'),
    path('districts/', DistrictsListView.as_view(), name='districts-list'),

    # Module 4: Blood Inventory
    path('inventory/', BloodInventoryView.as_view(), name='blood-inventory'),
    path('inventory/transactions/', InventoryTransactionListView.as_view(), name='inventory-transactions'),

    # Administrative Dashboard & Audits
    path('admin/dashboard/', AdminDashboardKPIView.as_view(), name='admin-dashboard'),
    path('admin/kpis/', AdminDashboardKPIView.as_view(), name='admin-kpis'),
    path('admin/audit-logs/', AuditLogListView.as_view(), name='admin-audit-logs'),

    # Module 3 (Donations) & Module 5 (Requests) via router
    path('', include(router.urls)),
]
