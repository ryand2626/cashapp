# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

from cashapp.addons.mail.tests.common import mail_new_test_user
from cashapp.tests import common


class TestHrCommon(common.TransactionCase):

    @classmethod
    def setUpClass(cls):
        super(TestHrCommon, cls).setUpClass()

        cls.res_users_hr_officer = mail_new_test_user(cls.env, login='hro', groups='base.group_user,hr.group_hr_user', name='HR Officer', email='hro@example.com')
