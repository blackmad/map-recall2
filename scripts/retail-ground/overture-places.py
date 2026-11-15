# Round 7 (lane retail-look-20261114): Overture Maps places for the Amsterdam bbox only, read straight from the
# release's public parquet with DuckDB (row-group pruning on the bbox column; the global dataset is never downloaded).
#   uv run --with duckdb python scripts/retail-ground/overture-places.py <release> <out.json>
# Output: one row per place with names.primary, taxonomy.primary, basic_category, operating_status, brand, confidence, address, sources and the point.
# Licence: Overture places, CDLA-Permissive-2.0 (and ODbL where a record's sources say OpenStreetMap).
import json, sys, duckdb
release, out = sys.argv[1], sys.argv[2]
W, S, E, N = 4.75, 52.28, 5.05, 52.43
con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';")
rows = con.execute(f"""
  SELECT id, names.primary AS name, taxonomy.primary AS cat, basic_category AS basic, operating_status AS status, brand.names.primary AS brand, confidence,
         addresses[1].freeform AS addr, list_transform(sources, lambda s: s.dataset) AS src,
         ST_X(geometry) AS lng, ST_Y(geometry) AS lat
  FROM read_parquet('s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*', hive_partitioning=1)
  WHERE bbox.xmin BETWEEN {W} AND {E} AND bbox.ymin BETWEEN {S} AND {N}
""").fetchall()
cols = ['id', 'name', 'cat', 'basic', 'status', 'brand', 'confidence', 'addr', 'src', 'lng', 'lat']
json.dump({'release': release, 'bbox': [W, S, E, N], 'licence': 'CDLA-Permissive-2.0 (ODbL where sourced from OpenStreetMap)', 'places': [dict(zip(cols, r)) for r in rows]}, open(out, 'w'))
print(f'{len(rows)} places -> {out}')
