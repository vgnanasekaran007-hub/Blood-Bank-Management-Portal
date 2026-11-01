"""
Comprehensive Database Seed Script
Populates realistic initial data for demonstration:
- Admin account
- Sample donors across all 8 blood groups and major districts
- Realistic initial stock for all 8 blood groups
- Sample requesters and requests across all lifecycle stages
- Donation records and audit history
"""

import os
import sys
import django
from datetime import date, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bloodportal.settings')
django.setup()

from django.contrib.auth.models import User
from bloodbank.models import (
    UserProfile, DonorProfile, BloodInventory, DonationRecord,
    BloodRequest, InventoryTransaction, AuditLog,
    BLOOD_GROUPS
)


def seed_database():
    print("Beginning database seeding for Blood Bank Portal...")

    # 1. Create or update Administrator
    admin_user, created = User.objects.get_or_create(
        username='admin',
        defaults={
            'email': 'admin@bloodbank.org',
            'first_name': 'Dr. Arumugam',
            'last_name': 'Saminathan',
            'is_staff': True,
            'is_superuser': True
        }
    )
    admin_user.set_password('admin123')
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
    print("-> Admin account created: username 'admin' (password: admin123)")

    # 2. Seed Initial Blood Inventory for all 8 Blood Groups
    inventory_defaults = {
        'A+': 18,
        'A-': 6,
        'B+': 24,
        'B-': 4,   # Low Stock alert
        'AB+': 11,
        'AB-': 2,  # Critical Alert
        'O+': 32,
        'O-': 3,   # Critical Alert
    }

    for bg, default_units in inventory_defaults.items():
        inv, _ = BloodInventory.objects.update_or_create(
            blood_group=bg,
            defaults={
                'units_available': default_units,
                'min_threshold': 5
            }
        )
    print("-> Blood inventory seeded for all 8 blood groups.")

    # 3. Create Sample Requesters
    requesters_data = [
        ('requester1', 'req123', 'Muthu', 'Kumar', 'muthu.k@gmail.com', '9841234567', 'Chennai', 'Chennai'),
        ('requester2', 'req123', 'Kavitha', 'Ramesh', 'kavitha.r@gmail.com', '9841876543', 'Madurai', 'Madurai'),
    ]

    requester_users = []
    for uname, pwd, fn, ln, email, phone, city, district in requesters_data:
        req_u, _ = User.objects.get_or_create(
            username=uname,
            defaults={'email': email, 'first_name': fn, 'last_name': ln}
        )
        req_u.set_password(pwd)
        req_u.save()

        UserProfile.objects.update_or_create(
            user=req_u,
            defaults={'role': 'requester', 'phone_number': phone, 'city': city, 'district': district}
        )
        requester_users.append(req_u)
    print(f"-> Created {len(requester_users)} sample requester accounts.")

    # 4. Create Sample Donors across ABO/Rh groups and districts
    donors_dataset = [
        ('karthik_o_pos', 'donor123', 'Karthik', 'Raman', 'karthik.r@email.com', 'O+', '9840551122', 'Chennai', 'Chennai', 'Anna Nagar', 4, date(2026, 7, 10)),
        ('priya_a_pos', 'donor123', 'Priya', 'Sundaram', 'priya.s@email.com', 'A+', '9840662233', 'Chennai', 'Chennai', 'Adyar', 2, date(2026, 6, 15)),
        ('rajesh_b_pos', 'donor123', 'Rajesh', 'Kannan', 'rajesh.k@email.com', 'B+', '9840773344', 'Coimbatore', 'Coimbatore', 'Gandhipuram', 6, date(2026, 5, 20)),
        ('ananya_ab_pos', 'donor123', 'Ananya', 'Iyer', 'ananya.i@email.com', 'AB+', '9840884455', 'Madurai', 'Madurai', 'KK Nagar', 1, date(2026, 8, 1)),
        ('vikram_o_neg', 'donor123', 'Vikram', 'Chandran', 'vikram.c@email.com', 'O-', '9840995566', 'Tiruchirappalli', 'Tiruchirappalli', 'Thillai Nagar', 5, date(2026, 4, 18)),
        ('deepa_b_neg', 'donor123', 'Deepa', 'Murugan', 'deepa.m@email.com', 'B-', '9840116677', 'Salem', 'Salem', 'Fairlands', 3, date(2026, 7, 28)),
        ('suresh_a_neg', 'donor123', 'Suresh', 'Balan', 'suresh.b@email.com', 'A-', '9840227788', 'Tirunelveli', 'Tirunelveli', 'Palayamkottai', 2, date(2026, 8, 14)),
        ('sneha_ab_neg', 'donor123', 'Sneha', 'Venkatesh', 'sneha.v@email.com', 'AB-', '9840338899', 'Chennai', 'Chennai', 'T. Nagar', 3, date(2026, 6, 30)),
    ]

    created_donors = []
    for uname, pwd, fn, ln, email, bg, phone, city, dist, locality, total_don, last_dt in donors_dataset:
        donor_u, _ = User.objects.get_or_create(
            username=uname,
            defaults={'email': email, 'first_name': fn, 'last_name': ln}
        )
        donor_u.set_password(pwd)
        donor_u.save()

        UserProfile.objects.update_or_create(
            user=donor_u,
            defaults={'role': 'donor', 'phone_number': phone, 'city': city, 'district': dist}
        )

        donor_p, _ = DonorProfile.objects.update_or_create(
            user=donor_u,
            defaults={
                'blood_group': bg,
                'phone_number': phone,
                'city': city,
                'district': dist,
                'locality': locality,
                'pincode': '600001',
                'is_available': True,
                'consent_to_contact': True,
                'total_donations': total_don,
                'last_donation_date': last_dt
            }
        )
        created_donors.append(donor_p)
    print(f"-> Created {len(created_donors)} verified donors with full profiles.")

    # 5. Create Donation Records (Pending and Verified)
    # Verified donation:
    first_donor = created_donors[0]
    rec1, _ = DonationRecord.objects.get_or_create(
        donor=first_donor,
        hospital_or_camp="Apollo Hospitals Blood Donation Camp",
        defaults={
            'blood_group': first_donor.blood_group,
            'units': 1,
            'donation_date': date(2026, 7, 10),
            'status': 'VERIFIED',
            'verified_by': admin_user
        }
    )

    # Pending donation (ready for interactive verification demo)
    second_donor = created_donors[1]
    rec2, _ = DonationRecord.objects.get_or_create(
        donor=second_donor,
        hospital_or_camp="Government Stanley Medical College Blood Bank",
        defaults={
            'blood_group': second_donor.blood_group,
            'units': 1,
            'donation_date': date.today() - timedelta(days=2),
            'status': 'PENDING',
            'notes': 'Voluntary donor walk-in donation; hemoglobin: 13.8 g/dL.'
        }
    )
    print("-> Donation records created (Verified & Pending for verification demo).")

    # 6. Create Blood Requests across the lifecycle
    sample_requests = [
        {
            'requester': requester_users[0],
            'patient_name': 'R. Meenakshi',
            'patient_age': 46,
            'patient_gender': 'FEMALE',
            'blood_group': 'O+',
            'units_needed': 2,
            'hospital_name': 'Apollo Speciality Hospital, Greams Road',
            'hospital_address': 'Greams Road, Thousand Lights, Chennai',
            'city': 'Chennai',
            'district': 'Chennai',
            'contact_person': 'Muthu Kumar (Son)',
            'contact_phone': '9841234567',
            'urgency': 'CRITICAL',
            'medical_reason': 'Emergency Cardiac Bypass Surgery',
            'required_by_date': date.today(),
            'status': 'SUBMITTED',
            'admin_remarks': ''
        },
        {
            'requester': requester_users[1],
            'patient_name': 'V. Senthil Nathan',
            'patient_age': 32,
            'patient_gender': 'MALE',
            'blood_group': 'B+',
            'units_needed': 1,
            'hospital_name': 'Government Rajaji Hospital',
            'hospital_address': 'Panagal Road, Madurai',
            'city': 'Madurai',
            'district': 'Madurai',
            'contact_person': 'Kavitha Ramesh (Wife)',
            'contact_phone': '9841876543',
            'urgency': 'URGENT',
            'medical_reason': 'Accidental Trauma & Orthopedic Surgery',
            'required_by_date': date.today() + timedelta(days=1),
            'status': 'UNDER_REVIEW',
            'admin_remarks': 'Contacted blood bank coordinator for cross-matching.'
        },
        {
            'requester': requester_users[0],
            'patient_name': 'K. Gomathi',
            'patient_age': 28,
            'patient_gender': 'FEMALE',
            'blood_group': 'A-',
            'units_needed': 1,
            'hospital_name': 'MIOT International',
            'hospital_address': '4/112 Mount Poonamallee Road, Manapakkam, Chennai',
            'city': 'Chennai',
            'district': 'Chennai',
            'contact_person': 'Muthu Kumar',
            'contact_phone': '9841234567',
            'urgency': 'NORMAL',
            'medical_reason': 'Elective Gynecological Procedure',
            'required_by_date': date.today() + timedelta(days=3),
            'status': 'APPROVED',
            'admin_remarks': 'Approved by Blood Bank Medical Officer. Units reserved.'
        },
        {
            'requester': requester_users[1],
            'patient_name': 'A. Mohammed Iqbal',
            'patient_age': 54,
            'patient_gender': 'MALE',
            'blood_group': 'O+',
            'units_needed': 2,
            'hospital_name': 'Meenakshi Mission Hospital',
            'hospital_address': 'Melur Road, Madurai',
            'city': 'Madurai',
            'district': 'Madurai',
            'contact_person': 'Farook (Brother)',
            'contact_phone': '9841999888',
            'urgency': 'CRITICAL',
            'medical_reason': 'Gastrointestinal Bleeding Emergency',
            'required_by_date': date.today() - timedelta(days=2),
            'status': 'FULFILLED',
            'admin_remarks': 'Issued 2 units O+ whole blood units #BB-891 and #BB-892.'
        }
    ]

    for req_data in sample_requests:
        BloodRequest.objects.get_or_create(
            patient_name=req_data['patient_name'],
            hospital_name=req_data['hospital_name'],
            defaults=req_data
        )
    print("-> Blood requests created covering SUBMITTED, UNDER_REVIEW, APPROVED, and FULFILLED.")

    # 7. Record initial audit log entries
    AuditLog.objects.create(
        user=admin_user,
        action="SYSTEM_INIT",
        entity_type="System",
        entity_id="1",
        details={"event": "Blood Bank Portal initialized with standard ABO/Rh inventory."}
    )
    print("-> System audit log entries created.")
    print("\nSeeding completed successfully! System is ready for demonstration.")


if __name__ == '__main__':
    seed_database()
