# Part of CashApp. See LICENSE file for full copyright and licensing details.

from datetime import datetime, timezone
from unittest.mock import patch

from werkzeug.datastructures import ResponseCacheControl
from werkzeug.http import parse_cache_control_header

import cashapp
from cashapp.http import Session
from cashapp.addons.base.tests.common import HttpCaseWithUserDemo
from cashapp.tools.func import lazy_property
from cashapp.addons.test_http.utils import MemoryGeoipResolver, MemorySessionStore

HTTP_DATETIME_FORMAT = '%a, %d %b %Y %H:%M:%S GMT'


class TestHttpBase(HttpCaseWithUserDemo):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        geoip_resolver = MemoryGeoipResolver()
        session_store = MemorySessionStore(session_class=Session)

        lazy_property.reset_all(cashapp.http.root)
        cls.addClassCleanup(lazy_property.reset_all, cashapp.http.root)
        cls.classPatch(cashapp.conf, 'server_wide_modules', ['base', 'web', 'test_http'])
        cls.classPatch(cashapp.http.Application, 'session_store', session_store)
        cls.classPatch(cashapp.http.Application, 'geoip_city_db', geoip_resolver)
        cls.classPatch(cashapp.http.Application, 'geoip_country_db', geoip_resolver)

    def setUp(self):
        super().setUp()
        cashapp.http.root.session_store.store.clear()

    def db_url_open(self, url, *args, allow_redirects=False, **kwargs):
        return self.url_open(url, *args, allow_redirects=allow_redirects, **kwargs)

    def nodb_url_open(self, url, *args, allow_redirects=False, **kwargs):
        with patch('cashapp.http.db_list') as db_list, \
             patch('cashapp.http.db_filter') as db_filter:
            db_list.return_value = []
            db_filter.return_value = []
            return self.url_open(url, *args, allow_redirects=allow_redirects, **kwargs)

    def multidb_url_open(self, url, *args, allow_redirects=False, dblist=(), **kwargs):
        dblist = dblist or self.db_list
        assert len(dblist) >= 2, "There should be at least 2 databases"
        with patch('cashapp.http.db_list') as db_list, \
             patch('cashapp.http.db_filter') as db_filter, \
             patch('cashapp.http.Registry') as Registry:
            db_list.return_value = dblist
            db_filter.side_effect = lambda dbs, host=None: [db for db in dbs if db in dblist]
            Registry.return_value = self.registry
            return self.url_open(url, *args, allow_redirects=allow_redirects, **kwargs)

    def parse_http_cache_control(self, cache_control):
        return parse_cache_control_header(cache_control, None, ResponseCacheControl)

    def assertCacheControl(self, response, cache_control):
        self.assertEqual(
           self.parse_http_cache_control(response.headers['Cache-Control']),
           self.parse_http_cache_control(cache_control),
        )

    def parse_http_expires(self, expires):
        return datetime.strptime(expires, HTTP_DATETIME_FORMAT).replace(tzinfo=timezone.utc)
