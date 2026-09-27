import unittest
from sanitize_facade_svg import sanitize_svg

class SvgTest(unittest.TestCase):
    def test_geometry(self):
        out = sanitize_svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><rect x="10" y="20" width="30" height="40" fill="#aabbcc"/></svg>', 679, 699)
        self.assertIn('width="679"', out)
    def test_active_or_remote_content(self):
        for child in ['<script/>', '<image href="file:///tmp/a"/>', '<rect onclick="alert(1)"/>', '<rect fill="url(http://example.com/a)"/>', '<foreignObject/>']:
            with self.assertRaises(ValueError):
                sanitize_svg('<svg viewBox="0 0 1000 1000">'+child+'</svg>', 100, 100)
    def test_wrong_frame(self):
        with self.assertRaises(ValueError):
            sanitize_svg('<svg viewBox="0 0 200 100"/>', 100, 100)

if __name__ == '__main__': unittest.main()
