"""
TrustShield backend regression tests (Node/Express + PostgreSQL).
Focus: confirm backend/.env fallback loading did not break any endpoint.
Covers: health, sandbox (analyze/scenarios/compare/runs/validation), legacy scanners, dashboard.
"""
import os
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or frontend_env.get("REACT_APP_BACKEND_URL")
    or "http://localhost:8001"
).rstrip("/")

API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- health ----------
class TestHealth:
    def test_health(self, client):
        r = client.get(f"{API}/health", timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "ok"


# ---------- sandbox ----------
class TestSandbox:
    def test_scenarios_catalog(self, client):
        r = client.get(f"{API}/sandbox/scenarios", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data["scenarios"]) == 10, f"expected 10 scenarios, got {len(data['scenarios'])}"
        assert isinstance(data["supportedTypes"], list) and data["supportedTypes"]
        assert isinstance(data["maxContentLength"], int)
        for sc in data["scenarios"]:
            assert sc.get("id") and sc.get("inputType") and sc.get("sampleContent")

    def test_analyze_with_scenario_id(self, client):
        cat = client.get(f"{API}/sandbox/scenarios", timeout=20).json()["scenarios"]
        sc = next(s for s in cat if s["id"] == "fake-support")
        r = client.post(f"{API}/sandbox/analyze",
                        json={"inputType": sc["inputType"], "content": sc["sampleContent"],
                              "scenarioId": sc["id"]}, timeout=60)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["riskScore"] > 0 and len(d["signals"]) > 0

    def test_analyze_phishing_message(self, client):
        payload = {
            "inputType": "message",
            "content": "URGENT: Your account will be suspended today. Verify immediately and share your OTP.",
        }
        r = client.post(f"{API}/sandbox/analyze", json=payload, timeout=60)
        assert r.status_code == 201, r.text
        d = r.json()
        for key in ["sandboxRunId", "riskScore", "classification", "signals",
                    "evidence", "attackChain", "correlation", "confidence"]:
            assert key in d, f"missing {key} in analyze response: {list(d)}"
        assert isinstance(d["riskScore"], (int, float)) and d["riskScore"] > 0
        assert isinstance(d["signals"], list) and len(d["signals"]) > 0
        assert isinstance(d["evidence"], list)
        assert isinstance(d["attackChain"], list)
        assert d["classification"] in ("SAFE", "SUSPICIOUS", "SCAM", "DANGEROUS", "HIGH_RISK", "FRAUD"), d["classification"]
        # persistence check
        rid = d["sandboxRunId"]
        g = client.get(f"{API}/sandbox/runs/{rid}", timeout=20)
        assert g.status_code == 200, g.text
        run = g.json()
        assert "_id" not in run
        assert run["id"] == rid
        assert isinstance(run.get("signals"), list)
        assert "evidence" in run and "attackChain" in run

    def test_analyze_empty_content_400(self, client):
        r = client.post(f"{API}/sandbox/analyze", json={"inputType": "message", "content": ""}, timeout=20)
        assert r.status_code == 400, f"{r.status_code} {r.text}"
        assert "error" in r.json()

    def test_analyze_unsupported_type_400(self, client):
        r = client.post(f"{API}/sandbox/analyze", json={"inputType": "webhook", "content": "hello"}, timeout=20)
        assert r.status_code == 400, f"{r.status_code} {r.text}"

    def test_analyze_missing_input_type_400(self, client):
        r = client.post(f"{API}/sandbox/analyze", json={"content": "hello"}, timeout=20)
        assert r.status_code == 400, f"{r.status_code} {r.text}"

    def test_analyze_oversized_content_400(self, client):
        r = client.post(f"{API}/sandbox/analyze",
                        json={"inputType": "message", "content": "a" * 20001}, timeout=30)
        assert r.status_code == 400, f"{r.status_code} {r.text}"

    def test_compare(self, client):
        payload = {
            "scenarioA": {"inputType": "message",
                          "content": "Your monthly bank statement is ready. Log in through your usual banking app."},
            "scenarioB": {"inputType": "message",
                          "content": "URGENT! Your account will be suspended. Verify immediately and share the OTP."},
        }
        r = client.post(f"{API}/sandbox/compare", json=payload, timeout=90)
        assert r.status_code == 201, r.text
        d = r.json()
        assert "scenarioA" in d and "scenarioB" in d and "comparison" in d
        comp = d["comparison"]
        assert comp["scoreDelta"] > 0, f"expected positive scoreDelta, got {comp.get('scoreDelta')}"
        assert isinstance(comp.get("uniqueToB"), list) and len(comp["uniqueToB"]) > 0

    def test_compare_missing_scenario_400(self, client):
        r = client.post(f"{API}/sandbox/compare",
                        json={"scenarioA": {"inputType": "message", "content": "hi"}}, timeout=20)
        assert r.status_code == 400, f"{r.status_code} {r.text}"

    def test_runs_list_and_pagination(self, client):
        r = client.get(f"{API}/sandbox/runs?limit=5", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        runs = data if isinstance(data, list) else data.get("runs", data.get("items"))
        assert isinstance(runs, list)
        assert len(runs) <= 5
        for run in runs:
            assert "_id" not in run

    def test_run_detail_not_found(self, client):
        r = client.get(f"{API}/sandbox/runs/99999999", timeout=20)
        assert r.status_code == 404, f"{r.status_code} {r.text}"

    def test_run_detail_invalid_id(self, client):
        r = client.get(f"{API}/sandbox/runs/abc", timeout=20)
        assert r.status_code == 400, f"{r.status_code} {r.text}"

    def test_zz_clear_runs_only_sandbox(self, client):
        # snapshot production scans first
        before = client.get(f"{API}/scans", timeout=30)
        assert before.status_code == 200, before.text
        before_body = before.json()
        before_scans = before_body if isinstance(before_body, list) else before_body.get("scans", [])

        r = client.delete(f"{API}/sandbox/runs", timeout=30)
        assert r.status_code == 200, r.text
        assert isinstance(r.json().get("deleted"), int)

        after_runs = client.get(f"{API}/sandbox/runs", timeout=20)
        assert after_runs.status_code == 200
        body = after_runs.json()
        runs = body if isinstance(body, list) else body.get("runs", body.get("items", []))
        assert len(runs) == 0, "sandbox runs should be empty after clear"

        after = client.get(f"{API}/scans", timeout=30)
        after_body = after.json()
        after_scans = after_body if isinstance(after_body, list) else after_body.get("scans", [])
        assert len(after_scans) == len(before_scans), "production scans must not be deleted by sandbox clear"


# ---------- regression: legacy scanners ----------
class TestScannersRegression:
    def test_scan_url_safe(self, client):
        r = client.post(f"{API}/scan/url", json={"url": "https://www.google.com"}, timeout=60)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        verdict = d.get("classification") or d.get("verdict") or d.get("result")
        assert verdict, f"no verdict in response: {list(d)}"
        assert str(verdict).upper() == "SAFE", f"expected SAFE, got {verdict}"

    def test_scan_message_safe(self, client):
        r = client.post(f"{API}/scan/message", json={"content": "Hi lunch tomorrow?"}, timeout=60)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        verdict = d.get("classification") or d.get("verdict")
        assert str(verdict).upper() == "SAFE", f"expected SAFE, got {verdict}"

    def test_scan_email_phishing(self, client):
        r = client.post(f"{API}/scan/email",
                        json={"content": "Your account will be suspended, verify at http://paypa1.com/login"},
                        timeout=60)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert (d.get("classification") or d.get("verdict")), f"no verdict: {list(d)}"
        assert isinstance(d.get("riskScore", d.get("score")), (int, float))

    def test_dashboard(self, client):
        r = client.get(f"{API}/dashboard", timeout=30)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), dict)

    def test_scans_list(self, client):
        r = client.get(f"{API}/scans", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        scans = body if isinstance(body, list) else body.get("scans")
        assert isinstance(scans, list)
        for s in scans[:10]:
            assert "_id" not in s
