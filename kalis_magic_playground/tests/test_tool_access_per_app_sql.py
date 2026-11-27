"""Run only against a new disposable local PostgreSQL cluster; never a configured DB."""
import json
import pathlib
import shutil
import socket
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
BIN = {name: shutil.which(name) for name in ('initdb', 'pg_ctl', 'psql')}


@unittest.skipUnless(all(BIN.values()), 'local initdb/pg_ctl/psql unavailable; SQL execution not verified')
class ToolAccessSqlTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='.pg-access-', dir=ROOT)
        cls.data = pathlib.Path(cls.temp.name) / 'data'
        subprocess.run([BIN['initdb'], '-D', str(cls.data), '-A', 'trust', '-U', 'postgres'], check=True, capture_output=True)
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            cls.port = probe.getsockname()[1]
        subprocess.run([BIN['pg_ctl'], '-D', str(cls.data), '-l', str(pathlib.Path(cls.temp.name) / 'server.log'),
                        '-o', f"-h 127.0.0.1 -p {cls.port} -k ''", '-w', 'start'], check=True, capture_output=True)

    @classmethod
    def tearDownClass(cls):
        subprocess.run([BIN['pg_ctl'], '-D', str(cls.data), '-m', 'immediate', '-w', 'stop'], check=True, capture_output=True)
        cls.temp.cleanup()

    def sql(self, text, success=True):
        result = subprocess.run([BIN['psql'], '-X', '-h', '127.0.0.1', '-p', str(self.port), '-U', 'postgres',
                                 '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], input=text, text=True, capture_output=True)
        self.assertEqual(result.returncode == 0, success, result.stdout + result.stderr)
        return result

    def script(self, relative, success=True):
        return self.sql((ROOT / relative).read_text(), success)

    def setUp(self):
        # This connection points exclusively to the cluster created above.
        self.sql('drop table if exists public.tool_access; create table public.tool_access ('
                 'id uuid primary key, email text not null, tool text, status text not null, lifetime boolean not null);'
                 "insert into public.tool_access values ('00000000-0000-4000-8000-000000000001',"
                 "'synthetic@example.test','all','approved',true);")

    def forward(self, success=True):
        return self.script('supabase/migrations/20261127_tool_access_per_app.sql', success)

    def rollback(self, success=True):
        return self.script('supabase/rollback/20261127_tool_access_per_app.sql', success)

    def snapshot(self):
        return self.sql('select row_to_json(t) from public.tool_access t order by id;').stdout

    def test_forward_reexecution_preserves_legacy_all(self):
        before = json.loads(self.snapshot())
        output = self.forward()
        self.assertIn('rows=1', output.stderr)
        self.assertIn('"tool": "all"', output.stderr)
        after = json.loads(self.snapshot())
        self.assertEqual({key: after[key] for key in before}, before)
        self.assertIsNone(after['per_app_access'])
        self.forward()
        self.assertEqual(json.loads(self.snapshot()), after)

    def test_mismatched_column_definition_stops_before_change(self):
        for definition in ['text', 'jsonb not null default \'{}\'::jsonb', "jsonb default '{}'::jsonb"]:
            with self.subTest(definition=definition):
                self.setUp()
                self.sql(f'alter table public.tool_access add column per_app_access {definition};')
                before = self.snapshot()
                self.forward(False)
                self.assertEqual(self.snapshot(), before)

    def test_historical_unsafe_projection_requires_roll_forward(self):
        self.forward()
        grants = {'calc': {'status': 'approved', 'lifetime': True}, 'stopwatch': {'status': 'pending', 'lifetime': False}}
        self.sql("update public.tool_access set lifetime=false, per_app_access='" + json.dumps(grants) + "'::jsonb;")
        before = self.snapshot()
        output = self.forward(False)
        self.assertIn('mismatched rows=1', output.stderr)
        self.assertIn('00000000-0000-4000-8000-000000000001', output.stderr)
        self.assertEqual(self.snapshot(), before)

    def test_valid_mixed_json_projection_reexecutes_without_changing_authority(self):
        self.forward()
        grants = {'calc': {'status': 'approved', 'lifetime': True}, 'stopwatch': {'status': 'pending', 'lifetime': False}}
        self.sql("update public.tool_access set tool='calc', lifetime=true, per_app_access='" + json.dumps(grants) + "'::jsonb;")
        before = self.snapshot()
        self.forward()
        self.assertEqual(self.snapshot(), before)

    def test_forward_rejects_unexpected_authoritative_json(self):
        self.forward()
        self.sql("update public.tool_access set per_app_access='[1]'::jsonb;")
        before = self.snapshot()
        result = self.forward(False)
        self.assertIn('invalid rows=1', result.stderr)
        self.assertEqual(self.snapshot(), before)

    def test_rollback_blocks_mixed_and_unexpected_json_without_any_write(self):
        good = {'status': 'approved', 'lifetime': True}
        invalid = [None, [], {}, {'unknown': good}, {'calc': None}, {'calc': {'status': 'approved'}},
                   {'calc': {**good, 'future': True}}, {'calc': {'status': 'approved', 'lifetime': 'true'}},
                   {'calc': good, 'stopwatch': {'status': 'pending', 'lifetime': True}},
                   {'calc': good, 'stopwatch': {'status': 'approved', 'lifetime': False}}]
        for grants in invalid:
            with self.subTest(grants=grants):
                self.setUp()
                self.forward()
                self.sql("update public.tool_access set per_app_access='" + json.dumps(grants) + "'::jsonb;")
                before = self.snapshot()
                result = self.rollback(False)
                self.assertIn('blocked rows=1', result.stderr)
                self.assertIn('00000000-0000-4000-8000-000000000001', result.stderr)
                self.assertEqual(self.snapshot(), before)

    def test_lossless_rollback_preserves_each_state_and_duration_and_reexecutes(self):
        for tools in [('calc',), ('stopwatch',), ('calc', 'stopwatch')]:
            for status in ['pending', 'approved']:
                for lifetime in [False, True]:
                    self.setUp()
                    self.forward()
                    grants = {tool: {'status': status, 'lifetime': lifetime} for tool in tools}
                    self.sql("update public.tool_access set per_app_access='" + json.dumps(grants) + "'::jsonb;")
                    self.rollback()
                    row = json.loads(self.snapshot())
                    self.assertEqual((row['tool'], row['status'], row['lifetime']),
                                     ('all' if len(tools) == 2 else tools[0], status, lifetime))
                    self.assertIsNone(row['per_app_access'])
                    before = self.snapshot()
                    self.rollback()
                    self.assertEqual(self.snapshot(), before)


if __name__ == '__main__':
    unittest.main(verbosity=2)
