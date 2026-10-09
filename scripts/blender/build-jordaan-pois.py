"""Compatibility entry point for the five Jordaan recipes.

See build-buildings.py for the reusable CLI and README.md for source auditing.
Importing this module never imports Blender, clears a scene or starts rendering.
"""
import runpy,sys
from pathlib import Path

def main(argv=None):
    args=list(argv if argv is not None else (sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]))
    if not any(a in args for a in ('--all','--building','--gallery')):
        for id in ('rozengracht-158','elandsgracht-96','rozengracht-160','lauriergracht-50','rozengracht-212'):args.extend(['--building',id])
    cli=runpy.run_path(str(Path(__file__).with_name('build-buildings.py')),run_name='building_library_cli')
    return cli['main'](args)

if __name__=='__main__':main()
