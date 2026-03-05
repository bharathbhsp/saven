const { doc, TABLES, requireMember } = require("../db");
const { json, raw, badRequest, forbidden } = require("../responses");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseExportRange(query) {
  const startDate = query && query.startDate;
  const endDate = query && query.endDate;
  if (!startDate || !endDate) return { err: "startDate and endDate (YYYY-MM-DD) are required" };
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) return { err: "startDate and endDate must be YYYY-MM-DD" };
  if (startDate > endDate) return { err: "startDate must be before endDate" };
  return { skStart: `${startDate}#`, skEnd: `${endDate}\uffff` };
}

async function fetchTransactions(groupId, userId, query) {
  const isMember = await requireMember(groupId, userId);
  if (!isMember) return { err: forbidden("Not a member of this group") };
  const range = parseExportRange(query);
  if (range.err) return { err: badRequest(range.err) };
  const req = {
    TableName: TABLES.transactions,
    KeyConditionExpression: "groupId = :gid AND sk BETWEEN :start AND :end",
    ExpressionAttributeValues: { ":gid": groupId, ":start": range.skStart, ":end": range.skEnd },
  };
  const categoryId = query && query.categoryId;
  if (categoryId && categoryId.trim()) {
    req.FilterExpression = "categoryId = :cid";
    req.ExpressionAttributeValues[":cid"] = categoryId.trim();
  }
  const r = await doc.query(req).promise();
  return { transactions: r.Items || [] };
}

function csvEscape(s) {
  if (s == null) return "";
  const t = String(s);
  if (/[",\n\r]/.test(t)) return '"' + t.replace(/"/g, '""') + '"';
  return t;
}

async function csv(params, body, userId, query) {
  const { groupId } = params;
  const result = await fetchTransactions(groupId, userId, query);
  if (result.err) return result.err;
  const rows = result.transactions;
  const header = "Date,Amount,Category ID,Note\n";
  const bodyRows = rows.map((t) => [t.date, t.amount, t.categoryId || "", t.note || ""].map(csvEscape).join(",")).join("\n");
  const csvBody = header + bodyRows;
  const filename = `saven-export-${params.groupId}-${query.startDate || "range"}.csv`;
  return raw(200, csvBody, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
}

async function pdf(params, body, userId, query) {
  const { groupId } = params;
  const result = await fetchTransactions(groupId, userId, query);
  if (result.err) return result.err;
  const rows = result.transactions;
  let PDFDocument;
  try {
    PDFDocument = require("pdfkit");
  } catch (e) {
    console.error("pdfkit not installed", e);
    return json(501, { error: "NotImplemented", message: "PDF export not available" });
  }
  const docPdf = new PDFDocument({ margin: 50 });
  const chunks = [];
  docPdf.on("data", (chunk) => chunks.push(chunk));
  docPdf.on("end", () => {});
  docPdf.fontSize(16).text("Saven – Transaction export", { continued: false });
  docPdf.fontSize(10).text(`Group: ${groupId}  |  ${query.startDate || ""} to ${query.endDate || ""}`, { continued: false });
  docPdf.moveDown();
  docPdf.fontSize(10);
  const tableTop = docPdf.y;
  docPdf.text("Date", 50, tableTop);
  docPdf.text("Amount", 150, tableTop);
  docPdf.text("Category", 250, tableTop);
  docPdf.text("Note", 350, tableTop);
  let y = tableTop + 15;
  for (const t of rows) {
    docPdf.text(t.date || "", 50, y);
    docPdf.text(String(t.amount ?? ""), 150, y);
    docPdf.text((t.categoryId || "").slice(0, 20), 250, y);
    docPdf.text((t.note || "").slice(0, 30), 350, y);
    y += 14;
    if (y > 700) {
      docPdf.addPage();
      y = 50;
    }
  }
  docPdf.end();

  const buffer = await new Promise((resolve, reject) => {
    docPdf.on("end", () => resolve(Buffer.concat(chunks)));
    docPdf.on("error", reject);
  });
  const filename = `saven-export-${groupId}-${query.startDate || "range"}.pdf`;
  return raw(200, buffer, {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
}

module.exports = { csv, pdf };
