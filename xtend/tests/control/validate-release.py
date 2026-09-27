"""Check the corresponding-source and installer boundaries, without extraction."""
import json, pathlib, tarfile
root = pathlib.Path(__file__).resolve().parents[4] / 'XTend-search-Install-0.3.0-linux-amd64'
report = {}
for name in ['xtend-search-0.3.0-source.tar.gz', 'xtend-search-0.3.0-verification.tar.gz']:
    with tarfile.open(root / name) as archive:
        members = archive.getmembers()
        for member in members:
            path = pathlib.PurePosixPath(member.name)
            assert not path.is_absolute() and '..' not in path.parts
            assert path.name not in ['.env.control', 'resume-private.pem', 'control-plane.sqlite', 'signing-key', 'owner.lock']
            assert '.secrets' not in path.parts
        report[name] = {'entries': len(members), 'privateRuntimeFiles': False, 'unsafePaths': False}
with tarfile.open(root / 'xtend-search-0.3.0-source.tar.gz') as archive:
    names = {member.name.removeprefix('./') for member in archive.getmembers()}
    for name in ['LICENSE', 'Dockerfile.control', 'Dockerfile.searxng', 'Dockerfile.control.dockerignore', '.dockerignore', 'compose.control.yml', 'xtend/vendor-inputs/ccslabs-xtend-0.8.0.tgz', 'xtend/server/standalone.mjs', 'xtend/admin/admin.rmt']:
        assert name in names, name
report['sourceRebuildInputsPresent'] = True
out = pathlib.Path(__file__).resolve().parents[2] / 'evidence/control-plane/archive-validation.json'
out.write_text(json.dumps(report, indent=2))
print(json.dumps(report))
