# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

from collections import defaultdict
from dateutil.relativedelta import relativedelta

from cashapp import api, fields, models, _
from cashapp.exceptions import UserError
from cashapp.addons.fleet.models.fleet_vehicle_model import FUEL_TYPES


#Some fields don't have the exact same name
MODEL_FIELDS_TO_VEHICLE = {
    'transmission': 'transmission', 'model_year': 'model_year', 'electric_assistance': 'electric_assistance',
    'color': 'color', 'seats': 'seats', 'doors': 'doors', 'trailer_hook': 'trailer_hook',
    'default_co2': 'co2', 'co2_standard': 'co2_standard', 'default_fuel_type': 'fuel_type',
    'power': 'power', 'horsepower': 'horsepower', 'horsepower_tax': 'horsepower_tax', 'category_id': 'category_id',
    'vehicle_range': 'vehicle_range', 'power_unit': 'power_unit'
}

class FleetVehicle(models.Model):
    _inherit = ['mail.thread', 'mail.activity.mixin', 'avatar.mixin']
    _name = 'fleet.vehicle'
    _description = 'Vehicle'
    _order = 'license_plate asc, acquisition_date asc'
    _rec_names_search = ['name', 'driver_id.name']

    def _get_default_state(self):
        state = self.env.ref('fleet.fleet_vehicle_state_new_request', raise_if_not_found=False)
        return state if state and state.id else False

    name = fields.Char(compute="_compute_vehicle_name", store=True)
    description = fields.Html("Vehicle Description")
    active = fields.Boolean('Active', default=True, tracking=True)
    manager_id = fields.Many2one(
        'res.users', 'Fleet Manager',
        domain=lambda self: [('groups_id', 'in', self.env.ref('fleet.fleet_group_manager').id), ('company_id', 'in', self.env.companies.ids)],
    )
    company_id = fields.Many2one(
        'res.company', 'Company',
        default=lambda self: self.env.company,
    )
    currency_id = fields.Many2one('res.currency', related='company_id.currency_id')
    country_id = fields.Many2one('res.country', related='company_id.country_id')
    country_code = fields.Char(related='country_id.code', depends=['country_id'])
    license_plate = fields.Char(tracking=True,
        help='License plate number of the vehicle (i = plate number for a car)')
    vin_sn = fields.Char('Chassis Number', help='Unique number written on the vehicle motor (VIN/SN number)', tracking=True, copy=False)
    trailer_hook = fields.Boolean(default=False, string='Trailer Hitch', compute='_compute_model_fields', store=True, readonly=False)
    driver_id = fields.Many2one('res.partner', 'Driver', tracking=True, help='Driver address of the vehicle', copy=False)
    future_driver_id = fields.Many2one('res.partner', 'Future Driver', tracking=True, help='Next Driver Address of the vehicle', copy=False, check_company=True)
    model_id = fields.Many2one('fleet.vehicle.model', 'Model',
        tracking=True, required=True)
    brand_id = fields.Many2one('fleet.vehicle.model.brand', 'Brand', related="model_id.brand_id", store=True, readonly=False)
    log_drivers = fields.One2many('fleet.vehicle.assignation.log', 'vehicle_id', string='Assignment Logs')
    log_services = fields.One2many('fleet.vehicle.log.services', 'vehicle_id', 'Services Logs')
    log_contracts = fields.One2many('fleet.vehicle.log.contract', 'vehicle_id', 'Contracts')
    contract_count = fields.Integer(compute="_compute_count_all", string='Contract Count')
    service_count = fields.Integer(compute="_compute_count_all", string='Services')
    odometer_count = fields.Integer(compute="_compute_count_all", string='Odometer')
    history_count = fields.Integer(compute="_compute_count_all", string="Drivers History Count")
    next_assignation_date = fields.Date('Assignment Date', help='This is the date at which the car will be available, if not set it means available instantly')
    order_date = fields.Date('Order Date')
    acquisition_date = fields.Date('Registration Date', required=False,
        default=fields.Date.today, tracking=True,
        help='Date of vehicle registration')
    write_off_date = fields.Date('Cancellation Date', tracking=True, help="Date when the vehicle's license plate has been cancelled/removed.")
    first_contract_date = fields.Date(string="First Contract Date", default=fields.Date.today, tracking=True)
    color = fields.Char(help='Color of the vehicle', compute='_compute_model_fields', store=True, readonly=False)
    state_id = fields.Many2one('fleet.vehicle.state', 'State',
        default=_get_default_state, group_expand='_read_group_expand_full',
        tracking=True,
        help='Current state of the vehicle', ondelete="set null")
    location = fields.Char(help='Location of the vehicle (garage, ...)')
    seats = fields.Integer('Seats Number', help='Number of seats of the vehicle', compute='_compute_model_fields', store=True, readonly=False)
    model_year = fields.Char('Model Year', help='Year of the model', compute='_compute_model_fields', store=True, readonly=False)
    doors = fields.Integer('Doors Number', help='Number of doors of the vehicle', compute='_compute_model_fields', store=True, readonly=False)
    tag_ids = fields.Many2many('fleet.vehicle.tag', 'fleet_vehicle_vehicle_tag_rel', 'vehicle_tag_id', 'tag_id', 'Tags', copy=False)
    odometer = fields.Float(compute='_get_odometer', inverse='_set_odometer', string='Last Odometer',
        help='Odometer measure of the vehicle at the moment of this log')
    odometer_unit = fields.Selection([
        ('kilometers', 'km'),
        ('miles', 'mi')
        ], 'Odometer Unit', default='kilometers', required=True)
    transmission = fields.Selection(
        [('manual', 'Manual'), ('automatic', 'Automatic')], 'Transmission',
        compute='_compute_model_fields', store=True, readonly=False)
    fuel_type = fields.Selection(FUEL_TYPES, 'Fuel Type', compute='_compute_model_fields', store=True, readonly=False)
    power_unit = fields.Selection([
        ('power', 'kW'),
        ('horsepower', 'Horsepower')
        ], 'Power Unit', default='power', required=True)
    horsepower = fields.Integer(compute='_compute_model_fields', store=True, readonly=False)
    horsepower_tax = fields.Float('Horsepower Taxation', compute='_compute_model_fields', store=True, readonly=False)
    power = fields.Integer('Power', help='Power in kW of the vehicle', compute='_compute_model_fields', store=True, readonly=False)
    co2 = fields.Float('CO2 Emissions', help='CO2 emissions of the vehicle', compute='_compute_model_fields', store=True, readonly=False, tracking=True, aggregator=None)
    co2_standard = fields.Char('CO2 Standard', compute='_compute_model_fields', store=True, readonly=False)
    category_id = fields.Many2one('fleet.vehicle.model.category', 'Category', compute='_compute_model_fields', store=True, readonly=False)
    image_128 = fields.Image(related='model_id.image_128', readonly=True)
    contract_renewal_due_soon = fields.Boolean(compute='_compute_contract_reminder', search='_search_contract_renewal_due_soon',
        string='Has Contracts to renew')
    contract_renewal_overdue = fields.Boolean(compute='_compute_contract_reminder', search='_search_get_overdue_contract_reminder',
        string='Has Contracts Overdue')
    contract_state = fields.Selection(
        [('futur', 'Incoming'),
         ('open', 'In Progress'),
         ('expired', 'Expired'),
         ('closed', 'Closed')
        ], string='Last Contract State', compute='_compute_contract_reminder', required=False)
    car_value = fields.Float(string="Catalog Value (VAT Incl.)", tracking=True)
    net_car_value = fields.Float(string="Purchase Value")
    residual_value = fields.Float()
    plan_to_change_car = fields.Boolean(related='driver_id.plan_to_change_car', store=True, readonly=False)
    plan_to_change_bike = fields.Boolean(related='driver_id.plan_to_change_bike', store=True, readonly=False)
    vehicle_type = fields.Selection(related='model_id.vehicle_type')
    frame_type = fields.Selection([('diamant', 'Diamant'), ('trapez', 'Trapez'), ('wave', 'Wave')], string="Bike Frame Type")
    electric_assistance = fields.Boolean(compute='_compute_model_fields', store=True, readonly=False)
    frame_size = fields.Float()
    service_activity = fields.Selection([
        ('none', 'None'),
        ('overdue', 'Overdue'),
        ('today', 'Today'),
    ], compute='_compute_service_activity')
    vehicle_properties = fields.Properties('Properties', definition='model_id.vehicle_properties_definition', copy=True)
    vehicle_range = fields.Integer(string="Range")

    @api.depends('log_services')
    def _compute_service_activity(self):
        for vehicle in self:
            activities_state = set(state for state in vehicle.log_services.mapped('activity_state') if state and state != 'planned')
            vehicle.service_activity = sorted(activities_state)[0] if activities_state else 'none'

    @api.depends('model_id')
    def _compute_model_fields(self):
        '''
        Copies all the related fields from the model to the vehicle
        '''
        model_values = dict()
        for vehicle in self.filtered('model_id'):
            if vehicle.model_id.id in model_values:
                write_vals = model_values[vehicle.model_id.id]
            else:
                # copy if value is truthy
                write_vals = {MODEL_FIELDS_TO_VEHICLE[key]: vehicle.model_id[key] for key in MODEL_FIELDS_TO_VEHICLE\
                    if vehicle.model_id[key]}
                model_values[vehicle.model_id.id] = write_vals
            vehicle.update(write_vals)

    @api.depends('model_id.brand_id.name', 'model_id.name', 'license_plate')
    def _compute_vehicle_name(self):
        for record in self:
            record.name = (record.model_id.brand_id.name or '') + '/' + (record.model_id.name or '') + '/' + (record.license_plate or _('No Plate'))

    def _get_odometer(self):
        FleetVehicalOdometer = self.env['fleet.vehicle.odometer']
        for record in self:
            vehicle_odometer = FleetVehicalOdometer.search([('vehicle_id', '=', record.id)], limit=1, order='value desc')
            if vehicle_odometer:
                record.odometer = vehicle_odometer.value
            else:
                record.odometer = 0

    def _set_odometer(self):
        for record in self:
            if record.odometer:
                date = fields.Date.context_today(record)
                data = {'value': record.odometer, 'date': date, 'vehicle_id': record.id}
                self.env['fleet.vehicle.odometer'].create(data)

    def _compute_count_all(self):
        Odometer = self.env['fleet.vehicle.odometer']
        LogService = self.env['fleet.vehicle.log.services'].with_context(active_test=False)
        LogContract = self.env['fleet.vehicle.log.contract'].with_context(active_test=False)
        History = self.env['fleet.vehicle.assignation.log']
        odometers_data = Odometer._read_group([('vehicle_id', 'in', self.ids)], ['vehicle_id'], ['__count'])
        services_data = LogService._read_group([('vehicle_id', 'in', self.ids)], ['vehicle_id', 'active'], ['__count'])
        logs_data = LogContract._read_group([('vehicle_id', 'in', self.ids), ('state', '!=', 'closed')], ['vehicle_id', 'active'], ['__count'])
        histories_data = History._read_group([('vehicle_id', 'in', self.ids)], ['vehicle_id'], ['__count'])

        mapped_odometer_data = defaultdict(lambda: 0)
        mapped_service_data = defaultdict(lambda: defaultdict(lambda: 0))
        mapped_log_data = defaultdict(lambda: defaultdict(lambda: 0))
        mapped_history_data = defaultdict(lambda: 0)

        for vehicle, count in odometers_data:
            mapped_odometer_data[vehicle.id] = count
        for vehicle, active, count in services_data:
            mapped_service_data[vehicle.id][active] = count
        for vehicle, active, count in logs_data:
            mapped_log_data[vehicle.id][active] = count
        for vehicle, count in histories_data:
            mapped_history_data[vehicle.id] = count

        for vehicle in self:
            vehicle.odometer_count = mapped_odometer_data[vehicle.id]
            vehicle.service_count = mapped_service_data[vehicle.id][vehicle.active]
            vehicle.contract_count = mapped_log_data[vehicle.id][vehicle.active]
            vehicle.history_count = mapped_history_data[vehicle.id]

    @api.depends('log_contracts')
    def _compute_contract_reminder(self):
        params = self.env['ir.config_parameter'].sudo()
        delay_alert_contract = int(params.get_param('hr_fleet.delay_alert_contract', default=30))
        current_date = fields.Date.context_today(self)
        data = self.env['fleet.vehicle.log.contract']._read_group(
            domain=[('expiration_date', '!=', False), ('vehicle_id', 'in', self.ids), ('state', '!=', 'closed')],
            groupby=['vehicle_id', 'state'],
            aggregates=['expiration_date:max'])

        prepared_data = {}
        for vehicle_id, state, expiration_date in data:
            if prepared_data.get(vehicle_id.id):
                if prepared_data[vehicle_id.id]['expiration_date'] < expiration_date:
                    prepared_data[vehicle_id.id]['expiration_date'] = expiration_date
                    prepared_data[vehicle_id.id]['state'] = state
            else:
                prepared_data[vehicle_id.id] = {
                    'state': state,
                    'expiration_date': expiration_date,
                }

        for record in self:
            vehicle_data = prepared_data.get(record.id)
            if vehicle_data:
                diff_time = (vehicle_data['expiration_date'] - current_date).days
                record.contract_renewal_overdue = diff_time < 0
                record.contract_renewal_due_soon = not record.contract_renewal_overdue and (diff_time < delay_alert_contract)
                record.contract_state = vehicle_data['state']
            else:
                record.contract_renewal_overdue = False
                record.contract_renewal_due_soon = False
                record.contract_state = ""

    def _get_analytic_name(self):
        # This function is used in fleet_account and is overrided in l10n_be_hr_payroll_fleet
        return self.license_plate or _('No plate')

    def _search_contract_renewal_due_soon(self, operator, value):
        params = self.env['ir.config_parameter'].sudo()
        delay_alert_contract = int(params.get_param('hr_fleet.delay_alert_contract', default=30))
        res = []
        assert operator in ('=', '!=', '<>') and value in (True, False), 'Operation not supported'
        if (operator == '=' and value is True) or (operator in ('<>', '!=') and value is False):
            search_operator = 'in'
        else:
            search_operator = 'not in'
        today = fields.Date.context_today(self)
        datetime_today = fields.Datetime.from_string(today)
        limit_date = fields.Datetime.to_string(datetime_today + relativedelta(days=+delay_alert_contract))
        res_ids = self.env['fleet.vehicle.log.contract'].search([
            ('expiration_date', '>', today),
            ('expiration_date', '<', limit_date),
            ('state', 'in', ['open', 'expired'])
        ]).mapped('vehicle_id').ids
        res.append(('id', search_operator, res_ids))
        return res

    def _search_get_overdue_contract_reminder(self, operator, value):
        res = []
        assert operator in ('=', '!=', '<>') and value in (True, False), 'Operation not supported'
        if (operator == '=' and value is True) or (operator in ('<>', '!=') and value is False):
            search_operator = 'in'
        else:
            search_operator = 'not in'
        today = fields.Date.context_today(self)
        # get the id of vehicles that have overdue contracts
        # but exclude those for which a new contract has already been created for them
        vehicle_ids = self.env['fleet.vehicle']._search([
            ("log_contracts", "any", [
                ('expiration_date', '!=', False),
                ('expiration_date', '<', today),
                ('state', 'in', ['open', 'expired'])
            ]),
            "!",
                ("log_contracts", "any", [
                    ('expiration_date', '!=', False),
                    ('expiration_date', '>=', today),
                    ('state', 'in', ['open', 'futur'])
                ]),
        ])
        res.append(('id', search_operator, vehicle_ids))
        return res

    def _clean_vals_internal_user(self, vals):
        # Fleet administrator may not have rights to write on partner
        # related fields when the driver_id is a res.user.
        # This trick is used to prevent access right error.
        su_vals = {}
        if self.env.su:
            return su_vals
        if 'plan_to_change_car' in vals:
            su_vals['plan_to_change_car'] = vals.pop('plan_to_change_car')
        if 'plan_to_change_bike' in vals:
            su_vals['plan_to_change_bike'] = vals.pop('plan_to_change_bike')
        return su_vals

    @api.model_create_multi
    def create(self, vals_list):
        ptc_values = [self._clean_vals_internal_user(vals) for vals in vals_list]
        vehicles = super().create(vals_list)
        for vehicle, vals, ptc_value in zip(vehicles, vals_list, ptc_values):
            if ptc_value:
                vehicle.sudo().write(ptc_value)
            if 'driver_id' in vals and vals['driver_id']:
                vehicle.create_driver_history(vals)
            if 'future_driver_id' in vals and vals['future_driver_id']:
                state_waiting_list = self.env.ref('fleet.fleet_vehicle_state_waiting_list', raise_if_not_found=False)
                states = vehicle.mapped('state_id').ids
                if not state_waiting_list or state_waiting_list.id not in states:
                    future_driver = self.env['res.partner'].browse(vals['future_driver_id'])
                    if self.vehicle_type == 'bike':
                        future_driver.sudo().write({'plan_to_change_bike': True})
                    if self.vehicle_type == 'car':
                        future_driver.sudo().write({'plan_to_change_car': True})
        return vehicles

    def write(self, vals):
        if 'odometer' in vals and any(vehicle.odometer > vals['odometer'] for vehicle in self):
            raise UserError(_('The odometer value cannot be lower than the previous one.'))

        if 'driver_id' in vals and vals['driver_id']:
            driver_id = vals['driver_id']
            for vehicle in self.filtered(lambda v: v.driver_id.id != driver_id):
                vehicle.create_driver_history(vals)
                if vehicle.driver_id:
                    vehicle.activity_schedule(
                        'mail.mail_activity_data_todo',
                        user_id=vehicle.manager_id.id or self.env.user.id,
                        note=_('Specify the End date of %s', vehicle.driver_id.name))

        if 'future_driver_id' in vals and vals['future_driver_id']:
            state_waiting_list = self.env.ref('fleet.fleet_vehicle_state_waiting_list', raise_if_not_found=False)
            states = self.mapped('state_id').ids if 'state_id' not in vals else [vals['state_id']]
            if not state_waiting_list or state_waiting_list.id not in states:
                future_driver = self.env['res.partner'].browse(vals['future_driver_id'])
                if self.vehicle_type == 'bike':
                    future_driver.sudo().write({'plan_to_change_bike': True})
                if self.vehicle_type == 'car':
                    future_driver.sudo().write({'plan_to_change_car': True})

        if 'active' in vals and not vals['active']:
            self.env['fleet.vehicle.log.contract'].search([('vehicle_id', 'in', self.ids)]).active = False
            self.env['fleet.vehicle.log.services'].search([('vehicle_id', 'in', self.ids)]).active = False

        su_vals = self._clean_vals_internal_user(vals)
        if su_vals:
            self.sudo().write(su_vals)
        res = super(FleetVehicle, self).write(vals)
        return res

    def _get_driver_history_data(self, vals):
        self.ensure_one()
        return {
            'vehicle_id': self.id,
            'driver_id': vals['driver_id'],
            'date_start': fields.Date.today(),
        }

    def create_driver_history(self, vals):
        for vehicle in self:
            self.env['fleet.vehicle.assignation.log'].create(
                vehicle._get_driver_history_data(vals),
            )

    def action_accept_driver_change(self):
        # Find all the vehicles of the same type for which the driver is the future_driver_id
        # remove their driver_id and close their history using current date
        vehicles = self.search([('driver_id', 'in', self.mapped('future_driver_id').ids), ('vehicle_type', '=', self.vehicle_type)])
        vehicles.write({'driver_id': False})

        for vehicle in self:
            if vehicle.vehicle_type == 'bike':
                vehicle.future_driver_id.sudo().write({'plan_to_change_bike': False})
            if vehicle.vehicle_type == 'car':
                vehicle.future_driver_id.sudo().write({'plan_to_change_car': False})
            vehicle.driver_id = vehicle.future_driver_id
            vehicle.future_driver_id = False

    def return_action_to_open(self):
        """ This opens the xml view specified in xml_id for the current vehicle """
        self.ensure_one()
        xml_id = self.env.context.get('xml_id')
        if xml_id:

            res = self.env['ir.actions.act_window']._for_xml_id('fleet.%s' % xml_id)
            res.update(
                context=dict(self.env.context, default_vehicle_id=self.id, group_by=False),
                domain=[('vehicle_id', '=', self.id)]
            )
            return res
        return False

    def act_show_log_cost(self):
        """ This opens log view to view and add new log for this vehicle, groupby default to only show effective costs
            @return: the costs log view
        """
        self.ensure_one()
        copy_context = dict(self.env.context)
        copy_context.pop('group_by', None)
        res = self.env['ir.actions.act_window']._for_xml_id('fleet.fleet_vehicle_costs_action')
        res.update(
            context=dict(copy_context, default_vehicle_id=self.id, search_default_parent_false=True),
            domain=[('vehicle_id', '=', self.id)]
        )
        return res

    def _track_subtype(self, init_values):
        self.ensure_one()
        if 'driver_id' in init_values or 'future_driver_id' in init_values:
            return self.env.ref('fleet.mt_fleet_driver_updated')
        return super(FleetVehicle, self)._track_subtype(init_values)

    def open_assignation_logs(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Assignment Logs',
            'view_mode': 'list',
            'res_model': 'fleet.vehicle.assignation.log',
            'domain': [('vehicle_id', '=', self.id)],
            'context': {'default_driver_id': self.driver_id.id, 'default_vehicle_id': self.id}
        }

    def action_send_email(self):
        return {
            'name': _('Send Email'),
            'type': 'ir.actions.act_window',
            'target': 'new',
            'view_mode': 'form',
            'res_model': 'fleet.vehicle.send.mail',
            'context': {
                'default_vehicle_ids': self.ids,
            }
        }
