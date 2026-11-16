"""Offline runtime-lock, CLI and ordinary Markdown compatibility checks.

Run in the backend image with the same fixture environment as upstream-gate.sh.
These are functional checks, not exploit or denial-of-service tests.
"""
import importlib.metadata
import os
from pathlib import Path
import re
import subprocess
import sys
import unittest
from unittest.mock import patch


class DependencyContract(unittest.TestCase):
    def test_runtime_distributions_match_complete_lock(self):
        # Validate the actual resolved image, not merely the direct requirements.
        lock = Path('xtend/requirements.lock.txt')
        normalize = lambda name: re.sub(r'[-_.]+', '-', name).lower()
        expected = {}
        for line in lock.read_text(encoding='utf-8').splitlines():
            if not line.strip() or line.startswith('#'):
                continue
            name, version = line.split('==')
            self.assertNotIn(normalize(name), expected)
            expected[normalize(name)] = version
        installed = {normalize(d.metadata['Name']): d.version for d in importlib.metadata.distributions()}
        # Image/bootstrap tooling is not an application dependency.
        runtime = {name: version for name, version in installed.items()
                   if name not in {'pip', 'setuptools', 'wheel'}}
        self.assertEqual(runtime, expected)

    def test_typer_module_help_and_nested_options(self):
        commands = [
            ('searx.data', ['--help'], 'state'),
            ('searx.enginelib', ['--help'], 'cache'),
            ('searx.enginelib', ['cache', 'maintenance', '--help'], 'truncate'),
            ('searx.favicons', ['--help'], 'cache'),
            ('searx.favicons', ['cache', 'maintenance', '--help'], 'debug'),
        ]
        for module, args, expected in commands:
            with self.subTest(module=module, args=args):
                result = subprocess.run([sys.executable, '-m', module, *args],
                                        capture_output=True, text=True, timeout=30,
                                        env={**os.environ, 'NO_COLOR': '1', 'TERM': 'dumb'})
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertIn(expected, result.stdout.lower())

    def test_typer_boolean_options_reach_engine_command(self):
        from typer.testing import CliRunner
        from searx import enginelib
        with patch.object(enginelib.ENGINES_CACHE, 'maintenance') as maintenance:
            result = CliRunner().invoke(enginelib.app, ['maintenance', '--no-force', '--truncate'])
            self.assertEqual(result.exit_code, 0, result.output)
            maintenance.assert_called_once_with(force=False, truncate=True)

    def test_commonmark_plain_text_conversion(self):
        from searx.utils import markdown_to_text
        examples = [
            ('## Headline', 'Headline'),
            ('Read **bold** and *italic* with `code`.', 'Read bold and italic with code.'),
            ('[Guide](https://example.org/guide)', 'Guide'),
            ('A &amp; B', 'A & B'),
            ('', ''),
        ]
        for source, expected in examples:
            with self.subTest(source=source):
                self.assertEqual(markdown_to_text(source), expected)

    def test_lemmy_comment_uses_markdown_conversion(self):
        from searx.engines import lemmy
        fixture = {'comments': [{
            'creator': {'name': 'fixture-user'},
            'comment': {'content': '**Hello** [community](https://example.org/)',
                        'ap_id': 'https://example.org/comment/1', 'published': '2026-11-16T09:00:00Z'},
            'post': {'name': 'Fixture post'},
            'counts': {'upvotes': 3, 'downvotes': 0},
            'community': {'title': 'Fixture community'},
        }]}
        with patch.object(lemmy, 'gettext', side_effect=lambda text: text):
            results = lemmy._get_comments(fixture)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['content'], 'Hello community')
        self.assertEqual(results[0]['url'], 'https://example.org/comment/1')


if __name__ == '__main__':
    unittest.main(verbosity=2)
