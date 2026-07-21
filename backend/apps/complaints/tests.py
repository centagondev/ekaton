from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.complaints.models import Complaint
from core.throttles import ComplaintCreateRateThrottle


class ComplaintAPITests(APITestCase):
    def setUp(self):
        cache.clear()
        self.url = reverse("complaints")
        self.user = self.create_user(
            email="owner@example.com",
            full_name="Owner User",
            batch="2024",
        )
        self.other_user = self.create_user(
            email="other@example.com",
            full_name="Other User",
            batch="2025",
        )

    def create_user(self, email, full_name, batch):
        return get_user_model().objects.create_user(
            email=email,
            password="StrongPass123!",
            full_name=full_name,
            batch=batch,
            gender="male",
            is_verified=True,
        )

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.user)

    def complaint_payload(self, **overrides):
        payload = {
            "title": "Hostel maintenance issue",
            "description": "The third floor water filter needs repair.",
            "category": Complaint.Category.FACILITIES,
            "is_anonymous": True,
        }
        payload.update(overrides)
        return payload

    def test_unauthenticated_user_cannot_create_complaint(self):
        response = self.client.post(self.url, self.complaint_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(Complaint.objects.count(), 0)

    def test_authenticated_user_can_create_complaint(self):
        self.authenticate()

        response = self.client.post(self.url, self.complaint_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Complaint.objects.count(), 1)
        complaint = Complaint.objects.get()
        self.assertEqual(complaint.title, "Hostel maintenance issue")
        self.assertEqual(complaint.user, self.user)
        self.assertEqual(response.data["data"]["id"], complaint.id)

    def test_complaint_ownership_always_comes_from_authenticated_user(self):
        self.authenticate(self.user)

        response = self.client.post(
            self.url,
            self.complaint_payload(user=self.other_user.id),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        complaint = Complaint.objects.get()
        self.assertEqual(complaint.user, self.user)

    def test_status_cannot_be_set_during_creation(self):
        self.authenticate()

        response = self.client.post(
            self.url,
            self.complaint_payload(status=Complaint.Status.RESOLVED),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        complaint = Complaint.objects.get()
        self.assertEqual(complaint.status, Complaint.Status.OPEN)

    def test_blank_title_is_rejected(self):
        self.authenticate()

        response = self.client.post(
            self.url,
            self.complaint_payload(title="   "),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Complaint.objects.count(), 0)
        self.assertIn("title", response.data)

    def test_blank_description_is_rejected(self):
        self.authenticate()

        response = self.client.post(
            self.url,
            self.complaint_payload(description="   "),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Complaint.objects.count(), 0)
        self.assertIn("description", response.data)

    def test_anonymous_complaint_hides_author_identity(self):
        self.authenticate()
        Complaint.objects.create(
            user=self.user,
            title="Anonymous issue",
            description="Keep my identity hidden.",
            category=Complaint.Category.GENERAL,
            is_anonymous=True,
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result = response.data["data"]["results"][0]
        self.assertEqual(result["author_name"], "Anonymous")
        self.assertIsNone(result["author_batch"])
        self.assertNotIn("user", result)
        self.assertNotIn("user_id", result)

    def test_non_anonymous_complaint_shows_public_author_fields(self):
        self.authenticate()
        Complaint.objects.create(
            user=self.user,
            title="Visible issue",
            description="My identity can be visible.",
            category=Complaint.Category.GENERAL,
            is_anonymous=False,
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result = response.data["data"]["results"][0]
        self.assertEqual(result["author_name"], self.user.full_name)
        self.assertEqual(result["author_batch"], self.user.batch)
        self.assertNotIn("user", result)
        self.assertNotIn("user_id", result)

    def test_complaint_list_is_paginated(self):
        self.authenticate()
        complaints = [
            Complaint(
                user=self.user,
                title=f"Complaint {index}",
                description="Paginated complaint",
                category=Complaint.Category.GENERAL,
            )
            for index in range(12)
        ]
        Complaint.objects.bulk_create(complaints)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"]["count"], 12)
        self.assertEqual(len(response.data["data"]["results"]), 10)
        self.assertIsNotNone(response.data["data"]["next"])
        self.assertIsNone(response.data["data"]["previous"])

    def test_complaint_creation_is_rate_limited(self):
        self.authenticate()

        with patch.object(ComplaintCreateRateThrottle, "rate", "2/hour", create=True):
            first_response = self.client.post(
                self.url,
                self.complaint_payload(title="First complaint"),
                format="json",
            )
            second_response = self.client.post(
                self.url,
                self.complaint_payload(title="Second complaint"),
                format="json",
            )
            throttled_response = self.client.post(
                self.url,
                self.complaint_payload(title="Third complaint"),
                format="json",
            )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            throttled_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS
        )
