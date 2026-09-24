import { Request, Response } from 'express';
import { Merchant } from '../models';
import { merchantScope, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/async';
import { ApiError } from '../utils/errors';
import {
  resolveRange,
  buildSummary,
  buildBranchBreakdown,
  buildEmployeeBreakdown,
  buildSellerReport,
  buildInvoiceBreakdown,
  ReportPeriod,
} from '../services/report.service';
import { buildReportExcel, buildReportPdf } from '../services/export.service';
import { audit } from '../services/audit.service';

function parseRange(req: Request) {
  const period = (String(req.query.period || 'monthly') as ReportPeriod);
  if (!['daily', 'weekly', 'monthly', 'custom'].includes(period)) throw ApiError.badRequest('الفترة غير صالحة');
  return resolveRange(period, req.query.from as string | undefined, req.query.to as string | undefined);
}

function periodLabel(range: { from: Date; to: Date }): string {
  const f = (d: Date) => d.toISOString().slice(0, 10);
  return `من ${f(range.from)} إلى ${f(range.to)}`;
}

export const getSummaryReport = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const auth = requireAuth(req);
  const range = parseRange(req);
  const summary = await buildSummary(scope.merchantId, range);

  const extras: Record<string, unknown> = {};
  extras.branches = await buildBranchBreakdown(scope.merchantId, range);
  extras.employees = await buildEmployeeBreakdown(scope.merchantId, range);
  if (auth.accountType === 'online_seller') extras.seller = await buildSellerReport(scope.merchantId, range);
  if (auth.accountType === 'company') extras.invoices = await buildInvoiceBreakdown(scope.merchantId, range);

  res.json({ summary, ...extras, periodLabel: periodLabel(range) });
});

export const exportReport = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const range = parseRange(req);
  const format = String(req.params.format || 'excel');
  const [summary, merchant] = await Promise.all([
    buildSummary(scope.merchantId, range),
    Merchant.findById(scope.merchantId).select('businessName'),
  ]);
  const meta = {
    merchantName: merchant?.businessName || 'أموالي',
    title: 'تقرير المدفوعات',
    periodLabel: periodLabel(range),
  };
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'pdf') {
    const buf = await buildReportPdf(summary, meta);
    await audit(req, { action: 'report.exported', resource: 'report', metadata: { format: 'pdf' } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="amwali-report-${stamp}.pdf"`);
    return res.end(buf);
  }
  if (format === 'excel') {
    const buf = await buildReportExcel(summary, meta);
    await audit(req, { action: 'report.exported', resource: 'report', metadata: { format: 'excel' } });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="amwali-report-${stamp}.xlsx"`);
    return res.end(buf);
  }
  throw ApiError.badRequest('صيغة التصدير غير مدعومة');
});
