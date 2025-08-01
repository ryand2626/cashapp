from cashapp.tests.common import TransactionCase


class TestWebReadGroup(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.tags = cls.env['test_new_api.multi.tag'].create([
            {'name': 'one'},
            {'name': 'two'},
            {'name': 'two'},
            {'name': 'there'},
            {'name': 'there'},
            {'name': 'there'},
        ])

    def test_web_read_group_limit_not_reached(self):
        result = self.env['test_new_api.multi.tag'].web_read_group(
            [], ['__count'], ['name'], limit=80,
        )
        self.assertEqual(result, {
            'groups': [
                {'name': 'one', 'name_count': 1, '__domain': [('name', '=', 'one')]},
                {'name': 'there', 'name_count': 3, '__domain': [('name', '=', 'there')]},
                {'name': 'two', 'name_count': 2, '__domain': [('name', '=', 'two')]},
            ],
            'length': 3,
        })

    def test_web_read_group_limit_reached(self):
        result = self.env['test_new_api.multi.tag'].web_read_group(
            [], ['__count'], ['name'], limit=2,
        )
        self.assertEqual(result, {
            'groups': [
                {'name': 'one', 'name_count': 1, '__domain': [('name', '=', 'one')]},
                {'name': 'there', 'name_count': 3, '__domain': [('name', '=', 'there')]},
            ],
            'length': 3,
        })

    def test_web_read_group_groupby_id(self):
        """ Test ['id'] as groupby, it is quite a dummy feature, but it should work """
        result = self.env['test_new_api.multi.tag'].web_read_group(
            [], ['__count'], ['id'], limit=2,
        )
        self.assertEqual(result, {
            'groups': [
                {'id': (self.tags[0].id, 'one'), 'id_count': 1, '__domain': [('id', '=', self.tags[0].id)]},
                {'id': (self.tags[1].id, 'two'), 'id_count': 1, '__domain': [('id', '=', self.tags[1].id)]},
            ],
            'length': 6,
        })
