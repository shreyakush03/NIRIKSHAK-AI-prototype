"""
External Service Integrations Module for NIRIKSHAK AI.
Provides interfaces and stubs for NGO Darpan, GIS Boundary Checks, and PFMS limits.
"""

from typing import Dict, Any, List


class NGODarpanService:
    """Service to verify registered societies/trusts against NGO Darpan portal."""

    def __init__(self):
        # Pre-seeded test registry of verified NGOs
        self._mock_registry = {
            "UP/2023/0012345": {
                "name": "Gramin Vikas Sansthan",
                "valid": True,
                "registration_act": "Societies Registration Act, 1860",
                "active_years": 5,
                "blacklisted": False,
            },
            "DL/2021/0098765": {
                "name": "Youth Welfare Trust",
                "valid": True,
                "registration_act": "Indian Trusts Act, 1882",
                "active_years": 2,
                "blacklisted": False,
            }
        }

    def verify_ngo(self, darpan_id: str) -> Dict[str, Any]:
        """Verify NGO details by Darpan ID."""
        if not darpan_id:
            return {"valid": False, "reason": "No Darpan ID provided"}
        
        record = self._mock_registry.get(darpan_id)
        if not record:
            return {"valid": False, "reason": "Darpan ID not found in NGO Darpan database"}
        
        return record


class GISBoundaryService:
    """Service for geospatial & constituency boundary validation."""

    def __init__(self):
        self._constituency_map = {
            "Gorakhpur": ["Gorakhpur", "Maharajganj"],
            "Varanasi": ["Varanasi"],
            "Lucknow": ["Lucknow"],
        }

    def is_location_in_constituency(self, constituency_name: str, district: str) -> bool:
        """Validate if district falls within constituency boundaries."""
        allowed = self._constituency_map.get(constituency_name, [constituency_name])
        return district in allowed


class PFMSIntegrationService:
    """Service for Public Financial Management System (PFMS) vendor verification."""

    def verify_vendor_and_limits(self, vendor_id: str, amount: float) -> Dict[str, Any]:
        """Validate vendor active status and drawing limits."""
        return {
            "vendor_active": True,
            "drawing_limit_available": True,
            "verified": True
        }

