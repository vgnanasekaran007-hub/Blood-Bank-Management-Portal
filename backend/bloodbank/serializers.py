from rest_framework import serializers
from django.contrib.auth.models import User
from django.utils import timezone
from .models import (
    UserProfile, DonorProfile, BloodInventory, DonationRecord,
    BloodRequest, InventoryTransaction, AuditLog,
    BLOOD_GROUPS, BLOOD_GROUP_CHOICES_LIST, USER_ROLES, GENDER_CHOICES,
    DONATION_STATUSES, REQUEST_STATUSES, URGENCY_LEVELS
)
import re
from datetime import date


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    phone_number = serializers.SerializerMethodField()
    city = serializers.SerializerMethodField()
    district = serializers.SerializerMethodField()
    is_donor = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone_number', 'city', 'district', 'is_donor']

    def get_role(self, obj):
        if obj.is_superuser or obj.is_staff:
            return 'admin'
        if hasattr(obj, 'profile') and obj.profile.role:
            return obj.profile.role
        if hasattr(obj, 'donor_profile'):
            return 'donor'
        return 'requester'

    def get_phone_number(self, obj):
        if hasattr(obj, 'profile'):
            return obj.profile.phone_number
        if hasattr(obj, 'donor_profile'):
            return obj.donor_profile.phone_number
        return ''

    def get_city(self, obj):
        if hasattr(obj, 'profile'):
            return obj.profile.city
        if hasattr(obj, 'donor_profile'):
            return obj.donor_profile.city
        return ''

    def get_district(self, obj):
        if hasattr(obj, 'profile'):
            return obj.profile.district
        if hasattr(obj, 'donor_profile'):
            return obj.donor_profile.district
        return ''

    def get_is_donor(self, obj):
        return hasattr(obj, 'donor_profile')


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    full_name = serializers.CharField(max_length=150)
    role = serializers.ChoiceField(choices=USER_ROLES, default='requester')
    phone_number = serializers.CharField(max_length=20)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    district = serializers.CharField(max_length=100, required=False, allow_blank=True)
    state = serializers.CharField(max_length=100, required=False, default='Tamil Nadu')

    # Optional donor registration fields if role == 'donor'
    blood_group = serializers.ChoiceField(choices=BLOOD_GROUP_CHOICES_LIST, required=False)
    date_of_birth = serializers.DateField(required=False)
    gender = serializers.ChoiceField(choices=[g[0] for g in GENDER_CHOICES], required=False, default='MALE')
    locality = serializers.CharField(max_length=150, required=False, allow_blank=True)
    pincode = serializers.CharField(max_length=10, required=False, allow_blank=True)
    last_donation_date = serializers.DateField(required=False, allow_null=True)
    is_available = serializers.BooleanField(required=False, default=True)

    def validate_username(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError("Username cannot be blank.")
        if User.objects.filter(username__iexact=cleaned).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return cleaned

    def validate_email(self, value):
        cleaned = str(value).strip().lower()
        if User.objects.filter(email__iexact=cleaned).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return cleaned

    def validate_full_name(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError("Full name cannot be blank.")
        return cleaned

    def validate_phone_number(self, value):
        cleaned = re.sub(r'[\s\-\(\)\+]', '', str(value))
        if len(cleaned) < 10 or not cleaned.isdigit():
            raise serializers.ValidationError("Enter a valid 10-digit phone number.")
        return cleaned

    def validate_last_donation_date(self, value):
        if value and value > date.today():
            raise serializers.ValidationError("Last donation date cannot be in the future.")
        return value

    def validate(self, data):
        if data.get('role') == 'donor':
            if not data.get('blood_group'):
                raise serializers.ValidationError({"blood_group": "Blood group is required for donor registration."})
            if not data.get('district'):
                raise serializers.ValidationError({"district": "District is required for donor location discovery."})
            dob = data.get('date_of_birth')
            if dob:
                today = date.today()
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                if age < 18:
                    raise serializers.ValidationError({"date_of_birth": "Voluntary blood donors must be at least 18 years old."})
                if age > 65:
                    raise serializers.ValidationError({"date_of_birth": "Standard voluntary donation age limit is 65 years."})
        return data


class DonorProfileSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    is_eligible = serializers.BooleanField(source='is_eligible_by_date', read_only=True)
    days_since_last_donation = serializers.IntegerField(read_only=True)

    class Meta:
        model = DonorProfile
        fields = [
            'id', 'user_id', 'username', 'full_name', 'email', 'blood_group',
            'phone_number', 'alternate_phone', 'date_of_birth', 'gender',
            'city', 'district', 'state', 'pincode', 'locality',
            'is_available', 'last_donation_date', 'consent_to_contact',
            'total_donations', 'notes', 'is_eligible', 'days_since_last_donation',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['total_donations', 'created_at', 'updated_at']

    def validate_last_donation_date(self, value):
        if value and value > date.today():
            raise serializers.ValidationError("Last donation date cannot be in the future.")
        return value

    def validate_phone_number(self, value):
        cleaned = re.sub(r'[\s\-\(\)\+]', '', str(value))
        if len(cleaned) < 10 or not cleaned.isdigit():
            raise serializers.ValidationError("Enter a valid 10-digit phone number.")
        return cleaned


class PublicDonorSearchSerializer(serializers.ModelSerializer):
    """
    Privacy-Preserving Serializer:
    Never exposes phone number, email, or exact residential address in public discovery.
    Provides verified discovery badges and safe coordination hooks.
    """
    donor_code = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()
    is_eligible = serializers.BooleanField(source='is_eligible_by_date', read_only=True)

    class Meta:
        model = DonorProfile
        fields = [
            'id', 'donor_code', 'display_name', 'blood_group', 'city',
            'district', 'state', 'is_available', 'is_eligible',
            'consent_to_contact', 'total_donations'
        ]

    def get_donor_code(self, obj):
        return f"DNR-{obj.id:04d}"

    def get_display_name(self, obj):
        name = obj.user.get_full_name() or obj.user.username
        parts = name.split()
        if len(parts) > 1:
            return f"{parts[0]} {parts[1][0]}."
        return f"{name[:3]}***"


class DonationRecordSerializer(serializers.ModelSerializer):
    donor_name = serializers.SerializerMethodField()
    donor_code = serializers.SerializerMethodField()
    verified_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DonationRecord
        fields = [
            'id', 'donor', 'donor_name', 'donor_code', 'blood_group',
            'units', 'donation_date', 'hospital_or_camp', 'status',
            'verified_by', 'verified_by_name', 'verified_at',
            'rejection_reason', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['verified_by', 'verified_at', 'created_at', 'updated_at']

    def get_donor_name(self, obj):
        return obj.donor.user.get_full_name() or obj.donor.user.username

    def get_donor_code(self, obj):
        return f"DNR-{obj.donor.id:04d}"

    def get_verified_by_name(self, obj):
        if obj.verified_by:
            return obj.verified_by.get_full_name() or obj.verified_by.username
        return None


class DonationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DonationRecord
        fields = ['blood_group', 'units', 'donation_date', 'hospital_or_camp', 'notes']

    def validate_units(self, value):
        if value < 1 or value > 3:
            raise serializers.ValidationError("Standard whole blood donation quantity is 1 to 2 units (350ml-450ml per unit).")
        return value

    def validate_donation_date(self, value):
        if value > date.today():
            raise serializers.ValidationError("Donation date cannot be in the future.")
        return value


class DonationVerificationSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['VERIFIED', 'REJECTED'])
    rejection_reason = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if data['status'] == 'REJECTED' and not data.get('rejection_reason'):
            raise serializers.ValidationError({"rejection_reason": "A specific reason is mandatory when rejecting a donation record."})
        return data


class BloodInventorySerializer(serializers.ModelSerializer):
    status = serializers.CharField(read_only=True)

    class Meta:
        model = BloodInventory
        fields = ['id', 'blood_group', 'units_available', 'min_threshold', 'status', 'last_updated']


class InventoryTransactionSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = InventoryTransaction
        fields = [
            'id', 'blood_group', 'transaction_type', 'units', 'stock_before',
            'stock_after', 'reference_donation', 'reference_request',
            'performed_by', 'performed_by_name', 'remarks', 'created_at'
        ]

    def get_performed_by_name(self, obj):
        if obj.performed_by:
            return obj.performed_by.get_full_name() or obj.performed_by.username
        return "System"


class BloodRequestSerializer(serializers.ModelSerializer):
    requester_name = serializers.SerializerMethodField()
    requester_email = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = BloodRequest
        fields = [
            'id', 'requester', 'requester_name', 'requester_email',
            'patient_name', 'patient_age', 'patient_gender', 'blood_group',
            'units_needed', 'hospital_name', 'hospital_address',
            'city', 'district', 'contact_person', 'contact_phone',
            'urgency', 'medical_reason', 'required_by_date', 'status',
            'admin_remarks', 'reviewed_by', 'reviewed_by_name',
            'reviewed_at', 'fulfilled_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['requester', 'reviewed_by', 'reviewed_at', 'fulfilled_at', 'created_at', 'updated_at']

    def get_requester_name(self, obj):
        return obj.requester.get_full_name() or obj.requester.username

    def get_requester_email(self, obj):
        return obj.requester.email

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.username
        return None


class BloodRequestCreateSerializer(serializers.ModelSerializer):
    hospital_address = serializers.CharField(required=False, allow_blank=True, default='')
    city = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')

    class Meta:
        model = BloodRequest
        fields = [
            'patient_name', 'patient_age', 'patient_gender', 'blood_group',
            'units_needed', 'hospital_name', 'hospital_address',
            'city', 'district', 'contact_person', 'contact_phone',
            'urgency', 'medical_reason', 'required_by_date'
        ]

    def validate_patient_age(self, value):
        if value < 0 or value > 120:
            raise serializers.ValidationError("Enter a valid patient age between 0 and 120.")
        return value

    def validate_units_needed(self, value):
        if value < 1 or value > 10:
            raise serializers.ValidationError("Requested blood units must be between 1 and 10 units per request.")
        return value

    def validate(self, data):
        for field in ('hospital_address', 'city', 'medical_reason'):
            if data.get(field) is None:
                data[field] = ''
        return data

    def validate_contact_phone(self, value):
        cleaned = re.sub(r'[\s\-\(\)\+]', '', str(value))
        if len(cleaned) < 10 or not cleaned.isdigit():
            raise serializers.ValidationError("Enter a valid 10-digit emergency contact phone number.")
        return cleaned

    def validate_required_by_date(self, value):
        if value < date.today():
            raise serializers.ValidationError("Requirement date cannot be in the past.")
        return value


class BloodRequestStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['UNDER_REVIEW', 'APPROVED', 'FULFILLED', 'REJECTED', 'CANCELLED'])
    admin_remarks = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if data['status'] == 'REJECTED' and not data.get('admin_remarks'):
            raise serializers.ValidationError({"admin_remarks": "A remark explaining rejection is required."})
        return data


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = ['id', 'user', 'user_name', 'action', 'entity_type', 'entity_id', 'details', 'ip_address', 'created_at']

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return "System / Guest"
