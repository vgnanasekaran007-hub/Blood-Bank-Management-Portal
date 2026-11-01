from rest_framework import permissions


def check_is_admin(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or user.is_staff:
        return True
    return hasattr(user, 'profile') and user.profile.role == 'admin'


class IsAdminUserOrStaff(permissions.BasePermission):
    """
    Allows access only to authenticated administrators or blood bank staff.
    """
    def has_permission(self, request, view):
        return check_is_admin(request.user)


class IsDonor(permissions.BasePermission):
    """
    Allows access only to authenticated users with the donor role or profile.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return (hasattr(request.user, 'profile') and request.user.profile.role == 'donor') or hasattr(request.user, 'donor_profile')


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Object-level permission to allow owners of an object or admins to view/edit it.
    """
    def has_object_permission(self, request, view, obj):
        if check_is_admin(request.user):
            return True
        # For DonorProfile
        if hasattr(obj, 'user'):
            return obj.user == request.user
        # For BloodRequest
        if hasattr(obj, 'requester'):
            return obj.requester == request.user
        # For DonationRecord
        if hasattr(obj, 'donor'):
            return obj.donor.user == request.user
        return False
