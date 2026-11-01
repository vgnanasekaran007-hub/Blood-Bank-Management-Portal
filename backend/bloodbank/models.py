from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.exceptions import ValidationError
import re

BLOOD_GROUPS = [
    ('A+', 'A Positive (A+)'),
    ('A-', 'A Negative (A-)'),
    ('B+', 'B Positive (B+)'),
    ('B-', 'B Negative (B-)'),
    ('AB+', 'AB Positive (AB+)'),
    ('AB-', 'AB Negative (AB-)'),
    ('O+', 'O Positive (O+)'),
    ('O-', 'O Negative (O-)'),
]

BLOOD_GROUP_CHOICES_LIST = [bg[0] for bg in BLOOD_GROUPS]

USER_ROLES = [
    ('donor', 'Blood Donor'),
    ('requester', 'Blood Requester'),
    ('admin', 'Blood Bank Administrator / Staff'),
]

GENDER_CHOICES = [
    ('MALE', 'Male'),
    ('FEMALE', 'Female'),
    ('OTHER', 'Other'),
]

DONATION_STATUSES = [
    ('PENDING', 'Pending Verification'),
    ('VERIFIED', 'Verified & Accepted into Stock'),
    ('REJECTED', 'Rejected'),
]

REQUEST_STATUSES = [
    ('SUBMITTED', 'Submitted'),
    ('UNDER_REVIEW', 'Under Review'),
    ('APPROVED', 'Approved (Ready for Fulfillment)'),
    ('FULFILLED', 'Fulfilled (Stock Dispatched)'),
    ('REJECTED', 'Rejected'),
    ('CANCELLED', 'Cancelled by Requester'),
]

URGENCY_LEVELS = [
    ('NORMAL', 'Standard (Within 24-48 Hours)'),
    ('URGENT', 'Urgent (Within 6-12 Hours)'),
    ('CRITICAL', 'Emergency Critical (Immediate)'),
]

TRANSACTION_TYPES = [
    ('DONATION_ADD', 'Stock Addition from Verified Donation'),
    ('REQUEST_FULFILL', 'Stock Deduction for Fulfilled Request'),
    ('MANUAL_ADJUSTMENT', 'Authorized Manual Inventory Adjustment'),
    ('DISCARD', 'Blood Expiry or Quality Discard'),
]


def validate_phone(value):
    cleaned = re.sub(r'[\s\-\(\)\+]', '', str(value))
    if len(cleaned) < 10 or not cleaned.isdigit():
        raise ValidationError('Enter a valid 10-digit phone number.')


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=USER_ROLES, default='requester')
    phone_number = models.CharField(max_length=20, validators=[validate_phone])
    city = models.CharField(max_length=100, blank=True)
    district = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, default='Tamil Nadu')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'User Profile'
        verbose_name_plural = 'User Profiles'

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} ({self.get_role_display()})"


class DonorProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='donor_profile')
    blood_group = models.CharField(max_length=5, choices=BLOOD_GROUPS)
    phone_number = models.CharField(max_length=20, validators=[validate_phone])
    alternate_phone = models.CharField(max_length=20, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, default='MALE')
    city = models.CharField(max_length=100)
    district = models.CharField(max_length=100)
    state = models.CharField(max_length=100, default='Tamil Nadu')
    pincode = models.CharField(max_length=10)
    locality = models.CharField(max_length=150, help_text="Neighborhood or area for discovery; never exposed as exact home address.")
    is_available = models.BooleanField(default=True, help_text="Toggle to make yourself available or busy for emergency donation.")
    last_donation_date = models.DateField(null=True, blank=True)
    consent_to_contact = models.BooleanField(default=True, help_text="Explicit consent to receive communication for verified blood requests.")
    total_donations = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True, help_text="Administrative notes (e.g. eligibility screenings)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['blood_group', 'district', 'is_available']),
            models.Index(fields=['city']),
        ]
        verbose_name = 'Donor Profile'
        verbose_name_plural = 'Donor Profiles'

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} - {self.blood_group} ({self.district})"

    @property
    def is_eligible_by_date(self):
        if not self.last_donation_date:
            return True
        diff = timezone.now().date() - self.last_donation_date
        return diff.days >= 90

    @property
    def days_since_last_donation(self):
        if not self.last_donation_date:
            return None
        diff = timezone.now().date() - self.last_donation_date
        return diff.days


class BloodInventory(models.Model):
    blood_group = models.CharField(max_length=5, choices=BLOOD_GROUPS, unique=True)
    units_available = models.PositiveIntegerField(default=0)
    min_threshold = models.PositiveIntegerField(default=5, help_text="Threshold below which inventory triggers low-stock alerts")
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Blood Stock Item'
        verbose_name_plural = 'Blood Inventory'
        constraints = [
            models.CheckConstraint(
                condition=models.Q(units_available__gte=0),
                name='inventory_units_non_negative'
            )
        ]

    def __str__(self):
        return f"{self.blood_group}: {self.units_available} units available"

    @property
    def status(self):
        if self.units_available == 0:
            return 'OUT_OF_STOCK'
        elif self.units_available <= self.min_threshold:
            return 'LOW_STOCK'
        return 'HEALTHY'


class DonationRecord(models.Model):
    donor = models.ForeignKey(DonorProfile, on_delete=models.CASCADE, related_name='donations')
    blood_group = models.CharField(max_length=5, choices=BLOOD_GROUPS)
    units = models.PositiveIntegerField(default=1, help_text="Number of units (e.g. 1 unit ~ 350-450ml)")
    donation_date = models.DateField(default=timezone.now)
    hospital_or_camp = models.CharField(max_length=200, help_text="Hospital name or Blood Donation Camp venue")
    status = models.CharField(max_length=20, choices=DONATION_STATUSES, default='PENDING')
    verified_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='verified_donations')
    verified_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-donation_date', '-created_at']
        verbose_name = 'Donation Record'
        verbose_name_plural = 'Donation Records'

    def __str__(self):
        return f"Donation #{self.id}: {self.donor.user.username} - {self.blood_group} ({self.status})"


class BloodRequest(models.Model):
    requester = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blood_requests')
    patient_name = models.CharField(max_length=150)
    patient_age = models.PositiveIntegerField()
    patient_gender = models.CharField(max_length=10, choices=GENDER_CHOICES, default='MALE')
    blood_group = models.CharField(max_length=5, choices=BLOOD_GROUPS)
    units_needed = models.PositiveIntegerField(default=1)
    hospital_name = models.CharField(max_length=200)
    hospital_address = models.TextField()
    city = models.CharField(max_length=100)
    district = models.CharField(max_length=100)
    contact_person = models.CharField(max_length=150)
    contact_phone = models.CharField(max_length=20, validators=[validate_phone])
    urgency = models.CharField(max_length=20, choices=URGENCY_LEVELS, default='URGENT')
    medical_reason = models.CharField(max_length=200, blank=True, help_text="e.g. Emergency Trauma, Cardiac Surgery, Dengue, Thalassemia")
    required_by_date = models.DateField(default=timezone.now)
    status = models.CharField(max_length=20, choices=REQUEST_STATUSES, default='SUBMITTED')
    admin_remarks = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='reviewed_requests')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    fulfilled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'blood_group']),
            models.Index(fields=['district']),
        ]
        verbose_name = 'Blood Request'
        verbose_name_plural = 'Blood Requests'

    def __str__(self):
        return f"Request #{self.id}: {self.patient_name} - {self.units_needed} unit(s) of {self.blood_group} ({self.status})"


class InventoryTransaction(models.Model):
    blood_group = models.CharField(max_length=5, choices=BLOOD_GROUPS)
    transaction_type = models.CharField(max_length=30, choices=TRANSACTION_TYPES)
    units = models.IntegerField(help_text="Positive for additions, negative for deductions")
    stock_before = models.PositiveIntegerField()
    stock_after = models.PositiveIntegerField()
    reference_donation = models.ForeignKey(DonationRecord, null=True, blank=True, on_delete=models.SET_NULL, related_name='inventory_transactions')
    reference_request = models.ForeignKey(BloodRequest, null=True, blank=True, on_delete=models.SET_NULL, related_name='inventory_transactions')
    performed_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name='inventory_actions')
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Inventory Transaction'
        verbose_name_plural = 'Inventory Transactions'

    def __str__(self):
        sign = '+' if self.units >= 0 else ''
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M')}] {self.blood_group} {sign}{self.units} units ({self.get_transaction_type_display()})"


class AuditLog(models.Model):
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='audit_logs')
    action = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=50)
    entity_id = models.CharField(max_length=50)
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'

    def __str__(self):
        username = self.user.username if self.user else 'System'
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M:%S')}] {username} - {self.action} on {self.entity_type} #{self.entity_id}"
