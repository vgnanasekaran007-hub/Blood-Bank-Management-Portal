"""
Database Initialization Script (Clean Production Ready)
Initializes:
- Administrator staff account
- Standard 8 ABO/Rh blood groups with 0 initial units
Zero mock or demo data. All future records are populated exclusively by real users.
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bloodportal.settings')
django.setup()

from django.contrib.auth.models import User
from bloodbank.models import UserProfile, BloodInventory, BLOOD_GROUPS


def init_database():
    print("Initializing clean production database...")

    from bloodbank.models import DonorProfile, BloodRequest, DonationRecord, InventoryTransaction, AuditLog
    DonorProfile.objects.all().delete()
    BloodRequest.objects.all().delete()
    DonationRecord.objects.all().delete()
    InventoryTransaction.objects.all().delete()
    AuditLog.objects.all().delete()
    User.objects.exclude(username='admin').delete()

    # 1. Administrator Account
    admin_user, created = User.objects.get_or_create(
        username='admin',
        defaults={
            'email': 'admin@lifepulse.org',
            'first_name': 'Admin',
            'last_name': 'Portal',
            'is_staff': True,
            'is_superuser': True
        }
    )
    admin_user.set_password('admin123')
    admin_user.first_name = 'Admin'
    admin_user.last_name = 'Portal'
    admin_user.save()

    UserProfile.objects.update_or_create(
        user=admin_user,
        defaults={
            'role': 'admin',
            'phone_number': '9840112233',
            'city': 'Chennai',
            'district': 'Chennai',
            'state': 'Tamil Nadu'
        }
    )
    print("-> Staff Administrator account verified (username: 'admin')")

    # 2. Initialize all 8 blood groups with 0 units
    for bg, _ in BLOOD_GROUPS:
        BloodInventory.objects.update_or_create(
            blood_group=bg,
            defaults={
                'units_available': 0,
                'min_threshold': 5
            }
        )
    print("-> 8 ABO/Rh blood groups initialized at 0 units.")
    print("-> Clean working model ready for real users.")


if __name__ == '__main__':
    init_database()
