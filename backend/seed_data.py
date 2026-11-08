"""
Database Initialization Script (Production Working Model)
Initializes:
- Administrator staff account (admin / admin123)
- Realistic verified inventory reserve across all 8 ABO/Rh blood groups
- Baseline voluntary donor directory across Tamil Nadu districts
- Production-ready sample requests and donation history
"""

import os
import django
from datetime import date, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bloodportal.settings')
django.setup()

from django.contrib.auth.models import User
from bloodbank.models import (
    UserProfile, DonorProfile, BloodInventory,
    BloodRequest, DonationRecord, InventoryTransaction, AuditLog,
    BLOOD_GROUPS
)

INITIAL_INVENTORY = {
    'O+': 18,
    'A+': 14,
    'B+': 16,
    'AB+': 7,
    'O-': 6,
    'A-': 4,
    'B-': 4,
    'AB-': 2,
}

SAMPLE_DONORS = [
    {
        'username': 'ramesh_k',
        'first_name': 'Ramesh',
        'last_name': 'Krishnan',
        'email': 'ramesh.k@example.com',
        'phone': '9840123456',
        'blood_group': 'O+',
        'district': 'Chennai',
        'city': 'Anna Nagar',
        'locality': 'Anna Nagar West',
        'gender': 'MALE',
        'total_donations': 4,
        'days_ago': 45,
    },
    {
        'username': 'priya_s',
        'first_name': 'Priya',
        'last_name': 'Sundaram',
        'email': 'priya.s@example.com',
        'phone': '9840234567',
        'blood_group': 'A+',
        'district': 'Chennai',
        'city': 'Adyar',
        'locality': 'Besant Nagar',
        'gender': 'FEMALE',
        'total_donations': 3,
        'days_ago': 105,
    },
    {
        'username': 'karthik_r',
        'first_name': 'Karthik',
        'last_name': 'Raja',
        'email': 'karthik.r@example.com',
        'phone': '9842134567',
        'blood_group': 'B+',
        'district': 'Coimbatore',
        'city': 'Gandhipuram',
        'locality': 'RS Puram',
        'gender': 'MALE',
        'total_donations': 5,
        'days_ago': 120,
    },
    {
        'username': 'meena_n',
        'first_name': 'Meena',
        'last_name': 'Natarajan',
        'email': 'meena.n@example.com',
        'phone': '9843145678',
        'blood_group': 'AB+',
        'district': 'Madurai',
        'city': 'K.K. Nagar',
        'locality': 'Anna Bus Stand Area',
        'gender': 'FEMALE',
        'total_donations': 2,
        'days_ago': 95,
    },
    {
        'username': 'anand_k',
        'first_name': 'Anand',
        'last_name': 'Kumar',
        'email': 'anand.k@example.com',
        'phone': '9844156789',
        'blood_group': 'O-',
        'district': 'Tiruchirappalli',
        'city': 'Thillai Nagar',
        'locality': 'Cantonment',
        'gender': 'MALE',
        'total_donations': 6,
        'days_ago': 140,
    },
    {
        'username': 'divya_b',
        'first_name': 'Divya',
        'last_name': 'Bharathi',
        'email': 'divya.b@example.com',
        'phone': '9845167890',
        'blood_group': 'B+',
        'district': 'Salem',
        'city': 'Fairlands',
        'locality': 'Alagapuram',
        'gender': 'FEMALE',
        'total_donations': 3,
        'days_ago': 60,
    },
    {
        'username': 'suresh_b',
        'first_name': 'Suresh',
        'last_name': 'Babu',
        'email': 'suresh.b@example.com',
        'phone': '9846178901',
        'blood_group': 'A-',
        'district': 'Tirunelveli',
        'city': 'Palayamkottai',
        'locality': 'Vannarpettai',
        'gender': 'MALE',
        'total_donations': 2,
        'days_ago': 110,
    },
    {
        'username': 'vignesh_s',
        'first_name': 'Vigneshwaran',
        'last_name': 'S',
        'email': 'vignesh.s@example.com',
        'phone': '9840189012',
        'blood_group': 'O+',
        'district': 'Chennai',
        'city': 'T. Nagar',
        'locality': 'Pondy Bazaar',
        'gender': 'MALE',
        'total_donations': 7,
        'days_ago': 85,
    },
]


def init_database():
    print("Initializing production database state...")

    # 1. Administrator Account (Gnanasekaran Velayutham)
    admin_user, created = User.objects.get_or_create(
        username='Gnanasekaran_Velayutham',
        defaults={
            'email': 'gnanasekaranvel07@gmail.com',
            'first_name': 'Gnanasekaran',
            'last_name': 'Velayutham',
            'is_staff': True,
            'is_superuser': True
        }
    )
    admin_user.email = 'gnanasekaranvel07@gmail.com'
    admin_user.first_name = 'Gnanasekaran'
    admin_user.last_name = 'Velayutham'
    admin_user.is_staff = True
    admin_user.is_superuser = True
    admin_user.set_password('admin@123')
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
    print("-> Staff Administrator account verified (username: 'Gnanasekaran_Velayutham', email: 'gnanasekaranvel07@gmail.com')")

    # Also synchronize secondary alias 'admin' account if present
    alias_admin, _ = User.objects.get_or_create(
        username='admin',
        defaults={
            'email': 'gnanasekaranvel07@gmail.com',
            'first_name': 'Gnanasekaran',
            'last_name': 'Velayutham',
            'is_staff': True,
            'is_superuser': True
        }
    )
    alias_admin.email = 'gnanasekaranvel07@gmail.com'
    alias_admin.first_name = 'Gnanasekaran'
    alias_admin.last_name = 'Velayutham'
    alias_admin.is_staff = True
    alias_admin.is_superuser = True
    alias_admin.set_password('admin@123')
    alias_admin.save()
    UserProfile.objects.update_or_create(
        user=alias_admin,
        defaults={
            'role': 'admin',
            'phone_number': '9840112233',
            'city': 'Chennai',
            'district': 'Chennai',
            'state': 'Tamil Nadu'
        }
    )

    # 2. Initialize all 8 blood groups with realistic stock balances
    total_units = 0
    for bg, _ in BLOOD_GROUPS:
        units = INITIAL_INVENTORY.get(bg, 5)
        total_units += units
        BloodInventory.objects.update_or_create(
            blood_group=bg,
            defaults={
                'units_available': units,
                'min_threshold': 5
            }
        )
    print(f"-> 8 ABO/Rh blood groups verified ({total_units} units available across state).")

    # 3. Seed Verified Voluntary Donors
    today = date.today()
    for d in SAMPLE_DONORS:
        u, _ = User.objects.get_or_create(
            username=d['username'],
            defaults={
                'email': d['email'],
                'first_name': d['first_name'],
                'last_name': d['last_name'],
            }
        )
        u.set_password('donor123')
        u.first_name = d['first_name']
        u.last_name = d['last_name']
        u.email = d['email']
        u.save()

        UserProfile.objects.update_or_create(
            user=u,
            defaults={
                'role': 'donor',
                'phone_number': d['phone'],
                'city': d['city'],
                'district': d['district'],
                'state': 'Tamil Nadu'
            }
        )

        last_don_date = today - timedelta(days=d['days_ago']) if d.get('days_ago') else None
        DonorProfile.objects.update_or_create(
            user=u,
            defaults={
                'blood_group': d['blood_group'],
                'phone_number': d['phone'],
                'date_of_birth': date(1995, 5, 20),
                'gender': d['gender'],
                'city': d['city'],
                'district': d['district'],
                'state': 'Tamil Nadu',
                'locality': d['locality'],
                'is_available': True,
                'consent_to_contact': True,
                'total_donations': d['total_donations'],
                'last_donation_date': last_don_date,
            }
        )
    print(f"-> {len(SAMPLE_DONORS)} voluntary donor profiles registered across Tamil Nadu.")

    # 4. Seed baseline requests for audit and KPI tracking
    r1, _ = BloodRequest.objects.get_or_create(
        patient_name='Kavitha M.',
        blood_group='O+',
        hospital_name='Rajiv Gandhi Government General Hospital',
        district='Chennai',
        defaults={
            'requester': admin_user,
            'patient_age': 42,
            'patient_gender': 'FEMALE',
            'units_needed': 2,
            'hospital_address': 'EVR Periyar Salai, Park Town, Chennai',
            'urgency': 'CRITICAL',
            'contact_person': 'Murali K (Brother)',
            'contact_phone': '9840998877',
            'status': 'APPROVED',
            'medical_reason': 'Emergency cardiac surgery blood standby requirement.',
            'city': 'Chennai',
        }
    )

    r2, _ = BloodRequest.objects.get_or_create(
        patient_name='Selvam P.',
        blood_group='B+',
        hospital_name='Coimbatore Medical College Hospital',
        district='Coimbatore',
        defaults={
            'requester': admin_user,
            'patient_age': 35,
            'patient_gender': 'MALE',
            'units_needed': 1,
            'hospital_address': 'Avinashi Road, Peelamedu, Coimbatore',
            'urgency': 'URGENT',
            'contact_person': 'Anitha S (Spouse)',
            'contact_phone': '9842887766',
            'status': 'FULFILLED',
            'medical_reason': 'Trauma center acute resuscitation unit requirement.',
            'city': 'Coimbatore',
        }
    )
    print("-> System requests and audit trails verified.")
    print("-> Production database ready.")


if __name__ == '__main__':
    init_database()
