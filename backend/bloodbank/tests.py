from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import date, timedelta
from bloodbank.models import (
    UserProfile, DonorProfile, BloodInventory, DonationRecord,
    BloodRequest, InventoryTransaction, AuditLog
)

class BloodPortalModuleTests(TestCase):
    def setUp(self):
        self.client = Client()

        # Seed all 8 blood groups
        for bg in ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']:
            BloodInventory.objects.create(blood_group=bg, units_available=10, min_threshold=5)

        # Create Admin
        self.admin_user = User.objects.create_superuser('admin', 'admin@test.com', 'admin123')
        UserProfile.objects.create(user=self.admin_user, role='admin', phone_number='9840112233', district='Chennai')

        # Create Donor
        self.donor_user = User.objects.create_user('donor1', 'donor1@test.com', 'pass123', first_name='Ravi', last_name='Varma')
        UserProfile.objects.create(user=self.donor_user, role='donor', phone_number='9840998877', district='Chennai')
        self.donor_profile = DonorProfile.objects.create(
            user=self.donor_user,
            blood_group='O+',
            phone_number='9840998877',
            city='Chennai',
            district='Chennai',
            is_available=True,
            consent_to_contact=True,
            locality='Anna Nagar',
            last_donation_date=date.today() - timedelta(days=100)
        )

        # Create Requester
        self.req_user = User.objects.create_user('requester1', 'req1@test.com', 'pass123', first_name='Sita', last_name='Devi')
        UserProfile.objects.create(user=self.req_user, role='requester', phone_number='9840776655', district='Chennai')

    def test_health_check(self):
        res = self.client.get('/api/health/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['status'], 'healthy')

    def test_uptimerobot_health_check(self):
        # Verify /health/ returns HTTP 200 with the exact required JSON payload
        res = self.client.get('/health/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {
            "status": "ok",
            "message": "Blood Bank Backend is running"
        })

    def test_uptimerobot_health_check_no_trailing_slash(self):
        # Verify /health without trailing slash also succeeds
        res = self.client.get('/health')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {
            "status": "ok",
            "message": "Blood Bank Backend is running"
        })

    def test_module_1_donor_registration_and_profile(self):
        # Test public registration of a donor
        res = self.client.post('/api/auth/register/', {
            'username': 'new_donor',
            'email': 'new_donor@test.com',
            'password': 'password123',
            'full_name': 'Anand Kumar',
            'role': 'donor',
            'phone_number': '9840123456',
            'blood_group': 'B+',
            'city': 'Coimbatore',
            'district': 'Coimbatore'
        }, content_type='application/json')
        self.assertEqual(res.status_code, 201)
        self.assertTrue(DonorProfile.objects.filter(user__username='new_donor').exists())

        # Test donor profile availability toggle
        self.client.login(username='new_donor', password='password123')
        update_res = self.client.patch('/api/donors/profile/', {
            'is_available': False
        }, content_type='application/json')
        self.assertEqual(update_res.status_code, 200)
        profile = DonorProfile.objects.get(user__username='new_donor')
        self.assertFalse(profile.is_available)

    def test_module_2_blood_search_privacy(self):
        # Search returns matching donor with masked privacy info
        res = self.client.get('/api/search/?blood_group=O%2B&district=Chennai')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(data['count'], 1)
        donor = data['donors'][0]
        self.assertIn('donor_code', donor)
        # Verify phone number and exact address are NOT present
        self.assertNotIn('phone_number', donor)
        self.assertNotIn('address', donor)
        self.assertNotIn('email', donor)

    def test_module_3_donation_record_and_verification_increases_stock(self):
        # Donor logs a donation record
        self.client.login(username='donor1', password='pass123')
        res = self.client.post('/api/donations/', {
            'blood_group': 'O+',
            'units': 2,
            'donation_date': str(date.today()),
            'hospital_or_camp': 'Stanley Medical College',
            'notes': 'Regular voluntary donation'
        }, content_type='application/json')
        self.assertEqual(res.status_code, 201)
        donation_id = res.json()['id']

        # Verify stock has NOT increased while donation is pending
        o_pos_stock = BloodInventory.objects.get(blood_group='O+').units_available
        self.assertEqual(o_pos_stock, 10)

        # Admin logs in and verifies the donation
        self.client.login(username='admin', password='admin123')
        verify_res = self.client.post(f'/api/donations/{donation_id}/verify/', {
            'status': 'VERIFIED',
            'notes': 'Hemoglobin confirmed normal at 14.2 g/dL'
        }, content_type='application/json')
        self.assertEqual(verify_res.status_code, 200)

        # Verify stock HAS increased by exactly 2 units transactionally
        o_pos_stock_after = BloodInventory.objects.get(blood_group='O+').units_available
        self.assertEqual(o_pos_stock_after, 12)
        # Verify audit log & inventory transaction exists
        self.assertTrue(InventoryTransaction.objects.filter(reference_donation_id=donation_id, transaction_type='DONATION_ADD').exists())

    def test_module_4_blood_inventory_endpoint(self):
        res = self.client.get('/api/inventory/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data['inventory']), 8)
        self.assertGreaterEqual(data['total_units'], 80)

    def test_module_5_blood_request_lifecycle_and_fulfillment_reduces_stock(self):
        # Requester submits request
        self.client.login(username='requester1', password='pass123')
        req_res = self.client.post('/api/requests/', {
            'patient_name': 'K. Sundaram',
            'patient_age': 52,
            'patient_gender': 'MALE',
            'blood_group': 'A+',
            'units_needed': 3,
            'hospital_name': 'Apollo Hospital',
            'hospital_address': 'Greams Road, Chennai',
            'city': 'Chennai',
            'district': 'Chennai',
            'contact_person': 'Sita Devi',
            'contact_phone': '9840776655',
            'urgency': 'CRITICAL',
            'required_by_date': str(date.today()),
            'medical_reason': 'Emergency Cardiac Surgery'
        }, content_type='application/json')
        self.assertEqual(req_res.status_code, 201)
        req_id = req_res.json()['id']

        # Check stock before approval: should NOT be reduced simply by submitting
        a_pos_stock = BloodInventory.objects.get(blood_group='A+').units_available
        self.assertEqual(a_pos_stock, 10)

        # Admin approves the request
        self.client.login(username='admin', password='admin123')
        appr_res = self.client.post(f'/api/requests/{req_id}/update_status/', {
            'status': 'APPROVED',
            'admin_remarks': 'Blood cross-match confirmed.'
        }, content_type='application/json')
        self.assertEqual(appr_res.status_code, 200)

        # Admin fulfills the request -> ATOMIC DECREMENT
        fulfill_res = self.client.post(f'/api/requests/{req_id}/update_status/', {
            'status': 'FULFILLED',
            'admin_remarks': '3 units of A+ blood dispatched with transport seal.'
        }, content_type='application/json')
        self.assertEqual(fulfill_res.status_code, 200)

        # Verify inventory has decreased from 10 to 7
        a_pos_stock_after = BloodInventory.objects.get(blood_group='A+').units_available
        self.assertEqual(a_pos_stock_after, 7)

    def test_negative_stock_prevention(self):
        # Attempt to fulfill request demanding more units than available
        self.client.login(username='admin', password='admin123')
        req = BloodRequest.objects.create(
            requester=self.req_user,
            patient_name='High Demand Patient',
            patient_age=40,
            blood_group='AB-',  # has only 10 units
            units_needed=20,     # more than 10
            hospital_name='Emergency Care',
            hospital_address='Chennai',
            city='Chennai',
            district='Chennai',
            contact_person='Contact',
            contact_phone='9840776655',
            required_by_date=date.today(),
            status='APPROVED'
        )

        res = self.client.post(f'/api/requests/{req.id}/update_status/', {
            'status': 'FULFILLED'
        }, content_type='application/json')

        self.assertEqual(res.status_code, 400)
        self.assertIn('Insufficient blood units', res.json()['error'])
        # Verify stock did not go negative
        inv = BloodInventory.objects.get(blood_group='AB-')
        self.assertEqual(inv.units_available, 10)

    def test_bearer_token_logout_revokes_session(self):
        # Log in to obtain a session bearer token
        login_res = self.client.post('/api/auth/login/', {
            'username': 'admin',
            'password': 'admin123'
        }, content_type='application/json')
        self.assertEqual(login_res.status_code, 200)
        token = login_res.json().get('token')
        self.assertTrue(token)

        # Fresh client simulating cross-origin Vercel browser carrying only Bearer header
        bearer_client = Client()
        me_before = bearer_client.get('/api/auth/me/', HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(me_before.status_code, 200)
        self.assertTrue(me_before.json()['authenticated'])

        # Logout via Bearer token must revoke DB session and return 200
        logout_res = bearer_client.post('/api/auth/logout/', content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(logout_res.status_code, 200)

        # Subsequent /auth/me/ with revoked Bearer token must report unauthenticated
        me_after = bearer_client.get('/api/auth/me/', HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(me_after.status_code, 200)
        self.assertFalse(me_after.json()['authenticated'])

    def test_guest_emergency_request_with_blank_optional_fields(self):
        res = self.client.post('/api/requests/', {
            'patient_name': 'Emergency Patient',
            'patient_age': 44,
            'patient_gender': 'FEMALE',
            'blood_group': 'O+',
            'units_needed': 1,
            'hospital_name': 'Govt General Hospital',
            'hospital_address': '',
            'city': '',
            'district': 'Chennai',
            'contact_person': 'Arun Kumar',
            'contact_phone': '9840554433',
            'urgency': 'CRITICAL',
            'medical_reason': '',
            'required_by_date': str(date.today())
        }, content_type='application/json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()['patient_name'], 'Emergency Patient')

    def test_checksheet_registration_persists_donation_date_and_validates(self):
        past_date = str(date.today() - timedelta(days=120))
        res = self.client.post('/api/auth/register/', {
            'username': 'ChecksheetDonor',
            'email': 'CHECKSHEET@TEST.COM',
            'password': 'password123',
            'full_name': 'Lakshmi Narayanan',
            'role': 'donor',
            'phone_number': '9840332211',
            'blood_group': 'B-',
            'district': 'Madurai',
            'city': 'KK Nagar',
            'last_donation_date': past_date,
            'is_available': False,
        }, content_type='application/json')
        self.assertEqual(res.status_code, 201)
        profile = DonorProfile.objects.get(user__username='ChecksheetDonor')
        self.assertEqual(str(profile.last_donation_date), past_date)
        self.assertFalse(profile.is_available)

        # Future last_donation_date must be rejected with 400
        future_res = self.client.post('/api/auth/register/', {
            'username': 'future_donor',
            'email': 'future@test.com',
            'password': 'password123',
            'full_name': 'Future Date',
            'role': 'donor',
            'phone_number': '9840332200',
            'blood_group': 'O+',
            'district': 'Chennai',
            'last_donation_date': str(date.today() + timedelta(days=5)),
        }, content_type='application/json')
        self.assertEqual(future_res.status_code, 400)

        # Case-insensitive email & username duplicate must be rejected
        dup_res = self.client.post('/api/auth/register/', {
            'username': 'checksheetdonor',
            'email': 'checksheet@test.com',
            'password': 'password123',
            'full_name': 'Duplicate User',
            'role': 'donor',
            'phone_number': '9840332299',
            'blood_group': 'B-',
            'district': 'Madurai',
        }, content_type='application/json')
        self.assertEqual(dup_res.status_code, 400)

        # PATCH profile with empty last_donation_date clears it cleanly
        self.client.login(username='ChecksheetDonor', password='password123')
        patch_res = self.client.patch('/api/donors/profile/', {
            'last_donation_date': ''
        }, content_type='application/json')
        self.assertEqual(patch_res.status_code, 200)
        profile.refresh_from_db()
        self.assertIsNone(profile.last_donation_date)
