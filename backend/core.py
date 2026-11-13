"""Database, validation and compatibility with the existing Node SQLite store."""
import hashlib
import json
import math
import os
import re
import secrets
import sqlite3
import time
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
IST = timezone(timedelta(hours=5, minutes=30))
ENTITIES = ('customers', 'enquiries', 'tasks', 'orders', 'products', 'settings')
connection = ContextVar('lumera_connection', default=None)


def now():
    return int(time.time() * 1000)


def iso(value=None):
    return datetime.fromtimestamp((now() if value is None else value) / 1000, timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def parse_date(value):
    try:
        dt = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        return int(dt.replace(tzinfo=dt.tzinfo or timezone.utc).timestamp() * 1000)
    except (ValueError, TypeError, OverflowError):
        raise ApiError(400, 'Invalid due date')


def uid():
    import uuid
    return str(uuid.uuid4())


def dumps(value):
    return json.dumps(value, separators=(',', ':'), ensure_ascii=False, allow_nan=False)


def seed(name):
    return json.loads((ROOT / 'seeds' / f'{name}.json').read_text(encoding='utf-8'))


def connect(path=None):
    filename = Path(path or os.environ.get('DATABASE_PATH', 'data/lumera.sqlite')).resolve()
    filename.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(filename, timeout=15, isolation_level=None, check_same_thread=False)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    db.execute('PRAGMA journal_mode=WAL')
    return db


def initialize(db):
    version = db.execute('PRAGMA user_version').fetchone()[0]
    check(version <= 3, 'Database schema is newer than this backend', 503)
    db.executescript((ROOT / 'schema.sql').read_text())
    with database(db), transaction():
        for product in seed('products'):
            run('INSERT OR IGNORE INTO products VALUES(?,?,?)', product['slug'], dumps({**product, 'stock': 0, 'active': True}), iso())
        for index, starter in enumerate(seed('automations')):
            run('INSERT OR IGNORE INTO auto_workflows(id,name,draft,created_at,updated_at) VALUES(?,?,?,?,?)', f'preset-{index}', starter['name'], dumps(starter['definition']), now(), now())


@contextmanager
def database(db):
    token = connection.set(db)
    try:
        yield db
    finally:
        connection.reset(token)


def run(sql, *args):
    return connection.get().execute(sql, args)


def one(sql, *args):
    row = run(sql, *args).fetchone()
    return dict(row) if row else None


def all_rows(sql, *args):
    return [dict(row) for row in run(sql, *args).fetchall()]


@contextmanager
def transaction():
    db = connection.get()
    if db.in_transaction:
        # Nested business operations participate in their caller's atomic transaction.
        yield
        return
    db.execute('BEGIN IMMEDIATE')
    try:
        yield
        db.execute('COMMIT')
    except BaseException:
        db.execute('ROLLBACK')
        raise


def decode(row):
    if not row:
        return None
    value = {**json.loads(row['data']), 'id': row['id'], 'createdAt': row['created_at']}
    if 'customer_id' in row:
        value['customerId'] = row['customer_id']
    return value


def record(table, key):
    check(table in ENTITIES, 'Unknown resource', 404)
    return decode(one(f'SELECT * FROM {table} WHERE id=?', key))


def records(table):
    check(table in ENTITIES, 'Unknown resource', 404)
    return [decode(row) for row in all_rows(f'SELECT * FROM {table} ORDER BY created_at DESC')]


def save(table, key, data, customer_id=None):
    check(table in ENTITIES, 'Unknown resource', 404)
    if table == 'customers':
        run('INSERT INTO customers VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,data=excluded.data', key, data['email'], dumps(data), iso())
    elif table in ('orders', 'enquiries', 'tasks'):
        run(f'INSERT INTO {table} VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data', key, customer_id, dumps(data), iso())
    else:
        run(f'INSERT INTO {table} VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data', key, dumps(data), iso())
    return record(table, key)


def audit(actor, action, entity):
    run('INSERT INTO audit VALUES(?,?,?,?,?)', uid(), actor, action, entity, iso())


class ApiError(Exception):
    def __init__(self, status, message):
        self.status = status
        self.message = message
        super().__init__(message)


def check(condition, message, status=400):
    if not condition:
        raise ApiError(status, message)


def text(value, label, maximum=500, required=True):
    check(value is None or isinstance(value, str), f'{label} must be text')
    result = (value or '').strip()
    check((not required or bool(result)) and len(result) <= maximum, f'Invalid {label}')
    return result


def email(value):
    value = text(value, 'email', 254).lower()
    check(re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value), 'Enter a valid email')
    return value


def number(value, label, maximum=100000000):
    check(type(value) in (int, float) and math.isfinite(value) and 0 <= value <= maximum, f'Invalid {label}')
    return value


def choice(value, options, label):
    check(isinstance(value, str) and value in options, f'Invalid {label}')
    return value


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    # Node scryptSync defaults: N=16384, r=8, p=1, salt is its UTF-8 hex string.
    key = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64)
    return f'{salt}:{key.hex()}'


def verify_password(password, stored):
    try:
        salt, expected = stored.split(':')
        actual = hash_password(password, salt).split(':')[1]
        return secrets.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False
