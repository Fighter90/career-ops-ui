"""Real owned process groups, plus cleanup failure/placement boundaries. No models."""
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lib'))
from steer.jsonrpc import JsonRpcProcess
from steer.supervisor import Supervisor
from steer import util
from fleet import hosts


class CancellationTests(unittest.TestCase):
    @unittest.skipIf(os.name == 'nt', 'POSIX process group regression')
    def test_rpc_cancel_kills_resistant_descendant_after_parent_exits(self):
        child_code="import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); print('ready',flush=True); time.sleep(60)"
        leader_code="import subprocess,sys,time; p=subprocess.Popen([sys.executable,'-u','-c',sys.argv[1]],stdout=subprocess.PIPE,text=True); assert p.stdout.readline().strip()=='ready'; print(p.pid,flush=True); time.sleep(60)"
        leader=subprocess.Popen([sys.executable,'-u','-c',leader_code,child_code],stdout=subprocess.PIPE,text=True,start_new_session=True)
        unrelated=subprocess.Popen([sys.executable,'-c','import time; time.sleep(60)'],start_new_session=True)
        self.assertEqual(os.getpgid(leader.pid),leader.pid)
        try:
            child=int(leader.stdout.readline())
            rpc=JsonRpcProcess([]);rpc.proc=leader
            rpc.terminate()
            rpc.terminate()  # Duplicate cancellation is harmless.
            self.assertIsNotNone(leader.poll())
            deadline=time.monotonic()+3
            while time.monotonic()<deadline:
                state=subprocess.run(['ps','-o','stat=','-p',str(child)],capture_output=True,text=True).stdout.strip()
                if not state or state.startswith('Z'):break
                time.sleep(.05)
            self.assertTrue(not state or state.startswith('Z'),'descendant is still running')
            self.assertIsNone(unrelated.poll(),'unrelated job was killed')
        finally:
            for proc in (leader,unrelated):
                try:os.killpg(proc.pid,signal.SIGKILL)
                except ProcessLookupError:pass
                proc.wait(timeout=5)
            leader.stdout.close()

    def test_rpc_cleanup_error_is_retryable_and_visible(self):
        rpc=JsonRpcProcess([]);rpc.proc=Mock()
        rpc.proc.poll.return_value=None
        with patch('steer.jsonrpc.kill_process_group',side_effect=PermissionError('denied')):
            with self.assertRaises(PermissionError):rpc.terminate()
        self.assertFalse(rpc._closed)

    @unittest.skipIf(os.name == 'nt', 'POSIX group protection')
    def test_caller_group_is_never_signalled(self):
        with patch.object(util.os,'getpgid',return_value=os.getpgrp()),patch.object(util.os,'killpg') as kill:
            with self.assertRaisesRegex(RuntimeError,'caller'):util.kill_process_group(123)
            kill.assert_not_called()

    def test_supervisor_records_cleanup_failure(self):
        supervisor=Supervisor.__new__(Supervisor)
        supervisor.adapter=Mock()
        supervisor.adapter.close.side_effect=RuntimeError('cleanup failed')
        supervisor._session_lease=None
        supervisor._update_registry_meta=Mock()
        supervisor._registry_notice=Mock()
        supervisor._finish_cleanup()
        supervisor._update_registry_meta.assert_called_with(cleanup_status='failed',cleanup_error='cleanup failed')
        supervisor._registry_notice.assert_called_once()

    def test_supervisor_cleanup_is_idempotent(self):
        supervisor=Supervisor.__new__(Supervisor)
        supervisor.adapter=Mock();supervisor.adapter.child_pid.return_value=None
        supervisor._update_registry_meta=Mock()
        supervisor._cleanup_adapter();supervisor._cleanup_adapter()
        supervisor.adapter.close.assert_called_once()

    @unittest.skipIf(os.name == 'nt', 'POSIX fleet host telemetry')
    def test_terminal_task_with_pending_cleanup_is_not_spare_capacity(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'run').mkdir()
            registry=Mock();registry.runs_dir=root
            for cleanup in ('pending','failed','completed'):
                registry.load_meta.return_value={'status':'cancelled','cleanup_status':cleanup}
                with patch.object(hosts,'Registry',return_value=registry):observation=hosts.probe()
                self.assertEqual(observation['runs']['run'],'cancelled' if cleanup=='completed' else 'cleanup_'+cleanup)

if __name__=='__main__':unittest.main()
