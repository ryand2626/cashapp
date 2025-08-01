# Part of CashApp. See LICENSE file for full copyright and licensing details.

from cashapp import api, models


class ProductPricelistReport(models.AbstractModel):
    _name = 'report.product.report_pricelist'
    _description = 'Pricelist Report'

    def _get_report_values(self, docids, data):
        return self._get_report_data(data, 'pdf')

    @api.model
    def get_html(self, data):
        render_values = self._get_report_data(data, 'html')
        return self.env['ir.qweb']._render('product.report_pricelist_page', render_values)

    def _get_report_data(self, data, report_type='html'):
        quantities = data.get('quantities', [1])
        data_pricelist_id = data.get('pricelist_id')
        pricelist_id = data_pricelist_id and int(data_pricelist_id)
        pricelist = self.env['product.pricelist'].browse(pricelist_id).exists()
        if not pricelist:
            pricelist = self.env['product.pricelist'].search([], limit=1)

        active_model = data.get('active_model', 'product.template')
        active_ids = data.get('active_ids') or []
        is_product_tmpl = active_model == 'product.template'
        ProductClass = self.env[active_model]

        products = ProductClass.browse(active_ids) if active_ids else []
        products_data = [
            self._get_product_data(is_product_tmpl, product, pricelist, quantities)
            for product in products
        ]

        return {
            'is_html_type': report_type == 'html',
            'is_product_tmpl': is_product_tmpl,
            'display_pricelist_title': data.get('display_pricelist_title', False) and bool(data['display_pricelist_title']),
            'pricelist': pricelist,
            'products': products_data,
            'quantities': quantities,
            'docs': pricelist,
        }

    def _get_product_data(self, is_product_tmpl, product, pricelist, quantities):
        data = {
            'id': product.id,
            'name': is_product_tmpl and product.name or product.display_name,
            'price': dict.fromkeys(quantities, 0.0),
            'uom': product.uom_id.name,
        }
        for qty in quantities:
            data['price'][qty] = pricelist._get_product_price(product, qty)

        if is_product_tmpl and product.product_variant_count > 1:
            data['variants'] = [
                self._get_product_data(False, variant, pricelist, quantities)
                for variant in product.product_variant_ids
            ]

        return data
