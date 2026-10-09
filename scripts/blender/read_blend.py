"""Read-only SDNA inspection of saved Blender 5 large-buffer scenes.

No Blender runtime, mesh evaluation or export is implied by this reader. The
embedded schema supplies every field offset; unsupported files fail closed.
Format reference: Blender BLO_core_bhead.hh and 5.0 core release notes.
"""
from pathlib import Path
import re
import struct


class BlendFile:
    def __init__(self, path):
        data = Path(path).read_bytes()
        if data[:4] == b'\x28\xb5\x2f\xfd':
            from compression import zstd
            data = zstd.decompress(data)
        if data[:12] != b'BLENDER17-01' or data[12:13] != b'v':
            raise ValueError('Only little-endian Blender large-buffer format 01 is supported')
        self.blocks = []
        self.addresses = {}
        cursor = 17
        scope = 0
        while cursor < len(data):
            if cursor + 32 > len(data):
                raise ValueError('Truncated block header')
            code, schema, address, size, count = struct.unpack_from('<4siQqq', data, cursor)
            cursor += 32
            if size < 0 or count < 0 or cursor + size > len(data):
                raise ValueError('Invalid block extent')
            if code != b'DATA': scope += 1
            block = dict(code=code, schema=schema, address=address, count=count, scope=scope,
                         data=memoryview(data)[cursor:cursor + size])
            self.blocks.append(block)
            if address:
                key = (scope, address)
                if key in self.addresses:
                    raise ValueError('Duplicate block address')
                self.addresses[key] = block
            cursor += size
            if code == b'ENDB':
                break
        if cursor != len(data) or self.blocks[-1]['code'] != b'ENDB':
            raise ValueError('Missing terminator or trailing data')
        dna = [b for b in self.blocks if b['code'] == b'DNA1']
        if len(dna) != 1:
            raise ValueError('Expected one embedded schema')
        self._schema(bytes(dna[0]['data']))
        self.ids = {}
        for block in self.blocks:
            if block['code'][2:] == b'\0\0' and block['address']:
                if block['address'] in self.ids: raise ValueError('Duplicate ID address')
                self.ids[block['address']] = block

    def _schema(self, data):
        cursor = 0
        def marker(value):
            nonlocal cursor
            if data[cursor:cursor + 4] != value:
                raise ValueError('Invalid schema marker')
            cursor += 4
        def strings():
            nonlocal cursor
            count, = struct.unpack_from('<I', data, cursor)
            cursor += 4
            out = []
            for _ in range(count):
                end = data.index(b'\0', cursor)
                out.append(data[cursor:end].decode('ascii'))
                cursor = end + 1
            cursor = (cursor + 3) & ~3
            return out
        marker(b'SDNA'); marker(b'NAME'); names = strings()
        marker(b'TYPE'); types = strings()
        marker(b'TLEN')
        lengths = struct.unpack_from('<' + 'H' * len(types), data, cursor)
        cursor = (cursor + 2 * len(types) + 3) & ~3
        marker(b'STRC')
        count, = struct.unpack_from('<I', data, cursor); cursor += 4
        self.structs = []
        self.types = {}
        for _ in range(count):
            type_id, fields_count = struct.unpack_from('<HH', data, cursor); cursor += 4
            fields, offset = {}, 0
            for _ in range(fields_count):
                field_type, name_id = struct.unpack_from('<HH', data, cursor); cursor += 4
                declaration = names[name_id]
                dimensions = [int(n) for n in re.findall(r'\[(\d+)\]', declaration)]
                elements = 1
                for dimension in dimensions: elements *= dimension
                pointer = '*' in declaration
                size = (8 if pointer else lengths[field_type]) * elements
                name = re.sub(r'\[.*', '', declaration).lstrip('*')
                fields[name] = dict(type=types[field_type], offset=offset, size=size,
                                    pointer=pointer, elements=elements, declaration=declaration)
                offset += size
            if offset != lengths[type_id]:
                raise ValueError(f'Schema padding mismatch: {types[type_id]} {offset} != {lengths[type_id]}')
            schema = dict(name=types[type_id], size=offset, fields=fields)
            self.structs.append(schema)
            self.types[schema['name']] = schema

    def records(self, type_name):
        for block in self.blocks:
            if self.structs[block['schema']]['name'] == type_name:
                schema = self.types[type_name]
                if len(block['data']) != block['count'] * schema['size']:
                    raise ValueError('Record extent mismatch')
                for i in range(block['count']):
                    yield block, i * schema['size']

    def field(self, block, offset, type_name, name):
        field = self.types[type_name]['fields'][name]
        start = offset + field['offset']
        raw = block['data'][start:start + field['size']]
        if len(raw) != field['size']: raise ValueError('Field outside block')
        formats = {'char':'b', 'uchar':'B', 'short':'h', 'ushort':'H', 'int':'i',
                   'uint':'I', 'int8_t':'b', 'uint8_t':'B', 'int64_t':'q', 'uint64_t':'Q', 'float':'f', 'double':'d'}
        if field['pointer']: fmt = 'Q'
        elif field['type'] in formats: fmt = formats[field['type']]
        else: return raw
        if field['type'] == 'char' and not field['pointer'] and field['elements'] > 1:
            return bytes(raw).split(b'\0', 1)[0].decode('utf8')
        values = struct.unpack('<' + fmt * field['elements'], raw)
        return values[0] if len(values) == 1 else values

    def resolve(self, owner, address, id_type=None):
        if not address: raise ValueError('Null pointer')
        block = self.ids.get(address) if id_type else self.addresses.get((owner['scope'], address))
        if block is None: raise ValueError('Unresolved scoped pointer')
        if id_type and self.structs[block['schema']]['name'] != id_type:
            raise ValueError('Unexpected ID pointer type')
        return block

    def properties(self, owner):
        address = self.field(owner, 0, 'ID', 'properties')
        if not address: return {}
        active = set()
        def decode(pointer):
            if pointer in active: raise ValueError('Cyclic property graph')
            active.add(pointer)
            block = self.resolve(owner, pointer)
            kind = self.field(block, 0, 'IDProperty', 'type')
            offset = self.types['IDProperty']['fields']['data']['offset']
            if kind == 6:
                group = offset + self.types['IDPropertyData']['fields']['group']['offset']
                child = self.field(block, group, 'ListBase', 'first')
                value, seen = {}, set()
                while child:
                    if child in seen: raise ValueError('Cyclic property list')
                    seen.add(child)
                    item = self.resolve(owner, child)
                    name = self.field(item, 0, 'IDProperty', 'name')
                    if name in value: raise ValueError('Duplicate property name')
                    value[name] = decode(child)
                    child = self.field(item, 0, 'IDProperty', 'next')
                if len(value) != self.field(block, 0, 'IDProperty', 'len'):
                    raise ValueError('Property group count mismatch')
            elif kind == 0:
                target = self.resolve(owner, self.field(block, offset, 'IDPropertyData', 'pointer'))
                length = self.field(block, 0, 'IDProperty', 'len')
                raw = bytes(target['data'])
                if len(raw) != length or raw[-1:] != b'\0': raise ValueError('Invalid property string')
                value = raw[:-1].decode('utf8')
            elif kind in (1, 10):
                value = self.field(block, offset, 'IDPropertyData', 'val')
                if kind == 10:
                    if value not in (0, 1): raise ValueError('Invalid boolean property')
                    value = bool(value)
            elif kind in (2, 8):
                start = offset + self.types['IDPropertyData']['fields']['val']['offset']
                value, = struct.unpack_from('<f' if kind == 2 else '<d', block['data'], start)
            elif kind == 5:
                subtype = self.field(block,0,'IDProperty','subtype')
                fmt = {1:'i',2:'f',8:'d',10:'b'}.get(subtype)
                if not fmt: raise ValueError('Unsupported property array subtype')
                length = self.field(block,0,'IDProperty','len')
                target = self.resolve(owner,self.field(block,offset,'IDPropertyData','pointer'))
                if len(target['data']) != length * struct.calcsize(fmt):
                    raise ValueError('Property array extent mismatch')
                value = list(struct.unpack('<'+fmt*length,target['data']))
            else:
                raise ValueError(f'Unsupported property type {kind}')
            active.remove(pointer)
            return value
        return decode(address)

    def mesh_arrays(self, mesh):
        counts = {key: self.field(mesh, 0, 'Mesh', key) for key in ('totvert', 'totpoly', 'totloop')}
        offset = self.types['Mesh']['fields']['attribute_storage']['offset']
        number = self.field(mesh, offset, 'AttributeStorage', 'dna_attributes_num')
        attributes = self.resolve(mesh, self.field(mesh, offset, 'AttributeStorage', 'dna_attributes'))
        if len(attributes['data']) != number * self.types['Attribute']['size']:
            raise ValueError('Attribute record extent mismatch')
        result = {}
        for i in range(number):
            start = i * self.types['Attribute']['size']
            raw_name = self.resolve(mesh, self.field(attributes, start, 'Attribute', 'name'))
            name = bytes(raw_name['data']).rstrip(b'\0').decode('utf8')
            array = self.resolve(mesh, self.field(attributes, start, 'Attribute', 'data'))
            storage = self.structs[array['schema']]['name']
            if storage not in ('AttributeArray', 'AttributeSingle'):
                raise ValueError('Unsupported attribute storage')
            size = self.field(array, 0, storage, 'size') if storage == 'AttributeArray' else 1
            single = self.field(array, 0, storage, 'is_single') if storage == 'AttributeArray' else 1
            raw = self.resolve(mesh, self.field(array, 0, storage, 'data'))
            result[name] = dict(type=self.field(attributes,start,'Attribute','data_type'),
                                domain=self.field(attributes,start,'Attribute','domain'),
                                size=size, single=single, data=raw['data'])
        for name, dtype, domain, count, stride in (
                ('position',7,0,counts['totvert'],12),
                ('.corner_vert',3,3,counts['totloop'],4)):
            attribute = result[name]
            if (attribute['type'],attribute['domain'],attribute['size'],attribute['single']) != (dtype,domain,count,0):
                raise ValueError(f'Unexpected {name} layout')
            if len(attribute['data']) != count * stride: raise ValueError('Attribute extent mismatch')
        positions = list(struct.iter_unpack('<fff',result['position']['data']))
        corners = [v[0] for v in struct.iter_unpack('<i',result['.corner_vert']['data'])]
        raw = self.resolve(mesh,self.field(mesh,0,'Mesh','poly_offset_indices'))
        offsets = [v[0] for v in struct.iter_unpack('<i',raw['data'])]
        if len(offsets) != counts['totpoly'] + 1 or offsets[0] != 0 or offsets[-1] != len(corners):
            raise ValueError('Invalid polygon offsets')
        polygons = [corners[a:z] for a,z in zip(offsets,offsets[1:])]
        if any(len(face)<3 for face in polygons) or any(v<0 or v>=len(positions) for v in corners):
            raise ValueError('Invalid polygon topology')
        return positions, polygons, result


if __name__ == '__main__':
    import argparse, json
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('path')
    parser.add_argument('--types', nargs='+', default=['Object', 'Mesh', 'CustomData', 'CustomDataLayer', 'IDProperty'])
    args = parser.parse_args()
    blend = BlendFile(args.path)
    print(json.dumps({name: blend.types[name] for name in args.types}, indent=2))
