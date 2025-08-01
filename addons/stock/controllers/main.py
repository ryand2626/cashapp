# -*- coding: utf-8 -*-
import werkzeug
from werkzeug.exceptions import InternalServerError

from cashapp import http
from cashapp.http import request
from cashapp.tools.misc import html_escape

import json


class StockReportController(http.Controller):

    @http.route('/stock/<string:output_format>/<string:report_name>', type='http', auth='user')
    def report(self, output_format, report_name=False, **kw):
        uid = request.session.uid
        domain = [('create_uid', '=', uid)]
        stock_traceability = request.env['stock.traceability.report'].with_user(uid).search(domain, limit=1)
        line_data = json.loads(kw['data'])
        try:
            if output_format == 'pdf':
                response = request.make_response(
                    stock_traceability.with_context(active_id=kw['active_id'], active_model=kw['active_model']).get_pdf(line_data),
                    headers=[
                        ('Content-Type', 'application/pdf'),
                        ('Content-Disposition', 'attachment; filename=' + 'stock_traceability' + '.pdf;')
                    ]
                )
                return response
        except Exception as e:
            se = http.serialize_exception(e)
            error = {
                'code': 200,
                'message': 'CashApp Server Error',
                'data': se
            }
            res = request.make_response(html_escape(json.dumps(error)))
            raise InternalServerError(response=res) from e
