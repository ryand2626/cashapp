# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

from types import SimpleNamespace
from unittest.mock import patch

from cashapp import SUPERUSER_ID
from cashapp.addons.base.models.res_users import is_selection_groups, get_selection_groups, name_selection_groups
from cashapp.exceptions import UserError, ValidationError
from cashapp.http import _request_stack
from cashapp.tests import Form, TransactionCase, new_test_user, tagged, HttpCase, users
from cashapp.tools import mute_logger


class TestUsers(TransactionCase):

    def test_name_search(self):
        """ Check name_search on user. """
        User = self.env['res.users']

        test_user = User.create({'name': 'Flad the Impaler', 'login': 'vlad'})
        like_user = User.create({'name': 'Wlad the Impaler', 'login': 'vladi'})
        other_user = User.create({'name': 'Nothing similar', 'login': 'nothing similar'})
        all_users = test_user | like_user | other_user

        res = User.name_search('vlad', operator='ilike')
        self.assertEqual(User.browse(i[0] for i in res) & all_users, test_user)

        res = User.name_search('vlad', operator='not ilike')
        self.assertEqual(User.browse(i[0] for i in res) & all_users, all_users)

        res = User.name_search('', operator='ilike')
        self.assertEqual(User.browse(i[0] for i in res) & all_users, all_users)

        res = User.name_search('', operator='not ilike')
        self.assertEqual(User.browse(i[0] for i in res) & all_users, User)

        res = User.name_search('lad', operator='ilike')
        self.assertEqual(User.browse(i[0] for i in res) & all_users, test_user | like_user)

        res = User.name_search('lad', operator='not ilike')
        self.assertEqual(User.browse(i[0] for i in res) & all_users, other_user)

    def test_user_partner(self):
        """ Check that the user partner is well created """

        User = self.env['res.users']
        Partner = self.env['res.partner']
        Company = self.env['res.company']

        company_1 = Company.create({'name': 'company_1'})
        company_2 = Company.create({'name': 'company_2'})

        partner = Partner.create({
            'name': 'Bob Partner',
            'company_id': company_2.id
        })

        # case 1 : the user has no partner
        test_user = User.create({
            'name': 'John Smith',
            'login': 'jsmith',
            'company_ids': [company_1.id],
            'company_id': company_1.id
        })

        self.assertFalse(
            test_user.partner_id.company_id,
            "The partner_id linked to a user should be created without any company_id")

        # case 2 : the user has a partner
        test_user = User.create({
            'name': 'Bob Smith',
            'login': 'bsmith',
            'company_ids': [company_1.id],
            'company_id': company_1.id,
            'partner_id': partner.id
        })

        self.assertEqual(
            test_user.partner_id.company_id,
            company_1,
            "If the partner_id of a user has already a company, it is replaced by the user company"
        )


    def test_change_user_company(self):
        """ Check the partner company update when the user company is changed """

        User = self.env['res.users']
        Company = self.env['res.company']

        test_user = User.create({'name': 'John Smith', 'login': 'jsmith'})
        company_1 = Company.create({'name': 'company_1'})
        company_2 = Company.create({'name': 'company_2'})

        test_user.company_ids += company_1
        test_user.company_ids += company_2

        # 1: the partner has no company_id, no modification
        test_user.write({
            'company_id': company_1.id
        })

        self.assertFalse(
            test_user.partner_id.company_id,
            "On user company change, if its partner_id has no company_id,"
            "the company_id of the partner_id shall NOT be updated")

        # 2: the partner has a company_id different from the new one, update it
        test_user.partner_id.write({
            'company_id': company_1.id
        })

        test_user.write({
            'company_id': company_2.id
        })

        self.assertEqual(
            test_user.partner_id.company_id,
            company_2,
            "On user company change, if its partner_id has already a company_id,"
            "the company_id of the partner_id shall be updated"
        )

    @mute_logger('cashapp.sql_db')
    def test_deactivate_portal_users_access(self):
        """Test that only a portal users can deactivate his account."""
        user_internal = self.env['res.users'].create({
            'name': 'Internal',
            'login': 'user_internal',
            'password': 'password',
            'groups_id': [self.env.ref('base.group_user').id],
        })

        with self.assertRaises(UserError, msg='Internal users should not be able to deactivate their account'):
            user_internal._deactivate_portal_user()

    @mute_logger('cashapp.sql_db', 'cashapp.addons.base.models.res_users_deletion')
    def test_deactivate_portal_users_archive_and_remove(self):
        """Test that if the account can not be removed, it's archived instead
        and sensitive information are removed.

        In this test, the deletion of "portal_user" will succeed,
        but the deletion of "portal_user_2" will fail.
        """
        User = self.env['res.users']
        portal_user = User.create({
            'name': 'Portal',
            'login': 'portal_user',
            'password': 'password',
            'groups_id': [self.env.ref('base.group_portal').id],
        })
        portal_partner = portal_user.partner_id

        portal_user_2 = User.create({
            'name': 'Portal',
            'login': 'portal_user_2',
            'password': 'password',
            'groups_id': [self.env.ref('base.group_portal').id],
        })
        portal_partner_2 = portal_user_2.partner_id

        (portal_user | portal_user_2)._deactivate_portal_user()

        self.assertTrue(portal_user.exists() and not portal_user.active, 'Should have archived the user 1')

        self.assertEqual(portal_user.name, 'Portal', 'Should have kept the user name')
        self.assertEqual(portal_user.partner_id.name, 'Portal', 'Should have kept the partner name')
        self.assertNotEqual(portal_user.login, 'portal_user', 'Should have removed the user login')

        asked_deletion_1 = self.env['res.users.deletion'].search([('user_id', '=', portal_user.id)])
        asked_deletion_2 = self.env['res.users.deletion'].search([('user_id', '=', portal_user_2.id)])

        self.assertTrue(asked_deletion_1, 'Should have added the user 1 in the deletion queue')
        self.assertTrue(asked_deletion_2, 'Should have added the user 2 in the deletion queue')

        # The deletion will fail for "portal_user_2",
        # because of the absence of "ondelete=cascade"
        self.cron = self.env['ir.cron'].create({
            'name': 'Test Cron',
            'user_id': portal_user_2.id,
            'model_id': self.env.ref('base.model_res_partner').id,
        })

        self.env['res.users.deletion']._gc_portal_users()

        self.assertFalse(portal_user.exists(), 'Should have removed the user')
        self.assertFalse(portal_partner.exists(), 'Should have removed the partner')
        self.assertEqual(asked_deletion_1.state, 'done', 'Should have marked the deletion as done')

        self.assertTrue(portal_user_2.exists(), 'Should have kept the user')
        self.assertTrue(portal_partner_2.exists(), 'Should have kept the partner')
        self.assertEqual(asked_deletion_2.state, 'fail', 'Should have marked the deletion as failed')

    def test_user_home_action_restriction(self):
        test_user = new_test_user(self.env, 'hello world')

        # Find an action that contains restricted context ('active_id')
        restricted_action = self.env['ir.actions.act_window'].search([('context', 'ilike', 'active_id')], limit=1)
        with self.assertRaises(ValidationError):
            test_user.action_id = restricted_action.id

        # Find an action without restricted context
        allowed_action = self.env['ir.actions.act_window'].search(['!', ('context', 'ilike', 'active_id')], limit=1)

        test_user.action_id = allowed_action.id
        self.assertEqual(test_user.action_id.id, allowed_action.id)

    def test_context_get_lang(self):
        self.env['res.lang'].with_context(active_test=False).search([
            ('code', 'in', ['fr_FR', 'es_ES', 'de_DE', 'en_US'])
        ]).write({'active': True})

        user = new_test_user(self.env, 'jackoneill')
        user = user.with_user(user)
        user.lang = 'fr_FR'

        company = user.company_id.partner_id.sudo()
        company.lang = 'de_DE'

        request = SimpleNamespace()
        request.best_lang = 'es_ES'
        request_patch = patch('cashapp.addons.base.models.res_users.request', request)
        self.addCleanup(request_patch.stop)
        request_patch.start()

        self.assertEqual(user.context_get()['lang'], 'fr_FR')
        self.env.registry.clear_cache()
        user.lang = False

        self.assertEqual(user.context_get()['lang'], 'es_ES')
        self.env.registry.clear_cache()
        request_patch.stop()

        self.assertEqual(user.context_get()['lang'], 'de_DE')
        self.env.registry.clear_cache()
        company.lang = False

        self.assertEqual(user.context_get()['lang'], 'en_US')

@tagged('post_install', '-at_install')
class TestUsers2(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user_employee = cls.env['res.users'].create({
            'name': 'employee',
            'login': 'employee',
            'groups_id': cls.env.ref('base.group_user'),
            'tz': 'UTC',
        })

    def test_change_user_login(self):
        """ Check that partner email is updated when changing user's login """

        User = self.env['res.users']
        with Form(User, view='base.view_users_form') as UserForm:
            UserForm.name = "Test User"
            UserForm.login = "test-user1"
            self.assertFalse(UserForm.email)

            UserForm.login = "test-user1@mycompany.example.org"
            self.assertEqual(
                UserForm.email, "test-user1@mycompany.example.org",
                "Setting a valid email as login should update the partner's email"
            )

    def test_reified_groups(self):
        """ The groups handler doesn't use the "real" view with pseudo-fields
        during installation, so it always works (because it uses the normal
        groups_id field).
        """
        # use the specific views which has the pseudo-fields
        f = Form(self.env['res.users'], view='base.view_users_form')
        f.name = "bob"
        f.login = "bob"
        user = f.save()

        self.assertIn(self.env.ref('base.group_user'), user.groups_id)

        # all template user groups are copied
        default_user = self.env.ref('base.default_user')
        self.assertEqual(default_user.groups_id, user.groups_id)

    def test_selection_groups(self):
        # create 3 groups that should be in a selection
        app = self.env['ir.module.category'].create({'name': 'Foo'})
        group1, group2, group0 = self.env['res.groups'].create([
            {'name': name, 'category_id': app.id}
            for name in ('User', 'Manager', 'Visitor')
        ])
        # THIS PART IS NECESSARY TO REPRODUCE AN ISSUE: group1.id < group2.id < group0.id
        self.assertLess(group1.id, group2.id)
        self.assertLess(group2.id, group0.id)
        # implication order is group0 < group1 < group2
        group2.implied_ids = group1
        group1.implied_ids = group0
        groups = group0 + group1 + group2

        # determine the name of the field corresponding to groups
        fname = next(
            name
            for name in self.env['res.users'].fields_get()
            if is_selection_groups(name) and group0.id in get_selection_groups(name)
        )
        self.assertCountEqual(get_selection_groups(fname), groups.ids)

        # create a user
        user = self.env['res.users'].create({'name': 'foo', 'login': 'foo'})

        # put user in group0, and check field value
        user.write({fname: group0.id})
        self.assertEqual(user.groups_id & groups, group0)
        self.assertEqual(user.read([fname])[0][fname], group0.id)

        # put user in group1, and check field value
        user.write({fname: group1.id})
        self.assertEqual(user.groups_id & groups, group0 + group1)
        self.assertEqual(user.read([fname])[0][fname], group1.id)

        # put user in group2, and check field value
        user.write({fname: group2.id})
        self.assertEqual(user.groups_id & groups, groups)
        self.assertEqual(user.read([fname])[0][fname], group2.id)

        normalized_values = user._remove_reified_groups({fname: group0.id})
        self.assertEqual(sorted(normalized_values['groups_id']), [(3, group1.id), (3, group2.id), (4, group0.id)])

        normalized_values = user._remove_reified_groups({fname: group1.id})
        self.assertEqual(sorted(normalized_values['groups_id']), [(3, group2.id), (4, group1.id)])

        normalized_values = user._remove_reified_groups({fname: group2.id})
        self.assertEqual(normalized_values['groups_id'], [(4, group2.id)])

    def test_read_list_with_reified_field(self):
        """ Check that read_group and search_read get rid of reified fields"""
        User = self.env['res.users']
        fnames = ['name', 'email', 'login']

        # find some reified field name
        reified_fname = next(
            fname
            for fname in User.fields_get()
            if fname.startswith(('in_group_', 'sel_groups_'))
        )

        # check that the reified field name is not aggregable
        self.assertFalse(User.fields_get([reified_fname], ['aggregator'])[reified_fname].get('aggregator'))

        # check that the reified fields are not considered invalid in search_read
        # and are ignored
        res_with_reified = User.search_read([], fnames + [reified_fname])
        res_without_reified = User.search_read([], fnames)
        self.assertEqual(res_with_reified, res_without_reified, "Reified fields should be ignored in search_read")

        # Verify that the read_group is raising an error if reified field is used as groupby
        with self.assertRaises(ValueError):
            User.read_group([], fnames + [reified_fname], [reified_fname])

    def test_reified_groups_on_change(self):
        """Test that a change on a reified fields trigger the onchange of groups_id."""
        group_public = self.env.ref('base.group_public')
        group_portal = self.env.ref('base.group_portal')
        group_user = self.env.ref('base.group_user')

        # Build the reified group field name
        user_groups = group_public | group_portal | group_user
        user_groups_ids = [str(group_id) for group_id in sorted(user_groups.ids)]
        group_field_name = f"sel_groups_{'_'.join(user_groups_ids)}"

        # <group col="4" invisible="sel_groups_1_9_10 != 1" groups="base.group_no_one" class="o_label_nowrap">
        with self.debug_mode():
            user_form = Form(self.env['res.users'], view='base.view_users_form')
        user_form.name = "Test"
        user_form.login = "Test"
        self.assertFalse(user_form.share)

        user_form[group_field_name] = group_portal.id
        self.assertTrue(user_form.share, 'The groups_id onchange should have been triggered')

        user_form[group_field_name] = group_user.id
        self.assertFalse(user_form.share, 'The groups_id onchange should have been triggered')

        user_form[group_field_name] = group_public.id
        self.assertTrue(user_form.share, 'The groups_id onchange should have been triggered')

    def test_update_user_groups_view(self):
        """Test that the user groups view can still be built if all user type groups are share"""
        self.env['res.groups'].search([
            ("category_id", "=", self.env.ref("base.module_category_user_type").id)
        ]).write({'share': True})

        self.env['res.groups']._update_user_groups_view()

    @users('employee')
    def test_self_readable_writeable_fields_preferences_form(self):
        """Test that a field protected by a `groups='...'` with a group the user doesn't belong to
        but part of the `SELF_WRITEABLE_FIELDS` is shown in the user profile preferences form and is editable"""
        my_user = self.env['res.users'].browse(self.env.user.id)
        self.assertIn(
            'email',
            my_user.SELF_WRITEABLE_FIELDS,
            "This test doesn't make sense if not tested on a field part of the SELF_WRITEABLE_FIELDS"
        )
        self.patch(self.env.registry['res.users']._fields['email'], 'groups', 'base.group_system')
        with Form(my_user, view='base.view_users_form_simple_modif') as UserForm:
            UserForm.email = "foo@bar.com"
        self.assertEqual(my_user.email, "foo@bar.com")


@tagged('post_install', '-at_install', 'res_groups')
class TestUsersGroupWarning(TransactionCase):

    @classmethod
    def setUpClass(cls):
        """
            These are the Groups and their Hierarchy we have Used to test Group warnings.

            Category groups hierarchy:
                Sales
                ├── User: All Documents
                └── Administrator
                Timesheets
                ├── User: own timesheets only
                ├── User: all timesheets
                └── Administrator
                Project
                ├── User
                └── Administrator
                Field Service
                ├── User
                └── Administrator

            Implied groups hierarchy:
                Sales / Administrator
                └── Sales / User: All Documents

                Timesheets / Administrator
                └── Timesheets / User: all timesheets
                    └── Timehseets / User: own timesheets only

                Project / Administrator
                ├── Project / User
                └── Timesheets / User: all timesheets

                Field Service / Administrator
                ├── Sales / Administrator
                ├── Project / Administrator
                └── Field Service / User
        """
        super().setUpClass()
        ResGroups = cls.env['res.groups']
        IrModuleCategory = cls.env['ir.module.category']
        categ_sales = IrModuleCategory.create({'name': 'Sales'})
        categ_project = IrModuleCategory.create({'name': 'Project'})
        categ_field_service = IrModuleCategory.create({'name': 'Field Service'})
        categ_timesheets = IrModuleCategory.create({'name': 'Timesheets'})

        # Sales
        cls.group_sales_user, cls.group_sales_administrator = ResGroups.create([
            {'name': 'User: All Documents', 'category_id': categ_sales.id},
            {'name': 'Administrator', 'category_id': categ_sales.id},
        ])
        cls.sales_categ_field = name_selection_groups((cls.group_sales_user | cls.group_sales_administrator).ids)
        cls.group_sales_administrator.implied_ids = cls.group_sales_user

        # Timesheets
        cls.group_timesheets_user_own_timesheet = ResGroups.create([
            {'name': 'User: own timesheets only', 'category_id': categ_timesheets.id}
        ])
        cls.group_timesheets_user_all_timesheet = ResGroups.create([
            {'name': 'User: all timesheets', 'category_id': categ_timesheets.id}
        ])
        cls.group_timesheets_administrator = ResGroups.create([
            {'name': 'Administrator', 'category_id': categ_timesheets.id}
        ])
        cls.timesheets_categ_field = name_selection_groups((cls.group_timesheets_user_own_timesheet |
                                                            cls.group_timesheets_user_all_timesheet |
                                                            cls.group_timesheets_administrator).ids
                                                           )
        cls.group_timesheets_administrator.implied_ids += cls.group_timesheets_user_all_timesheet
        cls.group_timesheets_user_all_timesheet.implied_ids += cls.group_timesheets_user_own_timesheet

        # Project
        cls.group_project_user, cls.group_project_admnistrator = ResGroups.create([
            {'name': 'User', 'category_id': categ_project.id},
            {'name': 'Administrator', 'category_id': categ_project.id},
        ])
        cls.project_categ_field = name_selection_groups((cls.group_project_user | cls.group_project_admnistrator).ids)
        cls.group_project_admnistrator.implied_ids = (cls.group_project_user | cls.group_timesheets_user_all_timesheet)

        # Field Service
        cls.group_field_service_user, cls.group_field_service_administrator = ResGroups.create([
            {'name': 'User', 'category_id': categ_field_service.id},
            {'name': 'Administrator', 'category_id': categ_field_service.id},
        ])
        cls.field_service_categ_field = name_selection_groups((cls.group_field_service_user | cls.group_field_service_administrator).ids)
        cls.group_field_service_administrator.implied_ids = (cls.group_sales_administrator |
                                                             cls.group_project_admnistrator |
                                                             cls.group_field_service_user).ids

        # User
        cls.test_group_user = cls.env['res.users'].create({
            'name': 'Test Group User',
            'login': 'TestGroupUser',
            'groups_id': (
                cls.env.ref('base.group_user') |
                cls.group_timesheets_administrator |
                cls.group_field_service_administrator).ids,
        })


    def test_user_group_empty_group_warning(self):
        """ User changes Empty Sales access from 'Sales: Administrator'. The
        warning should be there since 'Sales: Administrator' is required when
        user is having 'Field Service: Administrator'. When user reverts the
        changes, warning should disappear. """
        with Form(self.test_group_user.with_context(show_user_group_warning=True), view='base.view_users_form') as UserForm:
            UserForm[self.sales_categ_field] = False
            self.assertEqual(
                UserForm.user_group_warning,
                'Since Test Group User is a/an "Field Service: Administrator", they will at least obtain the right "Sales: Administrator"'
            )

            UserForm[self.sales_categ_field] = self.group_sales_administrator.id
            self.assertFalse(UserForm.user_group_warning)

    def test_user_group_inheritance_warning(self):
        """ User changes 'Sales: User' from 'Sales: Administrator'. The warning
        should be there since 'Sales: Administrator' is required when user is
        having 'Field Service: Administrator'. When user reverts the changes,
        warning should disappear. """
        with Form(self.test_group_user.with_context(show_user_group_warning=True), view='base.view_users_form') as UserForm:
            UserForm[self.sales_categ_field] = self.group_sales_user.id
            self.assertEqual(
                UserForm.user_group_warning,
                'Since Test Group User is a/an "Field Service: Administrator", they will at least obtain the right "Sales: Administrator"'
            )

            UserForm[self.sales_categ_field] = self.group_sales_administrator.id
            self.assertFalse(UserForm.user_group_warning)

    def test_user_group_inheritance_warning_multi(self):
        """ User changes 'Sales: User' from 'Sales: Administrator' and
        'Project: User' from 'Project: Administrator'. The warning should
        be there since 'Sales: Administrator' and 'Project: Administrator'
        are required when user is havning 'Field Service: Administrator'.
        When user reverts the changes For 'Sales: Administrator', warning
        should disappear for Sales Access."""
        with Form(self.test_group_user.with_context(show_user_group_warning=True), view='base.view_users_form') as UserForm:
            UserForm[self.sales_categ_field] = self.group_sales_user.id
            UserForm[self.project_categ_field] = self.group_project_user.id
            self.assertTrue(
                UserForm.user_group_warning,
                'Since Test Group User is a/an "Field Service: Administrator", they will at least obtain the right "Sales: Administrator", Project: Administrator"',
            )

            UserForm[self.sales_categ_field] = self.group_sales_administrator.id
            self.assertEqual(
                UserForm.user_group_warning,
                'Since Test Group User is a/an "Field Service: Administrator", they will at least obtain the right "Project: Administrator"'
            )

    def test_user_group_least_possible_inheritance_warning(self):
        """ User changes 'Timesheets: User: own timesheets only ' from
        'Timesheets: Administrator'. The warning should be there since
        'Timesheets: User: all timesheets' is at least required when user is
        having 'Project: Administrator'. When user reverts the changes For
        'Timesheets: User: all timesheets', warning should disappear."""
        with Form(self.test_group_user.with_context(show_user_group_warning=True), view='base.view_users_form') as UserForm:
            UserForm[self.timesheets_categ_field] = self.group_timesheets_user_own_timesheet.id
            self.assertEqual(
                UserForm.user_group_warning,
                'Since Test Group User is a/an "Project: Administrator", they will at least obtain the right "Timesheets: User: all timesheets"'
            )

            UserForm[self.timesheets_categ_field] = self.group_timesheets_user_all_timesheet.id
            self.assertFalse(UserForm.user_group_warning)

    def test_user_group_parent_inheritance_no_warning(self):
        """ User changes 'Field Service: User' from 'Field Service: Administrator'.
        The warning should not be there since 'Field Service: User' is not affected
        by any other groups."""
        with Form(self.test_group_user.with_context(show_user_group_warning=True), view='base.view_users_form') as UserForm:
            UserForm[self.field_service_categ_field] = self.group_field_service_user.id
            self.assertFalse(UserForm.user_group_warning)


class TestUsersTweaks(TransactionCase):
    def test_superuser(self):
        """ The superuser is inactive and must remain as such. """
        user = self.env['res.users'].browse(SUPERUSER_ID)
        self.assertFalse(user.active)
        with self.assertRaises(UserError):
            user.write({'active': True})


@tagged('post_install', '-at_install')
class TestUsersIdentitycheck(HttpCase):

    @users('admin')
    def test_revoke_all_devices(self):
        """
        Test to check the revoke all devices by changing the current password as a new password
        """
        # Change the password to 8 characters for security reasons
        self.env.user.password = "admin@cashapp"

        # Create a first session that will be used to revoke other sessions
        session = self.authenticate('admin', 'admin@cashapp')

        # Create a second session that will be used to check it has been revoked
        self.authenticate('admin', 'admin@cashapp')
        # Test the session is valid
        # Valid session -> not redirected from /web to /web/login
        self.assertTrue(self.url_open('/web').url.endswith('/web'))

        # Push a fake request to the request stack, because @check_identity requires a request.
        # Use the first session created above, used to invalid other sessions than itself.
        _request_stack.push(SimpleNamespace(session=session, env=self.env))
        self.addCleanup(_request_stack.pop)
        # The user clicks the button logout from all devices from his profile
        action = self.env.user.action_revoke_all_devices()
        # The form of the check identity wizard opens
        form = Form(self.env[action['res_model']].browse(action['res_id']), action.get('view_id'))
        # The user fills his password
        form.password = 'admin@cashapp'
        # The user clicks the button "Log out from all devices", which triggers a save then a call to the button method
        user_identity_check = form.save()
        action = user_identity_check.run_check()

        # Test the session is no longer valid
        # Invalid session -> redirected from /web to /web/login
        self.assertTrue(self.url_open('/web').url.endswith('/web/login?redirect=%2Fweb%3F'))

        # In addition, the password must have been emptied from the wizard
        self.assertFalse(user_identity_check.password)
