from django.contrib import admin
from .models import (
    UserProfile, DonorProfile, BloodInventory, DonationRecord,
    BloodRequest, InventoryTransaction, AuditLog
)

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'phone_number', 'district', 'city', 'created_at')
    list_filter = ('role', 'district')
    search_fields = ('user__username', 'user__first_name', 'user__last_name', 'phone_number')


@admin.register(DonorProfile)
class DonorProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'blood_group', 'district', 'city', 'phone_number', 'is_available', 'last_donation_date', 'total_donations')
    list_filter = ('blood_group', 'is_available', 'district')
    search_fields = ('user__username', 'user__first_name', 'user__last_name', 'phone_number', 'city', 'district')
    actions = ['activate_availability', 'deactivate_availability']

    @admin.action(description="Mark selected donors as Available")
    def activate_availability(self, request, queryset):
        queryset.update(is_available=True)

    @admin.action(description="Mark selected donors as Unavailable")
    def deactivate_availability(self, request, queryset):
        queryset.update(is_available=False)


@admin.register(BloodInventory)
class BloodInventoryAdmin(admin.ModelAdmin):
    list_display = ('blood_group', 'units_available', 'min_threshold', 'status', 'last_updated')
    list_filter = ('blood_group',)
    ordering = ('blood_group',)


@admin.register(DonationRecord)
class DonationRecordAdmin(admin.ModelAdmin):
    list_display = ('id', 'donor', 'blood_group', 'units', 'donation_date', 'hospital_or_camp', 'status', 'verified_by')
    list_filter = ('status', 'blood_group', 'donation_date')
    search_fields = ('donor__user__username', 'hospital_or_camp')
    date_hierarchy = 'donation_date'


@admin.register(BloodRequest)
class BloodRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'patient_name', 'blood_group', 'units_needed', 'hospital_name', 'district', 'urgency', 'status', 'required_by_date', 'created_at')
    list_filter = ('status', 'urgency', 'blood_group', 'district')
    search_fields = ('patient_name', 'hospital_name', 'contact_person', 'contact_phone')
    date_hierarchy = 'created_at'


@admin.register(InventoryTransaction)
class InventoryTransactionAdmin(admin.ModelAdmin):
    list_display = ('id', 'blood_group', 'transaction_type', 'units', 'stock_before', 'stock_after', 'performed_by', 'created_at')
    list_filter = ('blood_group', 'transaction_type', 'created_at')
    search_fields = ('remarks',)
    date_hierarchy = 'created_at'


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'action', 'entity_type', 'entity_id', 'ip_address', 'created_at')
    list_filter = ('action', 'entity_type', 'created_at')
    search_fields = ('entity_id', 'user__username', 'action')
    date_hierarchy = 'created_at'
