"""验证 main/CI 门槛、专用 SSH 权限，以及数据和双应用的发布边界。"""

import copy
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import gateway
import production


class DeploymentTests(unittest.TestCase):
    def request(self):
        return {"sha": "a" * 40, "run_id": 123, "actor": "test-user", "token": "temporary-token",
                "images": {service: f"ghcr.io/lec-org/lecpunch-{service}@sha256:" + "b" * 64
                           for service in ("api", "web")}}

    def ci(self):
        return {"event": "push", "head_branch": "main", "head_sha": "a" * 40,
                "head_repository": {"full_name": production.REPOSITORY}, "path": ".github/workflows/ci.yml"}

    def jobs(self):
        return {"jobs": [{"name": name, "conclusion": "success"} for name in production.REQUIRED_JOBS]}

    def test_only_main_push_for_the_exact_ci_sha_can_deploy(self):
        for field, invalid in (("event", "pull_request"), ("head_branch", "feature"),
                               ("head_sha", "c" * 40), ("head_repository", {"full_name": "other/repo"}),
                               ("path", ".github/workflows/other.yml")):
            run = self.ci()
            run[field] = invalid
            with self.subTest(field=field), patch("production.helpers", return_value=SimpleNamespace(api=Mock(return_value=run))):
                with self.assertRaises(ValueError):
                    production.check_ci(self.request())
        api = Mock(side_effect=[self.ci(), self.jobs(), {"sha": "a" * 40}])
        with patch("production.helpers", return_value=SimpleNamespace(api=api)):
            production.check_ci(self.request())

    def test_any_missing_failed_cancelled_or_skipped_required_job_blocks_deploy(self):
        for job in production.REQUIRED_JOBS:
            for conclusion in (None, "failure", "cancelled", "skipped"):
                jobs = self.jobs()
                next(item for item in jobs["jobs"] if item["name"] == job)["conclusion"] = conclusion
                api = Mock(side_effect=[self.ci(), jobs])
                with self.subTest(job=job, conclusion=conclusion), patch("production.helpers", return_value=SimpleNamespace(api=api)):
                    with self.assertRaises(ValueError):
                        production.check_ci(self.request())
        api = Mock(side_effect=[self.ci(), {"jobs": []}])
        with patch("production.helpers", return_value=SimpleNamespace(api=api)):
            with self.assertRaises(ValueError):
                production.check_ci(self.request())

    def test_newer_main_blocks_an_outdated_build(self):
        api = Mock(side_effect=[self.ci(), self.jobs(), {"sha": "c" * 40}])
        with patch("production.helpers", return_value=SimpleNamespace(api=api)):
            with self.assertRaises(ValueError):
                production.check_ci(self.request())

    def test_only_the_two_fixed_digest_images_are_accepted(self):
        production.validate_request(self.request())
        for service in ("api", "web"):
            for invalid in ("ghcr.io/lec-org/lecpunch-web:latest", "ghcr.io/other/api@sha256:" + "b" * 64, "$(id)"):
                value = self.request()
                value["images"][service] = invalid
                with self.assertRaises(ValueError):
                    production.validate_request(value)
        for field, invalid in (("run_id", True), ("sha", "main"), ("images", {})):
            value = self.request()
            value[field] = invalid
            with self.assertRaises(ValueError):
                production.validate_request(value)

    def model(self):
        return {"services": {
            "mongo": {"image": "mongo", "volumes": ["mongo-data:/data/db"]},
            "api": {"image": "old-api", "environment": {"EXAMPLE": "server-only"}, "volumes": ["images:/data/images"]},
            "web": {"image": "old-web", "ports": ["127.0.0.1:18082:80"]},
        }, "volumes": {"mongo-data": {}, "images": {}}}

    def test_both_images_can_change_but_no_other_runtime_configuration_can(self):
        before = self.model()
        after = copy.deepcopy(before)
        for service in ("api", "web"):
            after["services"][service]["image"] = "new"
        production.check_model(before, after)
        for service, field, invalid in (("web", "ports", []), ("api", "volumes", []),
                                         ("api", "environment", {}), ("mongo", "image", "new-mongo")):
            changed = copy.deepcopy(after)
            changed["services"][service][field] = invalid
            with self.assertRaises(ValueError):
                production.check_model(before, changed)

    def test_compose_include_may_drop_anchor_metadata_but_not_service_logging(self):
        before = self.model()
        before["x-logging"] = {"driver": "local"}
        before["services"]["web"]["logging"] = {"driver": "local"}
        after = copy.deepcopy(before)
        del after["x-logging"]
        production.check_model(before, after)
        after["services"]["web"]["logging"] = {"driver": "json-file"}
        with self.assertRaises(ValueError):
            production.check_model(before, after)

    def test_ssh_keys_cannot_open_shells_or_publish_other_services(self):
        for mode in ("cloud", "pve"):
            for command in ("sh", "scp -t /tmp", "deploy; id", "pct exec 104 -- sh", ""):
                with patch("gateway.sys.argv", ["gateway", mode]), patch.dict("os.environ", {"SSH_ORIGINAL_COMMAND": command}):
                    with self.assertRaises(ValueError):
                        gateway.main()
        with patch("gateway.sys.argv", ["gateway", "pve"]), patch.dict("os.environ", {"SSH_ORIGINAL_COMMAND": "check"}), \
                patch("gateway.subprocess.call", return_value=0) as execute:
            gateway.main()
            self.assertEqual(execute.call_args.args[0], ["pct", "exec", "103", "--", "/usr/local/sbin/lec-deploy-punch", "--check"])

    def test_ci_failure_stops_before_any_docker_or_data_change(self):
        shared = Mock()
        with patch("production.helpers", return_value=shared), patch("production.check_ci", side_effect=ValueError("CI 失败")):
            with self.assertRaises(ValueError):
                production.deploy(self.request())
        shared.run.assert_not_called()
        shared.compose.assert_not_called()

    def test_backup_failure_stops_before_replacing_images_or_containers(self):
        with tempfile.TemporaryDirectory() as root:
            state = Path(root)
            image_file = state / "images.json"
            image_file.write_text("original-images")
            shared = Mock()
            shared.run.return_value = json.dumps([{"Config": {"Labels": {"org.opencontainers.image.revision": "a" * 40}}}]).encode()
            shared.compose.return_value = json.dumps(self.model()).encode()
            shared.atomic_write.side_effect = lambda path, data: Path(path).write_bytes(data)
            temporary_directory = tempfile.TemporaryDirectory
            with patch("production.STATE", state), patch("production.helpers", return_value=shared), \
                    patch("production.check_ci"), patch("production.backup_database", side_effect=RuntimeError("备份失败")), \
                    patch("production.tempfile.TemporaryDirectory", side_effect=lambda **kwargs: temporary_directory(dir=root)):
                with self.assertRaises(RuntimeError):
                    production.deploy(self.request())
            self.assertEqual(image_file.read_text(), "original-images")
            self.assertFalse((state / "state.json").exists())
            self.assertFalse(any("up" in call.args for call in shared.compose.call_args_list))

    def test_api_health_failure_stops_web_and_does_not_mark_release_successful(self):
        with tempfile.TemporaryDirectory() as root:
            state = Path(root)
            (state / "images.json").write_text("original-images")
            shared = Mock()
            shared.run.return_value = json.dumps([{"Config": {"Labels": {"org.opencontainers.image.revision": "a" * 40}}}]).encode()
            shared.compose.side_effect = [json.dumps(self.model()).encode(), json.dumps(self.model()).encode(), RuntimeError("API 不健康")]
            shared.atomic_write.side_effect = lambda path, data: Path(path).write_bytes(data)
            temporary_directory = tempfile.TemporaryDirectory
            with patch("production.STATE", state), patch("production.helpers", return_value=shared), \
                    patch("production.check_ci"), patch("production.backup_database"), \
                    patch("production.tempfile.TemporaryDirectory", side_effect=lambda **kwargs: temporary_directory(dir=root)):
                with self.assertRaises(RuntimeError):
                    production.deploy(self.request())
            self.assertFalse((state / "state.json").exists())
            updates = [call for call in shared.compose.call_args_list if "up" in call.args]
            self.assertEqual(len(updates), 1)
            self.assertEqual(updates[0].args[-1], "api")
            self.assertEqual(next((state / "releases").glob("*/previous-images.json")).read_text(), "original-images")


if __name__ == "__main__":
    unittest.main()
