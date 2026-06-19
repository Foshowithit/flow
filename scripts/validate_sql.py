#!/usr/bin/env python3
"""Lightweight SQL schema validation for Flow control-plane/schema.sql."""
import re
import sys

def main():
    try:
        sql = open('control-plane/schema.sql').read()
    except FileNotFoundError:
        print('  ❌ control-plane/schema.sql not found')
        sys.exit(1)

    creates = re.findall(r'CREATE TABLE IF NOT EXISTS (\w+)', sql)
    if len(creates) >= 4:
        print(f'  ✅ {len(creates)} CREATE TABLE statements found: {creates}')
    else:
        print(f'  ⚠️  Only {len(creates)} CREATE TABLE statements found')
        sys.exit(1)

    # Check foreign key references reference existing tables
    refs = re.findall(r'REFERENCES (\w+)', sql)
    tbl = set(creates)
    for r in refs:
        if r not in tbl:
            print(f'  ⚠️  FK ref to {r} without CREATE')
    print('  ✅ SQL structure looks reasonable')

if __name__ == '__main__':
    main()
