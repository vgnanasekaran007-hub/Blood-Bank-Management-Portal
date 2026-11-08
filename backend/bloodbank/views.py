from rest_framework import status, views, viewsets
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db import transaction, connection
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db.models import Sum, Q, Count
import uuid

from .models import (
    UserProfile, DonorProfile, BloodInventory, DonationRecord,
    BloodRequest, InventoryTransaction, AuditLog,
    BLOOD_GROUPS, BLOOD_GROUP_CHOICES_LIST, TAMIL_NADU_DISTRICTS
)
from .serializers import (
    UserSerializer, RegisterSerializer, DonorProfileSerializer,
    PublicDonorSearchSerializer, DonationRecordSerializer, DonationCreateSerializer,
    DonationVerificationSerializer, BloodInventorySerializer,
    InventoryTransactionSerializer, BloodRequestSerializer,
    BloodRequestCreateSerializer, BloodRequestStatusUpdateSerializer,
    AuditLogSerializer
)
from .permissions import IsAdminUserOrStaff, IsDonor, IsOwnerOrAdmin, check_is_admin


def log_audit(user, action_name, entity_type, entity_id, details=None, request=None):
    ip = None
    if request:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
    AuditLog.objects.create(
        user=user if user and user.is_authenticated else None,
        action=action_name,
        entity_type=entity_type,
        entity_id=str(entity_id),
        details=details or {},
        ip_address=ip
    )


# ==========================================
# AUTHENTICATION VIEWS
# ==========================================

class RegisterView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"error": "Validation failed", "details": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        try:
            with transaction.atomic():
                names = data['full_name'].split(None, 1)
                first_name = names[0]
                last_name = names[1] if len(names) > 1 else ''

                user = User.objects.create_user(
                    username=data['username'],
                    email=data['email'],
                    password=data['password'],
                    first_name=first_name,
                    last_name=last_name
                )

                role = data.get('role', 'requester')
                # Prevent self-assigning admin role through public registration
                if role == 'admin' and not (request.user and check_is_admin(request.user)):
                    role = 'requester'

                profile = UserProfile.objects.create(
                    user=user,
                    role=role,
                    phone_number=data['phone_number'],
                    city=data.get('city', ''),
                    district=data.get('district', ''),
                    state=data.get('state', 'Tamil Nadu')
                )

                if role == 'donor':
                    DonorProfile.objects.create(
                        user=user,
                        blood_group=data['blood_group'],
                        phone_number=data['phone_number'],
                        date_of_birth=data.get('date_of_birth'),
                        gender=data.get('gender', 'MALE'),
                        city=data.get('city', ''),
                        district=data.get('district', ''),
                        state=data.get('state', 'Tamil Nadu'),
                        pincode=data.get('pincode', ''),
                        locality=data.get('locality', '') or data.get('city', ''),
                        is_available=True,
                        consent_to_contact=True
                    )

                log_audit(user, "USER_REGISTERED", "User", user.id, {"role": role, "username": user.username}, request)

            # Auto login the registered user in session
            login(request, user)
            if not request.session.session_key:
                request.session.save()
            token = request.session.session_key

            user_data = UserSerializer(user).data
            donor_profile_data = None
            if hasattr(user, 'donor_profile'):
                donor_profile_data = DonorProfileSerializer(user.donor_profile).data

            return Response({
                "message": "Registration successful",
                "token": token,
                "user": user_data,
                "donor_profile": donor_profile_data
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": f"Registration failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LoginView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response({"error": "Both username and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(request, username=username, password=password)
        if user is None:
            raw_input = (username or '').strip()
            # 1. Match by email (e.g. gnanasekaranvel07@gmail.com)
            user_obj = User.objects.filter(email__iexact=raw_input).first()
            # 2. Match by full name with space (e.g. "Gnanasekaran Velayutham")
            if not user_obj and ' ' in raw_input:
                parts = raw_input.split(None, 1)
                user_obj = User.objects.filter(first_name__iexact=parts[0], last_name__iexact=parts[1]).first()
            # 3. Match by normalized username (e.g. "Gnanasekaran_Velayutham")
            if not user_obj:
                norm = raw_input.replace(' ', '_')
                user_obj = User.objects.filter(username__iexact=norm).first()
            if not user_obj:
                user_obj = User.objects.filter(username__iexact=raw_input).first()

            if user_obj:
                user = authenticate(request, username=user_obj.username, password=password)

        if user is not None:
            if not user.is_active:
                return Response({"error": "Account is deactivated. Please contact blood bank staff."}, status=status.HTTP_403_FORBIDDEN)

            login(request, user)
            if not request.session.session_key:
                request.session.save()
            token = request.session.session_key

            donor_profile_data = None
            if hasattr(user, 'donor_profile'):
                donor_profile_data = DonorProfileSerializer(user.donor_profile).data

            log_audit(user, "USER_LOGIN", "User", user.id, {"username": user.username}, request)
            return Response({
                "message": "Login successful",
                "token": token,
                "user": UserSerializer(user).data,
                "donor_profile": donor_profile_data
            }, status=status.HTTP_200_OK)
        else:
            return Response({"error": "Invalid username or password."}, status=status.HTTP_401_UNAUTHORIZED)


class LogoutView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        if request.user and request.user.is_authenticated:
            user = request.user
            log_audit(user, "USER_LOGOUT", "User", user.id, {}, request)
            logout(request)
        return Response({"message": "Logged out successfully."}, status=status.HTTP_200_OK)


class CurrentUserView(views.APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"authenticated": False, "user": None})

        user_data = UserSerializer(request.user).data
        donor_profile_data = None
        if hasattr(request.user, 'donor_profile'):
            donor_profile_data = DonorProfileSerializer(request.user.donor_profile).data

        return Response({
            "authenticated": True,
            "user": user_data,
            "donor_profile": donor_profile_data,
            "is_admin": check_is_admin(request.user)
        })


# ==========================================
# MODULE 1: DONOR REGISTRATION & PROFILE
# ==========================================

class DonorProfileView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        donor_id = request.query_params.get('donor_id')
        if donor_id and check_is_admin(request.user):
            profile = get_object_or_404(DonorProfile, id=donor_id)
        else:
            try:
                profile = request.user.donor_profile
            except DonorProfile.DoesNotExist:
                return Response({"error": "No donor profile found for the current user."}, status=status.HTTP_404_NOT_FOUND)

        serializer = DonorProfileSerializer(profile)
        return Response(serializer.data)

    def put(self, request):
        return self.patch(request)

    def patch(self, request):
        donor_id = request.data.get('donor_id')
        if donor_id and check_is_admin(request.user):
            profile = get_object_or_404(DonorProfile, id=donor_id)
        else:
            try:
                profile = request.user.donor_profile
            except DonorProfile.DoesNotExist:
                return Response({"error": "No donor profile found for the current user."}, status=status.HTTP_404_NOT_FOUND)

        allowed_fields = [
            'blood_group', 'phone_number', 'alternate_phone', 'city',
            'district', 'state', 'pincode', 'locality', 'is_available',
            'last_donation_date', 'consent_to_contact', 'notes'
        ]

        update_data = {k: v for k, v in request.data.items() if k in allowed_fields}

        # Only admins can edit administrative notes
        if 'notes' in update_data and not check_is_admin(request.user):
            del update_data['notes']

        serializer = DonorProfileSerializer(profile, data=update_data, partial=True)
        if serializer.is_valid():
            serializer.save()
            if 'phone_number' in update_data and hasattr(profile.user, 'profile'):
                profile.user.profile.phone_number = update_data['phone_number']
                profile.user.profile.save()
            log_audit(request.user, "DONOR_PROFILE_UPDATED", "DonorProfile", profile.id, update_data, request)
            return Response({
                "message": "Donor profile updated successfully",
                "profile": serializer.data
            })
        return Response({"error": "Invalid profile data", "details": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


class DonorAdminListView(views.APIView):
    permission_classes = [IsAdminUserOrStaff]

    def get(self, request):
        queryset = DonorProfile.objects.select_related('user').all()

        blood_group = request.query_params.get('blood_group')
        district = request.query_params.get('district')
        available = request.query_params.get('is_available')
        search = request.query_params.get('search')

        if blood_group:
            queryset = queryset.filter(blood_group=blood_group)
        if district:
            queryset = queryset.filter(district__icontains=district)
        if available is not None:
            is_avail = available.lower() in ('true', '1')
            queryset = queryset.filter(is_available=is_avail)
        if search:
            queryset = queryset.filter(
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search) |
                Q(user__username__icontains=search) |
                Q(phone_number__icontains=search) |
                Q(city__icontains=search)
            )

        serializer = DonorProfileSerializer(queryset, many=True)
        return Response({
            "count": queryset.count(),
            "donors": serializer.data
        })


# ==========================================
# MODULE 2: BLOOD GROUP SEARCH & DISCOVERY
# ==========================================

class BloodGroupSearchView(views.APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        blood_group = request.query_params.get('blood_group')
        district = request.query_params.get('district')
        city = request.query_params.get('city')

        # Base filter: Only available donors who consented to contact
        queryset = DonorProfile.objects.filter(is_available=True, consent_to_contact=True).select_related('user')

        if blood_group and blood_group in BLOOD_GROUP_CHOICES_LIST:
            queryset = queryset.filter(blood_group=blood_group)

        if district:
            queryset = queryset.filter(district__icontains=district.strip())

        if city:
            queryset = queryset.filter(city__icontains=city.strip())

        # Retrieve live stock from Supabase/DB for comparison
        stock_summary = {}
        if blood_group:
            inv = BloodInventory.objects.filter(blood_group=blood_group).first()
            if inv:
                stock_summary = {
                    "blood_group": inv.blood_group,
                    "units_available": inv.units_available,
                    "status": inv.status
                }
        else:
            stock_summary = {
                inv.blood_group: {"units": inv.units_available, "status": inv.status}
                for inv in BloodInventory.objects.all()
            }

        serializer = PublicDonorSearchSerializer(queryset, many=True)
        results = serializer.data

        # Helpful guidance when no matches found
        suggestion = None
        if len(results) == 0:
            if district and blood_group:
                wider_count = DonorProfile.objects.filter(blood_group=blood_group, is_available=True).count()
                suggestion = (
                    f"No active {blood_group} donors currently found in '{district}'. "
                    f"There are {wider_count} matching donors statewide. "
                    "You may submit an Emergency Blood Request, or expand your search to adjacent districts."
                )
            else:
                suggestion = "No active donors found matching the selected criteria. Try selecting another blood group or district."

        return Response({
            "filters_applied": {
                "blood_group": blood_group,
                "district": district,
                "city": city
            },
            "count": len(results),
            "blood_stock": stock_summary,
            "donors": results,
            "suggestion": suggestion
        })


class DistrictsListView(views.APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            "state": "Tamil Nadu",
            "count": len(TAMIL_NADU_DISTRICTS),
            "districts": TAMIL_NADU_DISTRICTS
        })


# ==========================================
# MODULE 3: DONATION RECORDS
# ==========================================

class DonationRecordViewSet(viewsets.ModelViewSet):
    serializer_class = DonationRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if check_is_admin(user):
            qs = DonationRecord.objects.select_related('donor', 'donor__user', 'verified_by').all()
            status_param = self.request.query_params.get('status')
            blood_group = self.request.query_params.get('blood_group')
            if status_param:
                qs = qs.filter(status=status_param)
            if blood_group:
                qs = qs.filter(blood_group=blood_group)
            return qs

        # Regular donors see only their own donation records
        if hasattr(user, 'donor_profile'):
            return DonationRecord.objects.filter(donor=user.donor_profile).select_related('donor', 'donor__user', 'verified_by')
        return DonationRecord.objects.none()

    def create(self, request, *args, **kwargs):
        donor_id = request.data.get('donor_id')
        if check_is_admin(request.user) and donor_id:
            donor = get_object_or_404(DonorProfile, id=donor_id)
        elif hasattr(request.user, 'donor_profile'):
            donor = request.user.donor_profile
        else:
            return Response({"error": "Only registered donors or blood bank staff can log donation records."}, status=status.HTTP_403_FORBIDDEN)

        serializer = DonationCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"error": "Validation failed", "details": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        record = DonationRecord.objects.create(
            donor=donor,
            blood_group=serializer.validated_data['blood_group'],
            units=serializer.validated_data.get('units', 1),
            donation_date=serializer.validated_data.get('donation_date', timezone.now().date()),
            hospital_or_camp=serializer.validated_data['hospital_or_camp'],
            status='PENDING',  # CRITICAL: Always PENDING on creation; stock increases ONLY upon admin verification
            notes=serializer.validated_data.get('notes', '')
        )

        log_audit(request.user, "DONATION_RECORDED", "DonationRecord", record.id, {
            "donor": donor.user.username,
            "blood_group": record.blood_group,
            "units": record.units
        }, request)

        return Response(DonationRecordSerializer(record).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUserOrStaff])
    def verify(self, request, pk=None):
        donation = self.get_object()
        serializer = DonationVerificationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"error": "Invalid verification input", "details": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        new_status = serializer.validated_data['status']
        rejection_reason = serializer.validated_data.get('rejection_reason', '')
        admin_notes = serializer.validated_data.get('notes', '')

        if donation.status == 'VERIFIED':
            return Response({"error": "This donation record has already been verified and added to inventory."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                if new_status == 'VERIFIED':
                    # Safe atomic increment using select_for_update
                    inventory, _ = BloodInventory.objects.select_for_update().get_or_create(
                        blood_group=donation.blood_group,
                        defaults={'units_available': 0}
                    )

                    stock_before = inventory.units_available
                    inventory.units_available += donation.units
                    inventory.save()

                    donation.status = 'VERIFIED'
                    donation.verified_by = request.user
                    donation.verified_at = timezone.now()
                    if admin_notes:
                        donation.notes = (donation.notes + " | " + admin_notes).strip(" | ")
                    donation.save()

                    # Record transaction audit
                    InventoryTransaction.objects.create(
                        blood_group=donation.blood_group,
                        transaction_type='DONATION_ADD',
                        units=donation.units,
                        stock_before=stock_before,
                        stock_after=inventory.units_available,
                        reference_donation=donation,
                        performed_by=request.user,
                        remarks=f"Stock addition from verified donation #{donation.id} by {donation.donor.user.get_full_name() or donation.donor.user.username}"
                    )

                    # Update donor profile
                    donor = donation.donor
                    donor.last_donation_date = donation.donation_date
                    donor.total_donations += 1
                    donor.save()

                    log_audit(request.user, "DONATION_VERIFIED", "DonationRecord", donation.id, {
                        "units_added": donation.units,
                        "new_inventory": inventory.units_available
                    }, request)

                elif new_status == 'REJECTED':
                    donation.status = 'REJECTED'
                    donation.verified_by = request.user
                    donation.verified_at = timezone.now()
                    donation.rejection_reason = rejection_reason
                    if admin_notes:
                        donation.notes = (donation.notes + " | " + admin_notes).strip(" | ")
                    donation.save()

                    log_audit(request.user, "DONATION_REJECTED", "DonationRecord", donation.id, {
                        "reason": rejection_reason
                    }, request)

            return Response({
                "message": f"Donation record {new_status.lower()} successfully",
                "record": DonationRecordSerializer(donation).data
            })

        except Exception as e:
            return Response({"error": f"Failed to process donation verification: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ==========================================
# MODULE 4: BLOOD INVENTORY
# ==========================================

class BloodInventoryView(views.APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        # Guarantee all 8 blood groups exist in DB
        for bg, _ in BLOOD_GROUPS:
            BloodInventory.objects.get_or_create(blood_group=bg, defaults={'units_available': 0})

        inventory = BloodInventory.objects.all().order_by('blood_group')
        total_units = inventory.aggregate(total=Sum('units_available'))['total'] or 0
        critical_groups = [inv.blood_group for inv in inventory if inv.status in ('LOW_STOCK', 'OUT_OF_STOCK')]
        total_donors = DonorProfile.objects.count()
        fulfilled_requests = BloodRequest.objects.filter(status='FULFILLED').count()

        return Response({
            "total_units": total_units,
            "total_donors": total_donors,
            "fulfilled_requests": fulfilled_requests,
            "critical_groups": critical_groups,
            "inventory": BloodInventorySerializer(inventory, many=True).data
        })


class InventoryTransactionListView(views.APIView):
    permission_classes = [IsAdminUserOrStaff]

    def get(self, request):
        transactions = InventoryTransaction.objects.select_related('performed_by', 'reference_donation', 'reference_request').all()
        blood_group = request.query_params.get('blood_group')
        tx_type = request.query_params.get('transaction_type')

        if blood_group:
            transactions = transactions.filter(blood_group=blood_group)
        if tx_type:
            transactions = transactions.filter(transaction_type=tx_type)

        serializer = InventoryTransactionSerializer(transactions[:50], many=True)
        return Response({
            "count": transactions.count(),
            "transactions": serializer.data
        })


# ==========================================
# MODULE 5: BLOOD REQUEST STATUS
# ==========================================

class BloodRequestViewSet(viewsets.ModelViewSet):
    serializer_class = BloodRequestSerializer

    def get_permissions(self):
        # Allow emergency requests to be created without prior registration
        if self.action == 'create':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return BloodRequest.objects.none()

        if check_is_admin(user):
            qs = BloodRequest.objects.select_related('requester', 'reviewed_by').all()
            status_param = self.request.query_params.get('status')
            urgency = self.request.query_params.get('urgency')
            blood_group = self.request.query_params.get('blood_group')
            if status_param:
                qs = qs.filter(status=status_param)
            if urgency:
                qs = qs.filter(urgency=urgency)
            if blood_group:
                qs = qs.filter(blood_group=blood_group)
            return qs

        # Requesters see only their own submitted requests
        return BloodRequest.objects.filter(requester=user).select_related('requester', 'reviewed_by')

    def create(self, request, *args, **kwargs):
        serializer = BloodRequestCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"error": "Validation failed", "details": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user if request.user.is_authenticated else None
        if not user:
            # Auto-create or associate requester account based on contact phone
            contact_phone = serializer.validated_data.get('contact_phone', '').strip()
            contact_person = serializer.validated_data.get('contact_person', 'Emergency Requester').strip()
            username = f"req_{contact_phone}" if contact_phone else f"guest_{uuid.uuid4().hex[:8]}"

            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "first_name": contact_person.split()[0] if contact_person else "Guest",
                    "last_name": " ".join(contact_person.split()[1:]) if len(contact_person.split()) > 1 else "Requester",
                    "email": f"{username}@lifepulse.portal"
                }
            )
            if created:
                user.set_unusable_password()
                user.save()
                UserProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        "role": "requester",
                        "phone_number": contact_phone,
                        "district": serializer.validated_data.get('district', 'Chennai'),
                        "city": serializer.validated_data.get('city', 'Chennai')
                    }
                )

            # Auto-login the user in session
            login(request, user)
            if not request.session.session_key:
                request.session.save()

        blood_req = BloodRequest.objects.create(
            requester=user,
            status='SUBMITTED',  # Initial status in lifecycle
            **serializer.validated_data
        )

        log_audit(user, "BLOOD_REQUEST_SUBMITTED", "BloodRequest", blood_req.id, {
            "patient": blood_req.patient_name,
            "blood_group": blood_req.blood_group,
            "units": blood_req.units_needed,
            "hospital": blood_req.hospital_name
        }, request)

        response_data = BloodRequestSerializer(blood_req).data
        if request.session.session_key:
            response_data['token'] = request.session.session_key
            response_data['user'] = UserSerializer(user).data

        return Response(response_data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        blood_req = self.get_object()
        user = request.user
        is_admin = check_is_admin(user)

        serializer = BloodRequestStatusUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"error": "Invalid status transition", "details": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        target_status = serializer.validated_data['status']
        remarks = serializer.validated_data.get('admin_remarks', '')

        # Requesters can only cancel their own pending/under-review requests
        if not is_admin:
            if target_status == 'CANCELLED':
                if blood_req.status in ('FULFILLED', 'REJECTED'):
                    return Response({"error": f"Cannot cancel a request that is already {blood_req.status.lower()}."}, status=status.HTTP_400_BAD_REQUEST)
                blood_req.status = 'CANCELLED'
                blood_req.admin_remarks = f"Cancelled by requester: {remarks}" if remarks else "Cancelled by requester."
                blood_req.save()
                log_audit(user, "REQUEST_CANCELLED", "BloodRequest", blood_req.id, {}, request)
                return Response({"message": "Request cancelled successfully", "request": BloodRequestSerializer(blood_req).data})
            else:
                return Response({"error": "Only authorized administrators can review, approve, or fulfill blood requests."}, status=status.HTTP_403_FORBIDDEN)

        # Admin status management
        if target_status == blood_req.status:
            return Response({"error": f"Request is already in '{blood_req.status}' status."}, status=status.HTTP_400_BAD_REQUEST)

        if blood_req.status == 'FULFILLED':
            return Response({"error": "Request has already been fulfilled and inventory issued. Status cannot be modified."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                if target_status == 'FULFILLED':
                    # Atomic inventory deduction
                    inventory, _ = BloodInventory.objects.select_for_update().get_or_create(
                        blood_group=blood_req.blood_group,
                        defaults={'units_available': 0}
                    )

                    if inventory.units_available < blood_req.units_needed:
                        return Response({
                            "error": (
                                f"Insufficient blood units in inventory. "
                                f"Available for {blood_req.blood_group}: {inventory.units_available} unit(s). "
                                f"Required: {blood_req.units_needed} unit(s). "
                                "Fulfillment halted to prevent negative stock."
                            )
                        }, status=status.HTTP_400_BAD_REQUEST)

                    stock_before = inventory.units_available
                    inventory.units_available -= blood_req.units_needed
                    inventory.save()

                    blood_req.status = 'FULFILLED'
                    blood_req.fulfilled_at = timezone.now()
                    blood_req.reviewed_by = user
                    blood_req.reviewed_at = timezone.now()
                    if remarks:
                        blood_req.admin_remarks = remarks
                    blood_req.save()

                    # Record transaction audit
                    InventoryTransaction.objects.create(
                        blood_group=blood_req.blood_group,
                        transaction_type='REQUEST_FULFILL',
                        units=-blood_req.units_needed,
                        stock_before=stock_before,
                        stock_after=inventory.units_available,
                        reference_request=blood_req,
                        performed_by=user,
                        remarks=f"Dispatched {blood_req.units_needed} units to {blood_req.hospital_name} for patient {blood_req.patient_name} (Request #{blood_req.id})"
                    )

                    log_audit(user, "REQUEST_FULFILLED", "BloodRequest", blood_req.id, {
                        "units_deducted": blood_req.units_needed,
                        "stock_remaining": inventory.units_available
                    }, request)

                elif target_status == 'APPROVED':
                    blood_req.status = 'APPROVED'
                    blood_req.reviewed_by = user
                    blood_req.reviewed_at = timezone.now()
                    if remarks:
                        blood_req.admin_remarks = remarks
                    blood_req.save()
                    log_audit(user, "REQUEST_APPROVED", "BloodRequest", blood_req.id, {"remarks": remarks}, request)

                elif target_status == 'UNDER_REVIEW':
                    blood_req.status = 'UNDER_REVIEW'
                    blood_req.reviewed_by = user
                    blood_req.reviewed_at = timezone.now()
                    if remarks:
                        blood_req.admin_remarks = remarks
                    blood_req.save()
                    log_audit(user, "REQUEST_UNDER_REVIEW", "BloodRequest", blood_req.id, {}, request)

                elif target_status in ('REJECTED', 'CANCELLED'):
                    blood_req.status = target_status
                    blood_req.reviewed_by = user
                    blood_req.reviewed_at = timezone.now()
                    if remarks:
                        blood_req.admin_remarks = remarks
                    blood_req.save()
                    log_audit(user, f"REQUEST_{target_status}", "BloodRequest", blood_req.id, {"remarks": remarks}, request)

            return Response({
                "message": f"Blood request status updated to '{target_status}'",
                "request": BloodRequestSerializer(blood_req).data
            })

        except Exception as e:
            return Response({"error": f"Failed to update request: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ==========================================
# ADMINISTRATIVE DASHBOARD & AUDIT LOGS
# ==========================================

class AdminDashboardKPIView(views.APIView):
    permission_classes = [IsAdminUserOrStaff]

    def get(self, request):
        total_donors = DonorProfile.objects.count()
        active_donors = DonorProfile.objects.filter(is_available=True).count()
        total_units = BloodInventory.objects.aggregate(total=Sum('units_available'))['total'] or 0

        pending_donations = DonationRecord.objects.filter(status='PENDING').count()
        pending_requests = BloodRequest.objects.filter(status__in=['SUBMITTED', 'UNDER_REVIEW']).count()
        fulfilled_requests = BloodRequest.objects.filter(status='FULFILLED').count()

        low_stock_groups = BloodInventory.objects.filter(units_available__lte=5).values_list('blood_group', flat=True)

        recent_activity = AuditLog.objects.select_related('user')[:15]

        return Response({
            "kpis": {
                "total_donors": total_donors,
                "active_donors": active_donors,
                "total_units_in_stock": total_units,
                "pending_donations": pending_donations,
                "pending_requests": pending_requests,
                "fulfilled_requests": fulfilled_requests,
                "low_stock_alert_count": len(low_stock_groups),
                "low_stock_groups": list(low_stock_groups)
            },
            "recent_activity": AuditLogSerializer(recent_activity, many=True).data
        })


class AuditLogListView(views.APIView):
    permission_classes = [IsAdminUserOrStaff]

    def get(self, request):
        logs = AuditLog.objects.select_related('user').all()[:100]
        return Response({
            "count": logs.count(),
            "logs": AuditLogSerializer(logs, many=True).data
        })


# ==========================================
# DEPLOYMENT MONITORING HEALTH CHECK
# ==========================================

@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    db_status = "ok"
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return Response({
        "status": "healthy" if db_status == "ok" else "degraded",
        "service": "Blood Donor & Blood Bank Management Portal API",
        "course": "CCS375 - Web Technologies (Team 1)",
        "database": db_status,
        "timestamp": timezone.now().isoformat()
    })
