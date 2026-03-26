from platform_837p.snapshot.models import (
    AddressSnapshotInput,
    CoverageSnapshotInput,
    SnapshotType,
)
from platform_837p.snapshot.service import (
    InMemorySnapshotStore,
    SnapshotService,
)


def test_creates_first_coverage_snapshot_with_version_one() -> None:
    store = InMemorySnapshotStore()
    service = SnapshotService(store=store)

    result = service.snapshot_coverage(
        claim_id="40000000-0000-0000-0000-000000000001",
        input_data=CoverageSnapshotInput(
            payer_name="Acme Health Plan",
            payer_id="99999",
            plan_type="HMO",
            group_number="GRP-1001",
            policy_number="POL-1001",
            relationship_code="18",
            effective_date="2026-01-01",
            termination_date=None,
            coverage_rank=1,
            is_active=True,
        ),
        reason="phase4-initial",
    )

    assert result.snapshot_type == SnapshotType.COVERAGE
    assert result.snapshot_version == 1
    assert result.claim_id == "40000000-0000-0000-0000-000000000001"
    assert result.changed is True


def test_repeated_identical_coverage_snapshot_does_not_create_new_version() -> None:
    store = InMemorySnapshotStore()
    service = SnapshotService(store=store)
    claim_id = "40000000-0000-0000-0000-000000000002"
    payload = CoverageSnapshotInput(
        payer_name="Acme Health Plan",
        payer_id="99999",
        plan_type="PPO",
        group_number="GRP-2002",
        policy_number="POL-2002",
        relationship_code="18",
        effective_date="2026-01-01",
        termination_date=None,
        coverage_rank=1,
        is_active=True,
    )

    first = service.snapshot_coverage(claim_id=claim_id, input_data=payload, reason="first")
    second = service.snapshot_coverage(claim_id=claim_id, input_data=payload, reason="repeat")

    assert first.snapshot_version == 1
    assert second.snapshot_version == 1
    assert second.changed is False


def test_changed_address_snapshot_increments_version() -> None:
    store = InMemorySnapshotStore()
    service = SnapshotService(store=store)
    claim_id = "40000000-0000-0000-0000-000000000003"

    first = service.snapshot_address(
        claim_id=claim_id,
        input_data=AddressSnapshotInput(
            address_line_1="10 Main St",
            address_line_2=None,
            city="Austin",
            state_code="TX",
            postal_code="78701",
            country_code="US",
            address_type="MEMBER_MAILING",
        ),
        reason="initial-address",
    )
    second = service.snapshot_address(
        claim_id=claim_id,
        input_data=AddressSnapshotInput(
            address_line_1="11 Main St",
            address_line_2=None,
            city="Austin",
            state_code="TX",
            postal_code="78701",
            country_code="US",
            address_type="MEMBER_MAILING",
        ),
        reason="member-move",
    )

    assert first.snapshot_version == 1
    assert second.snapshot_version == 2
    assert second.changed is True
