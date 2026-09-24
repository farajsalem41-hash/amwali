import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { shapeArabic } from '../utils/arabic';
import { ReportSummary } from './report.service';

const FONT_REGULAR = path.resolve(__dirname, '../../assets/fonts/Amiri-Regular.ttf');
const FONT_BOLD = path.resolve(__dirname, '../../assets/fonts/Amiri-Bold.ttf');

export interface ExportMeta {
  merchantName: string;
  title: string;
  periodLabel: string;
}

export async function buildReportExcel(summary: ReportSummary, meta: ExportMeta): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Amwali';
  const ws = wb.addWorksheet('التقرير', { views: [{ rightToLeft: true }] });

  ws.mergeCells('A1:D1');
  ws.getCell('A1').value = `${meta.merchantName} — ${meta.title}`;
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.mergeCells('A2:D2');
  ws.getCell('A2').value = meta.periodLabel;

  ws.addRow([]);
  ws.addRow(['البند', 'القيمة']).font = { bold: true };
  const t = summary.totals;
  const rows: [string, number][] = [
    ['عدد الطلبات', t.requestsCount],
    ['إجمالي المبالغ', t.totalAmount],
    ['المدفوع', t.paidAmount],
    ['المتبقي', t.remainingAmount],
    ['الخصومات', t.discountsAmount],
    ['المحصل في الفترة', t.collectedInRange],
    ['عدد الدفعات', t.paymentsCount],
    ['مدفوعة كليًا', t.fullyPaidCount],
    ['مدفوعة جزئيًا', t.partialCount],
    ['غير مدفوعة', t.unpaidCount],
  ];
  rows.forEach((r) => ws.addRow(r));

  ws.addRow([]);
  ws.addRow(['الحالة', 'العدد', 'المبلغ']).font = { bold: true };
  summary.byStatus.forEach((s) => ws.addRow([s.status, s.count, s.amount]));

  ws.addRow([]);
  ws.addRow(['التاريخ', 'المحصل', 'عدد الطلبات']).font = { bold: true };
  summary.byDay.forEach((d) => ws.addRow([d.date, d.collected, d.requests]));

  ws.columns.forEach((c) => {
    c.width = 22;
  });

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

function ar(text: string): string {
  return shapeArabic(text);
}

export async function buildReportPdf(summary: ReportSummary, meta: ExportMeta): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 42 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const hasFonts = fs.existsSync(FONT_REGULAR);
      if (hasFonts) {
        doc.registerFont('ar', FONT_REGULAR);
        doc.registerFont('ar-bold', fs.existsSync(FONT_BOLD) ? FONT_BOLD : FONT_REGULAR);
      }
      const regular = hasFonts ? 'ar' : 'Helvetica';
      const bold = hasFonts ? 'ar-bold' : 'Helvetica-Bold';
      const right = { align: 'right' as const, width: doc.page.width - 84 };

      doc.font(bold).fontSize(20).fillColor('#0F2A4A').text(ar(meta.merchantName), right);
      doc.font(regular).fontSize(13).fillColor('#334155').text(ar(meta.title), right);
      doc.fontSize(10).fillColor('#64748B').text(ar(meta.periodLabel), right);
      doc.moveDown(1);
      doc
        .strokeColor('#E2E8F0')
        .lineWidth(1)
        .moveTo(42, doc.y)
        .lineTo(doc.page.width - 42, doc.y)
        .stroke();
      doc.moveDown(0.8);

      const t = summary.totals;
      const lines: [string, string][] = [
        ['عدد الطلبات', String(t.requestsCount)],
        ['إجمالي المبالغ', t.totalAmount.toFixed(2)],
        ['المدفوع', t.paidAmount.toFixed(2)],
        ['المتبقي', t.remainingAmount.toFixed(2)],
        ['الخصومات', t.discountsAmount.toFixed(2)],
        ['المحصل في الفترة', t.collectedInRange.toFixed(2)],
        ['عدد الدفعات', String(t.paymentsCount)],
        ['مدفوعة كليًا', String(t.fullyPaidCount)],
        ['مدفوعة جزئيًا', String(t.partialCount)],
        ['غير مدفوعة', String(t.unpaidCount)],
      ];

      doc.font(bold).fontSize(12).fillColor('#0F2A4A').text(ar('ملخص الفترة'), right);
      doc.moveDown(0.4);
      doc.font(regular).fontSize(11).fillColor('#1E293B');
      for (const [label, value] of lines) {
        const y = doc.y;
        doc.text(ar(label), 42, y, { align: 'right', width: doc.page.width - 84 });
        doc.text(value, 42, y, { align: 'left', width: 200 });
        doc.moveDown(0.35);
      }

      if (summary.byDay.length) {
        doc.moveDown(0.8);
        doc.font(bold).fontSize(12).fillColor('#0F2A4A').text(ar('التحصيل اليومي'), right);
        doc.moveDown(0.3);
        doc.font(regular).fontSize(10).fillColor('#1E293B');
        for (const d of summary.byDay) {
          const y = doc.y;
          // draw each run separately: mixing several Arabic and numeric runs in one
          // string breaks the visual ordering used for PDF output.
          doc.text(d.collected.toFixed(2), 42, y, { align: 'left', width: 140 });
          doc.text(d.date, 42, y, { align: 'center', width: doc.page.width - 84 });
          doc.text(ar(`عدد الطلبات ${d.requests}`), 42, y, {
            align: 'right',
            width: doc.page.width - 84,
          });
          doc.moveDown(0.3);
          if (doc.y > doc.page.height - 70) doc.addPage();
        }
      }

      doc
        .fontSize(8)
        .fillColor('#94A3B8')
        .text(ar('تم إنشاء هذا التقرير بواسطة منصة أموالي'), 42, doc.page.height - 60, {
          align: 'center',
          width: doc.page.width - 84,
        });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
