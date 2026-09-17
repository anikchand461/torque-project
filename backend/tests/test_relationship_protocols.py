import pytest

pytestmark = pytest.mark.asyncio


async def _make_graph(client):
    response = await client.post("/api/v1/graphs", json={"name": "Test Graph"})
    assert response.status_code == 201
    return response.json()


async def _make_node(client, graph_id, name):
    response = await client.post(
        f"/api/v1/graphs/{graph_id}/nodes", json={"name": name}
    )
    assert response.status_code == 201
    return response.json()


async def _make_relationship(client, graph_id, source_id, target_id, rel_type="Communication", direction="BIDIRECTIONAL"):
    response = await client.post(
        f"/api/v1/graphs/{graph_id}/relationships",
        json={
            "source_node_id": source_id,
            "target_node_id": target_id,
            "relationship_type": rel_type,
            "direction": direction,
        },
    )
    return response


def _protocol_payload(name="Financial Reporting"):
    return {
        "name": name,
        "description": None,
        "can_send": True,
        "can_receive": True,
        "can_escalate": True,
        "can_bypass": False,
        "can_forward": False,
        "confidentiality": "Confidential",
        "allowed_information_types": ["budget", "forecasts"],
    }


async def _setup_relationship(client):
    graph = await _make_graph(client)
    node_a = await _make_node(client, graph["id"], "CEO")
    node_b = await _make_node(client, graph["id"], "CFO")
    rel = (await _make_relationship(client, graph["id"], node_a["id"], node_b["id"])).json()
    return graph, node_a, node_b, rel


# =====================================================
# 1. one relationship with zero protocols
# =====================================================

async def test_relationship_with_zero_protocols(client):
    graph, node_a, node_b, rel = await _setup_relationship(client)

    assert rel["protocol_ids"] == []
    assert rel["protocols"] == []

    listed = await client.get(f"/api/v1/relationships/{rel['id']}/protocols")
    assert listed.status_code == 200
    assert listed.json() == []


# =====================================================
# 2. one relationship with one protocol
# =====================================================

async def test_relationship_with_one_protocol(client):
    graph, node_a, node_b, rel = await _setup_relationship(client)

    created = await client.post(
        f"/api/v1/relationships/{rel['id']}/protocols", json=_protocol_payload()
    )
    assert created.status_code == 201
    protocol = created.json()

    assert protocol["name"] == "Financial Reporting"
    assert protocol["relationship_ids"] == [rel["id"]]
    assert protocol["graph_id"] == graph["id"]

    listed = (await client.get(f"/api/v1/relationships/{rel['id']}/protocols")).json()
    assert len(listed) == 1
    assert listed[0]["id"] == protocol["id"]


# =====================================================
# 3. one relationship with multiple protocols
# =====================================================

async def test_relationship_with_multiple_protocols(client):
    graph, node_a, node_b, rel = await _setup_relationship(client)

    names = ["Technical Information Sharing", "Emergency Escalation", "Confidential Information"]
    for name in names:
        response = await client.post(
            f"/api/v1/relationships/{rel['id']}/protocols",
            json=_protocol_payload(name=name),
        )
        assert response.status_code == 201

    listed = (await client.get(f"/api/v1/relationships/{rel['id']}/protocols")).json()
    assert len(listed) == 3
    assert {p["name"] for p in listed} == set(names)

    fetched_rel = (
        await client.get(f"/api/v1/graphs/{graph['id']}/relationships")
    ).json()[0]
    assert len(fetched_rel["protocol_ids"]) == 3
    assert len(fetched_rel["protocols"]) == 3


# =====================================================
# 4. attaching a protocol (to a second relationship)
# =====================================================

async def test_attach_existing_protocol_to_another_relationship(client):
    graph, node_a, node_b, rel = await _setup_relationship(client)
    node_c = await _make_node(client, graph["id"], "COO")

    second_rel = (
        await _make_relationship(client, graph["id"], node_a["id"], node_c["id"], direction="FORWARD")
    ).json()

    protocol = (
        await client.post(
            f"/api/v1/relationships/{rel['id']}/protocols", json=_protocol_payload()
        )
    ).json()

    attach_response = await client.post(
        f"/api/v1/relationships/{second_rel['id']}/protocols/{protocol['id']}/attach"
    )
    assert attach_response.status_code == 200

    attached = attach_response.json()
    assert set(attached["relationship_ids"]) == {rel["id"], second_rel["id"]}

    second_list = (
        await client.get(f"/api/v1/relationships/{second_rel['id']}/protocols")
    ).json()
    assert len(second_list) == 1
    assert second_list[0]["id"] == protocol["id"]


# =====================================================
# 5. detaching a protocol
# =====================================================

async def test_detach_protocol(client):
    graph, node_a, node_b, rel = await _setup_relationship(client)

    protocol = (
        await client.post(
            f"/api/v1/relationships/{rel['id']}/protocols", json=_protocol_payload()
        )
    ).json()

    detach_response = await client.delete(
        f"/api/v1/relationships/{rel['id']}/protocols/{protocol['id']}"
    )
    assert detach_response.status_code == 204

    listed = (await client.get(f"/api/v1/relationships/{rel['id']}/protocols")).json()
    assert listed == []

    # Detaching does not delete the protocol itself.
    still_editable = await client.put(
        f"/api/v1/protocols/{protocol['id']}", json={"confidentiality": "Public"}
    )
    assert still_editable.status_code == 200


# =====================================================
# 6. preventing duplicate protocol attachments
# =====================================================

async def test_prevent_duplicate_attachment(client):
    graph, node_a, node_b, rel = await _setup_relationship(client)

    protocol = (
        await client.post(
            f"/api/v1/relationships/{rel['id']}/protocols", json=_protocol_payload()
        )
    ).json()

    # Already attached (it was just created onto this
    # relationship) — attaching it again must be rejected.
    duplicate = await client.post(
        f"/api/v1/relationships/{rel['id']}/protocols/{protocol['id']}/attach"
    )
    assert duplicate.status_code == 409

    listed = (await client.get(f"/api/v1/relationships/{rel['id']}/protocols")).json()
    assert len(listed) == 1


# =====================================================
# 7. different protocols do NOT create duplicate
#    relationships
# =====================================================

async def test_multiple_protocols_do_not_duplicate_relationship(client):
    graph, node_a, node_b, rel = await _setup_relationship(client)

    for name in ["Protocol A", "Protocol B", "Protocol C"]:
        response = await client.post(
            f"/api/v1/relationships/{rel['id']}/protocols",
            json=_protocol_payload(name=name),
        )
        assert response.status_code == 201

    all_relationships = (
        await client.get(f"/api/v1/graphs/{graph['id']}/relationships")
    ).json()

    assert len(all_relationships) == 1
    assert len(all_relationships[0]["protocols"]) == 3

    # A second Relationship row between the same two nodes
    # (even with a different relationship_type/direction) is
    # still rejected — protocols are not a backdoor around
    # the one-relationship-per-pair rule.
    conflicting = await _make_relationship(
        client, graph["id"], node_a["id"], node_b["id"], rel_type="Escalation", direction="FORWARD"
    )
    assert conflicting.status_code == 400

    # Also rejected in the reverse order (B -> A counts as
    # the same pair as A -> B).
    reverse_conflict = await _make_relationship(
        client, graph["id"], node_b["id"], node_a["id"]
    )
    assert reverse_conflict.status_code == 400


# =====================================================
# Bonus: deleting a relationship doesn't delete a
# protocol still attached elsewhere.
# =====================================================

async def test_delete_relationship_keeps_protocol_attached_elsewhere(client):
    graph, node_a, node_b, rel = await _setup_relationship(client)
    node_c = await _make_node(client, graph["id"], "COO")
    second_rel = (
        await _make_relationship(client, graph["id"], node_a["id"], node_c["id"], direction="FORWARD")
    ).json()

    protocol = (
        await client.post(
            f"/api/v1/relationships/{rel['id']}/protocols", json=_protocol_payload()
        )
    ).json()

    await client.post(
        f"/api/v1/relationships/{second_rel['id']}/protocols/{protocol['id']}/attach"
    )

    delete_response = await client.delete(f"/api/v1/relationships/{rel['id']}")
    assert delete_response.status_code == 204

    remaining = (
        await client.get(f"/api/v1/relationships/{second_rel['id']}/protocols")
    ).json()
    assert len(remaining) == 1
    assert remaining[0]["id"] == protocol["id"]
